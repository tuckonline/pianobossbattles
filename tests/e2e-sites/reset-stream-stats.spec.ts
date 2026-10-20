import { test, expect } from '@playwright/test';
import { schmittLibrary } from '../../hosted/schmitt-library';
import { noteGroups } from '../../hosted/sight-library';
test('stream reset persists, reaches OBS and counts new attempts', async ({ browser }) => {
 const id = `reset-${Date.now()}`;
 const headers = {'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`};
 const ctx = await browser.newContext({extraHTTPHeaders:headers});
 const obsCtx = await browser.newContext({extraHTTPHeaders:headers});
 const page = await ctx.newPage(), obs = await obsCtx.newPage();
 const base = 'http://127.0.0.1:8787';
 const exercise = schmittLibrary[0];
 const save = async () => {
  const r = await ctx.request.post(`${base}/api/platform`, {headers:{origin:base},data:{action:'sightAttempt',exerciseNumber:exercise.number,hand:'both',played:noteGroups(exercise,'both').flatMap(g=>g.pitches)}});
  expect(r.ok(), await r.text()).toBeTruthy(); return r.json();
 };
 try {
  await page.goto(`${base}/student/practice?collection=schmitt`);
  const old = await save();
  await page.reload();
  await expect(page.locator('.practice-best')).toContainText('1 completed attempts');
  await obs.goto(`${base}/obs`);
  await expect(obs.locator('.obs-panel')).toContainText('1 completed attempt');
  await page.getByRole('button',{name:'Reset stream stats',exact:true}).click();
  await expect(page.locator('.practice-best')).toContainText('0 completed attempts');
  await expect(obs.locator('.obs-panel')).toContainText('0 completed attempts');
  await expect(obs.locator('.obs-panel')).not.toContainText('100%');
  await page.getByLabel('Practice collection').selectOption('hanon');
  await page.getByLabel('Practice collection').selectOption('schmitt');
  await expect(page.locator('.practice-best')).toContainText('0 completed attempts');
  await page.reload();
  await expect(page.locator('.practice-best')).toContainText('0 completed attempts');
  const next = await save(); expect(next.id).not.toBe(old.id);
  await page.reload();
  await expect(page.locator('.practice-best')).toContainText('1 completed attempts');
  await expect(obs.locator('.obs-panel')).toContainText('1 completed attempt');
  await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
  await expect(page.getByRole('button',{name:'Reset stream stats',exact:true})).toBeDisabled();
 } finally { await ctx.close(); await obsCtx.close(); }
});



