import {test,expect} from '@playwright/test';
import {schmittLibrary} from '../../hosted/schmitt-library';
import {noteGroups, practicePass} from '../../hosted/sight-library';
import {noteName} from '../../src/domains/music/model';
test.use({extraHTTPHeaders:{'oai-authenticated-user-id':'loops-e2e','oai-authenticated-user-email':'loops@example.test'}});
test('Schmitt completes exactly two passes, accepts final notes immediately, saves each and can stop early',async({page})=>{
 let saves=0;
 page.on('request',r=>{if(r.url().endsWith('/api/platform') && r.method()==='POST' && r.postDataJSON()?.action==='sightAttempt') saves++;});
 await page.goto('/student/practice?collection=schmitt');
 await page.getByLabel('Hands',{exact:true}).selectOption('right');
 await page.getByLabel('Practice passes').fill('2');
 await page.getByLabel('Practice passes').blur();
 await page.clock.install(); await page.clock.pauseAt(new Date());
 await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
 const ex=schmittLibrary[0];
 for(let pass=1;pass<=2;pass++){
  const passEx=practicePass(ex,pass<2), groups=noteGroups(passEx,'right');
  await expect(page.getByText(`Pass ${pass} of 2`,{exact:true})).toBeVisible();
  expect(saves).toBe(0);
  for(const [i,g] of groups.entries()){
   for(const pitch of g.pitches) await page.getByRole('button',{name:`Play ${noteName(pitch)}`,exact:true}).click();
   if(i<groups.length-1)await expect(page.getByRole('progressbar')).toHaveAttribute('value',String(i+1));
  }
 }
 await expect(page.getByText(/2 passes complete/)).toBeVisible();
 expect(saves).toBe(2);
 await expect(page.getByRole('button',{name:'Start MIDI practice',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
 await expect(page.getByText('Pass 1 of 2',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Stop practice',exact:true}).click();
 await page.clock.fastForward(20000);
 await expect(page.getByRole('button',{name:'Start MIDI practice',exact:true})).toBeEnabled();
});

