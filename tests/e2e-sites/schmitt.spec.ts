import { test, expect } from "@playwright/test";
import { schmittLibrary } from "../../hosted/schmitt-library";
import { noteGroups } from "../../hosted/sight-library";
import { noteName } from "../../src/domains/music/model";
test.use({
  extraHTTPHeaders: {
    "oai-authenticated-user-id": "schmitt-e2e",
    "oai-authenticated-user-email": "schmitt@example.test",
    "oai-authenticated-user-full-name": "Schmitt tester",
  },
});
test("database collection renders held voices and saves a completed note-only exercise", async ({
  page,
}) => {
  await page.goto("/student/practice");
  await page.getByLabel("Practice collection").selectOption("schmitt");
  const select = page.getByLabel("Exercise", { exact: true });
  await expect(select.locator("option")).toHaveCount(213);
  await select.selectOption("2111");
  await expect(page.locator(".notation .note")).toHaveCount(24);
  await page.screenshot({
    path: "../../work/schmitt-held.png",
    fullPage: true,
  });
  await select.selectOption("2213");
  await expect(page.locator(".notation .note")).toHaveCount(64);
  await expect(
    page.locator('a[href="/scores/schmitt-op16.pdf#page=14"]'),
  ).toBeVisible();
  await select.selectOption("2001");
  await expect(page.locator(".notation .note")).toHaveCount(66);
  await page.getByLabel("Hands", { exact: true }).selectOption("right");
  await page.getByLabel("Show note hints").check();
  await page.clock.install();
  await page.getByRole("button", { name: "Start MIDI practice" }).click();
  const groups = noteGroups(schmittLibrary[0], "right");
  for (const [i, g] of groups.entries()) {
    await page
      .getByRole("button", {
        name: `Play ${noteName(g.pitches[0])}`,
        exact: true,
      })
      .click();
    if(i<groups.length-1)await expect(page.getByRole("progressbar")).toHaveAttribute("value",String(i+1));
  }
  await expect(page.getByText(/Saved · 100% note accuracy/)).toBeVisible();
  await page.reload();
  await page.getByLabel("Practice collection").selectOption("schmitt");
  await page.getByLabel("Hands", { exact: true }).selectOption("right");
  await expect(
    page.getByText(/completed attempts with right hand/),
  ).toBeVisible();
});
