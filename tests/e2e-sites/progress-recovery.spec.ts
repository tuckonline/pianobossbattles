import { test, expect, type Page } from "@playwright/test";
import { installMidiKeyboard, playNotes } from "./helpers/midi";
import { scalesLibrary } from "../../hosted/scales-library";
import { noteGroups } from "../../hosted/sight-library";
import { readFile } from "node:fs/promises";
const notes = noteGroups(scalesLibrary[0], "both").flatMap((g) => g.pitches);
const headers = () => {
  const id = `recovery-${crypto.randomUUID()}`;
  return {
    "oai-authenticated-user-id": id,
    "oai-authenticated-user-email": `${id}@example.test`,
  };
};
async function start(page: Page) {
  await installMidiKeyboard(page);
  await page.goto("/student/practice?collection=scales");
  await expect(page.locator(".progress-save-status")).toContainText(
    "All progress saved",
  );
  await page
    .getByRole("button", { name: "Connect keyboard", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start MIDI practice", exact: true })
    .click();
}
async function state(page: Page) {
  return (
    await page.request.post("/api/platform", {
      headers: { origin: new URL(page.url()).origin },
      data: { action: "gameState" },
    })
  ).json();
}
for (const complete of [false, true])
  test(`recovers ${complete ? "completed bonuses" : "partial note XP"} after offline browser termination with session storage lost`, async ({
    browser,
    baseURL,
  }) => {
    const auth = headers();
    const old = await browser.newContext({ baseURL, extraHTTPHeaders: auth });
    const page = await old.newPage();
    await start(page);
    await old.setOffline(true);
    await playNotes(page, complete ? notes : notes.slice(0, 4));
    await expect(page.locator(".progress-save-status")).toContainText(
      /Saving progress|Progress needs syncing/,
    );
    // localStorage is disk-persistent; sessionStorage is deliberately NOT restored.
    const disk = await old.storageState();
    await old.close();
    const fresh = await browser.newContext({
      baseURL,
      extraHTTPHeaders: auth,
      storageState: disk,
    });
    const reopened = await fresh.newPage();
    await reopened.goto("/student/profile");
    const xp = complete ? 465 : 8;
    await expect.poll(async () => (await state(reopened)).xp).toBe(xp);
    await expect(reopened.locator(".progress-save-status")).toContainText(
      "All progress saved",
    );
    await expect(
      reopened.getByRole("region", { name: "Saved pianist progress" }),
    ).toContainText(`${xp} XP saved`);
    await reopened.reload();
    await expect(reopened.locator(".progress-save-status")).toContainText(
      "All progress saved",
    );
    expect((await state(reopened)).xp).toBe(xp);
    if (complete) {
      await expect(
        reopened.locator(".profile-achievement.unlocked"),
      ).toHaveCount(4);
      const download = reopened.waitForEvent("download");
      await reopened
        .getByRole("button", { name: "Download progress backup" })
        .click();
      const file = await download;
      const backup = JSON.parse(await readFile((await file.path())!, "utf8"));
      expect(backup.records.game_players[0].total_xp).toBe(xp);
      expect(backup.records.game_unlocks).toHaveLength(4);
      expect(backup.account.id).toBe(auth["oai-authenticated-user-id"]);
      await reopened.setViewportSize({ width: 1440, height: 1100 });
      await reopened.screenshot({
        path: "../../work/progress-profile.png",
        fullPage: true,
      });
    }
    await fresh.close();
  });

test("another live tab cannot abandon a running attempt, and recovery races never duplicate XP", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    extraHTTPHeaders: headers(),
  });
  const practice = await context.newPage();
  await start(practice);
  // Only delay this tab's gamification saves. The second tab stays online.
  await practice.route("**/api/platform", (route) =>
    route.request().postDataJSON()?.action === "gameSync"
      ? route.abort()
      : route.continue(),
  );
  await playNotes(practice, notes.slice(0, 4));
  const profile = await context.newPage();
  await profile.goto("/student/profile");
  await expect(profile.locator(".progress-save-status")).toContainText(
    "Saving progress",
  );
  // A lock observation proves recovery sees the owning practice document.
  expect(
    await profile.evaluate(async () =>
      (await navigator.locks.query()).held?.some((l) =>
        l.name?.startsWith("recovery:pianopath-game-outbox:"),
      ),
    ),
  ).toBe(true);
  expect((await state(profile)).xp).toBe(0);
  await playNotes(practice, notes.slice(4));
  await practice.unroute("**/api/platform");
  await expect.poll(async () => (await state(profile)).xp).toBe(465);
  await practice.close();
  const second = await context.newPage();
  await second.goto("/student/profile");
  await expect(profile.locator(".progress-save-status")).toContainText(
    "All progress saved",
  );
  await expect(second.locator(".progress-save-status")).toContainText(
    "All progress saved",
  );
  expect((await state(profile)).xp).toBe(465);
  await context.close();
});

