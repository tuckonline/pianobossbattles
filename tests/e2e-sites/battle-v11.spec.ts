import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {sightLibrary,noteGroups} from '../../hosted/sight-library';
import {battleMusicalBeats,countdownLabel} from '../../hosted/battle-modes';
import {installMidiKeyboard,playNotes} from './helpers/midi';

const out='../../work/v11-review';
test.use({trace:'off'});
for(const mode of ['timeAttack','ultimateBoss'] as const)for(const continuous of [true,false])test(`V11 ${mode}, continuous=${continuous}: loop preview, frozen settings and one running clock`,async({browser})=>{
 test.setTimeout(120000);await mkdir(out,{recursive:true});
 const id=`v11-loops-${crypto.randomUUID()}`,ctx=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`},viewport:{width:1920,height:750}});
 const p=await ctx.newPage(),obs=await ctx.newPage();
 try{
 await installMidiKeyboard(p);await p.goto('/student/sight-read');
 const controls=p.getByRole('region',{name:'Pianist progression'}),status=p.getByRole('region',{name:'Practice battle status'});
 await expect(controls.getByText('Connecting progression…')).toHaveCount(0);
 await controls.getByText('Progression & recording controls',{exact:true}).click();
 await controls.getByLabel('Boss Battle Mode',{exact:true}).check();
 await controls.getByLabel('Game mode',{exact:true}).selectOption(mode);
 await controls.getByLabel('Practice tempo preset',{exact:true}).selectOption('custom');
 await controls.getByLabel('Practice BPM',{exact:true}).fill('83');
 await controls.getByLabel('Timer allowance',{exact:true}).selectOption('1.5');
 await controls.getByLabel('Explicit time limit',{exact:true}).fill('0');
 const ex=sightLibrary[0],pitches=noteGroups(ex,'both').flatMap(g=>g.pitches),beats=battleMusicalBeats(ex)!;
 await obs.goto('/obs/recording');await expect(obs.locator('[data-broadcast-ready=true]')).toBeVisible();
 for(let loops=1;loops<=5;loops++){
  await p.getByLabel('Practice loops',{exact:true}).fill(String(loops));
  await expect(status.getByLabel('Battle countdown')).toContainText(countdownLabel(Math.ceil(beats*60/83*1.5*loops)*1000));
  await expect(status.getByRole('progressbar',{name:'boss HP'})).toHaveAttribute('aria-valuemax',String(pitches.length*loops));
  await expect(obs.getByLabel('Battle countdown')).toContainText(countdownLabel(Math.ceil(beats*60/83*1.5*loops)*1000));
  if(continuous&&(loops===1||loops===3))await obs.screenshot({path:`${out}/${mode}-${loops}-loops.png`});
 }
 await p.getByLabel('Practice loops',{exact:true}).fill('3');
 await controls.getByLabel('Explicit time limit',{exact:true}).fill('10');
 await expect(status.getByLabel('Battle countdown')).toContainText('00:30');
 if(!continuous)await p.getByRole('checkbox',{name:/Continuous/}).uncheck();
 await p.getByRole('button',{name:'Connect keyboard',exact:true}).click();await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
 const snapshot=async()=>{const r=await p.request.get('/api/obs');return (await r.json()).snapshot?.game?.battle;};
 await expect.poll(async()=>(await snapshot())?.status).toBe('active');
 const original=await snapshot();expect(original).toMatchObject({loopCount:3,timer:{limitMs:30000,running:false},bossMaxHp:pitches.length*3});
 await playNotes(p,[pitches[0]]);await p.waitForTimeout(1100);
 await controls.getByLabel('Practice BPM',{exact:true}).fill('140');
 await controls.getByLabel('Explicit time limit',{exact:true}).fill('1');
 await playNotes(p,pitches.slice(1));await expect(p.getByText('Loop 2 of 3',{exact:true})).toBeVisible();
 await expect.poll(async()=>(await snapshot())?.bossHp).toBe(pitches.length*2);
 const second=await snapshot();expect(second).toMatchObject({attemptId:original.attemptId,loopCount:3,config:{selectedBpm:83},timer:{limitMs:30000,running:true}});expect(second.timer.elapsedMs).toBeGreaterThanOrEqual(1000);
 await p.getByRole('button',{name:'Pause practice',exact:true}).click();await expect.poll(async()=>(await snapshot())?.status).toBe('paused');
 const paused=await snapshot();await p.waitForTimeout(600);expect((await snapshot()).timer.elapsedMs).toBe(paused.timer.elapsedMs);
 await p.getByRole('button',{name:'Resume practice',exact:true}).click();
 await playNotes(p,pitches);await expect(p.getByText('Loop 3 of 3',{exact:true})).toBeVisible();
 await expect.poll(async()=>(await snapshot())?.bossHp).toBe(pitches.length);
 const third=await snapshot();expect(third.attemptId).toBe(original.attemptId);expect(third.timer.elapsedMs).toBeGreaterThanOrEqual(paused.timer.elapsedMs);
 await playNotes(p,pitches);await expect(status).toHaveAttribute('data-battle-status','victory');
 await expect(obs.locator('.battle-cinematic')).toHaveAttribute('data-phase','holding',{timeout:12000});
 await obs.setViewportSize({width:1920,height:1080});await obs.reload();await expect(obs.locator('.battle-cinematic')).toHaveAttribute('data-phase','holding');
 expect(await obs.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}))).toEqual({width:1920,height:1080});
 await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();await expect(obs.locator('.battle-cinematic')).toHaveCount(0);
 await expect.poll(async()=>(await snapshot())?.timer?.limitMs).toBe(3000);
 expect((await snapshot()).config.selectedBpm).toBe(140);
 }finally{await ctx.close();}
});
