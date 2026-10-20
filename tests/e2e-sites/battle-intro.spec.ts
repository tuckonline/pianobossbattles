import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {sightLibrary,noteGroups} from '../../hosted/sight-library';
import {installMidiKeyboard,playNotes} from './helpers/midi';
const out='../../work/battle-countdown';
for(const loops of [1,5,10,100])test(`one countdown for ${loops} continuous loops`,async({browser})=>{
 test.setTimeout(120000);await mkdir(out,{recursive:true});
 const id=`intro-${crypto.randomUUID()}`,ctx=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`},viewport:{width:1920,height:750}});
 const p=await ctx.newPage(),obs=await ctx.newPage(),vertical=await ctx.newPage();
 try{
 await installMidiKeyboard(p);await p.goto('/student/sight-read');
 const controls=p.getByRole('region',{name:'Pianist progression'}),status=p.getByRole('region',{name:'Practice battle status'});
 await expect(controls.getByText('Connecting progression…')).toHaveCount(0);
 await controls.getByText('Progression & recording controls',{exact:true}).click();
 await controls.getByLabel('Boss Battle Mode',{exact:true}).check();
 await controls.getByLabel('Game mode',{exact:true}).selectOption('timeAttack');
 await p.getByLabel('Practice loops',{exact:true}).fill(String(loops));
 await obs.goto('/obs/recording');await expect(obs.locator('[data-broadcast-ready=true]')).toBeVisible();
 await vertical.setViewportSize({width:1080,height:1920});await vertical.goto('/obs/shorts');
 await p.getByRole('button',{name:'Connect keyboard',exact:true}).click();
 await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
 const intro=p.getByLabel('Battle start countdown'),snapshot=async()=>{const r=await p.request.get('/api/obs');return (await r.json()).snapshot?.game?.battle;};
 await expect(intro).toBeVisible();
 const pitches=noteGroups(sightLibrary[0],'both').flatMap(g=>g.pitches);
 await playNotes(p,[...pitches,12]);
 await expect.poll(async()=>(await snapshot())?.countdown?.releasedAt).toBeUndefined();
 const initial=await snapshot();expect(initial.bossHp).toBe(pitches.length*loops);expect(initial.playerHp).toBe(30);expect(initial.timer.elapsedMs).toBe(0);
 if(loops===5){
  await p.getByRole('button',{name:'Pause practice',exact:true}).click();
  await expect(intro).toHaveAttribute('data-paused','true');
  await expect(obs.getByLabel('Battle start countdown')).toBeVisible();
  await expect(vertical.getByLabel('Battle start countdown')).toBeVisible();
  await expect(vertical.locator('.battle-intro span')).toHaveCSS('opacity','1');
  await obs.screenshot({path:`${out}/horizontal.png`});await vertical.screenshot({path:`${out}/vertical.png`});
  const label=await intro.innerText();await obs.reload();await expect(obs.getByLabel('Battle start countdown')).toHaveText(label,{useInnerText:true});
  await p.waitForTimeout(3200);await expect(intro).toHaveText(label,{useInnerText:true});
  expect((await snapshot()).timer.elapsedMs).toBe(0);
  await p.getByRole('button',{name:'Resume practice',exact:true}).click();
 }
 await expect(status).toHaveAttribute('data-battle-status','active',{timeout:7000});await expect(intro).toHaveCount(0);
 await expect.poll(async()=>(await snapshot())?.countdown?.releasedAt).toBeTruthy();
 const run=await snapshot();
 for(let loop=1;loop<=loops;loop++){
  await playNotes(p,pitches);
  if(loop<loops){await expect(p.getByText(`Loop ${loop+1} of ${loops}`,{exact:true})).toBeVisible();await expect(intro).toHaveCount(0);}
 }
 await expect(status).toHaveAttribute('data-battle-status','victory');
 const final=await snapshot();expect(final.attemptId).toBe(run.attemptId);expect(final.countdown).toEqual(run.countdown);
 await obs.reload();await expect(obs.getByLabel('Battle start countdown')).toHaveCount(0);
 if(loops===1){await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();await expect(intro).toBeVisible();await p.getByRole('button',{name:'Stop practice',exact:true}).click();await expect(intro).toHaveCount(0);}
 }finally{await ctx.close();}
});
