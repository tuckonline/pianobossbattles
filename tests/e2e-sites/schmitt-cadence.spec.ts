import {test,expect} from '@playwright/test';
import {schmittLibrary} from '../../hosted/schmitt-library';
import {noteGroups,practicePass} from '../../hosted/sight-library';
import {noteName} from '../../src/domains/music/model';
for (const continuous of [true,false]) test(`three Schmitt passes, closing note only on final pass (continuous=${continuous})`,async({page})=>{
 const id=`cadence-${Date.now()}-${continuous}`;
 await page.setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
 const saves:any[]=[];
 page.on('request',r=>{if(r.url().endsWith('/api/platform')&&r.method()==='POST'&&r.postDataJSON()?.action==='sightAttempt')saves.push(r.postDataJSON());});
 await page.goto('/student/practice?collection=schmitt');
 await page.getByLabel('Exercise',{exact:true}).selectOption('2010');
 await page.getByLabel('Practice passes').fill('3');
 await page.getByLabel('Practice passes').blur();
 if(!continuous)await page.getByRole('checkbox',{name:/Continuous/}).uncheck();
 await page.clock.install();await page.clock.pauseAt(new Date());
 await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
 const ex=schmittLibrary[9];
 for(let pass=1;pass<=3;pass++){
  await expect(page.getByText(`Pass ${pass} of 3`,{exact:true})).toBeVisible();
  if(continuous)expect(saves).toHaveLength(0);
  const body=practicePass(ex,pass<3),groups=noteGroups(body,'both');
  for(const [i,g] of groups.entries()){
   for(const pitch of g.pitches)await page.getByRole('button',{name:`Play ${noteName(pitch)}`,exact:true}).click();
   if(i<groups.length-1)await expect(page.getByRole('progressbar')).toHaveAttribute('value',String(i+1));
  }
 }
 await expect(page.getByText(/3 passes complete.*Saved/)).toBeVisible();
 expect(saves).toHaveLength(3);
 expect(saves.map(s=>s.omitClosing)).toEqual([true,true,false]);
 expect(saves[2].played.length).toBe(saves[0].played.length+2);
 await expect(page.locator('.practice-best')).toContainText('100%');
});
