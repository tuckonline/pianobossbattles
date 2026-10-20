import {test,expect} from '@playwright/test';
import {moonlightLibrary} from '../../hosted/moonlight-library';
import {noteGroups} from '../../hosted/sight-library';
import {noteName} from '../../src/domains/music/model';
import {installMidiKeyboard,playNotes} from './helpers/midi';

test('exercise 7 draws chromatic symbols and grades the keys they represent',async({page})=>{
  const id=`moonlight-chromatic-${Date.now()}`;
  await page.setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  await installMidiKeyboard(page);
  await page.goto('/student/practice?collection=moonlight');
  await page.getByLabel('Exercise',{exact:true}).selectOption('9007');
  await page.getByLabel('Hands',{exact:true}).selectOption('right');
  const target=(pitch:number,beat:number)=>page.locator(`.notation .note[data-hand="right"][data-pitch="${pitch}"][data-beat="${beat}"]`);
  for(const [pitch,beat] of [[65,2],[67,5],[60,9]]) {
    await expect(target(pitch,beat).locator('.accid use')).toBeVisible();
  }
  await page.locator('.sight-score').screenshot({path:'../../work/moonlight-7-corrected.png'});
  await page.getByRole('button',{name:'Connect keyboard',exact:true}).click();
  await page.getByLabel('Show note hints').check();
  await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
  await playNotes(page,[63,64]);
  await expect(page.getByText(/^Play: /)).toHaveText('Play: F4');
  await expect(target(65,2)).toHaveClass(/practice-note-current/);
  await playNotes(page,[64]); // The repeated E natural must not pass as E sharp.
  await expect(page.getByRole('progressbar',{name:'Exercise progress'})).toHaveAttribute('value','2');
  await expect(page.locator('.practice-progress')).toContainText('1 incorrect');
  await playNotes(page,[65,66,66]);
  await expect(page.getByText(/^Play: /)).toHaveText('Play: G4');
  await playNotes(page,[67,68,69,59]);
  await expect(page.getByText(/^Play: /)).toHaveText('Play: C4');
  await playNotes(page,[60,61,63,64,63,61]);
  await expect(page.getByText(/Saved · .*1 incorrect notes/)).toBeVisible();
});

test('Moonlight course renders all lessons and can jump through the learning path',async({page})=>{
  test.setTimeout(120000);
  const id=`moonlight-render-${Date.now()}`;
  await page.setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  await page.goto('/student/practice?collection=moonlight');
  await expect(page.getByLabel('Practice collection')).toHaveValue('moonlight');
  await expect(page.getByLabel('Exercise',{exact:true}).locator('option')).toHaveCount(33);
  await expect(page.locator('.moonlight-path')).toContainText('Step 1 of 33');
  await page.locator('.moonlight-path summary').click();
  await page.getByRole('button',{name:/3\. Three even notes per beat/}).click();
  await expect(page.getByLabel('Exercise',{exact:true})).toHaveValue('9003');
  await expect(page.locator('.notation .tuplet').first()).toBeVisible();
  await page.screenshot({path:'../../work/moonlight/path.png',fullPage:false});
  await page.locator('.moonlight-path summary').click();
  for(const e of moonlightLibrary) {
    await page.getByLabel('Exercise',{exact:true}).selectOption(String(e.number));
    await expect(page.locator('.notation .measure')).toHaveCount(e.right.length);
    expect(await page.locator('.notation').evaluate(el=>Array.from(el.querySelectorAll(':scope > svg')).every(svg=>svg.getBoundingClientRect().width<=el.getBoundingClientRect().width+1))).toBe(true);
    if([9003,9006,9010,9018,9033].includes(e.number)) await page.locator('.notation').screenshot({path:`../../work/moonlight/lesson-${e.number}.png`});
  }
  await expect(page.locator('.notation .note[data-hand="right"][data-pitch="52"][data-beat="16"]')).toHaveCount(1);
  await page.getByRole('button',{name:'Listen',exact:true}).click();
  await expect(page.getByRole('button',{name:'Stop listening',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Stop listening',exact:true}).click();
  const pdf=await page.request.get('/scores/moonlight/Moonlight_Urtext.pdf');
  expect(pdf.status()).toBe(200);expect(pdf.headers()['content-type']).toContain('application/pdf');
  await page.setViewportSize({width:390,height:844});
  await page.getByLabel('Exercise',{exact:true}).selectOption('9006');
  await expect(page.locator('.notation .measure')).toHaveCount(4);
  expect(await page.locator('.notation').evaluate(el=>Array.from(el.querySelectorAll(':scope > svg')).every(svg=>svg.getBoundingClientRect().width<=el.getBoundingClientRect().width+1))).toBe(true);
  await page.locator('.moonlight-path').screenshot({path:'../../work/moonlight/mobile-path.png'});
});

test('triplet passage grades without timing gates, saves, and synchronizes with OBS',async({page,browser})=>{
  const id=`moonlight-play-${Date.now()}`;
  const headers={'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`};
  await page.setExtraHTTPHeaders(headers);
  await page.goto('/student/practice?collection=moonlight');
  await page.getByLabel('Exercise',{exact:true}).selectOption('9010'); // source measures 5–6

  const obsContext=await browser.newContext({extraHTTPHeaders:headers});
  try {
    const obs=await obsContext.newPage();await obs.goto('http://127.0.0.1:8787/obs');
    await expect(obs.locator('h1')).toHaveText('10. The melody enters · mm. 5–6');
    await page.clock.install();await page.clock.pauseAt(new Date());
    await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
    await expect(page.locator('.notation .note[data-hand="right"][data-pitch="52"][data-beat="0"]')).toHaveClass(/practice-note-current/);
    const e=moonlightLibrary.find(e=>e.number===9010)!;
    const groups=noteGroups(e,'both');
    for(const [i,g] of groups.entries()) {
      for(const pitch of g.pitches) await page.getByRole('button',{name:`Play ${noteName(pitch)}`,exact:true}).click();
      if(i===0) await expect(page.locator('.notation .note[data-pitch="56"].practice-note-current')).toHaveCount(1);
    }
    await expect(page.getByText(/Saved · 100% note accuracy/)).toBeVisible();
    await page.clock.runFor(1500);
    await expect(obs.getByText('100%',{exact:true}).first()).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Exercise',{exact:true}).locator('option[value="9010"]')).toContainText('Learning');
  } finally {await obsContext.close();}
});
