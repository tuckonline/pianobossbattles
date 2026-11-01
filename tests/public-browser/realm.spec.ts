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
import type { AttemptReceipt, RunConfig, PerformanceResult } from "../../src/domains/realms/types";
import { royalCatalog, legacyMusicItem } from "../../src/domains/economy/music-catalog";
import royalScores from "../../public-app/royal-scores.json" with { type: "json" };
import { noteGroups, type Exercise } from "../../hosted/sight-library";
const id = "a0000000-0000-4000-8000-000000000001";
async function fixture(page: Page, unlockBoss = false, freshAnimations = false) {
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
  let gold = 0, practiceMs = 0, revision = 0, failPractice = false;
  const practiceSessions = new Map<string, number>(), milestones = new Set<string>();
  const goldAwards = new Map<string, number>();
  const confirmations = new Map<string, {result:PerformanceResult;completion:{firstClear:boolean;improved:boolean}}>();
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
  await page.route("**/api/music-room", r => {
    const body = r.request().postDataJSON();
    if (body.action === "practice") {
      if (failPractice && body.activeMs > 0) {
        failPractice = false;
        return r.fulfill({ status: 503, json: { error: "Fixture retry" } });
      }
      const delta = Math.max(0, body.activeMs - (practiceSessions.get(body.sessionId) ?? 0));
      const before = Math.floor(practiceMs / 72000);
      practiceMs += delta; gold += Math.floor(practiceMs / 72000) - before;
      if (delta) revision++;
      practiceSessions.set(body.sessionId, Math.max(body.activeMs, practiceSessions.get(body.sessionId) ?? 0));
    }
    return r.fulfill({ json: { economy: { version: 1, revision, gold, owned: [], practiceMs }, catalog: [], activeMs: practiceSessions.get(body.sessionId) ?? 0 } });
  });
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
        const result = summarize(realmScore(receipt.config), receipt.events, c, Infinity, receipt.config.gradingVersion);
        const previous=progress.challenges[c.id];
        confirmations.set(receipt.id,{result,completion:{firstClear:result.passed&&!previous?.completed,improved:previous!==undefined&&result.accuracy>previous.bestAccuracy}});
        const amount = result.passed && !milestones.has(c.id) ? c.kind === "boss" ? 5 : 2 : 0;
        if (amount) milestones.add(c.id);
        gold += amount; revision++; goldAwards.set(receipt.id, amount);
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
    await r.fulfill({ json: { progress, economy: { version: 1, revision, gold, owned: [], practiceMs },
      ...(command.action === "finish" ? { ...confirmations.get(command.receipt.id), award: { amount: goldAwards.get(command.receipt.id), reason: "Fixture milestone confirmed." } } : {}) } });
  });
  await page.addInitScript(
    ({ session, freshAnimations, trialIds }) => {
      localStorage.setItem(
        "sb-huxmltjtovpxxxupuxdg-auth-token",
        JSON.stringify(session),
      );
      const presentationKey=`pbb:realm-presentation:v1:${session.user.id}`;
      if(!freshAnimations&&!localStorage.getItem(presentationKey))localStorage.setItem(presentationKey,JSON.stringify({
        version:1,preference:"balanced",seen:["realm:clockwork-kingdom",...trialIds.flatMap(id=>[`entry:${id}`,`clear:1:${id}`])],
      }));
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
    { session, freshAnimations, trialIds: clockworkKingdom.challenges.map(c=>c.id) },
  );
  return {
    progress: () => progressByDifficulty.get(1)!,
    fail: (value: boolean) => {
      failSave = value;
    },
    receipts,
    practiceMs: () => practiceMs,
    openedPractice: () => practiceSessions.size > 0,
    failPractice: () => { failPractice = true; },
  };
}
async function perform(page: Page, challengeId: string, good = true) {
  const config: RunConfig = {
      version: 1,
      challengeId,
      seed: 1,
      key: "C",
      tempo: 50,
      difficulty:1,curriculumVersion:2,studyVersion:2,positionVersion:1,gradingVersion:2,
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
// Seek CSS independently of the game clock to inspect the staged visual reveals.
async function showAnimationBeat(page: Page, milliseconds: number) {
  await page.locator(".realm-transition").evaluate((el,time)=>el.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=time;}),milliseconds);
}
test("Balanced entrances stage their reveals and only mark viewed on completion or skip", async ({page}) => {
  await page.clock.install();
  await fixture(page,false,true);
  await page.goto("/?mode=adventure");
  const scene=page.getByRole("region",{name:"Realm animation",exact:true});
  const saved=()=>page.evaluate(id=>JSON.parse(localStorage.getItem(`pbb:realm-presentation:v1:${id}`)! ),id);
  const cinematic=page.getByRole("region",{name:"Realm cinematic",exact:true});
  await expect(cinematic.locator("video")).toBeVisible();
  expect((await saved()).seen).toEqual([]);
  await page.reload();
  await expect(cinematic.locator("video")).toBeVisible();
  await expect(cinematic.locator(".realm-video-title")).toHaveCount(0);
  await cinematic.locator("video").evaluate(v=>{const video=v as HTMLVideoElement; Object.defineProperty(video,"duration",{value:6.041667,configurable:true}); Object.defineProperty(video,"currentTime",{value:5,configurable:true}); video.dispatchEvent(new Event("timeupdate"));});
  await expect(cinematic.locator(".realm-video-title")).toBeVisible();
  await page.clock.pauseAt(new Date((await page.evaluate(()=>Date.now()))+10));
  await cinematic.locator("video").dispatchEvent("ended");
  await cinematic.locator("video").dispatchEvent("ended");
  await expect(cinematic).toBeVisible();
  await page.clock.fastForward(850);
  await expect(cinematic).toHaveAttribute("data-fading","true");
  await page.clock.fastForward(650);
  await expect(cinematic).toHaveCount(0);
  await page.clock.resume();
  await page.getByRole("button",{name:"Replay Cinematic",exact:true}).click();
  await expect(cinematic.locator("video")).toBeVisible();
  await page.getByRole("button",{name:"Skip animation",exact:true}).click();
  await page.getByRole("button",{name:"Replay Cinematic",exact:true}).click();
  await cinematic.locator("video").dispatchEvent("error");
  await expect(cinematic).toHaveCount(0);
  expect((await saved()).seen).toContain("realm:clockwork-kingdom");
  await page.locator(".realm-node").first().click();
  await expect(scene).toHaveAttribute("data-event","trial-enter");
  await page.clock.pauseAt(new Date((await page.evaluate(()=>Date.now()))+10));
  expect((await saved()).seen).not.toContain("entry:steady-pulse");
  await showAnimationBeat(page,900);
  await expect(scene.locator(".realm-transition-description")).toHaveCSS("opacity","0");
  await expect(scene.locator(".clock-activation")).not.toHaveCSS("opacity","0");
  await showAnimationBeat(page,1700);
  await expect(scene.locator(".realm-transition-description")).toHaveCSS("opacity","1");
  await page.clock.fastForward(2900);
  await expect(page.locator(".realm-details")).toBeVisible();
  expect((await saved()).seen).toContain("entry:steady-pulse");
  await page.clock.resume();
  await page.getByRole("button",{name:"← Return to realm",exact:true}).click();
  await expect(scene).toHaveAttribute("data-full","false");
  await showAnimationBeat(page,1400);
  await expect(scene.locator("h1")).toHaveCSS("opacity","1");
  await expect(scene.locator(".realm-transition-description")).toHaveCSS("opacity","1");
  await expect(scene).toHaveCount(0);
  await page.locator(".realm-node").first().click();
  await expect(page.locator(".realm-details")).toBeVisible();
  await expect(scene).toHaveCount(0);
  await page.getByRole("combobox",{name:"Animation preference"}).selectOption("minimal");
  await page.reload();
  await expect(page.locator(".realm-map")).toBeVisible();
  await expect(scene).toHaveCount(0);
  expect((await saved()).preference).toBe("minimal");
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.evaluate(id=>localStorage.removeItem(`pbb:realm-presentation:v1:${id}`),id);
  await page.reload();
  await expect(page.locator(".realm-map")).toBeVisible();
  await expect(scene).toHaveCount(0);
  expect((await saved()).preference).toBe("balanced");
  expect(await page.locator(".realm-hero .clock-minute").evaluate(el=>getComputedStyle(el).animationName)).toBe("none");
});

