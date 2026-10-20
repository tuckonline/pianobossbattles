import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {build} from 'esbuild';

const out=resolve('../../work/cinematic-restore');
const originals={v10:'6e8a8c6842b19be96ae950840eeef4a9c7922a21',v11:'539c89796543a91834941cb97b73fd86830ed838'};
const bundles=new Map<string,{js:Uint8Array;css:Uint8Array}>();
test.use({viewport:{width:1920,height:634},trace:'off'});

test.beforeAll(async()=>{
  await mkdir(out,{recursive:true});
  for(const version of ['v10','v11','restored'] as const){
    const dir=join(out,version);await mkdir(dir,{recursive:true});
    let ui=resolve('hosted/battle-cinematic-ui.tsx');
    if(version!=='restored'){
      // Compile the exact Git renderer as an independent visual reference.
      for(const name of ['battle-cinematic-ui.tsx','battle-cinematic.ts','battle-cinematic.css',...(version==='v11'?['cinematic-choreography.ts']:[])]){
        let source=execFileSync('git',['show',`${originals[version]}:hosted/${name}`],{encoding:'utf8'});
        if(name==='battle-cinematic-ui.tsx')source=source.replace("'./battle-animation-player'",JSON.stringify(resolve('hosted/battle-animation-player.tsx')));
        await writeFile(join(dir,name),source);
      }
      ui=join(dir,'battle-cinematic-ui.tsx');
    }
    const entry=join(dir,'entry.tsx');
    await writeFile(entry,`
      import React from 'react'; import {createRoot} from 'react-dom/client';
      import {BattleCinematicOverlay} from ${JSON.stringify(ui)};
      const params=new URL(location.href).searchParams;
      const result=params.get('result'),time=Number(params.get('time'));
      await Promise.all(['hero-finish.png','hero-defeated.png','boss-dominant.png','boss-fallen.png'].map(async name=>{
        const img=new Image();img.src='/battle/cinematics/'+name;await img.decode();
      }));
      createRoot(document.getElementById('root')).render(<BattleCinematicOverlay atMs={time} playback={{
        id:'visual-reference',attemptId:'preview',exerciseId:2001,result,mode:'survival',startedAt:0,resultAt:0,
        settings:{enabled:true,practice:true,intensity:'high',durationMultiplier:1,audioEnabled:false,autoDismiss:false,showStats:true,reducedMotion:'never'},
        reducedMotion:false,stats:{playerHp:26,bossHp:result==='victory'?0:20,bossMaxHp:66,mistakes:2,bestCombo:26,progress:70}
      }}/>);
    `);
    const built=await build({entryPoints:[entry],bundle:true,format:'esm',platform:'browser',target:'es2022',jsx:'automatic',write:false,outdir:join(dir,'build'),nodePaths:[resolve('node_modules')],logLevel:'silent'});
    bundles.set(version,{js:built.outputFiles.find(f=>f.path.endsWith('.js'))!.contents,css:built.outputFiles.find(f=>f.path.endsWith('.css'))!.contents});
  }
});

for(const [result,reference,times,finalFrame] of [
  ['victory','v10',[750,1350,1900,2800,4399],4399],
  ['defeat','v10',[600,1075,1550,2300,3699],3699],
  ['timeout','v11',[300,500,600,1050,2749,3100],3100],
] as const)test(`${result} matches the exact original renderer and retains that composition when held`,async({page})=>{
  test.setTimeout(90000);
  const id=`visual-restore-${crypto.randomUUID()}`;
  await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  await page.route('**/__cinematic-parity**',async route=>{
    const url=new URL(route.request().url()),bundle=bundles.get(url.searchParams.get('version')!)!;
    if(url.pathname.endsWith('.js'))return route.fulfill({contentType:'text/javascript',body:Buffer.from(bundle.js)});
    if(url.pathname.endsWith('.css'))return route.fulfill({contentType:'text/css',body:Buffer.from(bundle.css)});
    const version=url.searchParams.get('version');
    await route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><link rel="stylesheet" href="/__cinematic-parity.css?version=${version}"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}#root{position:relative}</style></head><body><div id="root"></div><script type="module" src="/__cinematic-parity.js?version=${version}"></script></body></html>`});
  });
  const capture=async(version:string,time:number,heldReference=false)=>{
    await page.goto(`/__cinematic-parity?version=${version}&result=${result}&time=${time}`);
    await expect(page.locator('.battle-cinematic')).toHaveAttribute('data-fallback','false');
    await expect(page.locator('.battle-cinematic')).toHaveCSS('opacity','1');
    // V10 had no holding phase. Apply only V11's idle compositor hint to its
    // final frame; otherwise different GPU text/edge rasterization changes
    // pixels despite identical geometry. No artwork, styles or timing change.
    if(heldReference)await page.addStyleTag({content:'.battle-cinematic,.battle-cinematic *{will-change:auto}'});
    return page.screenshot({path:join(out,`${result}-${version}-${time}${heldReference?'-held-reference':''}.png`)});
  };
  for(const time of times){
    const original=await capture(reference,time),restored=await capture('restored',time);
    expect(restored.equals(original),`${result} at ${time}ms must be pixel-identical to ${reference}`).toBe(true);
  }
  const original=await capture(reference,finalFrame,reference==='v10'),held=await capture('restored',86400000);
  await expect(page.locator('.battle-cinematic')).toHaveAttribute('data-phase','holding');
  expect(held.equals(original),`${result} held composition must match its final original frame`).toBe(true);
});
