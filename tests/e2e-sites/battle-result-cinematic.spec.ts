import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {battleView,createBattle,type BattleView} from '../../hosted/boss-battle';
import {defaultGameSettings,type Celebration} from '../../hosted/game-core';
import {type CinematicResult,battleResultId} from '../../hosted/battle-cinematic';
import {installMidiKeyboard,playNotes} from './helpers/midi';
import {noteGroups} from '../../hosted/sight-library';
import {schmittLibrary} from '../../hosted/schmitt-library';
const origin='http://127.0.0.1:8787',out='../../work/v11-review';
test.use({trace:'off'});
async function setup(page:Page){
 const id=`v11-${crypto.randomUUID()}`,sourceId=crypto.randomUUID();let sequence=0;
 await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
 await page.request.post('/api/platform',{headers:{origin},data:{action:'gameState'}});
 const settings=structuredClone(defaultGameSettings);settings.bossBattle.enabled=true;
 const saveSettings=async()=>{
  const r=await page.request.post('/api/platform',{headers:{origin},data:{action:'gameSettings',settings}});
  expect(r.ok(),await r.text()).toBe(true);
 };
 await saveSettings();
 const initial=():BattleView=>({...battleView(createBattle(settings.bossBattle,66)),attemptId:crypto.randomUUID(),status:'active'});
 const publish=async(b:BattleView,{exercise=2001,alerts=[],dismiss='',feedback=[]}:{exercise?:number;alerts?:Celebration[];dismiss?:string;feedback?:[number,0|1|2][]}={})=>{
  const r=await page.request.post('/api/obs',{headers:{origin},data:{sourceId,sequence:++sequence,claim:true,snapshot:{exerciseNumber:exercise,title:'Schmitt Op. 16 · Exercise 1',hand:'both',status:'practicing',accuracy:100,mistakes:b.mistakes,measure:1,totalMeasures:3,
   score:{activeMeasure:1,activeBeat:0,listening:false,compact:true,follow:true,size:{mode:'auto',percent:100},feedback},
   game:{sessionId:'v11',preview:false,settings,alerts,cinematicDismissedId:dismiss,live:{attemptId:b.attemptId,sessionId:'v11',combo:26,best:26,attemptBest:26,correct:b.correctHits,incorrect:b.mistakes,provisionalXP:0,status:b.status,sequence},battle:b}}}});
  expect(r.ok(),await r.text()).toBe(true);
 };
 const terminal=(b:BattleView,result:CinematicResult):BattleView=>({...b,status:result==='victory'?'victory':'defeat',result:result==='timeout'?'timeout':result==='defeat'?'knockout':undefined,playerHp:result==='defeat'?0:26,bossHp:result==='victory'?0:20,correctHits:result==='victory'?66:46,mistakes:result==='defeat'?8:2,lastAt:Date.now(),revision:b.revision+1});
 return {settings,initial,publish,terminal,saveSettings};
}
for(const result of ['victory','defeat','timeout'] as const)test(`V11 ${result}: full scene, live score, once-only restore and normal-speed capture`,async({browser})=>{
 test.setTimeout(90000);await mkdir(out,{recursive:true});
 const ctx=await browser.newContext({viewport:{width:1920,height:750},recordVideo:{dir:out,size:{width:1920,height:750}}});const page=await ctx.newPage();
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 const {initial,publish,terminal}=await setup(page);let b=initial();await publish(b);
 await page.addInitScript(()=>{Object.assign(window,{midiCalls:0});Object.defineProperty(navigator,'requestMIDIAccess',{value:()=>{(window as unknown as {midiCalls:number}).midiCalls++;throw Error('duplicate MIDI');}});});
 await page.goto('/obs/recording');await expect(page.locator('[data-broadcast-ready=true]')).toBeVisible();
 await expect(page.locator('[data-asset-status=ready]')).toHaveCount(2);
 const svg=await page.locator('.notation > svg').first().elementHandle();
 await page.screenshot({path:`${out}/${result}-00-score.png`});
 b=terminal(b,result);await publish(b);
 const overlay=page.locator('.battle-cinematic');await expect(overlay).toHaveAttribute('data-result',result);
 // Capture the actual timestamp-driven playback without pausing or seeking it.
 for(const phase of ['entering','action','impact','result'] as const){
  if(result==='timeout'&&(phase==='action'||phase==='impact'))continue;
  await page.waitForFunction(phase=>document.querySelector('.battle-cinematic')?.getAttribute('data-phase')===phase,phase);if(phase==='result')await page.waitForTimeout(350);await page.screenshot({path:`${out}/${result}-${phase}.png`});
 }
 await expect(overlay).toHaveAttribute('data-fallback','false');
 await expect.poll(()=>overlay.evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
 const cover=(await overlay.boundingBox())!,score=(await page.locator('.sight-score').boundingBox())!,banner=(await page.locator('.obs-panel').boundingBox())!;
 expect(cover.y).toBeCloseTo(banner.height,0);expect(cover.x).toBe(0);expect(cover.width).toBe(1920);expect(cover.y+cover.height).toBe(750);expect(cover.y).toBeLessThanOrEqual(score.y);
 const art=await overlay.locator('img').evaluateAll(nodes=>nodes.every(n=>(n as HTMLImageElement).complete&&(n as HTMLImageElement).naturalHeight>1000));expect(art).toBe(true);
 expect(await svg!.evaluate(n=>n===document.querySelector('.notation > svg'))).toBe(true);
 await publish(b,{feedback:[[0,0],[1,0]]});
 await expect(page.locator('.practice-note-correct')).toHaveCount(2);
 await expect(overlay).toHaveAttribute('data-phase','holding',{timeout:12000});
 await page.waitForTimeout(2500);await expect(overlay).toHaveAttribute('data-phase','holding');
 await expect(page.locator('.battle-outcome,.battle-result,.battle-mode-notice')).toHaveCount(0);
 expect(await svg!.evaluate(n=>n===document.querySelector('.notation > svg'))).toBe(true);
 await page.reload();await expect(overlay).toHaveAttribute('data-phase','holding');await expect(overlay).toHaveAttribute('data-result',result);
 await publish(b,{dismiss:battleResultId(b),feedback:[[0,0],[1,0]]});await expect(overlay).toHaveCount(0);
 await expect(page.locator('[data-broadcast-ready=true]')).toBeVisible();
 await page.screenshot({path:`${out}/${result}-restored.png`});
 await publish(b,{dismiss:battleResultId(b)});await page.waitForTimeout(500);await expect(overlay).toHaveCount(0);
 await page.reload();await expect(page.locator('.boss-battle-panel')).toHaveAttribute('data-battle-status',b.status);await expect(overlay).toHaveCount(0);
 expect(await page.evaluate(()=>(window as unknown as {midiCalls:number}).midiCalls)).toBe(0);
 expect(await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}))).toEqual({width:1920,height:750});
 expect(errors).toEqual([]);
 }finally{await ctx.close();await page.video()!.saveAs(`${out}/${result}-normal-speed.webm`);}
});