test("Balanced first clears use saved rewards; skipping, replays and failures do not duplicate keepsakes or gold", async ({page}) => {
  await page.clock.install();
  const data=await fixture(page,false,true);
  await page.goto("/?mode=adventure");
  const scene=page.getByRole("region",{name:"Realm animation",exact:true});
  await page.getByRole("button",{name:"Skip animation",exact:true}).click();
  await page.getByRole("button",{name:"Connect MIDI Piano"}).click();
  await page.locator(".realm-node").first().click();
  await page.getByRole("button",{name:"Skip animation",exact:true}).click();
  await page.getByRole("button",{name:"Enter trial",exact:true}).click();
  await expect(scene).toHaveCount(0);
  await expect(page.locator(".realm-score svg").first()).toBeVisible();
  data.fail(true);
  await perform(page,"steady-pulse");
  await expect(page.getByText("Your completion is waiting to save.",{exact:true})).toBeVisible();
  await expect(scene).toHaveCount(0);
  expect(data.receipts.size).toBe(0);
  data.fail(false);
  await page.getByRole("button",{name:"Retry saving / loading",exact:true}).click();
  await expect(scene).toHaveAttribute("data-event","trial-complete");
  await expect(scene).toHaveAttribute("data-full","true");
  await expect(scene.getByLabel("3 earned stars")).toBeAttached();
  await expect(scene.getByText("+2 milestone gold",{exact:true})).toBeAttached();
  expect(data.receipts.size).toBe(1);
  expect(await page.evaluate(id=>JSON.parse(localStorage.getItem(`pbb:realm-presentation:v1:${id}`)! ).seen,id)).not.toContain("clear:1:steady-pulse");
  await showAnimationBeat(page,1100);
  await expect(scene.locator(".realm-reveal-stars span").first()).toHaveCSS("opacity","0");
  await expect(scene.locator(".realm-reveal-gold")).toHaveCSS("opacity","0");
  await showAnimationBeat(page,3400);
  await expect(scene.locator(".realm-reveal-stars span").last()).toHaveCSS("opacity","1");
  await expect(scene.locator(".realm-reveal-gold")).toHaveCSS("opacity","1");
  await page.screenshot({path:"test-results/balanced-first-clear.png",fullPage:true});
  await page.getByRole("button",{name:"Skip animation",exact:true}).evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});
  await expect(page.getByText("Milestone gold: +2",{exact:true})).toBeVisible();
  await expect(page.getByLabel("Gold balance")).toHaveText("2 gold");
  expect(data.progress().challenges["steady-pulse"].attempts).toBe(1);
  await page.getByRole("button",{name:"Retry full trial",exact:true}).click();
  await expect(scene).toHaveCount(0);
  await perform(page,"steady-pulse");
  await page.clock.pauseAt(new Date((await page.evaluate(()=>Date.now()))+10));
  await expect(scene).toHaveAttribute("data-full","false");
  await showAnimationBeat(page,250);
  await expect(scene.locator(".realm-reveal-gold")).toHaveCSS("opacity","0");
  await showAnimationBeat(page,1700);
  await expect(scene.locator(".realm-reveal-gold")).toHaveCSS("opacity","1");
  await expect(scene.locator(".realm-reveal-score")).toHaveCSS("opacity","1");
  await expect(scene.getByText("+0 milestone gold",{exact:true})).toBeVisible();
  await expect(scene.getByText("Pulse Spark is already restored.",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Skip animation",exact:true}).click();
  await page.clock.resume();
  await page.getByRole("button",{name:"Retry full trial",exact:true}).click();
  await perform(page,"steady-pulse",false);
  await page.clock.pauseAt(new Date((await page.evaluate(()=>Date.now()))+10));
  await expect(scene).toHaveAttribute("data-event","trial-failed");
  await expect(scene.locator(".clock-activation")).toHaveCSS("animation-name","none");
  await page.clock.fastForward(1400);
  await expect(page.locator(".realm-results")).toBeVisible();
  await expect(page.getByLabel("Gold balance")).toHaveText("2 gold");
  expect(data.progress().challenges["steady-pulse"].attempts).toBe(3);
  await page.clock.resume();
  await page.getByRole("button",{name:"Return to realm",exact:true}).click();
  await expect(page.locator(".realm-hero .realm-mechanism")).toHaveAttribute("data-restored","1");
  await page.screenshot({path:"test-results/balanced-restored-clock.png",fullPage:true});
});

