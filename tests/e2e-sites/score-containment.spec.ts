import {test,expect,type Page} from '@playwright/test';
import {defaultGameSettings} from '../../hosted/game-core';
import {battleView,createBattle} from '../../hosted/boss-battle';
import {defaultBossBattleConfig} from '../../hosted/boss-config';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
const origin='http://127.0.0.1:8787';
// Use the PNG decoder already bundled with our browser test tooling.
const require=createRequire(import.meta.url);
const {PNG}=require(join(dirname(require.resolve('playwright-core/package.json')),'lib/utilsBundle.js')) as {
  PNG:{sync:{read(buffer:Buffer):{width:number;height:number;data:Buffer}}};
};
function sameInk(a:Buffer,b:Buffer){
  const first=PNG.sync.read(a),second=PNG.sync.read(b);
  if(first.width!==second.width||first.height!==second.height)return false;
  // Repainting an SVG brace can change edge antialiasing by a few RGB units.
  // Allow that only; clipped black notation against white differs by 255.
  return first.data.every((value,i)=>Math.abs(value-second.data[i])<=16);
}

async function scoreClip(page:Page){
  const b=(await page.locator('.sight-score').boundingBox())!,x=Math.ceil(b.x)+1,y=Math.ceil(b.y)+1;
  // Exclude the fractional shared edge with the animated battle canvas.
  return {x,y,width:Math.floor(b.x+b.width)-x-1,height:Math.floor(b.y+b.height)-y-1};
}

async function start(page:Page){
  const id=`score-ink-${crypto.randomUUID()}`,sourceId=crypto.randomUUID();let sequence=0;
  await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  await page.request.post('/api/platform',{headers:{origin},data:{action:'gameState'}});
  return async(exerciseNumber:number,enabled:boolean,measure=1)=>{
    const response=await page.request.post('/api/platform',{headers:{origin},data:{action:'practiceExercise',exerciseNumber}}),exercise=await response.json();
    const config={...defaultBossBattleConfig,enabled};
    const settings={...defaultGameSettings,bossBattle:config};
    await page.request.post('/api/platform',{headers:{origin},data:{action:'gameSettings',settings}});
    const r=await page.request.post('/api/obs',{headers:{origin},data:{sourceId,sequence:++sequence,claim:true,snapshot:{exerciseNumber,title:exercise.title,hand:'both',status:'ready',accuracy:null,mistakes:0,measure,totalMeasures:exercise.right.length,
      game:{sessionId:'ink',preview:false,settings,alerts:[],live:{attemptId:'ink',sessionId:'ink',combo:0,best:0,correct:0,incorrect:0,provisionalXP:0,status:'ready',sequence},battle:battleView(createBattle(config,66))}}}});
    expect(r.ok()).toBe(true);return exercise;
  };
}

async function assertPaintContained(page:Page){
  await expect.poll(()=>page.locator('.notation .system').evaluateAll(systems=>{
    const area=document.querySelector('.sight-score')!.getBoundingClientRect();
    const shapes=systems.filter(n=>getComputedStyle(n).visibility==='visible').flatMap(s=>[...s.querySelectorAll('use,path,text,line,polygon,polyline,rect,circle,ellipse')]).filter(n=>!n.closest('defs,clipPath,mask'));
    return Math.max(...shapes.map(n=>n.getBoundingClientRect()).filter(b=>b.width||b.height).map(b=>Math.max(area.top+23-b.top,b.bottom-area.bottom+23,area.left+23-b.left,b.right-area.right+23)));
  })).toBeLessThanOrEqual(.5);
  // Bounding boxes alone cannot detect nested SVG clipping: a clipped glyph
  // still reports its complete rectangle. Check the actual pixels too.
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  const clip=await scoreClip(page);
  const actual=await page.screenshot({clip});
  const override=await page.addStyleTag({content:'.notation svg{overflow:visible!important;}'});
  const withoutInternalClips=await page.screenshot({clip});
  if(!sameInk(actual,withoutInternalClips)){
    await test.info().attach('actual-score',{body:actual,contentType:'image/png'});
    await test.info().attach('unclipped-score',{body:withoutInternalClips,contentType:'image/png'});
  }
  expect(sameInk(actual,withoutInternalClips),'rendered pixels must match the complete unclipped notation').toBe(true);
  await override.evaluate(n=>n.parentNode?.removeChild(n));
}

