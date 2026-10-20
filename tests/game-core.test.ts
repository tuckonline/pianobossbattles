import { expect, it } from "vitest";
import {
  evaluateGame,
  replayEvents,
  accuracyBonus,
  accuracyPB,
  levelInfo,
  levelThreshold,
  levelCost,
  practiceDay,
  achievements,
  CelebrationQueue,
  type GameEvent,
} from "../hosted/game-core";
import { scalesLibrary } from "../hosted/scales-library";
import { noteGroups } from "../hosted/sight-library";
const ctx = { playerId: "p", sessionId: "s", attemptId: "a", timestamp: 0 };
const event = (
  sequence: number,
  type: GameEvent["type"],
  payload: GameEvent["payload"] = {},
): GameEvent => ({
  ...ctx,
  id: `e${sequence}`,
  version: 1,
  sequence,
  type,
  payload,
});
it("counts approved individual chord notes, including mixed and out-of-order arrivals", () => {
  const e = scalesLibrary[0];
  const result = evaluateGame(e, "both", [60, 61, 48, 62, 50], ctx);
  expect(result).toMatchObject({
    correct: 4,
    incorrect: 1,
    combo: 3,
    best: 3,
    noteXP: 8,
  });
  expect(result.events.map((e) => e.payload.outcome)).toEqual([
    "correct",
    "incorrect",
    "correct",
    "correct",
    "correct",
  ]);
  expect(
    new Set(
      result.events
        .filter((e) => e.payload.outcome === "correct")
        .map((e) => e.payload.occurrence),
    ).size,
  ).toBe(4);
  const notes = noteGroups(e, "both").flatMap((g) => [...g.pitches].reverse());
  expect(evaluateGame(e, "both", notes, ctx)).toMatchObject({
    complete: true,
    correct: notes.length,
    noteXP: notes.length * 2,
  });
});
it("deduplicates events and expected occurrences; errors and misses break streaks", () => {
  const a = event(1, "note.evaluated", { outcome: "correct", occurrence: "1" });
  expect(
    replayEvents([a, a, { ...a, id: "duplicate", sequence: 2 }]),
  ).toMatchObject({ correct: 1, noteXP: 2, combo: 1 });
  for (const outcome of ["incorrect", "missed"] as const)
    expect(
      replayEvents([a, event(3, "note.evaluated", { outcome })]),
    ).toMatchObject({ combo: 0, best: 1 });
});
it("ignores unscored controls, freezes on pause, preserves resume, resets current combo on restart", () => {
  const events = [
    event(0, "attempt.started"),
    event(1, "note.evaluated", { outcome: "correct", occurrence: "1" }),
    event(2, "attempt.paused"),
    event(3, "note.evaluated", { outcome: "incorrect" }),
    event(4, "midi.disconnected"),
    event(5, "attempt.resumed"),
    event(6, "note.evaluated", { outcome: "unscored" }),
    event(7, "note.evaluated", { outcome: "correct", occurrence: "2" }),
  ];
  expect(replayEvents(events)).toMatchObject({ combo: 2, best: 2, correct: 2 });
  expect(replayEvents([...events, event(8, "attempt.started")])).toMatchObject({
    combo: 0,
    best: 2,
    noteXP: 4,
  });
});
it("replays canonical order and reconciles evaluator corrections without double credit", () => {
  const a = event(1, "note.evaluated", { outcome: "correct", occurrence: "1" }),
    b = event(2, "note.evaluated", { outcome: "correct", occurrence: "2" });
  const fix = event(3, "note.evaluation_corrected", {
    replaces: a.id,
    outcome: "incorrect",
  });
  expect(replayEvents([b, fix, a, fix])).toMatchObject({
    correct: 1,
    incorrect: 1,
    combo: 1,
    best: 1,
    noteXP: 2,
  });
});
it("uses exclusive exact accuracy tiers, real PBs and versioned level boundaries", () => {
  expect([89.9, 90, 94.99, 95, 99.99, 100].map(accuracyBonus)).toEqual([
    0, 20, 20, 40, 40, 75,
  ]);
  expect(accuracyPB(100, null)).toBe(false);
  expect(accuracyPB(100, 100)).toBe(false);
  expect(accuracyPB(99, 98)).toBe(true);
  expect(
    [0, 99, 100, 399, 400, 8100].map((x) => levelInfo(x, 1).level),
  ).toEqual([1, 1, 2, 2, 3, 10]);
  expect(levelInfo(900, 1).level - levelInfo(0, 1).level).toBe(3);
  expect(() => levelInfo(0, 3)).toThrow();
  expect(practiceDay(Date.UTC(2026, 9, 18, 3), "America/Los_Angeles")).toBe(
    "2026-10-17",
  );
  expect(achievements).toHaveLength(11);
  expect(new Set(achievements.map((a) => a.id)).size).toBe(11);
});
it("prioritizes, deduplicates, expires and clears presentation without touching rewards", () => {
  const q = new CelebrationQueue();
  const low = {
    id: "low",
    kind: "milestone" as const,
    title: "Nice",
    description: "10",
    priority: 20,
    createdAt: 0,
  };
  q.push(low);
  q.push(low);
  q.push({ ...low, id: "high", kind: "level", priority: 100 });
  expect(q.next(100)?.id).toBe("high");
  expect(q.next(100)?.id).toBe("low");
  expect(q.next(100)).toBeUndefined();
  q.push({ ...low, id: "expired" });
  expect(q.next(40000)).toBeUndefined();
  q.push({ ...low, id: "clear" });
  q.clear();
  expect(q.next(0)).toBeUndefined();
});

it("paces v2 milestones, increases every level cost, and caps the Expert level without capping XP", () => {
  expect([5, 10, 25].map((l) => levelThreshold(l))).toEqual([
    15000, 100000, 501250,
  ]);
  for (let l = 2; l <= 100; l++) {
    const xp = levelThreshold(l);
    expect(levelInfo(xp).level).toBe(l);
    expect(levelInfo(xp - 1).level).toBe(l - 1);
    if (l > 2) expect(levelCost(l)).toBeGreaterThan(levelCost(l - 1));
  }
  expect(levelInfo(501250).title).toBe("Advanced Beginner");
  expect(levelInfo(levelThreshold(100) + 999999)).toMatchObject({
    level: 100,
    title: "Expert",
    remaining: 0,
    percent: 100,
    maxed: true,
  });
  expect(levelInfo(465)).toMatchObject({ level: 1, remaining: 535 });
  expect(levelInfo(15000).level - levelInfo(0).level).toBe(4);
});

it("keeps achievements one-time beyond the transient queue history while new streaks can repeat", () => {
  const queue = new CelebrationQueue();
  const achievement = {id:"achievement:first_steps",kind:"achievement" as const,title:"First Steps",description:"",priority:80,createdAt:0};
  queue.push(achievement);
  expect(queue.next(0)?.id).toBe(achievement.id);
  for(let i=0;i<600;i++) {
    queue.push({...achievement,id:`streak:${i}`,kind:"milestone",title:"10 notes in a row"});
    expect(queue.next(0)?.id).toBe(`streak:${i}`);
  }
  queue.clear();
  queue.push(achievement);
  expect(queue.next(0)).toBeUndefined();
});