test("realm progression plays all five trials and the King, then survives reload", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.clock.install();
  const data = await fixture(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?mode=adventure");
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

test("completed Trials 1–3 reopen with distinct current Novice lessons", async ({ page }) => {
  // These saved records deliberately predate studyVersion=2.
  await fixture(page, true);
  await page.goto("/?mode=adventure");
  const lessonNames = ["Half notes & a steady beat", "Quarter notes & continuity", "Quarter & half-note counting"];
  const previews: number[] = [];
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Connect MIDI Piano" }).click();
    await page.locator(".realm-node").nth(i).click();
    await expect(page.locator(".realm-details .realm-eyebrow")).toHaveText(lessonNames[i]);
    await expect(page.locator(".realm-details svg").first()).toBeVisible();
    previews.push(await page.locator(".realm-details .note").count());
    const begin = page.waitForRequest(r => r.url().endsWith("/api/realms") && r.postDataJSON()?.action === "begin");
    await page.getByRole("button", { name: "Enter trial", exact: true }).click();
    expect((await begin).postDataJSON().config.studyVersion).toBe(2);
    expect((await begin).postDataJSON().config.positionVersion).toBe(1);
    // Return by reload; no performance or result is submitted.
    await page.reload();
    await expect(page.locator('.realm-node[data-complete="true"]')).toHaveCount(5);
  }
  expect(new Set(previews).size).toBe(3);
});

test("realm reward is confirmed on results and gold survives a difficulty change", async ({ page }) => {
  await page.clock.install();
  await fixture(page);
  await page.goto("/?mode=adventure");
  await page.getByRole("button", { name: "Connect MIDI Piano" }).click();
  await page.locator(".realm-node").first().click();
  await page.getByRole("button", { name: "Enter trial", exact: true }).click();
  await perform(page, "steady-pulse");
  await expect(page.getByText("Milestone gold: +2", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Gold balance")).toHaveText("2 gold");
  await page.getByRole("button", { name: "Return to realm", exact: true }).click();
  await page.getByRole("combobox", { name: "Musical difficulty", exact: true }).selectOption("5");
  await expect(page.getByLabel("Gold balance")).toHaveText("2 gold");
});

test("active practice earns gold through mistakes, excludes pauses, and retries fractional progress", async ({ page }) => {
  await page.clock.install();
  const data = await fixture(page);
  await page.goto("/?mode=adventure");
  await page.getByRole("button", { name: "Connect MIDI Piano" }).click();
  await page.getByRole("button", { name: "Free practice", exact: true }).click();
  await page.getByRole("button", { name: "Generate Exercise", exact: true }).click();
  await page.getByRole("button", { name: "Start Practice", exact: true }).click();
  await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 1000));
  const strike = () => page.evaluate(() => {
    const send = (window as unknown as { sendRealm: (events: {type: string; pitch: number; channel: number; velocity: number; timestamp: number}[], origin: number) => void }).sendRealm;
    // Deliberately wrong notes: learning effort still earns practice time.
    send([{ type: "NOTE_ON", pitch: 1, channel: 0, velocity: 80, timestamp: 0 },
      { type: "NOTE_OFF", pitch: 1, channel: 0, velocity: 0, timestamp: 0 }], performance.now());
  });
  await page.clock.fastForward(60000); // idle with the player open
  expect(data.practiceMs()).toBe(0);
  await strike();
  await expect.poll(data.openedPractice).toBe(true);
  for (let i = 0; i < 12; i++) { await page.clock.fastForward(6000); await strike(); }
  data.failPractice();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByText(/Practice gold is waiting to save/)).toBeVisible();
  await page.clock.fastForward(15000);
  await expect.poll(data.practiceMs).toBe(72000);
  await page.clock.fastForward(60000);
  await strike(); // MIDI while paused is excluded
  expect(data.practiceMs()).toBe(72000);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await strike();
  await page.clock.fastForward(6000);
  await strike();
  await page.getByRole("button", { name: "End Practice", exact: true }).click();
  await expect.poll(data.practiceMs).toBe(78000);
  await page.getByRole("button", { name: "Back to battles", exact: true }).click();
  await expect(page.getByLabel("Gold balance")).toHaveText("1 gold");
  await expect(page.getByLabel("Progress toward next gold")).toHaveText("6 / 72 seconds toward next gold");
  await page.clock.resume();
  await page.reload();
  await expect(page.getByLabel("Gold balance")).toHaveText("1 gold");
  await expect(page.getByLabel("Progress toward next gold")).toHaveText("6 / 72 seconds toward next gold");
});

