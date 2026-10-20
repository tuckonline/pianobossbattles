import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {sightLibrary,noteGroups} from '../../hosted/sight-library';
import {installMidiKeyboard,playNotes} from './helpers/midi';

const out='../../work/v11-review',origin='http://127.0.0.1:8787';
test.use({trace:'retain-on-failure'});

for(const result of ['victory','defeat','timeout'] as const)test(`held ${result}: actual practice controls dismiss, ordinary MIDI preserves`,async({browser})=>{
 test.setTimeout(120000);await mkdir(out,{recursive:true});
 const id=`v11-dismiss-${crypto.randomUUID()}`,ctx=await browser.newContext({viewport:{width:1920,height:750},extraHTTPHeaders:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`}});
 const p=await ctx.newPage(),obs=await ctx.newPage();
 try{
  await installMidiKeyboard(p);await p.goto('/student/sight-read');
  const controls=p.getByRole('region',{name:'Pianist progression'});
  await expect(controls.getByText('Connecting progression…')).toHaveCount(0);
  await controls.getByText('Progression & recording controls',{exact:true}).click();
  await controls.getByLabel('Boss Battle Mode',{exact:true}).check();
  await controls.getByLabel('Also show over my practice score',{exact:true}).check();
  await controls.getByLabel('Game mode',{exact:true}).selectOption(result==='timeout'?'timeAttack':'survival');
  if(result==='timeout')await controls.getByLabel('Explicit time limit',{exact:true}).fill('1');
  else await controls.getByLabel('Boss difficulty',{exact:true}).selectOption('30');
  await p.getByRole('button',{name:'Connect keyboard',exact:true}).click();
  await obs.goto('/obs/recording');await expect(obs.locator('[data-broadcast-ready=true]')).toBeVisible();
  const notes=noteGroups(sightLibrary[0],'both').flatMap(g=>g.pitches),panel=obs.locator('.boss-battle-panel'),overlay=obs.locator('.battle-cinematic');
  for(const action of ['restart','exercise','bossOff'] as const)await test.step(action,async()=>{
   await p.getByLabel('Exercise',{exact:true}).selectOption(String(sightLibrary[0].number));
   await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();await expect(panel).toHaveAttribute('data-battle-status','active');
   const attempt=await panel.getAttribute('data-battle-attempt'),svg=await obs.locator('.notation > svg').first().elementHandle(),practiceSvg=await p.locator('.notation > svg').first().elementHandle();
   await playNotes(p,result==='victory'?notes:result==='defeat'?[1]:notes.slice(0,1));
   await expect(overlay).toHaveAttribute('data-result',result);await expect(overlay).toHaveAttribute('data-phase','holding',{timeout:12000});
   const resultId=await overlay.getAttribute('data-cinematic-id');
   await playNotes(p,result==='timeout'?notes.slice(1,3):notes.slice(0,2));
   await expect(overlay).toHaveAttribute('data-phase','holding');await expect(overlay).toHaveAttribute('data-cinematic-id',resultId!);
   if(result!=='victory')await expect(obs.locator('.practice-note-correct')).toHaveCount(result==='timeout'?3:2);
   expect(await svg!.evaluate(n=>n===document.querySelector('.notation > svg'))).toBe(true);expect(await practiceSvg!.evaluate(n=>n===document.querySelector('.notation > svg'))).toBe(true);
   await expect(obs.locator('.battle-outcome,.battle-result,.game-celebration')).toHaveCount(0);
   await obs.screenshot({path:`${out}/controls-${result}-${action}-held.png`});
   if(result!=='victory'){
    await p.getByRole('button',{name:'Stop practice',exact:true}).click();
    await expect(overlay).toHaveAttribute('data-phase','holding');
   }
   await expect(p.getByRole('button',{name:'Start MIDI practice',exact:true})).toBeEnabled();
   if(action==='restart'){
    await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();await expect(panel).toHaveAttribute('data-battle-status','active');
    expect(await panel.getAttribute('data-battle-attempt')).not.toBe(attempt);
   }else if(action==='exercise')await p.getByLabel('Exercise',{exact:true}).selectOption(String(sightLibrary[1].number));
   else await controls.getByLabel('Boss Battle Mode',{exact:true}).uncheck();
   await expect(overlay).toHaveCount(0);await expect(p.locator('.battle-cinematic')).toHaveCount(0);await expect(obs.locator('[data-broadcast-ready=true]')).toBeVisible();
   if(action!=='exercise')expect(await svg!.evaluate(n=>n===document.querySelector('.notation > svg'))).toBe(true);
   await obs.screenshot({path:`${out}/controls-${result}-${action}-dismissed.png`});
   if(action==='restart')await p.getByRole('button',{name:'Stop practice',exact:true}).click();
  });
  const r=await p.request.post('/api/platform',{headers:{origin},data:{action:'gameState'}});expect(r.ok()).toBe(true);
 }finally{await ctx.close();}
});
