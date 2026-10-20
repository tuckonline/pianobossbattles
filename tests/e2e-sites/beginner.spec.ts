import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { noteGroups, type Exercise } from "../../hosted/sight-library";
import { noteName } from "../../src/domains/music/model";
const pieces = JSON.parse(
  readFileSync("hosted/data/beginner-pieces.json", "utf8"),
) as Exercise[];
test.use({
  extraHTTPHeaders: {
    "oai-authenticated-user-id": "beginner-e2e",
    "oai-authenticated-user-email": "beginner@example.test",
    "oai-authenticated-user-full-name": "Beginner tester",
  },
});
test("repertoire opens ten playable pieces and retains a completed result", async ({
  page,
}) => {
  await page.goto("/student/repertoire");
  await page.getByRole("link", { name: "Play Beginner Pieces" }).click();
  await expect(page.getByLabel("Practice collection")).toHaveValue("beginner");
  const select = page.getByLabel("Piece", { exact: true });
  await expect(select.locator("option")).toHaveCount(10);
  for (const piece of pieces) {
    await select.selectOption(String(piece.number));
    await expect(
      page.getByRole("heading", { name: piece.title, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".notation .measure")).toHaveCount(
      piece.right.length,
    );
    await expect(page.locator(".notation .note")).toHaveCount(
      piece.polyphony!.length,
    );
  }
  await select.selectOption("4003");
  await expect(page.locator(".notation .measure")).toHaveCount(8);
  await page.getByLabel("Hands", { exact: true }).selectOption("right");
  await page.getByLabel("Show note hints").check();
  await page.screenshot({
    path: "../../work/beginner-pieces.png",
    fullPage: true,
  });
  await page.clock.install();
  await page.getByRole("button", { name: "Start MIDI practice" }).click();
  const groups = noteGroups(pieces[2], "right");
  for (const [i, g] of groups.entries()) {
    for (const pitch of g.pitches)
      await page
        .getByRole("button", { name: `Play ${noteName(pitch)}`, exact: true })
        .click();
    if(i<groups.length-1)await expect(page.getByRole("progressbar")).toHaveAttribute("value",String(i+1));
  }
  await expect(page.getByText(/Saved · 100% note accuracy/)).toBeVisible();
  await page.reload();
  await page.getByLabel("Piece", { exact: true }).selectOption("4003");
  await page.getByLabel("Hands", { exact: true }).selectOption("right");
  await expect(
    page.getByText(/completed attempts with right hand/),
  ).toBeVisible();
  await page.getByLabel("Practice collection").selectOption("czerny");
  await expect(
    page.getByLabel("Exercise", { exact: true }).locator("option"),
  ).toHaveCount(100);
});
