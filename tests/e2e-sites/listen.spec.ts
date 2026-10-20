import { test, expect } from "@playwright/test";
test.use({
  extraHTTPHeaders: {
    "oai-authenticated-user-id": "listen-e2e",
    "oai-authenticated-user-email": "listen@example.test",
    "oai-authenticated-user-full-name": "Listen tester",
  },
});
test("Listen decodes audible media without Web Audio, changes volume, stops and restarts", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "AudioContext", {
      value: class {
        constructor() {
          throw new Error("Web Audio unavailable");
        }
      },
    });
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      Object.assign(window, { previewMedia: this });
      return original.call(this);
    };
  });
  await page.goto("/student/practice?collection=beginner");
  await expect(page.locator(".notation .note").first()).toBeVisible();
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Stop listening" }),
  ).toBeVisible();
  const status = () =>
    page.evaluate(() => {
      const media = (window as unknown as { previewMedia: HTMLAudioElement })
        .previewMedia;
      return {
        time: media.currentTime,
        paused: media.paused,
        volume: media.volume,
        duration: media.duration,
        error: media.error?.message,
      };
    });
  await expect.poll(async () => (await status()).time).toBeGreaterThan(0.1);
  expect((await status()).duration).toBeCloseTo(32.08, 1);
  expect((await status()).error).toBeUndefined();
  const peak = await page.evaluate(async () => {
    const media = (window as unknown as { previewMedia: HTMLAudioElement })
      .previewMedia;
    const view = new DataView(await (await fetch(media.src)).arrayBuffer());
    let peak = 0;
    for (let i = 44; i < view.byteLength; i += 2)
      peak = Math.max(peak, Math.abs(view.getInt16(i, true)));
    return peak;
  });
  expect(peak).toBeGreaterThan(1000);
  await page.getByLabel("Playback volume", { exact: true }).fill("40");
  await expect.poll(async () => (await status()).volume).toBe(0.4);
  await page.getByRole("button", { name: "Stop listening" }).click();
  expect((await status()).paused).toBe(true);
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Stop listening" }),
  ).toBeVisible();
  expect((await status()).duration).toBeCloseTo(32.08, 1);
  await page.getByRole("button", { name: "Stop listening" }).click();
  await expect(page.getByRole("button", { name: "Test sound", exact: true })).toHaveCount(0);
});

test("blocked playback reports an error instead of showing silent playback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () =>
      Promise.reject(new DOMException("Sound blocked", "NotAllowedError"));
  });
  await page.goto("/student/sight-read");
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Unable to start audio" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Listen", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Stop listening" }),
  ).toHaveCount(0);
});
