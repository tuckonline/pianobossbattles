import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { noteGroups, type Exercise } from "../../hosted/sight-library";
import { noteName } from "../../src/domains/music/model";
const data = JSON.parse(
  readFileSync("hosted/data/czerny-op599.json", "utf8"),
) as Exercise[];

test.use({
  extraHTTPHeaders: {
    "oai-authenticated-user-id": "czerny-e2e",
    "oai-authenticated-user-email": "czerny@example.test",
    "oai-authenticated-user-full-name": "Czerny tester",
  },
});
test("loads all 100 choices, renders both ends of the book, and saves timed practice", async ({
  page,
}) => {
  await page.goto("/student/practice");
  await page.getByLabel("Practice collection").selectOption("czerny");
  const select = page.getByLabel("Exercise", { exact: true });
  await expect(select.locator("option")).toHaveCount(100);
  await expect(page.locator(".notation .measure")).toHaveCount(32);
  await select.selectOption("3100");
  await expect(
    page.locator('a[href="/scores/czerny-op599.pdf#page=56"]'),
  ).toBeVisible();
  await expect(page.locator(".notation .measure")).toHaveCount(32);
  await expect(page.locator(".notation .tuplet").first()).toBeAttached();
  await page.screenshot({
    path: "../../work/czerny-100-browser.png",
    fullPage: true,
  });
  // The longest study stays in one scrolling document with all measures.
  await select.selectOption("3056");
  await expect(page.locator(".notation .measure")).toHaveCount(80);
  await select.selectOption("3001");
  await expect(page.locator(".notation .measure")).toHaveCount(32);
  await page.getByLabel("Hands", { exact: true }).selectOption("right");
  await page.getByLabel("Show note hints").check();
  await page.clock.install();
  await page.getByRole("button", { name: "Start MIDI practice" }).click();
  const ex = data[0] as Exercise;
  const groups = noteGroups(ex, "right");
  for (const [i, group] of groups.entries()) {
    for (const pitch of group.pitches)
      await page
        .getByRole("button", { name: `Play ${noteName(pitch)}`, exact: true })
        .click();
    if(i<groups.length-1)await expect(page.getByRole("progressbar")).toHaveAttribute("value",String(i+1));
  }
  await expect(page.getByText(/Saved · 100% note accuracy/)).toBeVisible();
  await page.reload();
  await page.getByLabel("Practice collection").selectOption("czerny");
  await page.getByLabel("Hands", { exact: true }).selectOption("right");
  await expect(
    page.getByText(/completed attempts with right hand/),
  ).toBeVisible();
});
