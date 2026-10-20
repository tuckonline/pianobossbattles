import {test,expect,type Page} from '@playwright/test';
import {defaultGameSettings} from '../../hosted/game-core';
import {createBattle,battleView,type BattleView} from '../../hosted/boss-battle';
import {defaultBossBattleConfig} from '../../hosted/boss-config';
import {noteGroups} from '../../hosted/sight-library';
import {schmittLibrary} from '../../hosted/schmitt-library';
import {installMidiKeyboard,playNotes} from './helpers/midi';
import {readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {rankHighlights,type ShortsSession,type ShortsEvent} from '../../hosted/shorts-core';
const origin='http://127.0.0.1:8787';
async function identity(page:Page){const id=`shorts-${crypto.randomUUID()}`;await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});await page.request.post('/api/platform',{headers:{origin},data:{action:'gameState'}});return id;}
function publisher(page:Page){let sequence=0;const sourceId=crypto.randomUUID();return async(b:BattleView,exerciseNumber=2001)=>{
  const e=await (await page.request.post('/api/platform',{headers:{origin},data:{action:'practiceExercise',exerciseNumber}})).json();
  const r=await page.request.post('/api/obs',{headers:{origin},data:{sourceId,sequence:++sequence,claim:true,snapshot:{exerciseNumber,title:e.title,hand:'both',status:'practicing',accuracy:98,mistakes:1,measure:1,totalMeasures:e.right.length,
    game:{battle:b,settings:{...defaultGameSettings,bossBattle:b.config},sessionId:'test',preview:false,alerts:[],live:{attemptId:b.attemptId,sessionId:'test',combo:50,best:50,correct:50,incorrect:1,provisionalXP:100,status:'playing',sequence}}}}});expect(r.ok()).toBeTruthy();};}
