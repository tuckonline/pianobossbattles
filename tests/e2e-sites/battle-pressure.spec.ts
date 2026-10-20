import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {installMidiKeyboard,playNotes} from './helpers/midi';
import {sightLibrary,noteGroups} from '../../hosted/sight-library';
async function probe(p:Page){await p.addInitScript(()=>{const starts:number[]=[];Object.assign(window,{pressureAudio:starts});const native=AudioContext.prototype.createBufferSource;AudioContext.prototype.createBufferSource=function(){const source=native.call(this),start=source.start.bind(source);source.start=function(...args:Parameters<typeof start>){starts.push(Date.now());return start(...args);};return source;};});}
const count=(p:Page)=>p.evaluate(()=>(window as unknown as {pressureAudio:number[]}).pressureAudio.length);
test('pressure: synchronized stages, quiet practice, cancellation, pauses, loops and no replay',async({browser})=>{
 test.setTimeout(120000);await mkdir('../../work/battle-pressure',{recursive:true});
 const id=`pressure-${crypto.randomUUID()}`,ctx=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`},viewport:{width:1920,height:750}});
 const p=await ctx.newPage(),obs=await ctx.newPage(),shorts=await ctx.newPage();
 try{
 await installMidiKeyboard(p);await probe(p);await probe(obs);await probe(shorts);await obs.clock.install();await p.goto('/student/sight-read');
 const controls=p.getByRole('region',{name:'Pianist progression'}),status=p.getByRole('region',{name:'Practice battle status'});
 await expect(controls.getByText('Connecting progression…')).toHaveCount(0);await controls.getByText('Progression & recording controls',{exact:true}).click();
 await controls.getByLabel('Boss Battle Mode',{exact:true}).check();await expect(controls.getByLabel('Battle Pressure Reactions',{exact:true})).toBeChecked();
 await controls.getByLabel('Battle sounds (optional)',{exact:true}).check();await expect(controls.getByTestId('battle-audio-diagnostics')).toContainText('Sound: enabled');await controls.getByLabel('Battle audio output',{exact:true}).selectOption('obs');
 await expect.poll(async()=>{const r=await p.request.get('/api/obs');return (await r.json()).snapshot?.game?.settings.bossBattle;}).toMatchObject({soundEnabled:true,audioOutput:'obs'});
 await p.getByLabel('Practice loops',{exact:true}).fill('5');
 await obs.goto('/obs/recording?battleAudio=1');await expect(obs.locator('[data-broadcast-ready=true]')).toBeVisible();await obs.locator('body').click({position:{x:10,y:10}});
 await shorts.setViewportSize({width:1080,height:1920});await shorts.goto('/obs/shorts?battleAudio=1');await shorts.locator('body').click({position:{x:10,y:10}});
 await expect(controls.getByTestId('obs-audio-diagnostics')).toContainText('unlocked');
 await p.getByRole('button',{name:'Connect keyboard',exact:true}).click();await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
 await expect(p.getByLabel('Battle start countdown')).toBeVisible();await expect(shorts.locator('[data-pressure-expression]')).toHaveCount(0);
 await expect(status).toHaveAttribute('data-battle-status','active');
 const snapshot=async()=>{const r=await p.request.get('/api/obs');return (await r.json()).snapshot.game.battle;};
 const initial=await snapshot();expect(initial.pressure.stage).toBe(0);
 await expect(shorts.locator('.battle-fighter-player')).toHaveAttribute('data-pressure','1',{timeout:7000});
 await expect(shorts.locator('[data-pressure-expression]')).toHaveAttribute('data-pressure-expression','2');
 await expect(obs.locator('[data-pressure-expression]')).toHaveAttribute('data-pressure-expression','2');
 await expect(shorts.locator('.battle-anxiety')).toHaveCSS('opacity','1');
 await expect(shorts.locator('[data-animation-id="pressure_hero_panic"]')).toHaveAttribute('data-asset-status','ready');
 await expect(obs.locator('[data-animation-id="pressure_boss_taunt"]')).toHaveAttribute('data-asset-status','ready');
 await obs.screenshot({path:'../../work/battle-pressure/horizontal-panic-v2.png'});
 await shorts.screenshot({path:'../../work/battle-pressure/vertical-taunt.png'});
 await expect(shorts.locator('[data-pressure-expression]')).toHaveAttribute('data-pressure-expression','3');
 await expect(obs.locator('[data-pressure-expression]')).toHaveAttribute('data-pressure-expression','3');
 await obs.clock.pauseAt(new Date(Date.now()+50));
 await expect(shorts.locator('.battle-anxiety')).toHaveCSS('opacity','1');
 await shorts.screenshot({path:'../../work/battle-pressure/vertical-pressure.png'});
 // Capture distinct authored poses in time order, rather than accepting a
 // static taunt image. The expanded laughter sequence ends in its closed-mouth guard.
 const tauntAt=(await snapshot()).pressure.at;
 for(const [frame,ms] of [[1,200],[2,450],[3,800],[4,1300]]){
  await obs.clock.runFor(Math.max(0,tauntAt+ms-await obs.evaluate(()=>Date.now())));
  // Playwright's JS clock does not drive the browser compositor clock.
  await obs.evaluate(t=>{for(const a of document.getAnimations()){a.pause();a.currentTime=t;}},ms);
  await expect(obs.locator('[data-animation-id="pressure_boss_taunt"] canvas')).toHaveAttribute('data-sprite-frame',String(frame));
  await obs.screenshot({path:`../../work/battle-pressure/taunt-frame-${frame}.png`,clip:{x:0,y:178,width:422,height:518}});
 }
 await obs.evaluate(()=>{for(const a of document.getAnimations())a.play();});
 await obs.clock.resume();
 await expect(shorts.locator('[data-pressure-expression]')).toHaveCount(0);
 const after=await snapshot();expect(after.playerHp).toBe(initial.playerHp);expect(after.bossHp).toBe(initial.bossHp);expect(after.pressure.id).toBe(initial.pressure.id);
 expect(await count(p)).toBe(0);expect((await count(obs))+(await count(shorts))).toBe(6); // 4 intro cues + 2 pressure cues, one audio owner
 const heldAudio=(await count(obs))+(await count(shorts));await p.waitForTimeout(1800);expect((await count(obs))+(await count(shorts))).toBe(heldAudio);
 await shorts.reload();await expect(shorts.locator('[data-pressure-expression]')).toHaveCount(0);expect(await count(shorts)).toBe(0);
 await playNotes(p,[12]);expect((await snapshot()).pressure.id).toBe(initial.pressure.id);
 const notes=noteGroups(sightLibrary[0],'both').flatMap(g=>g.pitches);
 await playNotes(p,notes.slice(0,2));await expect.poll(async()=>(await snapshot()).pressure.stage).toBe(0);
 await expect(shorts.locator('[data-pressure-expression]')).toHaveCount(0);
 await p.getByRole('button',{name:'Pause practice',exact:true}).click();const paused=await snapshot();await p.waitForTimeout(6500);expect((await snapshot()).pressure.stage).toBe(0);await expect(shorts.locator('[data-pressure-expression]')).toHaveCount(0);
 await p.getByRole('button',{name:'Resume practice',exact:true}).click();await expect.poll(async()=>(await snapshot()).pressure.dueAt).toBeGreaterThan(paused.pressure.dueAt+6000);
 await p.waitForTimeout(1000);expect((await snapshot()).pressure.stage).toBe(0);
 await expect(shorts.locator('[data-pressure-expression]')).toHaveAttribute('data-pressure-expression','2',{timeout:10000});
 await playNotes(p,notes.slice(2,3));await expect(shorts.locator('[data-pressure-expression]')).toHaveCount(0,{timeout:1000});
 await expect.poll(async()=>(await snapshot()).pressure.stage).toBe(0);
 await playNotes(p,notes.slice(3));await expect(p.getByText('Loop 2 of 5',{exact:true})).toBeVisible();await expect(p.getByLabel('Battle start countdown')).toHaveCount(0);
 expect((await snapshot()).pressure.stage).toBe(0);
 await controls.getByLabel('Battle Pressure Reactions',{exact:true}).uncheck();await expect.poll(async()=>(await snapshot()).pressure).toBeUndefined();
 await p.waitForTimeout(6000);await expect(shorts.locator('[data-pressure-expression]')).toHaveCount(0);
 await p.getByRole('button',{name:'Stop practice',exact:true}).click();expect(await count(p)).toBe(0);
 }finally{await ctx.close();}
});
