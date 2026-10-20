import {test,expect} from '@playwright/test';
import {sightLibrary,noteGroups} from '../../hosted/sight-library';
import {noteName} from '../../src/domains/music/model';
test('Hannah Smith advances on correct pitches regardless of written duration',async({page})=>{
 const id=`hannah-notes-${Date.now()}`;await page.setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
 await page.goto('/student/sight-read');
 await expect(page.getByLabel('Tempo',{exact:true})).toHaveCount(0);
 await page.clock.install({time:new Date("2026-10-14T12:00:00Z")});await page.clock.pauseAt(new Date("2026-10-14T12:00:01Z"));
 await page.getByLabel('Hands',{exact:true}).selectOption('right');await page.getByLabel('Show note hints').check();
 for(const beats of [4,2,1,0.5]){
  const ex=sightLibrary.find(e=>{const g=noteGroups(e,'right');return g.length>1&&g[1].beat-g[0].beat===beats&&g[0].pitches[0]!==g[1].pitches[0]})!;
  const groups=noteGroups(ex,'right');
  await page.getByLabel('Exercise',{exact:true}).selectOption(String(ex.number));
  await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
  for(const pitch of groups[0].pitches)await page.getByRole('button',{name:`Play ${noteName(pitch)}`,exact:true}).click();
  await expect(page.getByText(/^Play: /)).toHaveText(`Play: ${noteName(groups[1].pitches[0])}`);
  await page.clock.fastForward(30000);
  await expect(page.getByRole('progressbar')).toHaveAttribute('value','1');
  await page.getByRole('button',{name:'Stop practice',exact:true}).click();
 }
});

test('Sight Reading publishes collection, selection and MIDI results to independent OBS context',async({browser})=>{
 const id=`hannah-obs-${Date.now()}`,extraHTTPHeaders={'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`};
 const a=await browser.newContext({extraHTTPHeaders}),b=await browser.newContext({extraHTTPHeaders});
 try{const page=await a.newPage(),obs=await b.newPage();await page.goto('http://127.0.0.1:8787/student/sight-read');await obs.goto('http://127.0.0.1:8787/obs');
 await expect(page.getByLabel('Exercise',{exact:true}).locator('option')).toHaveCount(60);
 await expect(obs.locator('h1')).toHaveText('Hannah Smith Part 1 · Exercise 1');
 await page.getByLabel('Exercise',{exact:true}).selectOption('28');await page.getByLabel('Hands',{exact:true}).selectOption('right');
 await expect(obs.locator('h1')).toHaveText('Hannah Smith Part 1 · Exercise 28');await expect(obs.locator('.obs-hands')).toContainText('Right hand');
 await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();const first=noteGroups(sightLibrary[27],'right')[0].pitches[0];await page.getByRole('button',{name:`Play ${noteName(first)}`,exact:true}).click();
 await expect(obs.locator('.obs-metrics')).toContainText('100%');await expect(obs.locator('.obs-progress')).toContainText('Measure 1');
 }finally{await a.close();await b.close();}
});
test('Lullaby accepts the next correct note immediately',async({page})=>{
 const id=`lull-notes-${Date.now()}`;await page.setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
 await page.goto('/student/practice?collection=repertoire');
 await expect(page.getByLabel('Tempo',{exact:true})).toHaveCount(0);
 await page.getByLabel('Hands',{exact:true}).selectOption('right');await page.getByLabel('Show note hints').check();
 await page.clock.install({time:new Date("2026-10-14T12:00:00Z")});await page.clock.pauseAt(new Date("2026-10-14T12:00:01Z"));
 await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
 await page.getByRole('button',{name:'Play B4',exact:true}).click();
 await expect(page.getByText(/^Play: /)).toHaveText('Play: D5');
 await page.getByRole('button',{name:'Play D5',exact:true}).click();
 await expect(page.getByRole('progressbar')).toHaveAttribute('value','2');
});
