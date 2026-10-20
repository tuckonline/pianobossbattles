import {test,expect} from '@playwright/test';
import {moonlightLibrary} from '../../hosted/moonlight-library';
import {noteGroups} from '../../hosted/sight-library';
import {noteName} from '../../src/domains/music/model';

for(const viewport of [{width:1540,height:850},{width:1280,height:720}])test(`player hints fit entirely in the camera area at ${viewport.width}px`,async({page})=>{
  const id=`player-hints-${viewport.width}-${Date.now()}`;
  await page.setViewportSize(viewport);
  await page.setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/student/practice?collection=moonlight&stream=1');
  await page.getByLabel('Show note hints',{exact:true}).check();
  await page.clock.install();await page.clock.pauseAt(new Date());
  await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
  const dock=page.locator('.practice-keyboard-docked');
  await expect(dock).toBeVisible();
  await expect(dock).toContainText(`Play: ${noteName(49)} + ${noteName(61)}`);
  await page.clock.runFor(400);
  const geometry=()=>dock.evaluate(e=>{
    const panel=e.getBoundingClientRect(),keyboard=e.querySelector('.keyboard-bed')!.getBoundingClientRect();
    return {top:panel.top,bottom:panel.bottom,keysTop:keyboard.top,keysBottom:keyboard.bottom,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight};
  });
  const r=await geometry();
  expect(r.top).toBeGreaterThanOrEqual(viewport.height*.72);
  expect(r.bottom).toBeLessThanOrEqual(viewport.height);
  expect(r.keysTop).toBeGreaterThan(r.top);
  expect(r.keysBottom).toBeLessThan(r.bottom);
  expect(r.scrollHeight).toBeLessThanOrEqual(r.clientHeight+1);
  await expect.poll(()=>page.locator('.notation .system').first().evaluate(e=>e.getBoundingClientRect().bottom)).toBeLessThan(viewport.height*.72);
  if(viewport.width===1540)await page.screenshot({path:'../../work/player-hints-view.png'});
  const groups=noteGroups(moonlightLibrary[0],'both');
  for(const [i,g] of groups.entries()){
    for(const pitch of g.pitches)await dock.getByRole('button',{name:`Play ${noteName(pitch)}`,exact:true}).click();
    await page.clock.runFor(((groups[i+1]?.beat??16)-g.beat)*1500+30); // default 40 BPM
    if(i===1){
      expect((await geometry()).top).toBeCloseTo(r.top,1);
      await expect(page.locator('.practice-note-correct')).not.toHaveCount(0);
    }
  }
  await expect(page.getByText(/Saved · 100% note accuracy/)).toBeVisible();
  await expect(dock).toHaveCount(0);
  await page.getByRole('button',{name:'Listen',exact:true}).click();
  await expect(page.getByRole('button',{name:'Stop listening',exact:true})).toBeVisible();
  await expect(dock).toBeVisible();
  await page.getByRole('button',{name:'Stop listening',exact:true}).evaluate((e:HTMLButtonElement)=>e.click());
  await expect(dock).toHaveCount(0);
});

test('camera hint docking is optional and never activates outside stream mode',async({page})=>{
  const id=`hints-settings-${Date.now()}`;
  await page.setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  await page.goto('/student/practice?collection=moonlight');
  await page.getByLabel('Show note hints',{exact:true}).check();
  await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
  await expect(page.locator('.practice-keyboard-docked')).toHaveCount(0);
  await page.getByRole('button',{name:'Stop practice',exact:true}).click();
  await page.locator('.score-follow-settings summary').click();
  await page.getByLabel('OBS / stream safe area',{exact:true}).check();
  await page.getByLabel('Keep note hints in the bottom camera area',{exact:true}).uncheck();
  await page.reload();await page.locator('.score-follow-settings summary').click();
  await expect(page.getByLabel('Keep note hints in the bottom camera area',{exact:true})).not.toBeChecked();
  await page.getByLabel('Bottom camera · % of window').fill('10');
  await expect(page.getByLabel('Keep note hints in the bottom camera area',{exact:true})).toBeDisabled();
});
