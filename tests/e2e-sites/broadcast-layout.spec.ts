import { test, expect, type Page } from "@playwright/test";
import type { Exercise } from "../../hosted/sight-library";

async function ink(page: Page) {
  return page.locator(".notation .system").evaluateAll(nodes => {
    const shown = nodes.filter(n => getComputedStyle(n).visibility === "visible");
    const bounds = shown.map(n => n.getBoundingClientRect());
    return { count: shown.length, top: Math.min(...bounds.map(b => b.top)), bottom: Math.max(...bounds.map(b => b.bottom)), left: Math.min(...bounds.map(b => b.left)), right: Math.max(...bounds.map(b => b.right)) };
  });
}

test("all collection types fit and center their first and last frames at OBS aspect ratios", async ({ page }) => {
  test.setTimeout(120000);
  const id = `fit-${crypto.randomUUID()}`;
  await page.context().setExtraHTTPHeaders({ "oai-authenticated-user-id": id, "oai-authenticated-user-email": `${id}@example.test` });
  // Avoid Chromium's concurrent 8MB module disk-cache write race in local QA.
  await page.context().route("**/assets/**", route => route.continue());
  const origin = "http://127.0.0.1:8787";
  let sequence = 0;
  const sourceId = crypto.randomUUID();
  await page.goto("/obs/score");
  const sizes = [{ width: 1280, height: 440 }, { width: 1920, height: 700 }, { width: 960, height: 360 }];
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const exerciseNumber of [8025, 9017, 11001, 2001, 4001, 8001, 5001, 1001, 1, 9001, 10001, 7005, 7004]) {
      const response = await page.request.post("/api/platform", { headers: { origin }, data: { action: "practiceExercise", exerciseNumber } });
      expect(response.ok()).toBe(true);
      const exercise: Exercise = await response.json();
      const publish = async (activeMeasure: number, status = "ready") => {
        const r = await page.request.post("/api/obs", { headers: { origin }, data: {
          sourceId, sequence: ++sequence, claim: true,
          snapshot: { exerciseNumber, title: exercise.title ?? `Exercise ${exerciseNumber}`, hand: "both", status, accuracy: null, mistakes: 0,
            measure: activeMeasure + 1, totalMeasures: exercise.right.length,
            score: { activeMeasure, activeBeat: 0, listening: false, compact: true, follow: true, size: { mode: "custom", percent: 300 }, feedback: [] } },
        } });
        expect(r.ok()).toBe(true);
      };
      await publish(0);
      await expect(page.getByRole("main")).toHaveAttribute("aria-label", `OBS score only: ${exercise.title ?? `Exercise ${exerciseNumber}`}`);
      await expect(page.locator('[data-broadcast-ready="true"]')).toBeVisible();
      const verify = async () => {
        // Group rectangles omit stroke joins/caps. The fitting now includes
        // those painted extents, so the geometric center can differ slightly.
        await expect.poll(async () => { const b = await ink(page); return Math.abs((b.top + b.bottom) / 2 - size.height / 2); }).toBeLessThan(4);
        const b = await ink(page);
        expect(b.count).toBeGreaterThan(0); expect(b.count).toBeLessThanOrEqual(2);
        expect(b.top).toBeGreaterThanOrEqual(11); expect(b.bottom).toBeLessThanOrEqual(size.height - 11);
        expect(b.left).toBeGreaterThanOrEqual(11); expect(b.right).toBeLessThanOrEqual(size.width - 11);
        expect(Math.abs((b.left + b.right) / 2 - size.width / 2)).toBeLessThan(4);
      };
      await verify();
      // OBS may lock scrolling. Position is owned by the fixed score frame.
      await page.evaluate(() => window.scrollTo(0, 1000));
      await verify();
      const svg = await page.locator(".notation > svg").first().elementHandle();
      const width = await svg!.evaluate(e => e.getBoundingClientRect().width);
      if (size.width === 1280) await page.screenshot({ path: `../../work/broadcast-fit-${exerciseNumber}.png` });
      await publish(exercise.right.length - 1, "complete");
      await expect.poll(() => page.locator(".sight-active-measure").evaluate(e => e.getBoundingClientRect().bottom)).toBeLessThan(size.height);
      await verify();
      expect(await svg!.evaluate(e => e === document.querySelector(".notation > svg"))).toBe(true);
      expect(await svg!.evaluate(e => e.getBoundingClientRect().width)).toBeCloseTo(width, 1);
      await expect(page.locator("nav,button,.obs-panel,.game-hud")).toHaveCount(0);
    }
  }
});
