import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { readFileSync } from "node:fs";
import { realmCommand } from "../public-app/realm-service";
import { musicRoomCommand, royalScoresById } from "../public-app/music-room-service";
import { readEconomy, writeEconomy } from "../public-app/economy-store";
import { creditPractice, creditMilestone, emptyEconomy, PracticeActivity, goldRules } from "../src/domains/economy/rewards";
import { hasMusicAccess, legacyMusicItem, royalCatalog } from "../src/domains/economy/music-catalog";
import { realmScore } from "../src/domains/realms/content";
import { performanceEnd, referenceEvents } from "../src/domains/realms/performance";
import type { RunConfig } from "../src/domains/realms/types";
import { importMusicXml } from "../src/domains/notation/musicxml";
import { assessPractice, noteGroups, soundingNotes } from "../hosted/sight-library";

const db = new PGlite(), a = "a0000000-0000-4000-8000-000000000010", b = "b0000000-0000-4000-8000-000000000020";
// PGlite has one connection. Lease it like a one-connection pg pool so parallel
// requests exercise independent transactions instead of nesting BEGIN calls.
let lease = Promise.resolve();
const pool = { query: db.query.bind(db), connect: async () => {
  const previous = lease; let release!: () => void; lease = new Promise<void>(r => { release = r; });
  await previous; return { query: db.query.bind(db), release };
} } as unknown as Pool;
beforeAll(async () => {
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid primary key,email text,raw_user_meta_data jsonb); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;");
  await db.exec(readFileSync("supabase/migrations/202610200001_public_players.sql", "utf8"));
  for (const name of ["202610200002_music_catalog", "202610200003_music_publication", "202610200004_existing_music_visibility"])
    await db.exec(readFileSync(`supabase/migrations/${name}.sql`, "utf8"));
  await db.query("INSERT INTO auth.users VALUES($1,'economy-a@example.test','{}'),($2,'economy-b@example.test','{}')", [a, b]);
});
afterAll(() => db.close());
const config: RunConfig = { version: 1, challengeId: "steady-pulse", seed: 1, key: "C", tempo: 50, difficulty: 1, curriculumVersion: 2, studyVersion: 2, gradingVersion: 2 };
const score = realmScore(config);
const receipt = () => ({ id: crypto.randomUUID(), config, events: referenceEvents(score), elapsedMs: performanceEnd(score) });

it("retired Adventure cannot grant bonuses through stale commands", async () => {
 const first=receipt();
 await expect(realmCommand(pool,a,{action:"begin",expectedUserId:a,attemptId:first.id,config})).rejects.toThrow("retired");
 await expect(realmCommand(pool,a,{action:"finish",expectedUserId:a,receipt:first})).rejects.toThrow("retired");
 expect((await readEconomy(pool,a)).gold).toBe(0);
});

it("pays 50 gold per active hour regardless of how often exercises end", () => {
  const long = emptyEconomy(), short = emptyEconomy();
  expect(creditPractice(long, 3600000)).toBe(50);
  for (let i = 0; i < 600; i++) creditPractice(short, 6000);
  expect(short).toEqual(long);
  expect(creditPractice(short, 0)).toBe(0);
  expect(creditMilestone(short, "trial", false, false).amount).toBe(0);
  expect(creditMilestone(short, "trial", false, true).amount).toBe(2);
  expect(creditMilestone(short, "trial", false, true).amount).toBe(0);
  expect(creditMilestone(short, "boss", true, true).amount).toBe(5);
  for (const item of royalCatalog) expect(item.goldPrice! / goldRules.goldPerHour).toBeGreaterThanOrEqual(2);
  for (const item of royalCatalog) expect(item.goldPrice! / goldRules.goldPerHour).toBeLessThanOrEqual(10);
});

it("counts actual playing once for chords and excludes idle gaps, pauses and duplicate packets", () => {
  const meter = new PracticeActivity();
  const on = { type: "NOTE_ON" as const, pitch: 60, channel: 0, velocity: 80, timestamp: 0 };
  const off = { ...on, type: "NOTE_OFF" as const, velocity: 0 };
  expect(meter.record(on, 0)).toBe(0);
  expect(meter.record(on, 10)).toBe(0);
  expect(meter.record({ ...on, pitch: 64 }, 0)).toBe(0);
  expect(meter.record(off, 6000)).toBe(6000); // whole note at 40 BPM
  expect(meter.record({ ...off, pitch: 64 }, 6000)).toBe(0);
  expect(meter.record(off, 7000)).toBe(0);
  expect(meter.record(on, 66000)).toBe(0); // idle minute pays nothing
  expect(meter.record(off, 68000)).toBe(2000);
  meter.reset(); // pause, disconnect, finish, restart, or exercise switch
  expect(meter.record(on, 70000)).toBe(0);
  expect(meter.record({ type: "CONTROL_CHANGE", channel: 0, controller: 64, value: 127, timestamp: 0 }, 71000)).toBe(0);
  expect(meter.record(off, 72000)).toBe(2000);
});

