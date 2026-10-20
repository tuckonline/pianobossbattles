import { describe, it, expect } from "vitest";
import {
  normalizeMidi,
  MidiEventBus,
  MidiRecorder,
  MidiSimulator,
  trimRecording,
} from "../src/domains/midi/engine";
import { pairNotes, recordingToScore } from "../src/domains/music/model";
import {
  defaultScoring,
  scoringSchema,
  treeSchema,
} from "../src/domains/blocks/schema";
import { scorePerformance } from "../src/domains/scoring/engine";
import { canEdit, requireRole } from "../src/domains/auth/permissions";
import { importMusicXml } from "../src/domains/notation/musicxml";
const bus = new MidiEventBus(),
  sim = new MidiSimulator(bus, () => 0);
const fixture = sim.sequence([
  { pitch: 60, onset: 0, duration: 300 },
  { pitch: 64, onset: 500, duration: 300 },
]);
describe("MIDI domain", () => {
  it("normalizes note on, velocity-zero note off and CC64 with channels", () => {
    expect(normalizeMidi([0x92, 60, 90], 10)).toMatchObject({
      type: "NOTE_ON",
      channel: 2,
      pitch: 60,
      velocity: 90,
    });
    expect(normalizeMidi([0x90, 60, 0], 20)?.type).toBe("NOTE_OFF");
    expect(normalizeMidi([0xb3, 64, 127], 30)).toMatchObject({
      type: "CONTROL_CHANGE",
      controller: 64,
      channel: 3,
      value: 127,
    });
    expect(normalizeMidi([0xf8], 30)).toBeNull();
  });
  it("records relative timing and closes held notes and sustain", () => {
    let now = 100;
    const recorder = new MidiRecorder(bus, () => now);
    recorder.start();
    bus.emit({
      type: "NOTE_ON",
      timestamp: 110,
      pitch: 60,
      velocity: 80,
      channel: 0,
    });
    bus.emit({
      type: "CONTROL_CHANGE",
      timestamp: 120,
      controller: 64,
      value: 127,
      channel: 0,
    });
    now = 300;
    const events = recorder.stop();
    expect(events[0].timestamp).toBe(10);
    expect(pairNotes(events)[0].duration).toBe(190);
    expect(events.at(-1)).toMatchObject({ type: "CONTROL_CHANGE", value: 0 });
  });
  it("simulates chords, sequences and independent channels", () => {
    const events = sim.sequence([
      { pitch: 60, onset: 0, duration: 100, channel: 0 },
      { pitch: 60, onset: 0, duration: 200, channel: 1 },
      { pitch: 67, onset: 300, duration: 100 },
    ]);
    expect(pairNotes(events).map((n) => n.duration)).toEqual([100, 200, 100]);
  });
  it("trims notes crossing both boundaries without dangling events", () => {
    const events = trimRecording(fixture, 100, 600);
    expect(pairNotes(events).map((n) => [n.onset, n.duration])).toEqual([
      [0, 200],
      [400, 100],
    ]);
  });
  it("converts to canonical ticks without pretending to infer notation", () => {
    const score = recordingToScore(fixture, 120);
    expect(score.notes[1].onsetTick).toBe(480);
    expect(score.notes[0].hand).toBe("UNSPECIFIED");
    expect(score.warnings).not.toHaveLength(0);
  });
});
describe("scoring and validation", () => {
  it("scores correct pitches and rejects missing and extra notes", () => {
    expect(scorePerformance(fixture, fixture, defaultScoring).overall).toBe(
      100,
    );
    expect(scorePerformance(fixture, [], defaultScoring).passed).toBe(false);
    const extra = sim.sequence([
      { pitch: 60, onset: 0, duration: 300 },
      { pitch: 64, onset: 500, duration: 300 },
      { pitch: 67, onset: 900, duration: 100 },
    ]);
    expect(
      scorePerformance(fixture, extra, defaultScoring).extraNotes,
    ).toHaveLength(1);
    expect(
      scorePerformance(fixture, extra, defaultScoring).overall,
    ).toBeLessThan(80);
  });
  it("pitch-only scoring ignores rhythm but timing profile detects delay", () => {
    const actual = sim.sequence([
      { pitch: 60, onset: 0, duration: 300 },
      { pitch: 64, onset: 1200, duration: 300 },
    ]);
    expect(scorePerformance(fixture, actual, defaultScoring).overall).toBe(100);
    expect(
      scorePerformance(fixture, actual, {
        ...defaultScoring,
        weights: { ...defaultScoring.weights, rhythm: 1 },
        onsetTolerance: 70,
      }).overall,
    ).toBeLessThan(80);
  });
  it("does not pass below minimum tempo", () =>
    expect(scorePerformance(fixture, fixture, defaultScoring, 30).passed).toBe(
      false,
    ));
  it("rejects profiles with no dimensions and invalid block JSON", () => {
    expect(() =>
      scoringSchema.parse({
        ...defaultScoring,
        weights: {
          pitch: 0,
          rhythm: 0,
          duration: 0,
          continuity: 0,
          chord: 0,
          velocity: 0,
          pedal: 0,
        },
      }),
    ).toThrow();
    expect(() =>
      treeSchema.parse({
        modules: [
          {
            id: "m",
            title: "M",
            lessons: [
              {
                id: "l",
                title: "L",
                blocks: [
                  { id: "b", type: "UNTRUSTED", schemaVersion: 1, config: {} },
                ],
              },
            ],
          },
        ],
      }),
    ).toThrow();
  });
  it("supports multiple roles without allowing unrelated course editing", () => {
    const actor = {
      id: "a",
      roles: ["STUDENT", "TEACHER"] as ("STUDENT" | "TEACHER")[],
    };
    expect(() => requireRole(actor, "TEACHER")).not.toThrow();
    expect(canEdit(actor, "b")).toBe(false);
    expect(canEdit(actor, "b", "EDITOR")).toBe(true);
    expect(canEdit(actor, "b", "VIEWER")).toBe(false);
  });
  it("imports simple MusicXML and rejects entity declarations", () => {
    const xml =
      '<score-partwise><part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note></measure></part></score-partwise>';
    expect(importMusicXml(xml).notes[0]).toMatchObject({
      midiPitch: 60,
      durationTicks: 480,
    });
    expect(() => importMusicXml("<!DOCTYPE x>" + xml)).toThrow();
  });
});