test('V11 priority, held result skip, cancellation, Boss OFF, fallback and responsive containment',async({page})=>{
 test.setTimeout(240000);await mkdir(out,{recursive:true});const {initial,publish,terminal,settings,saveSettings}=await setup(page);let b=initial();
 await page.setViewportSize({width:1920,height:750});await publish(b);await page.goto('/obs/recording');await expect(page.locator('[data-broadcast-ready=true]')).toBeVisible();
 const svg=await page.locator('.notation > svg').first().elementHandle();
 b=terminal(b,'victory');const alerts:Celebration[]=[{id:'v11-achievement',kind:'achievement',title:'Precision Player',description:'Earned result',xp:75,priority:90,createdAt:Date.now()}];await publish(b,{alerts});
 const overlay=page.locator('.battle-cinematic');await expect(overlay).toHaveAttribute('data-phase','result');await expect(page.locator('.game-celebration')).toHaveCount(0);
 await expect(overlay).toHaveAttribute('data-phase','holding');
 await page.evaluate(()=>{Object.assign(window,{v11Frames:0});const original=window.requestAnimationFrame;window.requestAnimationFrame=(fn)=>{(window as unknown as {v11Frames:number}).v11Frames++;return original(fn);};Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForTimeout(700);await expect(overlay).toHaveAttribute('data-phase','holding');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForTimeout(500);const frames=await page.evaluate(()=>(window as unknown as {v11Frames:number}).v11Frames);await page.waitForTimeout(700);expect(await page.evaluate(()=>(window as unknown as {v11Frames:number}).v11Frames)-frames).toBeLessThan(8);
 for(const size of [{width:1920,height:600},{width:1280,height:720},{width:960,height:540}]){
  await page.setViewportSize(size);await page.waitForTimeout(100);const r=(await overlay.boundingBox())!;
  expect(r.x).toBe(0);expect(r.width).toBe(size.width);expect(r.y+r.height).toBe(size.height);
  const title=(await overlay.locator('h2').boundingBox())!;expect(title.x).toBeGreaterThanOrEqual(0);expect(title.x+title.width).toBeLessThanOrEqual(size.width);
  expect(await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}))).toEqual(size);
 }
 await publish(b,{alerts,dismiss:battleResultId(b)});await expect(overlay).toHaveCount(0);await expect(page.locator('.game-celebration')).toContainText('Precision Player');expect(await svg!.evaluate(n=>n===document.querySelector('.notation > svg'))).toBe(true);
 await page.setViewportSize({width:1920,height:750});
 for(const result of ['victory','defeat','timeout'] as const)for(const cancel of ['restart','attempt','exercise','off','disabled'] as const)await test.step(`${result} held → ${cancel}`,async()=>{
  b=initial();await publish(b);await expect(page.locator('.boss-battle-panel')).toHaveAttribute('data-battle-attempt',b.attemptId);
  b=terminal(b,result);await publish(b);await expect(overlay).toHaveAttribute('data-result',result);await expect(overlay).toHaveAttribute('data-phase','holding',{timeout:12000});
  await expect(page.locator('.battle-outcome,.battle-result,.game-celebration')).toHaveCount(0);
  const mountedScore=await page.locator('.notation > svg').first().elementHandle();
  await page.screenshot({path:`${out}/${result}-${cancel}-held.png`});
  if(cancel==='restart')await publish({...battleView(createBattle(settings.bossBattle,66)),status:'ready'});
  if(cancel==='attempt')await publish(initial());
  if(cancel==='exercise')await publish(b,{exercise:7001});
  if(cancel==='off')await publish({...b,config:{...b.config,enabled:false}});
  if(cancel==='disabled'){
   settings.cinematics.enabled=false;await publish(b);
   // Cloud snapshots deliberately use saved profile settings. A transient
   // presentation setting alone must not override that authoritative value.
   const before=await page.request.get('/api/obs');expect((await before.json()).snapshot.game.settings.cinematics.enabled).toBe(true);
   await saveSettings();await publish(b);
   const after=await page.request.get('/api/obs');expect((await after.json()).snapshot.game.settings.cinematics.enabled).toBe(false);
  }
  await expect(overlay,`${result} cinematic dismissal: ${cancel}`).toHaveCount(0);
  await expect(page.locator('[data-broadcast-ready=true]')).toBeVisible();
  if(cancel!=='exercise')expect(await mountedScore!.evaluate(n=>n===document.querySelector('.notation > svg'))).toBe(true);
  if(cancel==='disabled')await expect(page.locator('.battle-result')).toContainText(result==='victory'?'BOSS DEFEATED':result==='defeat'?'YOU WERE DEFEATED':'TIME UP');
  await page.screenshot({path:`${out}/${result}-${cancel}-dismissed.png`});
  settings.cinematics.enabled=true;await saveSettings();
 });
 // A new context is not necessary: fail the loader before an uncached URL by
 // using the explicit developer simulation, which exercises the same fallback.
 await page.goto('/student/practice?collection=schmitt&cinematicPreview=1');
 await page.getByText('Progression & recording controls',{exact:true}).click();await page.getByText('Developer cinematic preview · no rewards',{exact:true}).click();
 await page.getByLabel('Missing assets',{exact:true}).check();await page.getByLabel('Reduced motion preview',{exact:true}).check();await page.getByRole('button',{name:'Preview timeout',exact:true}).click();await page.getByRole('button',{name:'Skip to results',exact:true}).click();
 await expect(overlay).toHaveAttribute('data-fallback','true');await expect(overlay).toHaveAttribute('data-reduced-motion','true');await expect(overlay).toContainText('TIME OUT');await expect(overlay.locator('img')).toHaveCount(0);
 await page.getByRole('button',{name:'Cancel cinematic preview',exact:true}).click();await expect(overlay).toHaveCount(0);
});