it("persists fractional practice time atomically with retry-safe cumulative checkpoints", async () => {
  let now = 1000000;
  const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
  const command = { action: "practice", expectedUserId: b, sessionId: crypto.randomUUID(), activeMs: 0 };
  try {
    await musicRoomCommand(pool, b, command);
    await expect(musicRoomCommand(pool, b, { ...command, activeMs: 30000 })).rejects.toThrow(/elapsed/);
    now += 30000;
    await musicRoomCommand(pool, b, { ...command, activeMs: 30000 });
    expect(await readEconomy(pool, b)).toMatchObject({ gold: 0, practiceMs: 30000 });
    const next = { ...command, sessionId: crypto.randomUUID() };
    await musicRoomCommand(pool, b, next);
    now += 42000;
    const saved = await Promise.all([1, 2].map(() => musicRoomCommand(pool, b, { ...next, activeMs: 42000 })));
    expect(saved.map(s => s.economy?.gold)).toEqual([1, 1]);
    expect(saved).toEqual([expect.objectContaining({totalEarned:1}),expect.objectContaining({totalEarned:1})]);
    await musicRoomCommand(pool, b, { ...command, activeMs: 20000 }); // stale request
    expect(await readEconomy(pool, b)).toMatchObject({ gold: 1, practiceMs: 72000 });
    now += 3600000; // no notes, no gold
    await musicRoomCommand(pool, b, { ...next, activeMs: 42000 });
    expect(await readEconomy(pool, b)).toMatchObject({ gold: 1, practiceMs: 72000 });
    await expect(musicRoomCommand(pool, a, next)).rejects.toThrow(/Account changed/);
  } finally { clock.mockRestore(); }
});

it("purchases atomically, preserves ownership on fresh reads, protects locked scores and keeps accounts separate", async () => {
  await writeEconomy(pool, b, { ...emptyEconomy(), gold: 150 });
  const item = royalCatalog[0], buy = { action: "purchase", expectedUserId: b, itemId: item.id, transactionId: crypto.randomUUID() };
  await expect(musicRoomCommand(pool, b, { action: "exercise", expectedUserId: b, itemId: item.id })).rejects.toThrow(/Unlock/);
  const preview = await musicRoomCommand(pool, b, { action: "preview", expectedUserId: b, itemId: item.id });
  expect(preview).not.toHaveProperty("exercise");
  expect(importMusicXml(preview.xml!).measures).toHaveLength(2);
  const responses = await Promise.all([musicRoomCommand(pool, b, buy), musicRoomCommand(pool, b, buy), musicRoomCommand(pool, b, { ...buy, transactionId: crypto.randomUUID() })]);
  expect(responses.map(r => r.charged)).toEqual([150, 0, 0]);
  expect(await readEconomy(pool, b)).toMatchObject({ gold: 0, owned: [item.id] });
  expect(await musicRoomCommand(pool, b, { action: "exercise", expectedUserId: b, itemId: item.id })).toHaveProperty("exercise.title", "In May");
  await expect(musicRoomCommand(pool, b, { ...buy, itemId: royalCatalog[1].id })).rejects.toThrow(/different piece/);
  await expect(musicRoomCommand(pool, b, { ...buy, itemId: royalCatalog[1].id, transactionId: crypto.randomUUID() })).rejects.toThrow(/Not enough/);
  expect((await readEconomy(pool, b)).gold).toBe(0);
  expect((await readEconomy(pool, a)).owned).toEqual([]);
  await expect(musicRoomCommand(pool, a, buy)).rejects.toThrow(/Account changed/);
  const legacy = legacyMusicItem({ number: 1, title: "Existing piece", right: [], left: [], available: true });
  expect(hasMusicAccess(legacy, [], a)).toBe(true);
  const library = await musicRoomCommand(pool, b, { action: "state", expectedUserId: b });
  expect(library.economy).toMatchObject({ gold: 0, owned: [item.id] });
  expect(library.catalog!.find(i => i.id === item.id)).toBeDefined();
  const existing = library.catalog!.find(i => i.accessType === "legacy")!;
  expect(hasMusicAccess(existing, [], b)).toBe(true);
  expect(await musicRoomCommand(pool, b, { action: "exercise", expectedUserId: b, itemId: existing.id })).toHaveProperty("exercise.number", existing.exerciseNumber);
  const priorRealm = await realmCommand(pool, b, { action: "state", expectedUserId: b, difficulty: 1 });
  expect(priorRealm.progress.challenges).toEqual({});
  expect((await db.query("SELECT * FROM game_xp_ledger")).rows).toHaveLength(0);
});

it("keeps both licensed scores consistent with MusicXML and the existing hand-specific MIDI evaluator", () => {
  for (const { exercise } of Object.values(royalScoresById)) {
    const imported = importMusicXml(exercise.notationXml!);
    const source = imported.notes.map(n => `${n.midiPitch}:${n.onsetTick/480}:${n.durationTicks/480}`).sort();
    expect(soundingNotes(exercise).map(n => `${n.pitch}:${n.beat}:${n.beats}`).sort()).toEqual(source);
    expect(imported.measures).toHaveLength(exercise.durationBeats! / 3);
    for (const hand of ["right", "left", "both"] as const) {
      const played = noteGroups(exercise, hand).flatMap(g => g.pitches);
      expect(assessPractice(exercise, hand, played)).toMatchObject({ complete: true, accuracy: 100 });
    }
  }
});
