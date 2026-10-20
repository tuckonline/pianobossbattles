import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {installMidiKeyboard,playNotes} from './helpers/midi';
import {schmittLibrary} from '../../hosted/schmitt-library';
import {noteGroups,practicePass} from '../../hosted/sight-library';
const out='../../work/battle-story';
const origin='http://127.0.0.1:8787';
const notes=(i:number,omit=false)=>noteGroups(practicePass(schmittLibrary[i],omit),'both').flatMap(g=>g.pitches);
async function records(p:Page){const r=await p.request.post('/api/platform',{headers:{origin},data:{action:'battleStoryRecords'},maxRetries:2});expect(r.ok(),await r.text()).toBe(true);return r.json();}
async function setup(p:Page){
 await installMidiKeyboard(p);await p.goto('/student/practice');
 await p.getByLabel('Practice collection',{exact:true}).selectOption('schmitt');
 const controls=p.getByRole('region',{name:'Pianist progression'});
 await expect(controls.getByText('Connecting progression…')).toHaveCount(0);
 await controls.getByText('Progression & recording controls',{exact:true}).click();
 await controls.getByLabel('Boss Battle Mode',{exact:true}).check();
 await p.getByRole('button',{name:'Connect keyboard',exact:true}).click();
 return controls;
}
for(const boss of ['crimson_musical_colossus','grinwick'])test(`story: real MIDI chain, loops, result and both OBS layouts — ${boss}`,async({browser})=>{
 test.setTimeout(120000);await mkdir(out,{recursive:true});const id=`story-${crypto.randomUUID()}`;
 const context=await browser.newContext({viewport:{width:1920,height:750},extraHTTPHeaders:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`}});
 const p=await context.newPage(),h=await context.newPage(),v=await context.newPage(),errors:string[]=[];
 for(const page of [p,h,v])page.on('pageerror',e=>errors.push(e.message));
 try{
 const controls=await setup(p);
 if(boss==='grinwick')await controls.getByRole('radio',{name:/Grinwick/}).check();
 await p.getByLabel('Play a continuous exercise chain',{exact:true}).check();
 for(const [i,loops] of [2,1].entries()){
  await p.getByLabel('Add chain exercise',{exact:true}).selectOption(String(schmittLibrary[6+i].number));
  await p.getByLabel(`Chain exercise ${i+1} loops`,{exact:true}).fill(String(loops));
 }
 await h.goto('/obs/recording');await v.setViewportSize({width:1080,height:1920});await v.goto('/obs/shorts');
 await expect(h.locator('[data-broadcast-ready=true]')).toBeVisible({timeout:15000});
 for(const page of [h,v])await expect(page.getByLabel('Boss battle',{exact:true}).locator('[data-asset-status=ready]')).toHaveCount(2,{timeout:15000});
 await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
 for(const page of [p,h,v])await expect(page.getByLabel('Battle start countdown')).toContainText('SURVIVE 2 SCHMITT EXERCISES');
 await h.screenshot({path:`${out}/${boss}-horizontal-objective.png`});await v.screenshot({path:`${out}/${boss}-vertical-objective.png`});
 await expect(p.getByRole('region',{name:'Practice battle status'})).toHaveAttribute('data-battle-status','active',{timeout:7000});
 const snapshot=async()=>p.request.get('/api/obs',{maxRetries:2}).then(r=>r.json()).then(r=>r.snapshot.game.battle);
 const first=await snapshot();
 await playNotes(p,notes(6,true));
 await expect.poll(async()=>(await snapshot()).chain.pass).toBe(2);
 expect((await snapshot()).story.completed).toBe(0);
 await playNotes(p,notes(6).slice(0,18));
 const reaction=boss==='grinwick'?'grinwick_idle_panic_05':'boss_idle_laughter_03';
 for(const page of [h,v])await expect(page.locator(`.battle-character-boss[data-animation-id="${reaction}"]`)).toBeVisible({timeout:2500});
 await playNotes(p,notes(6).slice(18));
 for(const page of [h,v])await expect(page.locator(`.battle-character-boss[data-animation-id="${reaction}"]`)).toHaveCount(0);
 await expect(p.getByLabel('Exercise',{exact:true})).toHaveValue(String(schmittLibrary[7].number));
 await expect.poll(async()=>(await snapshot()).story.completed).toBe(1);
 for(const page of [h,v]){
  await expect(page.locator('[data-story-id]')).toHaveText('FINAL EXERCISE');
  await expect(page.getByLabel('Battle start countdown')).toHaveCount(0);
 }
 const eventIds=await Promise.all([h,v].map(page=>page.locator('[data-story-id]').getAttribute('data-story-id')));
 expect(eventIds[0]).toBe(eventIds[1]);
 await h.screenshot({path:`${out}/${boss}-horizontal-final-exercise.png`});await v.screenshot({path:`${out}/${boss}-vertical-final-exercise.png`});
 await playNotes(p,notes(7));
 for(const page of [h,v]){
  await expect(page.getByLabel('BOSS DEFEATED cinematic')).toBeVisible({timeout:15000});
  await expect(page.getByLabel('Battle story summary')).toContainText('2/2 EXERCISES COMPLETE');
  await expect(page.getByLabel('Battle story summary')).not.toContainText('PERSONAL BEST');
 }
 await expect.poll(async()=>(await records(p)).length,{timeout:15000}).toBe(1);
 const saved=await records(p);expect(saved[0].best.completed).toBe(2);expect(saved[0].best.result).toBe('victory');
 expect(saved[0].best.bestCombo).toBe(100);
 for(const page of [h,v])await expect(page.locator('.cinematic-stats')).toContainText('100 BEST COMBO');
 expect((await snapshot()).attemptId).toBe(first.attemptId);
 expect((await snapshot()).countdown.startedAt).toBe(first.countdown.startedAt);
 await expect(h.locator('.battle-cinematic')).toHaveAttribute('data-phase','holding',{timeout:12000});
 await h.screenshot({path:`${out}/${boss}-horizontal-summary.png`});await v.screenshot({path:`${out}/${boss}-vertical-summary.png`});
 await h.reload();await expect(h.getByLabel('Battle story summary')).toContainText('2/2 EXERCISES COMPLETE',{timeout:15000});
 await expect(h.locator('[data-story-id]')).toHaveCount(0);
 expect(await records(p)).toEqual(saved);
 await writeFile(`${out}/${boss}-result.json`,JSON.stringify(saved,null,2));expect(errors).toEqual([]);
 }finally{await context.close();}
});

test('story: strict PB, critical priority, save/reload and no duplicate notifications',async({browser})=>{
 test.setTimeout(120000);const id=`story-${crypto.randomUUID()}`;
 const context=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`}});
 const p=await context.newPage(),h=await context.newPage();
 try{
 await setup(p);await h.goto('/obs/recording');
 await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
 const status=p.getByRole('region',{name:'Practice battle status'});
 await expect(status).toHaveAttribute('data-battle-status','active',{timeout:7000});
 await playNotes(p,notes(0).slice(0,10));await playNotes(p,Array(6).fill(12));
 await expect(h.locator('[data-story-id]')).toHaveText('CRITICAL HEALTH');
 await playNotes(p,[12,12]);await expect(status).toHaveAttribute('data-battle-status','defeat');
 await expect(h.getByLabel('YOU WERE DEFEATED cinematic')).toBeVisible({timeout:15000});
 await expect(h.getByLabel('Battle story summary')).toContainText('10 CORRECT NOTES · 56% ACCURACY');
 await expect.poll(async()=>(await records(p)).length,{timeout:15000}).toBe(1);
 expect((await records(p))[0].best.correct).toBe(10);
 await p.reload();await setupAfterReload();
 await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
 await expect(p.getByLabel('Battle start countdown')).toContainText('BEST: 10 CORRECT NOTES');
 await expect(status).toHaveAttribute('data-battle-status','active',{timeout:7000});
 await playNotes(p,notes(0).slice(0,10));await expect(h.locator('[data-story-id]')).toHaveCount(0);
 await playNotes(p,notes(0).slice(10,11));await expect(h.locator('[data-story-id]')).toHaveText('NEW PERSONAL BEST!');
 const event=await h.locator('[data-story-id]').getAttribute('data-story-id');
 await playNotes(p,notes(0).slice(11,12));expect(await h.locator('[data-story-id]').getAttribute('data-story-id')).toBe(event);
 await expect(h.locator('[data-story-id]')).toHaveCount(0,{timeout:5000});
 await h.reload();await expect(h.locator('[data-story-id]')).toHaveCount(0);
 async function setupAfterReload(){
  // Practice deliberately opens the default collection on reload. Re-select the
  // same challenge: a Hanon attempt must not inherit Schmitt's personal best.
  await p.getByLabel('Practice collection',{exact:true}).selectOption('schmitt');
  await expect(p.getByLabel('Exercise',{exact:true})).toHaveValue(String(schmittLibrary[0].number));
  await expect(p.getByRole('region',{name:'Pianist progression'}).getByText('Connecting progression…')).toHaveCount(0);
  await p.getByRole('button',{name:'Connect keyboard',exact:true}).click();
 }
 }finally{await context.close();}
});
