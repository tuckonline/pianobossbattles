import { test, expect } from "@playwright/test";
import { installMidiKeyboard, sendMidi, playNotes } from "./helpers/midi";
import { scalesLibrary } from "../../hosted/scales-library";
import { noteGroups } from "../../hosted/sight-library";
test("evaluated combos, pause, persistence, OBS and preview share the existing practice flow", async ({
  page,
}) => {
  test.setTimeout(120000);
  const id = `game-${Date.now()}`;
  await page.context().setExtraHTTPHeaders({
    "oai-authenticated-user-id": id,
    "oai-authenticated-user-email": `${id}@example.test`,
  });
  await installMidiKeyboard(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/student/practice?collection=scales");
  const panel = page.getByRole("region", { name: "Pianist progression" });
  await expect(panel.getByText("Connecting progression…")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Connect keyboard", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start MIDI practice", exact: true })
    .click();
  const notes = noteGroups(scalesLibrary[0], "both").flatMap((g) => g.pitches);
  await playNotes(page, notes.slice(0, 10));
  await expect(panel.locator(".game-combo strong")).toHaveText("10");
  await sendMidi(page, [
    [0x80, 60, 0],
    [0xb0, 64, 127],
  ]);
  await expect(panel.locator(".game-combo strong")).toHaveText("10");
  await page
    .getByRole("button", { name: "Pause practice", exact: true })
    .click();
  await sendMidi(page, [[0x90, 61, 100]]);
  await expect(panel.locator(".game-combo strong")).toHaveText("10");
  await page
    .getByRole("button", { name: "Resume practice", exact: true })
    .click();
  await sendMidi(page, [[0x90, 61, 100]]);
  await expect(panel.locator(".game-combo strong")).toHaveText("0");
  await playNotes(page, notes.slice(10));
  await expect(page.getByText(/Saved · .*1 incorrect notes/)).toBeVisible();
  const state = async () =>
    await (
      await page.request.post("/api/platform", {
        headers: { origin: new URL(page.url()).origin },
        data: { action: "gameState" },
      })
    ).json();
  await expect.poll(async () => (await state()).xp).toBe(305);
  const overlay = await page.context().newPage();
  await overlay.setViewportSize({ width: 1920, height: 1080 });
  await overlay.goto("/obs");
  await expect(overlay.locator(".game-level")).toContainText("305 XP");
  await expect(overlay.locator(".game-combo strong")).toHaveText("20");
  await expect(overlay.locator(".obs-errors")).toHaveText("1");
  await expect(overlay.locator(".game-celebration")).toHaveCount(0);
  expect(
    (await overlay.locator(".game-xp-track").boundingBox())!.height,
  ).toBeGreaterThanOrEqual(12);
  await overlay.screenshot({
    path: "../../work/game-banner-1080.png",
    animations: "disabled",
  });
  await overlay.reload();
  await expect(overlay.locator(".game-level")).toContainText("305 XP");
  expect((await state()).xp).toBe(305);
  await page.reload();
  await expect(panel.locator(".game-level")).toContainText("305 XP");
  await panel
    .getByText("Progression & recording controls", { exact: true })
    .click();
  for (const name of [
    "Preview +10 combo",
    "Preview achievement",
    "Preview level-up",
  ])
    await panel.getByRole("button", { name, exact: true }).click();
  await expect(panel.locator(".game-preview")).toContainText("PREVIEW");
  expect((await state()).xp).toBe(305);
  await panel
    .getByRole("button", { name: "Exit preview", exact: true })
    .click();
  await panel
    .getByRole("button", {
      name: "End recording session & show summary",
      exact: true,
    })
    .click();
  await expect(
    panel.getByRole("region", { name: "Recording session summary" }),
  ).toContainText("+305 XP");
  await panel.screenshot({ path: "../../work/game-controls.png" });
  await overlay.close();
});
test("refresh preserves partial-note XP and continuous passes have distinct receipts", async ({
  page,
}) => {
  const id = `game-recovery-${Date.now()}`;
  await page.context().setExtraHTTPHeaders({
    "oai-authenticated-user-id": id,
    "oai-authenticated-user-email": `${id}@example.test`,
  });
  await installMidiKeyboard(page);
  await page.goto("/student/practice?collection=scales");
  const panel = page.getByRole("region", { name: "Pianist progression" });
  await expect(panel.getByText("Connecting progression…")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Connect keyboard", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start MIDI practice", exact: true })
    .click();
  await playNotes(
    page,
    noteGroups(scalesLibrary[0], "both")
      .flatMap((g) => g.pitches)
      .slice(0, 4),
  );
  await page.reload();
  await expect(panel.locator(".game-level")).toContainText("8 XP");
  await page.goto("/student/sight-read");
  await expect(panel.getByText("Connecting progression…")).toHaveCount(0);
  await page.getByLabel("Practice loops").fill("2");
  await page
    .getByRole("button", { name: "Connect keyboard", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start MIDI practice", exact: true })
    .click();
  // The first Hannah exercise is C4/C3, D4/D3, ...; obtain targets from catalog.
  const { sightLibrary } = await import("../../hosted/sight-library");
  const notes = noteGroups(sightLibrary[0], "both").flatMap((g) => g.pitches);
  await playNotes(page, [...notes, ...notes]);
  await expect(page.getByText(/2 loops complete · Saved · 100%/)).toBeVisible();
  await expect
    .poll(async () => {
      const res = await page.request.post("/api/platform", {
        headers: { origin: new URL(page.url()).origin },
        data: { action: "gameState" },
      });
      return (await res.json()).xp;
    })
    .toBe(8 + notes.length * 4 + 510);
});

test("rapid two-handed chords update counters without re-engraving notation", async ({
  page,
}) => {
  const id = `game-burst-${Date.now()}`;
  await page.context().setExtraHTTPHeaders({
    "oai-authenticated-user-id": id,
    "oai-authenticated-user-email": `${id}@example.test`,
  });
  await installMidiKeyboard(page);
  await page.goto("/student/practice?collection=scales");
  await page
    .getByLabel("Exercise", { exact: true })
    .selectOption(String(scalesLibrary[7].number));
  const panel = page.getByRole("region", { name: "Pianist progression" });
  await expect(panel.getByText("Connecting progression…")).toHaveCount(0);
  await expect(page.locator(".notation svg").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Connect keyboard", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start MIDI practice", exact: true })
    .click();
  const svg = await page.locator(".notation svg").first().elementHandle();
  const notes = noteGroups(scalesLibrary[7], "both").flatMap((g) =>
    [...g.pitches].reverse(),
  );
  await playNotes(page, notes);
  await expect(panel.locator(".game-combo strong")).toHaveText(
    String(notes.length),
  );
  expect(
    await svg!.evaluate((el) => el === document.querySelector(".notation svg")),
  ).toBe(true);
  await expect(page.getByText(/Saved · 100% note accuracy/)).toBeVisible();
});

