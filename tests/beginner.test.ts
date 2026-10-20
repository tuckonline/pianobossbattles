import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import data from "../hosted/data/beginner-pieces.json";
import {
  noteGroups,
  assessPractice,
  type Exercise,
} from "../hosted/sight-library";
import { importMusicXml } from "../src/domains/notation/musicxml";
const pieces = data as Exercise[];

it("provides all ten requested pieces with playable, matching scores for both hands", () => {
  expect(pieces.map((p) => p.number)).toEqual(
    Array.from({ length: 10 }, (_, i) => 4001 + i),
  );
  expect(pieces.filter((p) => p.difficulty === "Start here")).toHaveLength(6);
  for (const p of pieces) {
    expect(p.learningFocus).toBeTruthy();
    expect(p.practiceTip).toBeTruthy();
    const score = importMusicXml(
      readFileSync(`hosted/public${p.notationUrl}`, "utf8"),
    );
    expect(score.measures).toHaveLength(p.right.length);
    expect(score.notes).toHaveLength(p.polyphony!.length);
    const key = (pitch: number, onset: number, duration: number) =>
      `${pitch}:${onset}:${duration}`;
    const rendered = score.notes
      .map((n) => key(n.midiPitch, n.onsetTick / 480, n.durationTicks / 480))
      .sort();
    expect(rendered).toEqual(
      p.polyphony!.map((n) => key(n.pitch, n.beat, n.beats)).sort(),
    );
    for (const hand of ["right", "left", "both"] as const) {
      const played = noteGroups(p, hand).flatMap((g) => g.pitches);
      expect(assessPractice(p, hand, played)).toMatchObject({
        complete: true,
        mistakes: 0,
      });
      expect(assessPractice(p, hand, played.slice(0, -1)).complete).toBe(false);
    }
  }
});

it("keeps familiar openings, dotted rhythms, rests and the original five-note study", () => {
  const melody = (i: number) =>
    pieces[i].polyphony!.filter((n) => n.hand === "right");
  expect(
    melody(0)
      .slice(0, 4)
      .map((n) => n.pitch),
  ).toEqual([64, 62, 60, 62]);
  expect(melody(1).some((n) => n.beats === 1.5)).toBe(true);
  expect(
    melody(2)
      .slice(0, 3)
      .map((n) => [n.pitch, n.beats]),
  ).toEqual([
    [64, 2],
    [62, 2],
    [60, 4],
  ]);
  expect(melody(6)[0].beat).toBe(1); // Written pickup rest is not a MIDI target.
  expect(pieces[6].polyphony!.filter((n) => n.hand === "left")[0].beat).toBe(4);
  expect([...new Set(melody(8).map((n) => n.pitch))].sort()).toEqual([
    60, 62, 64, 65, 67,
  ]);
});

it("transcribes Reinagle's pitches and unfolds A-A-B-B-A to the Fine", () => {
  const p = pieces[9];
  expect(p.beatsPerMeasure).toBe(2);
  expect(p.durationBeats).toBe(80);
  expect(p.right).toHaveLength(40);
  expect(p.right[0].map((n) => n.pitch)).toEqual([72, 74]);
  expect(p.left[0][0].pitch).toBe(60);
  expect(p.right.slice(0, 8)).toEqual(p.right.slice(8, 16));
  expect(p.right.slice(16, 24)).toEqual(p.right.slice(24, 32));
  expect(p.right.slice(0, 8)).toEqual(p.right.slice(32));
  expect(p.right[39]).toEqual([{ pitch: 72, beats: 2, tie: false }]);
});
