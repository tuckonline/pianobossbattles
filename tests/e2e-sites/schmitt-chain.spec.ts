import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {installMidiKeyboard,playNotes} from './helpers/midi';
import {schmittLibrary} from '../../hosted/schmitt-library';
import {noteGroups,practicePass} from '../../hosted/sight-library';
import {schmittChain} from '../../hosted/schmitt-chain';
for(const {loops,start,boss='crimson_musical_colossus'} of [{loops:[1],start:0},{loops:[1,1],start:0},{loops:[2,3,1,1,1],start:0},{loops:[2,1,1],start:6},{loops:[2,1,1],start:6,boss:'grinwick'}])test(`Schmitt chain ${start+1}: ${loops.join('-')} ${boss}`,async({browser})=>{
 test.setTimeout(120000);const id=`chain-${crypto.randomUUID()}`;
 const ctx=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`},viewport:{width:1920,height:750}});
 try{
 const p=await ctx.newPage();const frames:{snapshot:{score?:{presentationId?:string};game?:{battle?:{chain?:{exerciseNumber:number;pass:number}}}}}[]=[];const prefetched:number[]=[];ctx.on('request',r=>{if(r.method()==='POST'){try{const b=r.postDataJSON();if(b.action==='practiceExercise')prefetched.push(b.exerciseNumber);}catch{}}});const completed=new Map<string,{played:number[]}>();p.on('request',r=>{if(r.method()==='POST'){try{const b=r.postDataJSON();if(b.snapshot)frames.push(b);if(b.action==='practiceExercise')prefetched.push(b.exerciseNumber);if(b.action==='gameSync'&&b.status==='completed')completed.set(b.attemptId,b);}catch{}}});await installMidiKeyboard(p);await p.goto('/student/practice');
 await p.getByLabel('Practice collection',{exact:true}).selectOption('schmitt');
 const controls=p.getByRole('region',{name:'Pianist progression'}),status=p.getByRole('region',{name:'Practice battle status'});
 await expect(controls.getByText('Connecting progression…')).toHaveCount(0);await controls.getByText('Progression & recording controls',{exact:true}).click();await controls.getByLabel('Boss Battle Mode',{exact:true}).check();
 if(boss==='grinwick')await controls.getByRole('radio',{name:/Grinwick/}).check();
 if(loops.length>1){await p.getByLabel('Play a continuous exercise chain',{exact:true}).check();
 for(let i=0;i<loops.length;i++){await p.getByLabel('Add chain exercise',{exact:true}).selectOption(String(schmittLibrary[start+i].number));await p.getByLabel(`Chain exercise ${i+1} loops`,{exact:true}).fill(String(loops[i]));}
 }
 if(loops.length>1){await p.getByRole('button',{name:'Move chain exercise 2 up',exact:true}).click();await p.getByRole('button',{name:'Move chain exercise 1 down',exact:true}).click();}
 if(loops.length===5){await mkdir('../../work/schmitt-chain',{recursive:true});await p.getByRole('group',{name:'Schmitt exercise chain',exact:true}).screenshot({path:'../../work/schmitt-chain/builder.png'});}
 const obs=await ctx.newPage(),vertical=await ctx.newPage();await obs.goto('/obs/recording');await expect(obs.locator('[data-broadcast-ready=true]')).toBeVisible({timeout:15000});await vertical.setViewportSize({width:1080,height:1920});await vertical.goto('/obs/shorts');
 if(start===6)for(const page of [p,obs,vertical])await page.evaluate(()=>{
  const samples:{pending:boolean;highlights:number;durations:(number|string)[]}[]=[];
  Object.assign(window,{scoreTransitionSamples:samples});
  new MutationObserver(()=>{const n=document.querySelector('.notation');if(!n)return;
   samples.push({pending:n.getAttribute('data-score-pending')==='true',highlights:n.querySelectorAll('.practice-note-current,.practice-note-correct,.practice-note-incorrect').length,durations:n.getAnimations().map(a=>Number(a.effect!.getTiming().duration))});
  }).observe(document.body,{subtree:true,attributes:true,childList:true});
 });
 await p.getByRole('button',{name:'Connect keyboard',exact:true}).click();await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();await expect(p.getByLabel('Battle start countdown')).toBeVisible();
 if(loops.length>1)await expect(p.getByLabel('Add chain exercise')).toBeDisabled();await expect(status).toHaveAttribute('data-battle-status','active',{timeout:7000});await expect(p.getByLabel('Battle start countdown')).toHaveCount(0);
 const snapshot=async()=>{const r=await p.request.get('/api/obs');return (await r.json()).snapshot;};
 const plan=schmittChain(loops.map((n,i)=>({exercise:schmittLibrary[start+i],loops:n})),'both');await expect.poll(async()=>(await snapshot())?.game?.battle?.countdown?.releasedAt).toBeTruthy();const initial=(await snapshot()).game.battle;
 expect(initial.config.bossId).toBe(boss);expect(initial.bossMaxHp).toBe(plan.notes);expect(initial.loopCount).toBe(plan.loops);
 const pitches=(i:number,n:number)=>noteGroups(practicePass(schmittLibrary[start+i],n<loops[i]),'both').flatMap(g=>g.pitches);
 // Stop at an exercise boundary, then deliver the remaining chain in one MIDI
 // burst: every transition must be synchronous, before a React render.
 if(loops.length>1){
  if(start===6)await expect.poll(()=>prefetched.includes(2008)).toBe(true);
  for(let n=1;n<=loops[0];n++){
   const notes=pitches(0,n);
   if(start===6&&n===loops[0]){
    await playNotes(p,notes.slice(0,-1));
    await expect(p.getByLabel('Exercise',{exact:true})).toHaveValue('2007');
    await playNotes(p,notes.slice(-1));
   }else await playNotes(p,notes);
  }
  if(start===6)await playNotes(p,[pitches(1,1)[0]]); // First incoming chord tone during the visual transition.
  await expect(p.getByLabel('Exercise',{exact:true})).toHaveValue(String(schmittLibrary[start+1].number));
  const mid=(await snapshot()).game.battle;expect(mid.attemptId).toBe(initial.attemptId);expect(mid.playerHp).toBe(30);expect(mid.bossHp).toBeLessThan(initial.bossHp);expect(mid.status).toBe('active');expect(mid.countdown).toEqual(initial.countdown);
  await expect(obs.getByLabel('Schmitt chain progress')).toContainText(`SCHMITT 2 / ${loops.length}`);await expect(vertical.getByLabel('Schmitt chain progress')).toContainText(`SCHMITT 2 / ${loops.length}`);
  if(start===6){
   await mkdir('../../work/score-transition',{recursive:true});
   for(const [i,page] of [p,obs,vertical].entries()){
    await expect(page.locator('.notation')).toHaveAttribute('data-score-presentation','2008:1');
    await expect(page.locator('.notation')).toHaveAttribute('data-score-pending','false');
    const samples=await page.evaluate(()=> (window as unknown as {scoreTransitionSamples:{pending:boolean;highlights:number;durations:number[]}[]}).scoreTransitionSamples);
    expect(samples.length).toBeGreaterThan(0);expect(samples.filter(s=>s.pending).every(s=>s.highlights===0)).toBe(true);expect(samples.some(s=>s.pending&&s.durations.includes(100))).toBe(true);expect(samples.some(s=>!s.pending&&s.durations.includes(100))).toBe(true);
    await page.screenshot({path:`../../work/score-transition/view-${i}.png`});
   }
  }
  await p.getByRole('button',{name:'Pause practice',exact:true}).click();await playNotes(p,[12]);expect((await snapshot()).game.battle.playerHp).toBe(30);await p.getByRole('button',{name:'Resume practice',exact:true}).click();
  await expect(obs.getByLabel('Schmitt chain progress')).toHaveCSS('opacity','1');await expect(vertical.getByLabel('Schmitt chain progress')).toHaveCSS('opacity','1');
  await mkdir('../../work/schmitt-chain',{recursive:true});await obs.screenshot({path:'../../work/schmitt-chain/horizontal.png'});await vertical.screenshot({path:'../../work/schmitt-chain/vertical.png'});
 }
 const remaining=loops.flatMap((n,i)=>i===0&&loops.length>1?[]:Array.from({length:n},(_,j)=>pitches(i,j+1)).flat());await playNotes(p,start===6?remaining.slice(1):remaining);
 await expect(status).toHaveAttribute('data-battle-status','victory');await expect.poll(async()=>(await snapshot()).game.battle.correctHits).toBe(plan.notes);const final=(await snapshot()).game.battle;
 expect(final.config.bossId).toBe(boss);expect(final.attemptId).toBe(initial.attemptId);expect(final.countdown).toEqual(initial.countdown);expect(final.correctHits).toBe(plan.notes);expect(final.mistakes).toBe(0);if(loops.length>1)expect(final.chain.index).toBe(loops.length);expect(final.bossHp).toBe(0);
 await expect(p.getByRole('button',{name:'Start MIDI practice',exact:true})).toBeEnabled({timeout:30000});
 if(start===6){expect(frames.some(f=>f.snapshot.score?.presentationId==='2008:1')).toBe(true);for(const {snapshot:s} of frames){const c=s.game?.battle?.chain;if(c)expect(s.score?.presentationId).toBe(`${c.exerciseNumber}:${c.pass}`);}}
 await expect.poll(()=>completed.size).toBe(plan.loops);expect([...completed.values()].reduce((n,a)=>n+a.played.length,0)).toBe(plan.notes);
 await obs.reload();await expect(obs.getByLabel('Battle start countdown')).toHaveCount(0);await expect(obs.getByLabel('BOSS DEFEATED cinematic')).toBeVisible({timeout:15000});
 await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();await expect(p.getByLabel('Battle start countdown')).toBeVisible();await expect(p.getByLabel('Exercise',{exact:true})).toHaveValue(String(schmittLibrary[start].number));await p.getByRole('button',{name:'Stop practice',exact:true}).click();
 }finally{await ctx.close();}
});

for(const mode of ['survival','timeAttack'] as const)test(`Schmitt chain holds ${mode==='survival'?'defeat':'TIME OUT'} across exercise transition`,async({browser})=>{
 test.setTimeout(60000);const id=`chain-terminal-${crypto.randomUUID()}`,ctx=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`}});
 try{const p=await ctx.newPage();await installMidiKeyboard(p);await p.goto('/student/practice');await p.getByLabel('Practice collection').selectOption('schmitt');
 const c=p.getByRole('region',{name:'Pianist progression'}),status=p.getByRole('region',{name:'Practice battle status'});await expect(c.getByText('Connecting progression…')).toHaveCount(0);await c.getByText('Progression & recording controls',{exact:true}).click();await c.getByLabel('Boss Battle Mode',{exact:true}).check();await c.getByLabel('Game mode',{exact:true}).selectOption(mode);
 if(mode==='survival')await c.getByLabel('Boss difficulty').selectOption('30');else await c.getByLabel('Explicit time limit').fill('2');
 await p.getByLabel('Play a continuous exercise chain').check();for(const e of schmittLibrary.slice(0,2))await p.getByLabel('Add chain exercise').selectOption(String(e.number));
 const obs=await ctx.newPage();await obs.goto('/obs/recording');await p.getByRole('button',{name:'Connect keyboard',exact:true}).click();await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();await expect(p.getByLabel('Battle start countdown')).toBeVisible();await expect(status).toHaveAttribute('data-battle-status','active',{timeout:7000});
 const notes=noteGroups(schmittLibrary[0],'both').flatMap(g=>g.pitches);await playNotes(p,mode==='survival'?[12]:notes.slice(0,1));await expect(status).toHaveAttribute('data-battle-status','defeat',{timeout:12000});
 const label=mode==='survival'?'YOU WERE DEFEATED cinematic':'TIME OUT cinematic';await expect(obs.getByLabel(label)).toBeVisible({timeout:15000});await playNotes(p,mode==='survival'?notes:notes.slice(1));await expect(p.getByLabel('Exercise',{exact:true})).toHaveValue(String(schmittLibrary[1].number));await expect(status).toHaveAttribute('data-battle-status','defeat');await expect(obs.getByLabel(label)).toBeVisible();await obs.reload();await expect(obs.getByLabel(label)).toBeVisible({timeout:15000});await expect(obs.getByLabel('Battle start countdown')).toHaveCount(0);await p.getByRole('button',{name:'Stop practice',exact:true}).click();
 }finally{await ctx.close();}
});