test('portrait ON/OFF and mobile layout contain notation, preserve sprites and reserve camera',async({page})=>{
  test.setTimeout(90000);await identity(page);const send=publisher(page);await page.addInitScript(()=>{Object.assign(window,{shortsMidiCalls:0});Object.defineProperty(navigator,'requestMIDIAccess',{value:()=>{(window as unknown as {shortsMidiCalls:number}).shortsMidiCalls++;throw Error('Unexpected MIDI');}});});
  const b=battleView(createBattle({...defaultBossBattleConfig,enabled:true},66));await send(b);await page.setViewportSize({width:1080,height:1920});await page.goto('/obs/shorts');
  for(const width of [1080,360]){
    await page.setViewportSize({width,height:width/9*16});await expect(page.locator('[data-broadcast-ready=true]')).toBeVisible({timeout:15000});await expect(page.locator('[data-asset-status=ready]')).toHaveCount(2);
    const camera=(await page.locator('.shorts-camera').boundingBox())!;expect(camera.height).toBeCloseTo(width/9*16*.25,0);expect(camera.y).toBeCloseTo(width/9*16*.65,0);
    expect(await page.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight}))).toEqual({w:width,h:width/9*16});
    const score=(await page.locator('.shorts-notation').boundingBox())!;
    const systems=await page.locator('.notation .measure').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).visibility==='visible').map(n=>{const r=n.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};}));
    expect(systems).toHaveLength(1);for(const r of systems){expect(r.left).toBeGreaterThanOrEqual(score.x+10);expect(r.right).toBeLessThanOrEqual(score.x+score.width-10);expect(r.top).toBeGreaterThanOrEqual(score.y+10);expect(r.bottom).toBeLessThanOrEqual(score.y+score.height-10);}
    await page.screenshot({path:`../../work/v13/portrait-${width}.png`});
  }
  await send({...b,config:{...b.config,enabled:false}});await expect(page.locator('.boss-battle-panel')).toHaveCount(0);await expect(page.locator('.shorts-no-boss strong')).toHaveText('50');expect(await page.evaluate(()=>(window as unknown as {shortsMidiCalls:number}).shortsMidiCalls)).toBe(0);
});
test('import, measured alignment, trimming, approval and local export kit are usable and persistent',async({page})=>{
  await identity(page);const source=resolve('tests/fixtures/shorts-source.mp4'),file=statSync(source),segment=crypto.randomUUID();
  const base={segment,exercise:2001,title:'Schmitt 1',attempt:'take-1',combo:66,hp:4,maxHp:30,bossHp:0,bossMax:66,nextDamage:4,shields:0,health:true,mode:'survival',bpm:80,loops:1,timeMs:null,progress:1};
  const events:ShortsEvent[]=[{...base,id:'sync-1',kind:'marker',detail:'SYNC 1',atMs:0},{...base,id:'take-victory',kind:'victory',atMs:6000},{...base,id:'sync-2',kind:'marker',detail:'SYNC 2',atMs:15000}];
  const s:ShortsSession={version:1,id:crypto.randomUUID(),revision:1,title:'Export review fixture',startedAt:new Date().toISOString(),status:'stopped',profile:'vertical-1080x1920',events,segments:[{id:segment,startMs:0,endMs:15000,reason:'Test recording'}],anchors:[],edits:[],targetSeconds:20,maxSeconds:180};
  s.edits=[{id:rankHighlights(s)[0].id,start:0,end:15,hook:'OLD CAPTION',hookVisible:true,contextVisible:true,decision:'suggested',exportStatus:'not-exported'}];
  expect((await page.request.post('/api/shorts',{headers:{origin},data:{session:s}})).ok()).toBe(true);
  await page.goto('/shorts');await page.getByLabel('Recording session',{exact:true}).selectOption(s.id);await page.getByLabel('Original OBS recording',{exact:true}).setInputFiles(source);
  await expect.poll(()=>page.locator('video').evaluate(v=>(v as HTMLVideoElement).duration)).toBeGreaterThan(14);
  await page.getByLabel('SYNC 1 video seconds').fill('0');await page.getByLabel('SYNC 2 video seconds').fill('15');await page.getByRole('button',{name:'Save timeline & edits',exact:true}).click();
  await page.getByRole('button',{name:'Preview clip',exact:true}).click();await expect(page.locator('.preview-caption,.shorts-hook')).toHaveCount(0);await expect(page.getByLabel('Hook text',{exact:true})).toHaveCount(0);
  await page.getByLabel('In',{exact:true}).fill('1');await page.getByLabel('Out',{exact:true}).fill('13');await page.getByRole('button',{name:'Approve',exact:true}).click();
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export MP4 locally',exact:true}).click();const downloaded=await pending;const path=await downloaded.path();const script=readFileSync(path!,'utf8');
  const encoded=/EMBEDDED_PLAN = '([^']+)'/.exec(script)![1],plan=JSON.parse(Buffer.from(encoded,'base64').toString());expect(plan.start).toBe(1);expect(plan.end).toBe(13);expect(plan.source.size).toBe(file.size);expect(plan.hook).toBe('');expect(plan.hookVisible).toBe(false);expect(plan.contextVisible).toBe(false);expect(script).not.toContain('youtube.upload');
  await expect(page.getByText('Export kit downloaded; run it locally, then review the MP4',{exact:false})).toBeVisible();await page.screenshot({path:'../../work/v13/review-ready.png',fullPage:true});
  await page.reload();await page.getByLabel('Recording session',{exact:true}).selectOption(s.id);await expect(page.getByLabel('Hook text')).toHaveCount(0);await expect(page.getByRole('button',{name:'Approve',exact:true})).toHaveAttribute('aria-pressed','true');
});
test('portrait cinematics retain canonical visuals, hold and restore without compact duplicates',async({page})=>{
  test.setTimeout(70000);await identity(page);await page.setViewportSize({width:1080,height:1920});const send=publisher(page);await page.goto('/obs/shorts');
  for(const result of ['victory','defeat','timeout'] as const){const b=battleView(createBattle({...defaultBossBattleConfig,enabled:true},66));b.attemptId=crypto.randomUUID();b.status='active';await send(b);await expect(page.locator('.battle-cinematic')).toHaveCount(0);await expect(page.locator('[data-asset-status=ready]')).toHaveCount(2);await expect(page.locator('[data-broadcast-ready=true]')).toBeVisible({timeout:15000});
    b.status=result==='victory'?'victory':'defeat';b.result=result==='timeout'?'timeout':'knockout';b.lastAt=Date.now();b.playerHp=result==='defeat'?0:4;b.bossHp=result==='victory'?0:12;await send(b);
    await expect(page.locator('.battle-cinematic')).toHaveAttribute('data-result',result);await expect(page.locator('.battle-cinematic')).toHaveAttribute('data-phase','holding',{timeout:12000});await expect(page.locator('.battle-result,.battle-outcome')).toHaveCount(0);
    await expect(page.locator('.battle-cinematic')).toHaveAttribute('data-fallback','false');await expect(page.locator('.battle-cinematic h2')).toHaveCount(1);
    const ending=(await page.locator('.battle-cinematic').boundingBox())!,camera=(await page.locator('.shorts-camera').boundingBox())!;expect(ending.y+ending.height).toBeLessThanOrEqual(camera.y+.5);
    if(result!=='timeout'){
      const arena=(await page.locator('.shorts-main').boundingBox())!;
      for(const name of ['hero','boss']){const cast=(await page.locator(`.cinematic-${name}`).boundingBox())!;expect(cast.y).toBeGreaterThanOrEqual(arena.y);expect(cast.y+cast.height).toBeLessThanOrEqual(arena.y+arena.height);}
    }
    await page.screenshot({path:`../../work/v13/${result}.png`});const svg=await page.locator('.notation > svg').first().elementHandle();await page.reload();await expect(page.locator('.battle-cinematic')).toHaveAttribute('data-phase','holding');expect(svg).not.toBeNull();
  }
});
test('real evaluated notes capture highlights, recovery is segmented, OBS never logs duplicates',async({page,context})=>{
  test.setTimeout(90000);await identity(page);await installMidiKeyboard(page);await page.goto('/student/practice?collection=schmitt&exercise=2001');
  await expect(page.getByText('All progress saved',{exact:true})).toBeVisible();await page.getByText('Progression & recording controls',{exact:true}).click();await page.getByLabel('Boss Battle Mode',{exact:true}).check();
  await page.locator('.shorts-capture-controls > summary').click();await page.getByRole('button',{name:'Start Shorts capture',exact:true}).click();await expect(page.locator('.shorts-capture-controls')).toContainText('Cloud saved');
  await page.getByRole('button',{name:'Connect keyboard',exact:true}).click();const obs=await context.newPage();await obs.setViewportSize({width:1080,height:1920});await obs.goto('/obs/shorts');
  await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
  const notes=noteGroups(schmittLibrary[0],'both').flatMap(g=>g.pitches);await playNotes(page,notes.slice(0,4));
  await expect(obs.locator('.boss-battle-panel')).toHaveAttribute('data-authoritative-boss-hp','62');
  const attempt=await obs.locator('.boss-battle-panel').getAttribute('data-battle-attempt');
  await page.getByText('Shorts Display',{exact:true}).click();await page.getByLabel('Character Scale',{exact:true}).fill('120');
  await expect(obs.locator('.shorts-view')).toHaveAttribute('data-character-scale','120');await expect(obs.locator('.boss-battle-panel')).toHaveAttribute('data-battle-attempt',attempt!);await expect(obs.locator('.boss-battle-panel')).toHaveAttribute('data-authoritative-boss-hp','62');
  await playNotes(page,notes.slice(4));
  await expect(obs.getByRole('progressbar',{name:'boss HP',exact:true})).toHaveAttribute('aria-valuenow','0');await expect(obs.locator('.battle-cinematic')).toHaveAttribute('data-phase','holding',{timeout:12000});
  await expect(obs.locator('.shorts-progress')).toContainText('3 / 3');
  await page.getByRole('button',{name:'Show sync marker',exact:true}).click();await expect(obs.locator('.shorts-sync')).toHaveText('SYNC 2');
  const list=await (await page.request.get('/api/shorts')).json();const id=list[0].id;
  await page.getByRole('button',{name:'Pause capture',exact:true}).click();await page.getByRole('button',{name:'Resume capture',exact:true}).click();await page.reload();
  await page.locator('.shorts-capture-controls > summary').click();await expect(page.locator('.shorts-capture-controls')).toContainText('interrupted');
  await page.getByRole('button',{name:'Resume capture',exact:true}).click();await page.getByRole('button',{name:'Stop capture',exact:true}).click();
  await expect.poll(async()=>{const s=await (await page.request.get(`/api/shorts?id=${id}`)).json();return s.status;}).toBe('stopped');
  const s=await (await page.request.get(`/api/shorts?id=${id}`)).json();expect(s.events.filter((e:{kind:string})=>e.kind==='victory')).toHaveLength(1);expect(s.events.some((e:{kind:string,combo:number})=>e.kind==='combo'&&e.combo===50)).toBe(true);expect(s.segments).toHaveLength(3);
  await obs.reload();expect((await (await page.request.get(`/api/shorts?id=${id}`)).json()).revision).toBe(s.revision);
  await page.goto('/shorts');await page.getByLabel('Recording session',{exact:true}).selectOption(id);await expect(page.locator('.clip-card')).not.toHaveCount(0);await expect(page.getByText('Match at least two sync markers from this segment to the video.',{exact:true})).toBeVisible();
  await page.screenshot({path:'../../work/v13/studio.png'});
});
