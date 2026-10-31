import { test, expect, type Page } from "@playwright/test";
import {
  clockworkKingdom,
  emptyProgress,
  unlocked,
} from "../../src/domains/realms/registry";
import { realmScore } from "../../src/domains/realms/content";
import {
  referenceEvents,
  summarize,
} from "../../src/domains/realms/performance";
import { advanceProgress } from "../../src/domains/realms/progression";
import type { AttemptReceipt, RunConfig } from "../../src/domains/realms/types";
const id = "a0000000-0000-4000-8000-000000000001";
async function fixture(page: Page, unlockBoss = false) {
  const user = {
    id,
    email: "realm-test@example.test",
    email_confirmed_at: new Date().toISOString(),
    aud: "authenticated",
    role: "authenticated",
    user_metadata: { name: "Realm Pianist" },
    app_metadata: { provider: "email", providers: ["email"] },
    created_at: new Date().toISOString(),
  };
  const token =
    [
      { alg: "HS256", typ: "JWT" },
      {
        sub: id,
        exp: Math.floor(Date.now() / 1000) + 3600,
        role: "authenticated",
      },
    ]
      .map((x) => Buffer.from(JSON.stringify(x)).toString("base64url"))
      .join(".") + ".fixture";
  const session = {
    access_token: token,
    refresh_token: "fixture",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user,
  };
  const progressByDifficulty=new Map<number,ReturnType<typeof emptyProgress>>([[1,emptyProgress()]]);
  let failSave = false;
  const receipts = new Set<string>();
  if (unlockBoss)
    for (const c of clockworkKingdom.challenges.slice(0, 5)) {
      const config: RunConfig = {
        version: 1,
        challengeId: c.id,
        seed: 1,
        key: "C",
        tempo: 50,
        difficulty:1,curriculumVersion:2,gradingVersion:2,
      };
      const score = realmScore(config);
      progressByDifficulty.set(1,advanceProgress(
        progressByDifficulty.get(1)!,
        config,
        summarize(score, referenceEvents(score), c),
        new Date().toISOString(),
      ));
    }
  await page.route("https://huxmltjtovpxxxupuxdg.supabase.co/auth/v1/**", (r) =>
    r.fulfill({ json: r.request().url().includes("/user") ? user : session }),
  );
  await page.route("**/api/auth/session", (r) =>
    r.fulfill({ json: { signedIn: true } }),
  );
  await page.route("**/api/realms", async (r) => {
    const command = r.request().postDataJSON();
    const difficulty=command.difficulty??command.receipt?.config.difficulty??1;
    let progress=progressByDifficulty.get(difficulty)??emptyProgress();
    if (command.action === "finish") {
      if (failSave)
        return r.fulfill({
          status: 503,
          json: { error: "Fixture storage unavailable" },
        });
      const receipt = command.receipt as AttemptReceipt,
        c = clockworkKingdom.challenges.find(
          (c) => c.id === receipt.config.challengeId,
        )!;
      if (!unlocked(c.id, progress))
        return r.fulfill({ status: 403, json: { error: "Locked" } });
      if (!receipts.has(receipt.id)) {
        progress = advanceProgress(
          progress,
          receipt.config,
          summarize(realmScore(receipt.config), receipt.events, c,Infinity,receipt.config.gradingVersion),
          new Date().toISOString(),
        );
        receipts.add(receipt.id);
        progressByDifficulty.set(difficulty,progress);
      }
    }
    await r.fulfill({ json: { progress } });
  });
  await page.addInitScript(
    ({ session }) => {
      localStorage.setItem(
        "sb-huxmltjtovpxxxupuxdg-auth-token",
        JSON.stringify(session),
      );
      const input = {
        id: "realm-midi",
        name: "Realm piano",
        state: "connected",
        connection: "open",
        onmidimessage: null as
          null | ((e: { data: Uint8Array; timeStamp: number }) => void),
        open: async () => {},
        close: async () => {},
      };
      const access = {
        inputs: new Map([[input.id, input]]),
        onstatechange: null as null | (() => void),
      };
      Object.defineProperty(navigator, "requestMIDIAccess", {
        value: async () => access,
      });
      (
        window as unknown as { realmMidiState: (state: string) => void }
      ).realmMidiState = (state) => {
        input.state = state;
        access.onstatechange?.();
      };
      (
        window as unknown as {
          sendRealm: (
            events: {
              type: string;
              pitch?: number;
              velocity?: number;
              channel: number;
              timestamp: number;
            }[],
            origin: number,
          ) => void;
        }
      ).sendRealm = (events, origin) => {
        for (const e of events)
          input.onmidimessage?.({
            data: new Uint8Array([
              (e.type === "NOTE_ON" ? 144 : 128) + e.channel,
              e.pitch!,
              e.velocity!,
            ]),
            timeStamp: origin + e.timestamp,
          });
      };
    },
    { session },
  );
  return {
    progress: () => progressByDifficulty.get(1)!,
    fail: (value: boolean) => {
      failSave = value;
    },
    receipts,
  };
}
async function perform(page: Page, challengeId: string, good = true) {
  const config: RunConfig = {
      version: 1,
      challengeId,
      seed: 1,
      key: "C",
      tempo: 50,
      difficulty:1,curriculumVersion:2,gradingVersion:2,
    },
    score = realmScore(config),
    duration = score.exercise.durationBeats! * 1200;
  await expect(
    page.getByRole("button", { name: "Start performance", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Metronome", { exact: true }).uncheck();
  await page.clock.pauseAt(
    new Date((await page.evaluate(() => Date.now())) + 1000),
  );
  const now = await page.evaluate(() => performance.now());
  await page
    .getByRole("button", { name: "Start performance", exact: true })
    .click();
  if (good)
    await page.evaluate(
      ({ events, origin }) =>
        (
          window as unknown as {
            sendRealm: (e: typeof events, o: number) => void;
          }
        ).sendRealm(events, origin),
      { events: referenceEvents(score), origin: now + 4900 },
    );
  await page.clock.fastForward(duration + 5100);
  await page.clock.resume();
}
test("realm progression plays all five trials and the King, then survives reload", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.clock.install();
  const data = await fixture(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "The Clockwork Kingdom" }),
  ).toBeVisible();
  await expect(page.locator(".realm-node:disabled")).toHaveCount(5);
  await page.screenshot({
    path: "test-results/clockwork-map.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Connect MIDI Piano" }).click();
  for (const c of clockworkKingdom.challenges) {
    await page
      .locator(".realm-node")
      .filter({
        has: page.getByRole("heading", { name: c.title, exact: true }),
      })
      .click();
    if (c.kind === "boss") {
      await expect(
        page.getByRole("region", { name: "Clockwork King introduction" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Skip cinematic" }).click();
    }
    await page
      .getByRole("button", { name: "Enter trial", exact: true })
      .click();
    await perform(page, c.id);
    if (c.kind === "boss") {
      await expect(
        page.getByRole("region", { name: "Kingdom restored" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Skip cinematic" }).click();
    }
    await expect(page.locator(".realm-result-stars")).toHaveAttribute(
      "aria-label",
      "3 stars",
    );
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  }
  expect(data.progress().bossDefeated).toBe(true);
  expect(data.receipts.size).toBe(6);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "The Singing Forest" }),
  ).toBeVisible();
  await expect(page.locator('.realm-node[data-complete="true"]')).toHaveCount(
    6,
  );
  expect(errors).toEqual([]);
});
test("failure offers measured weak-section practice and failed saves remain queued", async ({
  page,
}) => {
  await page.clock.install();
  const data = await fixture(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Connect MIDI Piano" }).click();
  await page.locator(".realm-node").first().click();
  await page.getByRole("button", { name: "Enter trial", exact: true }).click();
  data.fail(true);
  await perform(page, "steady-pulse", false);
  await expect(page.locator(".realm-result-stars")).toHaveAttribute(
    "aria-label",
    "0 stars",
  );
  await expect(page.getByRole("alert")).toContainText(
    "Fixture storage unavailable",
  );
  expect(
    await page.evaluate(
      (id) =>
        JSON.parse(localStorage.getItem(`pbb:realm-outbox:v1:${id}`)!).length,
      id,
    ),
  ).toBe(1);
  data.fail(false);
  await page.getByRole("button", { name: "Retry saving / loading" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Practice weak measures at 40 BPM" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Practice measures 1–4" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start performance", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: "test-results/clockwork-practice.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Return to realm", exact: true })
    .click();
  await expect(page.locator(".realm-node:disabled")).toHaveCount(5);
  expect(data.progress().challenges["steady-pulse"].attempts).toBe(1);
});

test("pause, reconnect and restart preserve one clock and clear prior MIDI feedback", async ({
  page,
}) => {
  await page.clock.install();
  const data = await fixture(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Connect MIDI Piano" }).click();
  await page.locator(".realm-node").first().click();
  await page.getByRole("button", { name: "Enter trial", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start performance", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Metronome", { exact: true }).uncheck();
  await page.clock.pauseAt(
    new Date((await page.evaluate(() => Date.now())) + 1000),
  );
  await page
    .getByRole("button", { name: "Start performance", exact: true })
    .click();
  await page.clock.fastForward(15800);
  await expect(page.getByText("Measure 3 / 8", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.clock.fastForward(30000);
  await expect(page.getByText("Measure 3 / 8", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.clock.fastForward(14400);
  await expect(page.getByText("Measure 6 / 8", { exact: true })).toBeVisible();
  await page.evaluate(() =>
    (
      window as unknown as { realmMidiState: (s: string) => void }
    ).realmMidiState("disconnected"),
  );
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeDisabled();
  await page.evaluate(() =>
    (
      window as unknown as { realmMidiState: (s: string) => void }
    ).realmMidiState("connected"),
  );
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(page.getByText("Measure 1 / 8", { exact: true })).toBeVisible();
  await expect(
    page.locator(".realm-score .practice-note-incorrect"),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Start performance", exact: true })
    .click();
  await page.clock.fastForward(11000);
  await expect(page.getByText("Measure 2 / 8", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Return to realm", exact: true })
    .click();
  expect(data.receipts.size).toBe(0);
  await page.clock.resume();
});

test("tablet boss respects reduced motion, advances musical phases and finishes with constructive defeat", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 1200 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await fixture(page, true);
  await page.goto("/");
  await page.getByRole("button", { name: "Connect MIDI Piano" }).click();
  await page.locator(".boss-node").click();
  await expect(
    page.getByRole("region", { name: "Clockwork King introduction" }),
  ).toHaveAttribute("data-reduced-motion", "true");
  expect(
    await page
      .locator(".king-gear")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Enter trial", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start performance", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Metronome", { exact: true }).uncheck();
  await page.clock.pauseAt(
    new Date((await page.evaluate(() => Date.now())) + 1000),
  );
  await page
    .getByRole("button", { name: "Start performance", exact: true })
    .click();
  await page.clock.fastForward(5000);
  await expect(
    page.getByText("THE CLOCKWORK KING · The Awakening", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/clockwork-playing-tablet.png",
    fullPage: true,
  });
  const box = await page.locator(".realm-score").boundingBox();
  expect(box!.width).toBeLessThanOrEqual(900);
  expect(box!.height).toBeGreaterThan(700);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const phase of [
    "The Acceleration",
    "The Broken Pendulum",
    "The Final Alignment",
  ]) {
    await page.clock.fastForward(38400);
    await expect(
      page.getByText(`THE CLOCKWORK KING · ${phase}`, { exact: true }),
    ).toBeVisible();
    expect(
      Number(
        await page
          .locator(".realm-score .notation-broadcast")
          .getAttribute("data-broadcast-first"),
      ),
    ).toBeGreaterThan(0);
    expect(
      await page.locator(".realm-score").evaluate((root) => {
        const frame = root.getBoundingClientRect();
        return [...root.querySelectorAll(".system")]
          .filter((s) => getComputedStyle(s).visibility !== "hidden")
          .every((s) => {
            const box = s.getBoundingClientRect();
            return (
              box.left >= frame.left - 1 &&
              box.right <= frame.right + 1 &&
              box.top >= frame.top - 1 &&
              box.bottom <= frame.bottom + 1
            );
          });
      }),
    ).toBe(true);
  }
  await page.clock.fastForward(38400);
  await page.clock.resume();
  await expect(
    page.getByRole("region", { name: "The King awaits" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".realm-result-stars")).toHaveAttribute(
    "aria-label",
    "0 stars",
  );
  await expect(
    page.getByRole("button", { name: "Practice weak measures at 40 BPM" }),
  ).toBeVisible();
  await expect(
    page.getByText("Overall accuracy: 0%", { exact: true }),
  ).toBeVisible();
});
