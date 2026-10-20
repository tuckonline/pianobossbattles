import { test, expect } from '@playwright/test';

test('Hannah Smith displays separate printed starting fingers on both staves', async ({ page }) => {
  const id = `hannah-fingers-${Date.now()}`;
  await page.setExtraHTTPHeaders({ 'oai-authenticated-user-id': id, 'oai-authenticated-user-email': `${id}@example.test` });
  await page.goto('/student/sight-read');
  for (const [exercise, right, left] of [[1, 1, 5], [11, 4, 2], [37, 1, 1], [55, 5, 5]]) {
    await page.getByLabel('Exercise', { exact: true }).selectOption(String(exercise));
    const fingers = page.locator('.notation .fing');
    await expect(fingers).toHaveCount(2);
    await expect(fingers.nth(0)).toHaveText(String(right));
    await expect(fingers.nth(1)).toHaveText(String(left));
    await expect(fingers.nth(0)).toBeVisible();
    await expect(fingers.nth(1)).toBeVisible();
  }
  await page.locator('.notation').screenshot({ path: '../../work/hannah-fingerings-render.png' });
});