test("shop purchase persists and opens the shared MIDI Studio without realm rewards", async ({ page }) => {
  const state = await fixture(page);
  const item = royalCatalog[0], source = royalScores["behr-in-may"] as { exercise: Exercise; previewXml: string };
  let gold = 150, revision = 1, owned: string[] = [], purchases = 0;
  const legacy = { ...source.exercise, number: 42, title: "Existing free study", available: true };
  await page.route("**/api/music-room", async route => {
    const body = route.request().postDataJSON();
    if (body.action === "purchase") { purchases++; if (!owned.includes(body.itemId)) { gold -= item.goldPrice!; owned = [body.itemId]; revision++; } }
    if (body.action === "exercise") return route.fulfill({ json: { exercise: body.itemId === "legacy:42" ? legacy : source.exercise } });
    if (body.action === "preview") return route.fulfill({ json: { xml: source.previewXml } });
    return route.fulfill({ json: { economy: { version: 1, revision, gold, owned }, catalog: [legacyMusicItem(legacy), ...royalCatalog], charged: body.action === "purchase" ? item.goldPrice : undefined, activeMs: body.activeMs ?? 0 } });
  });
  await page.goto("/?mode=adventure");
  await page.getByRole("button", { name: "Practice Studio", exact: true }).click();
  await expect(page.getByRole("button", { name: "Practice Existing free study", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Royal Music Shop", exact: true }).click();
  await page.getByRole("button", { name: "Preview In May", exact: true }).click();
  await expect(page.locator(".music-preview svg").first()).toBeVisible();
  await page.screenshot({ path: "C:/Users/aaron/Documents/Codex/2026-10-30/piano-boss-battles-handoff/work/royal-shop.png", fullPage: true });
  await page.getByRole("button", { name: "Buy for 150 gold", exact: true }).click();
  await expect(page.getByRole("button", { name: "Practice", exact: true })).toBeVisible();
  expect(purchases).toBe(1);
  await expect(page.getByLabel("Gold balance")).toHaveText("0 gold");
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page.getByRole("region", { name: "Studio practice", exact: true })).toBeVisible();
  await expect(page.locator(".classical-score svg").first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main destinations" })).toHaveCount(0);
  await page.getByRole("button", { name: /Connect.*MIDI|Enable MIDI|Connect piano/i }).click();
  await expect(page.getByRole("button", { name: "Start Practice", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Start Practice", exact: true }).click();
  const pitches = noteGroups(source.exercise, "both").flatMap(g => g.pitches);
  await page.evaluate(pitches => {
    const emit = (window as unknown as { sendRealm: (events: { type: string; pitch: number; velocity: number; channel: number; timestamp: number }[], origin: number) => void }).sendRealm;
    emit(pitches.map((pitch, i) => ({ type: "NOTE_ON", pitch, velocity: 80, channel: 0, timestamp: i * 10 })), performance.now());
  }, pitches);
  await expect(page.getByRole("heading", { name: "100% note accuracy" })).toBeVisible();
  expect(state.receipts.size).toBe(0);
  await page.reload();
  await page.getByRole("button", { name: "Practice Studio", exact: true }).click();
  await page.getByRole("combobox", { name: "Collection", exact: true }).selectOption("owned");
  await expect(page.getByRole("button", { name: "Practice In May", exact: true })).toBeVisible();
  await expect(page.getByLabel("Gold balance")).toHaveText("0 gold");
});
test("failure offers measured weak-section practice and failed saves remain queued", async ({
  page,
}) => {
  await page.clock.install();
  const data = await fixture(page);
  await page.goto("/?mode=adventure");
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
  await page.goto("/?mode=adventure");
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
  await page.goto("/?mode=adventure");
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

test("King video ends at preparation without starting gameplay", async ({page}) => {
  const data=await fixture(page,true);
  await page.goto("/?mode=adventure");
  await page.locator(".boss-node").click();
  const intro=page.getByRole("region",{name:"Clockwork King introduction"});
  await expect(intro.locator("video")).toHaveAttribute("src","/cinematics/clockwork-king-intro.mp4");
  await expect(intro.locator("video")).toHaveCSS("transform","matrix(1, 0, 0, 1, 0, 0)");
  await intro.locator("video").dispatchEvent("ended");
  await expect(page.locator(".realm-details")).toBeVisible();
  await expect(page.locator(".realm-playing")).toHaveCount(0);
  expect(data.receipts.size).toBe(0);
});
test("fingering assistance filters annotations without changing music and persists across modes",async({page})=>{
  await fixture(page);
  await page.goto("/?mode=adventure");
  const moduleUrl=`/@fs/${process.cwd().replaceAll("\\","/")}/src/domains/notation/fingering-assistance.ts`;
  const checked=await page.evaluate(async url=>{
    const {filterFingerings,resolveFingering}=await import(url);
    const note=(f:number,staff:number,extra="")=>`<note ${extra}><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><staff>${staff}</staff><notations><technical><fingering>${f}</fingering></technical></notations></note>`;
    const xml=`<score-partwise><part id="P1"><measure number="1">${note(1,1)}${note(2,1)}${note(2,1)}${note(3,1)}${note(1,1,'data-fingering-event="crossing"')}${note(5,2)}${note(4,2)}${note(4,2)}</measure></part></score-partwise>`;
    const count=(s:string)=>new DOMParser().parseFromString(s,"application/xml").querySelectorAll("fingering").length;
    const outputs=["full","light","minimal","off"].map(mode=>filterFingerings(xml,mode));
    return {counts:outputs.map(count),original:count(xml),same:outputs.every(s=>filterFingerings(s,"off")===filterFingerings(xml,"off")),defaults:[1,2,3,4,5].map(d=>resolveFingering("recommended",d)),override:[1,2,3,4,5].map(d=>resolveFingering("full",d))};
  },moduleUrl);
  expect(checked).toEqual({counts:[8,6,3,0],original:8,same:true,defaults:["full","light","minimal","minimal","off"],override:["full","full","full","full","full"]});
  await page.locator(".realm-node").first().click();
  const control=page.getByRole("combobox",{name:"Fingering Assistance"});
  const notes=()=>page.locator(".realm-details svg .note").count();
  await expect(page.locator(".realm-details svg .fing").first()).toBeVisible();
  const count=await notes();
  await control.selectOption("off");
  await expect(page.locator(".realm-details svg .fing")).toHaveCount(0);
  expect(await notes()).toBe(count);
  await control.selectOption("full");
  await expect(page.locator(".realm-details svg .fing").first()).toBeVisible();
  await page.reload();
  await page.locator(".realm-node").first().click();
  await expect(control).toHaveValue("full");
  await page.getByRole("button",{name:"Free practice",exact:true}).click();
  await page.getByRole("button",{name:"Generate Exercise",exact:true}).click();
  await expect(control).toHaveValue("full");
  const title=await page.locator(".classical-toolbar").textContent().catch(()=>null);
  await control.selectOption("minimal");
  await expect(page.locator(".classical-score svg .fing")).toHaveCount(2);
  await control.selectOption("off");
  await expect(page.locator(".classical-score svg .fing")).toHaveCount(0);
  if(title)expect(await page.locator(".classical-toolbar").textContent()).toBe(title);
});
test("Infinite learning steps apply only on generation and leave tempo editable",async({page})=>{
 await fixture(page);await page.goto('/?mode=adventure');await page.getByRole('button',{name:'Free practice',exact:true}).click();
 const step=page.getByRole('combobox',{name:'Learning step'});
 await expect(step).toHaveValue('novice-1-v1');
 await page.getByRole('button',{name:'Generate Exercise',exact:true}).click();
 const summary=page.locator('.classical-toolbar small');const original=await summary.textContent();
 await step.selectOption('novice-2-v1');
 expect(await summary.textContent()).toBe(original);
 await page.getByRole('spinbutton',{name:'Tempo (BPM)',exact:true}).fill('51');
 await page.getByRole('button',{name:'Generate Exercise',exact:true}).click();
 await expect(summary).toContainText('51 BPM');await expect(summary).toContainText('Quarter-note melody');await expect(summary).toContainText('Seed 1');
 await page.getByRole('combobox',{name:'Difficulty',exact:true}).selectOption('2');
 await expect(step).toHaveValue('beginner-1-v1');
 await expect(page.getByRole('spinbutton',{name:'Tempo (BPM)',exact:true})).toHaveValue('56');
 await page.getByRole('button',{name:'Generate Exercise',exact:true}).click();
 await expect(summary).toContainText('Two bass attacks');
 await expect(page.locator('.classical-score svg').first()).toBeVisible();
});
test("play-first home runs a checkpointed session through existing MIDI practice",async({page})=>{
 const data=await fixture(page);await page.goto('/');
 await expect(page.getByRole('region',{name:'Practice home',exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/play-first-home.png',fullPage:true});
 await expect(page.getByText('Your first completed practice will appear here.',{exact:false})).toBeVisible();
 await page.getByText('Customize',{exact:true}).click();await page.getByLabel('Session length',{exact:true}).selectOption('5');
 await page.getByRole('button',{name:'Connect MIDI Piano'}).click();await page.getByRole('button',{name:'Start Practice',exact:true}).click();
 await expect(page.getByRole('region',{name:'Guided practice session'})).toBeVisible();
 const saved=()=>page.evaluate(id=>JSON.parse(localStorage.getItem(`pbb:guided-session:v1:${id}`)!),id);
 await expect.poll(async()=>!!(await saved())).toBe(true);
 const first=await saved();await page.reload();await page.getByRole('button',{name:/Resume Practice/}).click();
 expect((await saved()).id).toBe(first.id);expect((await saved()).tasks).toEqual(first.tasks);
 await page.getByRole('button',{name:'Connect MIDI Piano'}).click();
 const {generateClassicalExercise}=await import('../../src/domains/music-generator/classical-generator');
 const beforeRetry=await saved();
 await page.getByRole('button',{name:'Repeat Exercise',exact:true}).click();
 await expect.poll(async()=>(await saved()).attempt).toBe(beforeRetry.attempt+1);
 expect((await saved()).tasks).toEqual(beforeRetry.tasks);
 await page.getByRole('button',{name:'Practice Again Slower',exact:true}).click();
 await expect.poll(async()=>(await saved()).tasks[0].settings.tempoBpm).toBe(beforeRetry.tasks[0].settings.tempoBpm-5);
 const slowed=generateClassicalExercise((await saved()).tasks[0].settings),original=generateClassicalExercise(beforeRetry.tasks[0].settings);
 expect(slowed.right).toEqual(original.right);expect(slowed.left).toEqual(original.left);
 expect((await saved()).results).toEqual([]);
 const visited=new Set<number>();
 while(!(await saved()).complete){const s=await saved();visited.add(s.tasks[s.index].stage);
 const ex=generateClassicalExercise(s.tasks[s.index].settings);const pitches=noteGroups(ex,s.tasks[s.index].settings.hands).flatMap(g=>g.pitches);
 await page.getByRole('button',{name:'Start Practice',exact:true}).click();
 if(s.index===0){await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByRole('button',{name:'Resume',exact:true}).click();}
 await page.locator('.classical-score').evaluate(el=>el.setAttribute('data-retained','yes'));
 await page.evaluate(pitches=>{const w=window as unknown as {sendRealm:(events:{type:string;pitch:number;velocity:number;channel:number;timestamp:number}[],origin:number)=>void};w.sendRealm(pitches.flatMap(pitch=>[{type:'NOTE_ON',pitch,velocity:90,channel:0,timestamp:0},{type:'NOTE_OFF',pitch,velocity:0,channel:0,timestamp:1}]),performance.now());},pitches);
 await expect(page.getByRole('heading',{name:'100% pitch accuracy',exact:true})).toBeVisible();
 await expect(page.locator('.classical-score')).toHaveAttribute('data-retained','yes');
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect.poll(async()=>{const next=await saved();return next.complete||next.index>s.index;}).toBe(true);
 }
 expect([...visited]).toEqual([0,1,2]);await expect(page.getByRole('region',{name:'Session summary'})).toContainText('100% pitch accuracy');
 expect(data.receipts.size).toBe(0);expect(data.practiceMs()).toBeLessThan(72000);
 await page.getByRole('button',{name:'Return Home / Start Another Session',exact:true}).click();
 await page.getByRole('button',{name:'Infinite Practice',exact:true}).click();await expect(page.getByRole('button',{name:'Generate Exercise',exact:true})).toBeVisible();
});
import {emptyLessons,lessons as curriculumLessons,completed as lessonCompleted} from '../../src/domains/curriculum/catalog';
test('Lessons replace Adventure and persist a complete introductory lesson',async({page})=>{
 await fixture(page);const progress=emptyLessons();
 await page.route('**/api/lessons',async route=>{const c=route.request().postDataJSON();if(c.lessonId)progress.lastLesson=c.lessonId;if(c.action==='finish'){const lesson=curriculumLessons.find(l=>l.id===c.lessonId)!;const a=lesson.activities.find(a=>a.id===c.activityId)!;const {assessPractice}=await import('../../hosted/sight-library');const r=assessPractice(a.exercise,'right',c.pitches);expect(r.complete).toBe(true);progress.records[`${lesson.id}:${a.id}`]={accuracy:r.accuracy,correct:r.correct,attempts:1};}await route.fulfill({json:progress});});
 await page.goto('/?mode=adventure');await expect(page.getByRole('button',{name:'Adventure Mode',exact:true})).toHaveCount(0);
 for(const name of ['Home','Lessons','Practice','Music Library','Music Shop','Progress'])await expect(page.getByRole('navigation',{name:'Primary navigation'}).getByRole('button',{name,exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Lessons',exact:true}).click();await expect(page.getByRole('heading',{name:'Level 6 — Expert'})).toBeVisible();
 for(const title of ['Reading Music with Confidence','Rhythm & Musical Patterns','Exploring the Keyboard','Becoming a Pianist'])await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Beginner Graduation',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Continue Learning',exact:true}).click();await page.locator('.studio-midi>summary').click();await page.getByRole('button',{name:'Connect MIDI Piano'}).click();
 for(const a of curriculumLessons[0].activities){await page.getByRole('button',{name:'Start Practice',exact:true}).click();const pitches=noteGroups(a.exercise,'right').flatMap(g=>g.pitches);await page.evaluate(pitches=>{const w=window as unknown as {sendRealm:(events:unknown[],origin:number)=>void};w.sendRealm(pitches.flatMap(pitch=>[{type:'NOTE_ON',pitch,velocity:90,channel:0,timestamp:0},{type:'NOTE_OFF',pitch,velocity:0,channel:0,timestamp:1}]),performance.now());},pitches);await expect.poll(()=>!!progress.records[`middle-c:${a.id}`]).toBe(true);await page.getByRole('button',{name:'Continue',exact:true}).click();}
 await expect(page.getByRole('heading',{name:'Lesson complete',exact:true})).toBeVisible();expect(lessonCompleted(curriculumLessons[0],progress)).toBe(true);
 await page.reload();await page.getByRole('button',{name:'Lessons',exact:true}).click();await expect(page.getByText('1/22 completed',{exact:false})).toBeVisible();await page.getByRole('button',{name:'Continue Learning',exact:true}).click();await expect(page.getByRole('heading',{name:'Understanding Finger Numbers',exact:true})).toBeVisible();
});
test('warm studio navigation and main screens fit mobile tablet and desktop',async({page})=>{
 const lessonState=emptyLessons();await fixture(page);await page.route('**/api/music-room',route=>route.fulfill({json:{economy:{version:1,revision:1,gold:250,owned:[royalCatalog[0].id],practiceMs:720000},catalog:royalCatalog}}));await page.route('**/api/lessons',route=>route.fulfill({json:lessonState}));
 for(const [width,height] of [[360,800],[430,932],[768,1024],[1024,768],[1366,768],[1920,1080]]){
  await page.setViewportSize({width,height});await page.goto('/');
  const nav=page.getByRole('navigation',{name:width<=700?'Mobile navigation':'Primary navigation',exact:true});await expect(nav).toBeVisible();
  const action=page.getByRole('button',{name:'Continue Lesson',exact:true});await expect(action).toBeVisible();expect((await action.boundingBox())!.y).toBeLessThan(height-90);
  await expect(page.locator('.studio-primary')).toHaveCount(1);await expect(page.getByText('Today’s Practice: Finding Middle C')).toHaveCount(0);
  const boxes=await nav.getByRole('button').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,width:r.width};}));expect(new Set(boxes.map(b=>Math.round(b.y))).size).toBe(1);
  for(let i=1;i<boxes.length;i++)expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i-1].right-1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('.studio-primary').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
  const contrast=await page.locator('.studio-primary').evaluate(el=>{
   const lum=(color:string)=>{const rgb=color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
   const ratio=(a:string,b:string)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
   const button=getComputedStyle(el.querySelector('button.primary')!);return [ratio(getComputedStyle(el.querySelector('p')!).color,getComputedStyle(el).backgroundColor),ratio(button.color,button.backgroundColor)];
  });for(const ratio of contrast)expect(ratio).toBeGreaterThanOrEqual(4.5);

  await page.screenshot({path:`test-results/studio-${width}.png`,fullPage:true});
 }
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 const mobile=page.getByRole('navigation',{name:'Mobile navigation'});
 await mobile.getByRole('button',{name:'Practice',exact:true}).click();await page.getByRole('button',{name:'Open Infinite Practice',exact:true}).click();await expect(page.getByRole('button',{name:'Generate Exercise',exact:true})).toBeVisible();await expect(mobile).toBeHidden();
 await page.getByRole('button',{name:'Back to practice',exact:true}).click();await mobile.getByRole('button',{name:'Library',exact:true}).click();await expect(page.getByRole('heading',{name:'Music Library',exact:true})).toBeVisible();
 await mobile.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:'Music Shop →',exact:true}).click();await expect(page.getByRole('heading',{name:'Music Shop',exact:true})).toBeVisible();await expect(page.getByText('Owned',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/studio-shop.png',fullPage:true});
 await mobile.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:'Settings →',exact:true}).click();await expect(page.getByLabel('Fingering Assistance',{exact:true})).toBeVisible();
 await mobile.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:'Progress →',exact:true}).click();await expect(page.getByText('12 minutes of recorded eligible active practice')).toBeVisible();await page.screenshot({path:'test-results/studio-lessons.png',fullPage:false});
 await mobile.getByRole('button',{name:'Home',exact:true}).click();await page.locator('.studio-midi>summary').click();await page.getByRole('button',{name:'Connect MIDI Piano'}).click();await expect(page.locator('.studio-midi>summary')).toContainText('Connected');
 await page.getByRole('button',{name:'Continue Lesson',exact:true}).click();await expect(page.getByRole('heading',{name:'Finding Middle C',exact:true})).toBeVisible();await expect(page.locator('.classical-score svg').first()).toBeVisible();await expect(mobile).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/studio-player.png',fullPage:true});
 for(const lesson of curriculumLessons)for(const activity of lesson.activities)lessonState.records[`${lesson.id}:${activity.id}`]={accuracy:100,correct:10,attempts:1,mastered:true};
 await page.goto('/');await expect(page.getByRole('button',{name:'Continue Lesson',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Start Practice',exact:true}).click();await expect(page.getByText('A clear next step at the piano.',{exact:true})).toBeVisible();
});
