import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {noteGroups,type Exercise} from '../../hosted/sight-library';
import {noteName} from '../../src/domains/music/model';
const data=JSON.parse(readFileSync('hosted/data/repertoire.json','utf8')) as Exercise[];
const ex=data.find(e=>e.number===7004)!;

test('photo arrangement renders, plays, grades and saves from Repertoire',async({page})=>{
  const id=`weasel-${Date.now()}`;
  await page.setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  await page.setViewportSize({width:1400,height:1000});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/student/repertoire');
  await page.getByRole('link',{name:'Practise Pop! Goes the Weasel',exact:true}).click();
  await expect(page.getByLabel('Exercise',{exact:true})).toHaveValue('7004');
  await expect(page.getByLabel('Tempo',{exact:true})).toHaveCount(0);
  await expect(page.locator('svg .note')).toHaveCount(69);
  await expect(page.locator('svg .note[data-beat="36"][data-hand="left"]')).toHaveCount(2);
  await page.locator('.sight-score').screenshot({path:'../../work/pop-goes-the-weasel-score.png'});
  await page.getByRole('button',{name:'Listen',exact:true}).click();
  await expect(page.getByRole('button',{name:'Stop listening',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Stop listening',exact:true}).click();
  await page.clock.install();await page.clock.pauseAt(new Date());
  await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
  const groups=noteGroups(ex,'both');
  for(const [i,g] of groups.entries()) {
    for(const pitch of g.pitches) await page.getByRole('button',{name:`Play ${noteName(pitch)}`,exact:true}).click();
  }
  await expect(page.getByText(/Saved · 100% note accuracy/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region',{name:'Collection progress',exact:true})).toContainText('1 learning');
  await expect(page.getByText(/1 completed attempts with both hands/)).toBeVisible();
});
