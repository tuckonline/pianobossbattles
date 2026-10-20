import {test,expect} from '@playwright/test';
import data from '../../hosted/data/repertoire.json' with {type:'json'};
import {noteGroups,type Exercise} from '../../hosted/sight-library';
import {installMidiKeyboard,playNotes} from './helpers/midi';
const ex=data.find(e=>e.number===7005)! as Exercise;
test('all 18 bars render, Listen plays, either hand grades, and progress/OBS update',async({page})=>{
  const id=`bwv924-${Date.now()}`;
  await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  await installMidiKeyboard(page);
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/student/repertoire');
  const card=page.locator('article').filter({has:page.getByRole('heading',{name:'Prelude in C major · BWV 924',exact:true})});
  await expect(card.getByRole('link')).toHaveCount(5);
  for(let image=1;image<=4;image++) expect((await page.request.get(`/scores/repertoire/bach-prelude-bwv924-source-${image}.png`)).ok()).toBeTruthy();
  await page.getByRole('link',{name:'Practise Bach’s Prelude in C',exact:true}).click();
  await expect(page.getByLabel('Exercise',{exact:true})).toHaveValue('7005');
  await expect(page.locator('.notation .measure')).toHaveCount(18);
  await expect(page.locator('.notation .note')).toHaveCount(286);
  await expect(page.locator('.notation .note[data-beat="35"][data-pitch="53"][data-hand="right"]')).toHaveCount(1);
  await expect(page.locator('.notation .note[data-beat="38.25"][data-pitch="67"][data-hand="left"]')).toHaveCount(1);
  await expect(page.locator('.notation .note[data-beat="67"][data-pitch="62"][data-hand="right"]')).toHaveCount(1);
  await page.locator('.notation').screenshot({path:'../../work/bwv924-full-score.png'});
  await page.getByText('About this piece & original score',{exact:true}).click();
  await expect(page.locator('.practice-intro')).toContainText('main written notes only');
  await expect(page.locator('.practice-intro').getByRole('link')).toHaveCount(4);
  await page.getByRole('button',{name:'Connect keyboard',exact:true}).click();
  const obs=await page.context().newPage();
  try{
    await obs.goto('/obs');
    await expect(obs.locator('h1')).toHaveText(ex.title!);
    for(const hand of ['right','left','both'] as const){
      await page.getByLabel('Hands',{exact:true}).selectOption(hand);
      await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
      await playNotes(page,noteGroups(ex,hand).flatMap(g=>g.pitches));
      await expect(page.getByText(/Saved · 100% note accuracy/)).toBeVisible();
    }
    await expect(obs.getByText('100%',{exact:true}).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole('region',{name:'Collection progress',exact:true})).toContainText('1 learning');
    await expect(page.getByLabel('Exercise',{exact:true}).locator('option:checked')).toContainText('Learning');
    await page.evaluate(()=>{const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){Object.assign(window,{preludeAudio:this});return original.call(this);};});
    await page.getByRole('button',{name:'Listen',exact:true}).click();
    await expect(page.getByRole('button',{name:'Stop listening',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>(window as unknown as {preludeAudio:HTMLMediaElement}).preludeAudio.duration)).toBeCloseTo(72*60/69+.08,1);
    await page.getByRole('button',{name:'Stop listening',exact:true}).click();
  }finally{await obs.close();}
});