test('Schmitt 1 keeps both complete staves and bottom beams at every recording height',async({page})=>{
  test.setTimeout(120000);const publish=await start(page);
  await publish(2001,false);await page.goto('/obs/recording');
  await expect(page.locator('[data-broadcast-ready=true]')).toBeVisible();
  for(const size of [{width:1920,height:440},{width:1920,height:600},{width:1920,height:750},{width:1920,height:1000},{width:1280,height:540}]){
    await page.setViewportSize(size);
    for(const enabled of [false,true]){
      await publish(2001,enabled);await expect(page.locator('.boss-battle-panel')).toHaveCount(enabled?1:0);
      await assertPaintContained(page);
      expect(await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}))).toEqual(size);
      if(size.width===1920&&[750,1000].includes(size.height)){
        await expect(page.locator('[data-asset-status=ready]')).toHaveCount(enabled?2:0);
        await page.screenshot({path:`../../work/schmitt-fixed-${size.height}-${enabled?'boss':'standard'}.png`});
      }
      if(size.height===1000&&enabled){
        const clip=await scoreClip(page),normal=await page.screenshot({clip});
        const oldBug=await page.addStyleTag({content:'.notation svg.definition-scale{overflow:hidden!important;}'});
        expect(sameInk(normal,await page.screenshot({clip})),'pixel assertion detects the original inner-viewport bug').toBe(false);
        await oldBug.evaluate(n=>n.parentNode?.removeChild(n));
      }
    }
  }
  await page.reload();await expect(page.locator('[data-broadcast-ready=true]')).toBeVisible();await assertPaintContained(page);
});

test('full ink fits short, long and decorated scores; debug exposes safe bounds and padding',async({page})=>{
  test.setTimeout(120000);const publish=await start(page);
  await publish(2001,true);await page.setViewportSize({width:1920,height:750});await page.goto('/obs/recording?scoreDebug=1');
  await expect(page.locator('[data-score-debug]')).toBeVisible();
  const read=async()=>JSON.parse((await page.locator('[data-score-debug]').getAttribute('data-metrics'))!);
  await expect.poll(async()=>Math.max(...Object.values((await read()).overflow) as number[])).toBeLessThan(.1);
  expect((await read()).padding).toEqual({top:24,bottom:24,left:24,right:24});
  await page.addStyleTag({content:'.sight-score{--score-padding-top:20px;--score-padding-bottom:28px;--score-padding-left:32px;--score-padding-right:40px;}'});
  await page.setViewportSize({width:1920,height:600});
  await expect.poll(async()=>(await read()).padding).toEqual({top:20,bottom:28,left:32,right:40});
  expect(Math.max(...Object.values((await read()).overflow) as number[])).toBeLessThan(.1);
  await page.screenshot({path:'../../work/schmitt-fit-debug.png'});
  await page.goto('/obs/recording');await expect(page.locator('[data-score-debug]')).toHaveCount(0);
  for(const exerciseNumber of [2028,9017,11001,4001,10001,7005]){
    const previous=await page.locator('.notation > svg').first().elementHandle();
    const ex=await publish(exerciseNumber,true);await expect(page.locator('.obs-piece h1')).toHaveText(ex.title);
    await expect.poll(()=>previous!.evaluate(n=>n.isConnected)).toBe(false);
    await expect(page.locator('[data-broadcast-ready=true]')).toBeVisible();
    await assertPaintContained(page);
    await publish(exerciseNumber,true,ex.right.length);
    await expect.poll(()=>page.locator('.notation .measure').evaluateAll(nodes=>nodes.findIndex(n=>n.classList.contains('sight-active-measure')))).toBe(ex.right.length-1);
    await assertPaintContained(page);
  }
  await page.goto('/obs/score');await expect(page.locator('[data-broadcast-ready=true]')).toBeVisible();await assertPaintContained(page);
});
