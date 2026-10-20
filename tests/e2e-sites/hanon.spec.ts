import { test, expect } from "@playwright/test";
import { practiceLibrary } from "../../hosted/practice-library";
import { noteGroups } from "../../hosted/sight-library";
import { noteName } from "../../src/domains/music/model";
test.use({
  extraHTTPHeaders: {
    "oai-authenticated-user-id": "hanon-e2e",
    "oai-authenticated-user-email": "hanon@example.test",
    "oai-authenticated-user-full-name": "Hanon tester",
  },
});
test("Hanon is separate, spans both pages, follows sixteenth timing and saves", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/student/practice");
  await expect(
    page.getByRole("heading", { name: "Hanon No. 1", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".notation .system")).toHaveCount(6);
  await expect(page.locator(".notation .measure")).toHaveCount(30);
  await expect(
    page.getByRole("button", { name: "Next score page" }),
  ).toHaveCount(0);
  await page.getByLabel("Hands", { exact: true }).selectOption("right");
  await page.clock.install();
  await page.getByRole("button", { name: "Start MIDI practice" }).click();
  const groups = noteGroups(practiceLibrary[0], "right");
  for (const [i, g] of groups.entries()) {
    await page
      .getByRole("button", {
        name: `Play ${noteName(g.pitches[0])}`,
        exact: true,
      })
      .click();
    if (i === 0) {
      await page.clock.fastForward(150);
      await expect(page.getByRole("progressbar")).toHaveAttribute("value", "0");
      await page.clock.fastForward(125);
    } else
      await page.clock.fastForward(
        ((groups[i + 1]?.beat ?? 60) - g.beat) * 1000 + 25,
      );
  }
  await expect(page.getByText(/Saved · 100% note accuracy/)).toBeVisible();
  await page.reload();
  await page.getByLabel("Hands", { exact: true }).selectOption("right");
  await expect(
    page.getByText(/completed attempts with right hand/),
  ).toBeVisible();
  await page.goto("/student/sight-read");
  await expect(
    page.getByLabel("Exercise", { exact: true }).locator("option"),
  ).toHaveCount(60);
});
