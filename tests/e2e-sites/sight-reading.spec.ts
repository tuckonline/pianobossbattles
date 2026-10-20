import { test, expect } from "@playwright/test";
import { sightLibrary, noteGroups } from "../../hosted/sight-library";
import { noteName } from "../../src/domains/music/model";
test.use({
  extraHTTPHeaders: {
    "oai-authenticated-user-id": "sight-e2e",
    "oai-authenticated-user-email": "sight-e2e@pianopath.test",
    "oai-authenticated-user-full-name": "Sight reader",
  },
});
test("renders all exercises and completes MIDI simulator practice with durable results", async ({
  page,
}) => {
  await page.goto("/student/sight-read");
  await expect(
    page.getByRole("heading", { name: "Sight Read", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Exercise", { exact: true }).locator("option"),
  ).toHaveCount(60);
  await expect(page.locator(".notation > svg")).toBeVisible({ timeout: 30000 });
  await page.getByLabel("Exercise", { exact: true }).selectOption("60");
  await expect(page.locator(".notation > svg")).toBeVisible();
  await page.getByLabel("Exercise", { exact: true }).selectOption("1");
  await page.getByLabel("Hands", { exact: true }).selectOption("right");
  await page.clock.install();
  await page.getByRole("button", { name: "Start MIDI practice" }).click();
  await page.getByRole("button", { name: "Play C♯4", exact: true }).click();
  const groups = noteGroups(sightLibrary[0], "right");
  for (const [i, group] of groups.entries()) {
    const pitch = group.pitches[0];
    await page
      .getByRole("button", { name: `Play ${noteName(pitch)}`, exact: true })
      .click();
    if(i<groups.length-1)await expect(page.getByRole("progressbar")).toHaveAttribute("value",String(i+1));
  }
  await expect(page.getByText(/Saved · .*1 incorrect notes/)).toBeVisible();
  await page.reload();
  await page.getByLabel("Hands", { exact: true }).selectOption("right");
  await expect(
    page.getByText(/completed attempts with right hand/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Stop listening" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop listening" }).click();
});
