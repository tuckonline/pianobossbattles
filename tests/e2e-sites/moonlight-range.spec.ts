import {test,expect,type Page} from '@playwright/test';
import {moonlightRange} from '../../hosted/moonlight-range';
import {noteGroups} from '../../hosted/sight-library';
import {installMidiKeyboard,playNotes} from './helpers/midi';

async function choose(page:Page,start:number,end:number) {
  await page.getByLabel('Start measure',{exact:true}).fill(String(start));
  await page.getByLabel('End measure',{exact:true}).fill(String(end));
  await page.getByRole('button',{name:'Use measures',exact:true}).click();
  await expect(page.locator('.sight-score h2')).toHaveText(moonlightRange(start,end).title!);
  await expect(page.locator('.notation .measure')).toHaveCount(end-start+1);
}

test.beforeEach(async({page})=>{
  const id=`moonlight-range-${Date.now()}`;
  await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  await installMidiKeyboard(page);
  await page.goto('/student/practice?collection=moonlight');
});

test('ranges 1–3 and 17–25 grade, save separately and reach the OBS banner',async({page})=>{
  test.setTimeout(90000);
  const obs=await page.context().newPage();await obs.goto('/obs');
  await page.getByRole('button',{name:'Connect keyboard',exact:true}).click();
  for(const [start,end] of [[1,3],[17,25]]) {
    const range=moonlightRange(start,end);
    await choose(page,start,end);
    await expect(page.locator('.practice-best')).toContainText('0 completed attempts');
    await expect(obs.locator('h1')).toHaveText(range.title!);
    await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
    await expect(page.getByLabel('Start measure',{exact:true})).toBeDisabled();
    await expect(page.locator('.practice-progress')).toContainText(`Measure ${start} · 1 of ${end-start+1}`);
    await playNotes(page,noteGroups(range,'both').flatMap(g=>g.pitches));
    await expect(page.getByText(/Saved · 100% note accuracy · 0 incorrect/)).toBeVisible();
    await expect(page.locator('.practice-best')).toContainText('1 completed attempts');
    await expect(page.getByLabel('Start measure',{exact:true})).toBeEnabled();
    await expect(obs.locator('.obs-metrics')).toContainText('100%');
    await expect(page.getByRole('region',{name:'Collection progress',exact:true})).toContainText('33 not started');
  }
  await page.reload();
  await choose(page,17,25);
  await expect(page.locator('.practice-best')).toContainText('1 completed attempts');
  await expect(page.getByLabel('Exercise',{exact:true}).locator('option[value="9033"]')).toContainText('Not started');
  await page.getByRole('button',{name:'Return to learning path',exact:true}).click();
  await expect(page.getByLabel('Exercise',{exact:true})).toHaveValue('9001');
  await obs.close();
});

test('single measure supports either hand, Listen plays only its duration, and invalid ranges are rejected',async({page})=>{
  await page.getByLabel('Start measure',{exact:true}).fill('25');
  await page.getByLabel('End measure',{exact:true}).fill('17');
  await page.getByRole('button',{name:'Use measures',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('end at or after the start');
  await choose(page,69,69);
  await page.getByRole('button',{name:'Connect keyboard',exact:true}).click();
  for(const hand of ['left','right'] as const) {
    await page.getByLabel('Hands',{exact:true}).selectOption(hand);
    await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
    await playNotes(page,noteGroups(moonlightRange(69,69),hand).flatMap(g=>g.pitches));
    await expect(page.getByText(/Saved · 100% note accuracy/)).toBeVisible();
  }
  await page.evaluate(()=>{
    const original=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){Object.assign(window,{rangeAudio:this});return original.call(this);};
  });
  await page.getByRole('button',{name:'Listen',exact:true}).click();
  await expect(page.getByRole('button',{name:'Stop listening',exact:true})).toBeVisible();
  const duration=await page.evaluate(()=>(window as unknown as {rangeAudio:HTMLMediaElement}).rangeAudio.duration);
  expect(duration).toBeCloseTo(4*60/64+.08,2);
  await page.getByRole('button',{name:'Stop listening',exact:true}).click();
  const headers={origin:new URL(page.url()).origin};
  const incomplete=await page.request.post('/api/platform',{headers,data:{action:'sightAttempt',exerciseNumber:moonlightRange(17,25).number,hand:'both',played:[60]}});
  expect(incomplete.status()).toBe(400);
  const invalid=await page.request.post('/api/platform',{headers,data:{action:'sightAttempt',exerciseNumber:106970,hand:'both',played:[60]}});
  expect(invalid.status()).toBe(404);
  await choose(page,17,25);
  await page.locator('.moonlight-path').screenshot({path:'../../work/moonlight-range-controls.png'});
  await page.locator('.sight-score').screenshot({path:'../../work/moonlight-range-score.png'});
  await page.setViewportSize({width:390,height:844});
  await page.locator('.moonlight-range').screenshot({path:'../../work/moonlight-range-mobile.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await choose(page,1,69);
  await expect(page.getByLabel('Exercise',{exact:true})).toHaveValue('9033');
  await page.getByLabel('Exercise',{exact:true}).selectOption('9007');
  await expect(page.getByRole('button',{name:'Return to learning path',exact:true})).toHaveCount(0);
});