test("separate OBS celebrations are transparent when idle and show previews and real milestones", async ({
  page,
}) => {
  const id = `game-celebrations-${Date.now()}`;
  await page
    .context()
    .setExtraHTTPHeaders({
      "oai-authenticated-user-id": id,
      "oai-authenticated-user-email": `${id}@example.test`,
    });
  await installMidiKeyboard(page);
  await page.goto("/student/practice?collection=scales");
  const panel = page.getByRole("region", { name: "Pianist progression" });
  await expect(panel.getByText("Connecting progression…")).toHaveCount(0);
  await panel
    .getByText("Progression & recording controls", { exact: true })
    .click();
  await expect(
    panel.getByRole("link", { name: "Transparent celebrations ↗" }),
  ).toHaveAttribute("href", "/obs/celebrations");
  const alerts = await page.context().newPage();
  await alerts.setViewportSize({ width: 250, height: 250 });
  await alerts.goto("/obs/celebrations");
  await expect(alerts.locator(".obs-celebrations-canvas")).toBeVisible();
  await expect(alerts.locator(".obs-panel")).toHaveCount(0);
  await expect(alerts.locator(".game-celebration")).toHaveCount(0);
  expect(
    await alerts.evaluate(() =>
      [
        document.documentElement,
        document.body,
        document.querySelector(".obs-canvas")!,
      ].map((el) => getComputedStyle(el).backgroundColor),
    ),
  ).toEqual(["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)"]);
  await expect(alerts.getByRole("button")).toHaveCount(0);
  await expect(alerts.locator(".obs-celebrations-canvas")).toBeEmpty();
  await panel
    .getByRole("button", { name: "Preview achievement", exact: true })
    .click();
  const card = alerts.locator(".game-celebration");
  await expect(card).toContainText("Flawless Victory");
  await expect(card).toContainText("PREVIEW");
  await expect
    .poll(() => card.evaluate((el) => getComputedStyle(el).opacity))
    .toBe("1");
  const box = await card.boundingBox();
  expect(box!.width).toBe(242);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(250);
  await alerts.screenshot({
    path: "../../work/obs-celebration-source.png",
    omitBackground: true,
  });
  await expect(card).toHaveCount(0, { timeout: 8000 });
  const xp = async () =>
    (
      await (
        await page.request.post("/api/platform", {
          headers: { origin: new URL(page.url()).origin },
          data: { action: "gameState" },
        })
      ).json()
    ).xp;
  expect(await xp()).toBe(0);
  await alerts.reload();
  await expect(alerts.locator(".obs-celebrations-canvas")).toBeVisible();
  await expect(card).toHaveCount(0);
  await panel
    .getByRole("button", { name: "Exit preview", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Connect keyboard", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start MIDI practice", exact: true })
    .click();
  await playNotes(
    page,
    noteGroups(scalesLibrary[0], "both")
      .flatMap((g) => g.pitches)
      .slice(0, 10),
  );
  await expect(card).toBeVisible();
  await expect.poll(xp).toBe(45);
  await expect(card).toHaveCount(0, { timeout: 14000 });
  expect(await xp()).toBe(45);
  await expect(alerts.locator(".obs-celebrations-canvas")).toBeEmpty();
  await alerts.reload();
  await expect(alerts.getByRole("button")).toHaveCount(0);
  await expect(alerts.locator(".obs-celebrations-canvas")).toBeEmpty();
  expect(await xp()).toBe(45);
  await page
    .getByRole("button", { name: "Stop practice", exact: true })
    .click();
  await alerts.close();
});


