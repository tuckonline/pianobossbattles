import {test,expect} from '@playwright/test';
import {sightLibrary,noteGroups} from '../../hosted/sight-library';
import {noteName} from '../../src/domains/music/model';
test('Hannah Smith fitted score stays the same size after completion, restart and stop',async({page})=>{
 const id=`stable-size-${Date.now()}`;await page.setViewportSize({width:1870,height:960});await page.setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
 await page.addInitScript(()=>localStorage.setItem('pianopath-score-follow',JSON.stringify({version:3,enabled:true,stream:true,top:0,bottom:28})));
 await page.goto('/student/sight-read');await page.getByLabel('Exercise',{exact:true}).selectOption('11');await expect(page.locator('.notation > svg')).toBeVisible();
 await page.clock.install();await page.clock.pauseAt(new Date());await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();await page.clock.runFor(700);
 const size=()=>page.locator('.notation > svg').evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}));const during=await size();expect(during.width).toBeLessThan(1400);
 const ex=sightLibrary[10],groups=noteGroups(ex,'both');
 for(const [i,g] of groups.entries()){
  for(const pitch of g.pitches)await page.getByRole('button',{name:`Play ${noteName(pitch)}`,exact:true}).click();
  await page.clock.runFor(((groups[i+1]?.beat??ex.right.length*4)-g.beat)*1000+25);
 }
 await expect(page.getByText(/Saved · 100% note accuracy/)).toBeVisible();await page.clock.runFor(500);expect(await size()).toEqual(during);
 await expect(page.locator('.practice-note-correct').first()).toBeAttached();
 await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();await page.clock.runFor(500);expect(await size()).toEqual(during);
 await page.getByRole('button',{name:'Stop practice',exact:true}).click();await page.clock.runFor(500);expect(await size()).toEqual(during);
});
