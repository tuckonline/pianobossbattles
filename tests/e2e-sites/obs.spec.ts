import { test, expect } from "@playwright/test";

test("OBS follows practice in an independent browser context and reconnects", async ({
  browser,
}) => {
  const id=`obs-e2e-${crypto.randomUUID()}`;
  const headers = {
    "oai-authenticated-user-id": id,
    "oai-authenticated-user-email": `${id}@example.test`,
  };
  const practiceContext = await browser.newContext({
    extraHTTPHeaders: headers,
  });
  const overlayContext = await browser.newContext({
    extraHTTPHeaders: headers,
    viewport: { width: 1920, height: 1080 },
  });
  const practice = await practiceContext.newPage(),
    overlay = await overlayContext.newPage();
  try {
    await practice.goto(
      "http://127.0.0.1:8787/student/practice?collection=beginner",
    );
    await expect(
      practice.getByRole("link", { name: /Live banner/ }),
    ).toHaveAttribute("href", "/obs");
    await overlay.goto("http://127.0.0.1:8787/obs");
    await expect(overlay.locator("h1")).toHaveText("Mary Had a Little Lamb");
    await practice.getByLabel("Piece", { exact: true }).selectOption("4003");
    await practice.getByLabel("Hands", { exact: true }).selectOption("right");
    await expect(overlay.locator("h1")).toHaveText("Hot Cross Buns");
    await expect(overlay.locator(".obs-hands")).toContainText("Right hand");
    await practice.getByLabel("Show note hints").check();
    await practice.getByRole("button", { name: "Start MIDI practice" }).click();
    await practice
      .getByRole("button", { name: "Play C4", exact: true })
      .click();
    await expect(overlay.locator(".obs-metrics")).toContainText("1");
    await practice
      .getByRole("button", { name: "Play E4", exact: true })
      .click();
    await expect(overlay.locator(".obs-metrics")).toContainText("50%");
    await expect(overlay.locator(".obs-progress")).toContainText(
      "Measure 1 / 8",
    );
    await expect(
      overlay.locator("nav, button, select, input, .notation"),
    ).toHaveCount(0);
    expect(
      await overlay.evaluate(() => ({
        body: getComputedStyle(document.body).backgroundColor,
        html: getComputedStyle(document.documentElement).backgroundColor,
        overflow:
          document.documentElement.scrollWidth > innerWidth ||
          document.documentElement.scrollHeight > innerHeight,
      })),
    ).toEqual({
      body: "rgba(0, 0, 0, 0)",
      html: "rgba(0, 0, 0, 0)",
      overflow: false,
    });
    const box = await overlay.locator(".obs-panel").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x+box!.width).toBeLessThanOrEqual(1920);
    expect(box!.y + box!.height).toBeLessThan(1080);
    await overlay.screenshot({
      path: "../../work/obs-overlay.png",
      omitBackground: true,
    });
    await overlayContext.setOffline(true);
    await expect(overlay.locator(".obs-status")).toContainText("Reconnecting");
    await practice.getByRole("button", { name: "Stop practice" }).click();
    await practice.getByLabel("Hands", { exact: true }).selectOption("left");
    await overlayContext.setOffline(false);
    await expect(overlay.locator(".obs-hands")).toContainText("Left hand");
    await expect(overlay.locator(".obs-progress")).toHaveCount(0);
    await overlay.reload();
    await expect(overlay.locator(".obs-hands")).toContainText("Left hand");
  } finally {
    await practiceContext.close();
    await overlayContext.close();
  }
});
