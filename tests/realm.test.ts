import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  clockworkKingdom,
  emptyProgress,
  unlocked,
} from "../src/domains/realms/registry";
import { realmScore, sliceStudy } from "../src/domains/realms/content";
import { referenceEvents, summarize } from "../src/domains/realms/performance";
import { advanceProgress } from "../src/domains/realms/progression";
import { importMusicXml } from "../src/domains/notation/musicxml";
import { musicXml, soundingNotes } from "../hosted/sight-library";
import type { RunConfig,RealmScore } from "../src/domains/realms/types";
import { clockworkTiming } from "../src/domains/scoring/timing";
import { musicalTiers } from "../src/domains/music-generator/difficulty-profiles";
const config = (id: string): RunConfig => ({
  version: 1,
  challengeId: id,
  key: "C",
  tempo: 80,
  seed: 1,
});
describe("Clockwork mastery", () => {
  it("gives Trials 1–3 distinct rhythmic lessons within each musical tier", () => {
    for (const [i, tier] of musicalTiers.entries()) {
      for (const [key, seed] of [["C", 1], ["G", 42], ["F", 0xffffffff]] as const) {
        const scores = clockworkKingdom.challenges.slice(0, 3).map((c) =>
          realmScore({ ...config(c.id), key, seed, tempo: tier.tempo, difficulty: i + 1,
            curriculumVersion: 2, studyVersion: 2, positionVersion: 1, gradingVersion: 2 }),
        );
        // Compare actual onset/duration patterns, not titles or seed labels.
        const rhythms = scores.map((s) => JSON.stringify(soundingNotes(s.exercise).map(n => [n.beat, n.beats])));
        expect(new Set(rhythms).size).toBe(3);
        for (const [trial, score] of scores.entries()) {
          expect(score.exercise.tempoBpm).toBe(tier.tempo);
          expect(summarize(score, referenceEvents(score), clockworkKingdom.challenges[trial], Infinity, 2))
            .toMatchObject({ pitch: 100, rhythm: 100, passed: true });
          if (i === 0) {
            const notes = soundingNotes(score.exercise);
            expect(notes.every(n => n.hand === "right" && [1, 2, 4].includes(n.beats))).toBe(true);
            expect(Math.max(...notes.map(n => n.pitch)) - Math.min(...notes.map(n => n.pitch))).toBeLessThanOrEqual(7);
            expect(notes.slice(1).every((n, j) => Math.abs(n.pitch - notes[j].pitch) <= 4)).toBe(true);
          }
        }
        expect(scores[0].exercise.right[0].map(n => n.beats)).toEqual(i === 0 ? [2, 2] : [1, 1, 1, 1]);
        if (i === 0) expect(scores[1].exercise.right[0].map(n => n.beats)).toEqual([1, 1, 1, 1]);
        if (i >= 2) expect(scores[2].exercise.right.flat().some(n => n.beats === 1.5 || n.beats === .75)).toBe(true);
      }
    }
  });
  it("reconstructs old trial receipts unchanged and leaves the other encounters alone", () => {
    for (const c of clockworkKingdom.challenges) {
      const run: RunConfig = { ...config(c.id), tempo: 50, difficulty: 1, curriculumVersion: 2 };
      const old = realmScore(run);
      if (["tempo", "streak", "precision"].includes(c.kind)) {
        // Captured before the lesson fix: all three really had identical music.
        expect(createHash("sha256").update(JSON.stringify(soundingNotes(old.exercise))).digest("hex"))
          .toBe("1e74f63e7afc6aa7cc8addfca31adf13ac005fb6090e36931954aa6193d98997");
        const updated = { ...run, studyVersion: 2 as const };
        expect(realmScore(updated)).toEqual(realmScore(updated));
      } else expect(realmScore({ ...run, studyVersion: 2 })).toEqual(old);
    }
  });
  it("retains exact rhythm and pitch windows at 40, 80, 120 and 160 BPM",()=>{
    expect([40,80,120,160].map(clockworkTiming)).toEqual([
      {rhythmToleranceMs:150,matchWindowMs:300},{rhythmToleranceMs:150,matchWindowMs:300},
      {rhythmToleranceMs:100,matchWindowMs:225},{rhythmToleranceMs:75,matchWindowMs:168.75},
    ]);
    for(const bpm of [40,80,120,160]){
      const score=timingScore(bpm),c=clockworkKingdom.challenges[0],threshold=clockworkTiming(bpm);
      for(const delta of [0,-threshold.rhythmToleranceMs,threshold.rhythmToleranceMs,threshold.rhythmToleranceMs+1]){
        const events=referenceEvents(score).map(e=>({...e,timestamp:e.timestamp+delta}));
        const result=summarize(score,events,c,Infinity,2);
        expect(result.pitch).toBe(100);expect(result.rhythm).toBe(Math.abs(delta)<=threshold.rhythmToleranceMs?100:0);
        expect(result.timing?.meanOffsetMs).toBe(Math.round(delta));
      }
      const outside=referenceEvents(score).map(e=>({...e,timestamp:e.timestamp+threshold.matchWindowMs+1}));
      expect(summarize(score,outside,c,Infinity,2)).toMatchObject({pitch:0,rhythm:0,missed:1,extra:1});
    }
  });
  it("accepts early opening notes immediately and waits for the complete pitch window before a miss",()=>{
    const score=timingScore(80),c=clockworkKingdom.challenges[0];
    const early=referenceEvents(score).map(e=>({...e,timestamp:e.timestamp-60}));
    expect(summarize(score,early,c,0,2)).toMatchObject({pitch:100,rhythm:100,extra:0,missed:0});
    expect(summarize(score,referenceEvents(score),c,20,2)).toMatchObject({pitch:100,extra:0,missed:0});
    for(const time of [0,150,200,300])expect(summarize(score,[],c,time,2).missed).toBe(0);
    expect(summarize(score,[],c,301,2).missed).toBe(1);
  });
  it("consumes repeated notes, chords and simultaneous hands once without duplicate penalties",()=>{
    const score=timingScore(160,true),c=clockworkKingdom.challenges[0],events=referenceEvents(score).map(e=>({...e,channel:0}));
    const duplicate=[...events,...events].sort((a,b)=>a.timestamp-b.timestamp);
    expect(summarize(score,duplicate,c,Infinity,2)).toMatchObject({pitch:100,rhythm:100,bestStreak:4,extra:0,wrong:0,missed:0});
    const wrong=events.map(e=>e.pitch===64?{...e,pitch:65}:e);
    expect(summarize(score,wrong,c,Infinity,2)).toMatchObject({pitch:75,wrong:1,missed:0,extra:0});
    // This attack belongs to the later repeated C, even though both old search windows overlap.
    const nearSecond=events.filter(e=>e.pitch!==60).concat([{type:"NOTE_ON",pitch:60,velocity:80,channel:0,timestamp:110},{type:"NOTE_OFF",pitch:60,velocity:0,channel:0,timestamp:250}]).sort((a,b)=>a.timestamp-b.timestamp);
    const result=summarize(score,nearSecond,c,Infinity,2);
    expect(result.missed).toBe(1);expect(result.timing?.samples.find(s=>s.pitch===60)?.beat).toBe(.5);
    // Each new summary has no retained matching state from an earlier attempt.
    expect(summarize(score,[],c,0,2)).toMatchObject({extra:0,wrong:0,missed:0,bestStreak:0});
  });
  it("plays all six scored encounters and unlocks progression without combat damage", () => {
    let progress = emptyProgress();
    expect(unlocked("steady-pulse", progress)).toBe(true);
    expect(unlocked("clockwork-king", progress)).toBe(false);
    for (const c of clockworkKingdom.challenges) {
      expect(unlocked(c.id, progress)).toBe(true);
      const run = config(c.id),
        score = realmScore(run),
        result = summarize(score, referenceEvents(score), c);
      expect(result).toMatchObject({
        passed: true,
        pitch: 100,
        rhythm: 100,
        stars: 3,
      });
      progress = advanceProgress(progress, run, result, "2026-10-30");
    }
    expect(progress.bossDefeated).toBe(true);
    expect(progress.rewards).toHaveLength(6);
  });
  it("does not grant rhythm stars for correct pitches played off the pulse", () => {
    const c = clockworkKingdom.challenges[0],
      score = realmScore(config(c.id));
    const late = referenceEvents(score).map((e) => ({
      ...e,
      timestamp: e.timestamp + 180,
    }));
    const result = summarize(score, late, c);
    expect(result.pitch).toBe(100);
    expect(result.rhythm).toBe(0);
    expect(result.stars).toBe(0);
    expect(result.late).toBeGreaterThan(0);
    expect(summarize(score, [], c)).toMatchObject({
      passed: false,
      stars: 0,
      pitch: 0,
      rhythm: 0,
    });
  });
  it("awards optional mastery stars at 70, 85 and 95 percent while allowing imperfect progression", () => {
    const c = clockworkKingdom.challenges[0],
      score = realmScore(config(c.id)),
      events = referenceEvents(score);
    const onsets = events.filter((e) => e.type === "NOTE_ON");
    expect(onsets).toHaveLength(21);
    for (const [keep, stars] of [
      [20, 3],
      [18, 2],
      [15, 1],
      [14, 0],
    ]) {
      const allowed = new Set(onsets.slice(0, keep));
      const result = summarize(
        score,
        events.filter((e) => e.type !== "NOTE_ON" || allowed.has(e)),
        c,
      );
      expect(result.stars).toBe(stars);
      expect(result.passed).toBe(stars > 0);
    }
  });
  it("resets timed streaks on misses and extras and never counts note releases twice", () => {
    const c = clockworkKingdom.challenges[1],
      score = realmScore(config(c.id)),
      events = referenceEvents(score);
    const first = events.find((e) => e.type === "NOTE_ON")!;
    const missing = events.filter(
      (e) => e.pitch !== first.pitch || e.timestamp > 400,
    );
    expect(summarize(score, missing, c).missed).toBeGreaterThan(0);
    const extra = [...events, { ...first, pitch: 1, timestamp: 400 }].sort(
      (a, b) => a.timestamp - b.timestamp,
    );
    expect(summarize(score, extra, c).extra).toBe(1);
    expect(summarize(score, events, c).bestStreak).toBe(
      soundingNotes(score.exercise).length,
    );
  });
  it("derives crystals, weak measures and staff feedback from measured notes", () => {
    const c = clockworkKingdom.challenges[4],
      score = realmScore(config(c.id)),
      events = referenceEvents(score);
    const damaged = events.filter(
      (e) => e.timestamp < 12000 || e.timestamp >= 24000,
    );
    const result = summarize(score, damaged, c);
    expect(result.crystals).toBe(3);
    expect(result.weak.start).toBe(4);
    const both = clockworkKingdom.challenges[3],
      two = realmScore(config(both.id));
    const rightOnly = referenceEvents(two).filter((e) => e.channel === 0);
    expect(summarize(two, rightOnly, both)).toMatchObject({
      right: 100,
      left: 0,
      passed: false,
    });
    const lateLeft = referenceEvents(two)
      .map((e) => ({
        ...e,
        timestamp: e.timestamp + (e.channel === 1 ? 180 : 0),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
    expect(summarize(two, lateLeft, both)).toMatchObject({
      right: 100,
      left: 0,
      passed: false,
    });
  });
  it("slices a weak phrase without changing its pitches or making a catalog exercise", () => {
    const original = realmScore(config("perfect-mechanism")),
      cut = sliceStudy(original, { start: 4, end: 8, title: "Weak" }, 60);
    expect(cut.exercise.durationBeats).toBe(16);
    expect(cut.exercise.tempoBpm).toBe(60);
    expect(soundingNotes(cut.exercise).map((n) => [n.pitch, n.beat])).toEqual(
      soundingNotes(original.exercise)
        .filter((n) => n.beat >= 16 && n.beat < 32)
        .map((n) => [n.pitch, n.beat - 16]),
    );
    expect(() => importMusicXml(musicXml(cut.exercise))).not.toThrow();
  });
  it("reproduces variations and supplies actual dotted, tied offbeat vocabulary", () => {
    for (const c of clockworkKingdom.challenges)
      for (let seed = 0; seed < 8; seed++) {
        const run = { ...config(c.id), seed },
          score = realmScore(run);
        expect(score).toEqual(realmScore(run));
        expect(score.exercise.right).toHaveLength(c.measures);
        expect(() => importMusicXml(musicXml(score.exercise))).not.toThrow();
        if (c.level === 3) {
          expect(score.exercise.right.flat().some((n) => n.beats === 1.5)).toBe(
            true,
          );
          expect(score.exercise.right.flat().some((n) => n.tie)).toBe(true);
        }
      }
  });
  it("holds the boss outcome until the whole timed score finishes, then permits defeat", () => {
    const c = clockworkKingdom.challenges[5],
      score = realmScore(config(c.id));
    expect(score.phases.map((p) => [p.start, p.end])).toEqual([
      [0, 8],
      [8, 16],
      [16, 24],
      [24, 32],
    ]);
    expect(summarize(score, referenceEvents(score), c, 1000).passed).toBe(
      false,
    );
    expect(summarize(score, [], c)).toMatchObject({ passed: false, stars: 0 });
  });
});

function timingScore(bpm:number,chord=false):RealmScore {
  const targets=chord?[{pitch:60,beat:0,hand:"right" as const},{pitch:64,beat:0,hand:"right" as const},{pitch:48,beat:0,hand:"left" as const},{pitch:60,beat:.5,hand:"right" as const}]:[{pitch:60,beat:0,hand:"right" as const}];
  return {exercise:{number:0,tempoBpm:bpm,beatsPerMeasure:4,durationBeats:4,right:[[{pitch:0,beats:4,tie:false,rest:true}]],left:[[{pitch:0,beats:4,tie:false,rest:true}]],polyphony:targets.map(n=>({...n,beats:.25}))},phrases:[{start:0,end:1,title:"Phrase"}],phases:[]};
}
