import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {noteGroups,type Exercise} from '../../hosted/sight-library';
import {noteName} from '../../src/domains/music/model';
const ex=JSON.parse(readFileSync('hosted/data/bach.json','utf8'))[0] as Exercise;

test('Bach collection supports the full Minuet, Listen, MIDI grading and saved progress',async({page})=>{
  test.setTimeout(180000);
  const id=`bach-${Date.now()}`;
  await page.setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  await page.setViewportSize({width:1400,height:1000});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/student/practice?collection=bach&exercise=10001');
  await expect(page.getByLabel('Practice collection')).toHaveValue('bach');
  await expect(page.getByLabel('Exercise',{exact:true})).toHaveValue('10001');
  await expect(page.getByLabel('Tempo',{exact:true})).toHaveCount(0);
  await expect(page.locator('svg .note')).toHaveCount(408);
  await expect(page.locator('svg .note[data-beat="21.25"][data-pitch="67"]')).toHaveCount(1);
  await expect(page.locator('svg .fing')).toHaveCount(92);
  const systems=page.locator('svg .system');
  for(let i=0;i<await systems.count();i++)
    await systems.nth(i).screenshot({path:`../../work/bach-system-${i}.png`});
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
  await page.getByLabel('Practice collection').selectOption('repertoire');
  await expect(page.getByLabel('Exercise',{exact:true})).toHaveValue('7002');
  await page.getByLabel('Practice collection').selectOption('bach');
  await expect(page.getByLabel('Exercise',{exact:true})).toHaveValue('10001');
});