test("corrupt and other-account journals are retained and never silently reported as saved", async ({
  page,
}) => {
  const auth = headers();
  await page.context().setExtraHTTPHeaders(auth);
  await page.goto("/student/profile");
  await expect(page.locator(".progress-save-status")).toContainText(
    "All progress saved",
  );
  await page.evaluate((user) => {
    localStorage.setItem(`pianopath-game-outbox:${user}:corrupt`, "broken");
    localStorage.setItem(
      "pianopath-game-outbox:another-user:foreign",
      "private data",
    );
  }, auth["oai-authenticated-user-id"]);
  await page.reload();
  await expect(page.locator(".progress-save-status")).toContainText(
    "Progress needs syncing",
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem("pianopath-game-outbox:another-user:foreign"),
    ),
  ).toBe("private data");
  expect((await state(page)).xp).toBe(0);
});

test("lost server acknowledgments are recovered by concurrent new tabs without a second reward", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    extraHTTPHeaders: headers(),
  });
  const practice = await context.newPage();
  await start(practice);
  await practice.route("**/api/platform", async (route) => {
    if (route.request().postDataJSON()?.action !== "gameSync")
      return route.continue();
    await route.fetch(); // The server commits, but the client never sees the reply.
    await route.abort();
  });
  await playNotes(practice, notes.slice(0, 4));
  await expect.poll(async () => (await state(practice)).xp).toBe(8);
  await expect(practice.locator(".progress-save-status")).not.toContainText(
    "All progress saved",
  );
  await practice.close();
  const [one, two] = await Promise.all([context.newPage(), context.newPage()]);
  await Promise.all([
    one.goto("/student/profile"),
    two.goto("/student/profile"),
  ]);
  for (const page of [one, two])
    await expect(page.locator(".progress-save-status")).toContainText(
      "All progress saved",
    );
  expect((await state(one)).xp).toBe(8);
  await context.close();
});

test("storage failures show an explicit warning and offline recovery downloads remain available", async ({
  page,
}) => {
  await page.context().setExtraHTTPHeaders(headers());
  await page.goto("/student/profile");
  await expect(page.locator(".progress-save-status")).toContainText(
    "All progress saved",
  );
  await page.context().setOffline(true);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download progress backup" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("pianopath-offline-recovery.json");
  await expect(
    page.getByText("Offline recovery file downloaded.", { exact: false }),
  ).toBeVisible();
  await page.context().setOffline(false);
  await installMidiKeyboard(page);
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("pianopath-game-outbox:"))
        throw new DOMException("Full", "QuotaExceededError");
      return set.call(this, key, value);
    };
  });
  await page.goto("/student/practice?collection=scales");
  await expect(page.locator(".progress-save-status")).toContainText(
    "All progress saved",
  );
  await page
    .getByRole("button", { name: "Connect keyboard", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start MIDI practice", exact: true })
    .click();
  await playNotes(page, notes.slice(0, 4));
  await expect(page.locator(".progress-save-status")).toContainText(
    "Local recovery storage is unavailable",
  );
  await expect.poll(async () => (await state(page)).xp).toBe(8);
});

test("navigating to Profile finalizes an interrupted exercise while background recovery stays connected", async ({ page }) => {
  await page.context().setExtraHTTPHeaders(headers());
  await start(page);
  await playNotes(page, notes.slice(0, 4));
  await page.getByRole("link", { name: "Your profile", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your profile", exact: true })).toBeVisible();
  await expect(page.locator(".progress-save-status")).toContainText("All progress saved");
  const backup = await (await page.request.post("/api/platform", { headers: { origin: new URL(page.url()).origin }, data: { action: "gameBackup" } })).json();
  expect(backup.records.game_attempts).toHaveLength(1);
  expect(backup.records.game_attempts[0].status).toBe("abandoned");
  expect(backup.records.game_players[0].total_xp).toBe(8);
});
