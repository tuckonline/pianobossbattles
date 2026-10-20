import { test, expect } from "@playwright/test";
test.use({
  extraHTTPHeaders: {
    "oai-authenticated-user-id": "burg-e2e",
    "oai-authenticated-user-email": "burg@example.test",
  },
});
test("all studies are selectable, playable and usable with MIDI feedback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      Object.assign(window, { previewMedia: this });
      return play.call(this);
    };
  });
  await page.goto("/student/practice?collection=burgmuller");
  await expect(page.getByLabel("Practice collection")).toHaveValue(
    "burgmuller",
  );
  await expect(
    page.getByLabel("Exercise", { exact: true }).locator("option"),
  ).toHaveCount(25);
  await expect(
    page.getByLabel("Hands", { exact: true }).locator("option"),
  ).toHaveCount(1);
  await expect(page.locator(".notation .note").first()).toBeVisible();
  await expect(page.locator(".notation .fing").first()).toBeVisible();
  await expect(page.locator(".fingering-guide")).toContainText("1 = thumb");
  await expect(
    page.getByRole("link", { name: /Original score/ }),
  ).toHaveAttribute("href", "/scores/burgmuller-op100.pdf#page=4");
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Stop listening" }),
  ).toBeVisible();
  const duration = () =>
    page.evaluate(
      () =>
        (window as unknown as { previewMedia: HTMLAudioElement }).previewMedia
          .duration,
    );
  expect(await duration()).toBeCloseTo(152.08, 1);
  await page.getByRole("button", { name: "Stop listening" }).click();
  await page.getByRole("button", { name: "Start MIDI practice" }).click();
  await page.getByRole("button", { name: "Play C3", exact: true }).click();
  await expect(
    page.locator('.practice-note-correct[data-pitch="48"]'),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Stop practice" }).click();
  await page.getByLabel("Exercise", { exact: true }).selectOption("5025");
  await expect(
    page.getByRole("link", { name: /Original score/ }),
  ).toHaveAttribute("href", "/scores/burgmuller-op100.pdf#page=38");
  await expect(page.locator(".notation .note").first()).toBeVisible();
  await expect(page.locator(".notation .fing").first()).toBeVisible();
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Stop listening" }),
  ).toBeVisible();
  expect(await duration()).toBeCloseTo(280.08, 1);
  await page.getByRole("button", { name: "Stop listening" }).click();
  await page.getByLabel("Practice collection").selectOption("hanon");
  await expect(
    page.getByLabel("Hands", { exact: true }).locator("option"),
  ).toHaveCount(3);
});
