import { test, expect } from "@playwright/test";
import { schmittLibrary } from "../../hosted/schmitt-library";
import { musicXml } from "../../hosted/sight-library";
test.use({
  extraHTTPHeaders: {
    "oai-authenticated-user-id": "feedback-e2e",
    "oai-authenticated-user-email": "feedback@example.test",
    "oai-authenticated-user-full-name": "Feedback tester",
  },
});
test("colors individual targets, corrects red to green, and advances without waiting", async ({
  page,
}) => {
  await page.goto("/student/sight-read");
  await expect(
    page.locator(".notation .note[data-pitch]").first(),
  ).toBeAttached();
  await page.clock.install();
  await page.getByRole("button", { name: "Start MIDI practice" }).click();
  await expect(page.locator(".practice-note-correct")).toHaveCount(0);
  await expect(page.locator(".practice-note-current")).toHaveCount(2);
  await page.getByRole("button", { name: "Play C3", exact: true }).click();
  await expect(page.locator(".practice-note-correct")).toHaveCount(1);
  await page.getByRole("button", { name: "Play D4", exact: true }).click();
  await expect(
    page.locator('.practice-note-incorrect[data-pitch="60"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('.practice-note-incorrect[data-pitch="60"]'),
  ).toHaveCSS("fill", "rgb(198, 40, 40)");
  await expect(
    page.locator('.practice-note-correct[data-pitch="48"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('.note[data-beat="4"][class*="practice-note"]'),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Play C4", exact: true }).click();
  await expect(page.locator(".practice-note-incorrect")).toHaveCount(0);
  await expect(page.locator(".practice-note-correct")).toHaveCount(2);
  await expect(
    page.locator('.practice-note-correct[data-pitch="60"]'),
  ).toHaveCSS("fill", "rgb(22, 125, 110)");
  await page.screenshot({
    path: "../../work/note-feedback-correct.png",
    fullPage: true,
  });
  await page.clock.fastForward(30000);
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
  await expect(page.locator(".practice-note-current")).toHaveCount(2);
  await page.getByRole("button", { name: "Stop practice" }).click();
  await page.getByRole("button", { name: "Start MIDI practice" }).click();
  await expect(page.locator(".practice-note-correct")).toHaveCount(0);
  await page.getByRole("button", { name: "Stop practice" }).click();
  await page.goto("/student/practice");
  await page.getByLabel("Practice collection").selectOption("schmitt");
  await page.getByLabel("Exercise", { exact: true }).selectOption("2008");
  await expect(page.locator(".notation .note[data-pitch]")).toHaveCount(
    (musicXml(schmittLibrary[7]).match(/<pitch>/g) ?? []).length,
  );
  await page.getByRole("button", { name: "Start MIDI practice" }).click();
  await expect(page.locator(".practice-note-correct")).toHaveCount(0);
  await expect(page.locator(".practice-note-current")).toHaveCount(2);
});