test('V11 actual MIDI continues under defeat, score stays mounted, skip and preview never award XP',async({browser})=>{
 test.setTimeout(120000);const id=`v11-midi-${crypto.randomUUID()}`;
 const ctx=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`},viewport:{width:1920,height:750}}),p=await ctx.newPage(),obs=await ctx.newPage();
 try{
 await installMidiKeyboard(p);await p.goto('/student/practice?collection=schmitt&exercise=2001');
 const controls=p.getByRole('region',{name:'Pianist progression'});await expect(controls.getByText('Connecting progression…')).toHaveCount(0);await controls.getByText('Progression & recording controls',{exact:true}).click();await controls.getByLabel('Boss Battle Mode',{exact:true}).check();
 await controls.getByLabel('Also show over my practice score',{exact:true}).check();await expect(controls.getByLabel('Return to score automatically',{exact:true})).toHaveCount(0);
 await obs.goto('/obs/recording');await expect(obs.locator('[data-broadcast-ready=true]')).toBeVisible();
 await p.getByRole('button',{name:'Connect keyboard',exact:true}).click();await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
 await expect(obs.locator('.boss-battle-panel')).toHaveAttribute('data-battle-status','active');
 const svg=await obs.locator('.notation > svg').first().elementHandle(),localSvg=await p.locator('.notation > svg').first().elementHandle();
 for(let i=0;i<8;i++){await playNotes(p,[1]);await p.waitForTimeout(25);}
 await expect(obs.locator('.battle-cinematic')).toHaveAttribute('data-result','defeat');await expect(p.locator('.battle-cinematic')).toHaveAttribute('data-result','defeat');
 await expect(obs.locator('.battle-cinematic')).toHaveAttribute('data-phase','holding');
 const pitches=noteGroups(schmittLibrary[0],'both').flatMap(g=>g.pitches);
 await playNotes(p,pitches.slice(0,12));
 await expect(obs.locator('.practice-note-correct')).toHaveCount(12);
 await expect(obs.locator('.battle-cinematic')).toHaveAttribute('data-phase','holding');await expect(p.locator('.battle-cinematic')).toHaveAttribute('data-phase','holding');
 const practiceStatus=p.getByRole('region',{name:'Practice battle status'});await expect(practiceStatus).toHaveAttribute('data-battle-status','defeat');
 expect(await svg!.evaluate(n=>n===document.querySelector('.notation > svg'))).toBe(true);expect(await localSvg!.evaluate(n=>n===document.querySelector('.notation > svg'))).toBe(true);
 await p.getByRole('button',{name:'Pause practice',exact:true}).click();
 const read=async()=>{const r=await p.request.post('/api/platform',{headers:{origin},data:{action:'gameState'}});return r.json();};await expect.poll(async()=>(await read()).xp).toBeGreaterThan(0);
 const saved=await read();await controls.getByRole('button',{name:'Dismiss result in recording view',exact:true}).click();await expect(obs.locator('.battle-cinematic')).toHaveCount(0);await expect(p.locator('.battle-cinematic')).toHaveCount(0);
 await p.waitForTimeout(500);expect((await read()).xp).toBe(saved.xp);
 // Refresh an OBS source never replays the terminal result.
 await obs.reload();await expect(obs.locator('.boss-battle-panel')).toHaveAttribute('data-battle-status','defeat');await expect(obs.locator('.battle-cinematic')).toHaveCount(0);
 }finally{await ctx.close();}
});


test('V11 failed image requests and repeated cancellation retain no cinematic DOM; preview is read-only',async({page})=>{
 test.setTimeout(60000);const {initial,publish,terminal}=await setup(page);await page.route('**/battle/cinematics/*.png',route=>route.abort());
 let b=initial();await publish(b);await page.goto('/obs/recording');await expect(page.locator('[data-broadcast-ready=true]')).toBeVisible();
 for(let i=0;i<4;i++){
  if(i){b=initial();await publish(b);await expect(page.locator('.boss-battle-panel')).toHaveAttribute('data-battle-attempt',b.attemptId);}
  b=terminal(b,'timeout');await publish(b);await expect(page.locator('.battle-cinematic')).toHaveAttribute('data-fallback','true');await expect(page.locator('.battle-cinematic img')).toHaveCount(0);
  await publish(b,{dismiss:battleResultId(b)});await expect(page.locator('.battle-cinematic')).toHaveCount(0);
 }
 await page.unroute('**/battle/cinematics/*.png');await page.goto('/student/practice?cinematicPreview=1');await expect(page.getByText('Connecting progression…')).toHaveCount(0);
 const read=async()=>{const r=await page.request.post('/api/platform',{headers:{origin},data:{action:'gameState'}});return r.json();};const before=await read();
 await page.getByText('Progression & recording controls',{exact:true}).click();await page.getByText('Developer cinematic preview · no rewards',{exact:true}).click();
 for(const result of ['victory','defeat','timeout']){await page.getByRole('button',{name:`Preview ${result}`,exact:true}).click();await page.getByRole('button',{name:'Skip to results',exact:true}).click();await expect(page.locator('.battle-cinematic')).toHaveAttribute('data-result',result);await page.getByRole('button',{name:'Cancel cinematic preview',exact:true}).click();}
 const after=await read();expect(after.xp).toBe(before.xp);expect(after.unlocks).toEqual(before.unlocks);expect(after.lifetimeBest).toBe(before.lifetimeBest);
});
