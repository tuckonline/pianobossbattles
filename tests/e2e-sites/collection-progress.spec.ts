import {test,expect} from '@playwright/test';
import {schmittLibrary} from '../../hosted/schmitt-library';
import {noteGroups} from '../../hosted/sight-library';
import {noteName} from '../../src/domains/music/model';
test('collection progress updates on save, reconciles and survives stream resets',async({page, browser})=>{
 const id=`progress-${Date.now()}`;
 const headers={'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`};
 await page.setExtraHTTPHeaders(headers);
 await page.goto('/student/practice?collection=schmitt');
 const summary=page.getByRole('region',{name:'Collection progress',exact:true});
 await expect(summary).toContainText('0 of 213 mastered');
 await expect(summary).toContainText('213 not started');
 const ex=schmittLibrary[9],groups=noteGroups(ex,'both');
 for(let i=0;i<2;i++){
  const r=await page.request.post('/api/platform',{headers:{...headers,origin:'http://127.0.0.1:8787'},data:{action:'sightAttempt',exerciseNumber:ex.number,hand:'both',played:groups.flatMap(g=>g.pitches)}});
  expect(r.ok(),await r.text()).toBeTruthy();
 }
 await page.reload();
 await expect(summary).toContainText('1 learning');
 await page.getByLabel('Exercise',{exact:true}).selectOption('2010');
 await expect(page.getByLabel('Exercise',{exact:true}).locator('option:checked')).toContainText('Learning');
 await page.clock.install();await page.clock.pauseAt(new Date());
 await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
 for(const [i,g] of groups.entries()){
  for(const pitch of g.pitches)await page.getByRole('button',{name:`Play ${noteName(pitch)}`,exact:true}).click();
  await page.clock.fastForward(((groups[i+1]?.beat??ex.durationBeats!)-g.beat)*1000+20);
 }
 await expect(summary).toContainText('1 of 213 mastered');
 await expect(summary).toContainText('0 learning');
 await expect(summary).toContainText('212 not started');
 await expect(page.getByLabel('Exercise',{exact:true}).locator('option:checked')).toContainText('Mastered');
 await page.getByRole('button',{name:'Reset stream stats',exact:true}).click();
 await expect(page.locator('.practice-best')).toContainText('0 completed attempts');
 await expect(summary).toContainText('1 of 213 mastered');
 await page.reload();await expect(summary).toContainText('1 of 213 mastered');
 await summary.getByText('Collection Progress',{exact:true}).click();
 await expect(summary.getByRole('img')).toHaveAttribute('aria-label','1 Mastered, 0 Learning, 0 Due for review, 212 Not started');
 await page.screenshot({path:'../../work/collection-progress.png',fullPage:false});
 const other=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':`${id}-other`,'oai-authenticated-user-email':`${id}-other@example.test`}});
 const otherPage=await other.newPage();await otherPage.goto('http://127.0.0.1:8787/student/practice?collection=schmitt');
 await expect(otherPage.getByRole('region',{name:'Collection progress',exact:true})).toContainText('0 of 213 mastered');
 await other.close();
});
