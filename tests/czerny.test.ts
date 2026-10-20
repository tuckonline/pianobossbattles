import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import data from "../hosted/data/czerny-op599.json";
import {
  assessPractice,
  noteGroups,
  type Exercise,
} from "../hosted/sight-library";
import { importMusicXml } from "../src/domains/notation/musicxml";

const library = data as Exercise[];
describe("Czerny practice edition", () => {
  it("contains all 100 complete, independently playable two-hand studies", () => {
    expect(library.map((e) => e.number)).toEqual(
      Array.from({ length: 100 }, (_, i) => 3001 + i),
    );
    for (const ex of library) {
      expect(ex.sourcePage).toBeGreaterThanOrEqual(3);
      expect(ex.sourcePage).toBeLessThanOrEqual(56);
      expect(ex.right.length).toBeGreaterThan(3);
      expect(ex.durationBeats).toBeCloseTo(
        ex.right.length * ex.beatsPerMeasure!,
      );
      for (const hand of ["right", "left", "both"] as const) {
        const groups = noteGroups(ex, hand);
        expect(groups.length).toBeGreaterThan(10);
        const played = groups.flatMap((g) => g.pitches);
        expect(assessPractice(ex, hand, played)).toMatchObject({
          complete: true,
          mistakes: 0,
        });
        expect(assessPractice(ex, hand, played.slice(0, -1)).complete).toBe(
          false,
        );
      }
    }
  });
  it("uses the displayed notation's onsets and pitches for every MIDI target", () => {
    for (const ex of library) {
      const xml = readFileSync(`hosted/public${ex.notationUrl}`, "utf8");
      const score = importMusicXml(xml);
      expect(score.measures.length, ex.title).toBe(ex.right.length);
      const onsets = new Set(
        score.notes.map(
          (n) => `${n.midiPitch}:${Math.round(n.onsetTick * 1000)}`,
        ),
      );
      for (const n of ex.polyphony!) {
        expect(
          onsets.has(`${n.pitch}:${Math.round(n.beat * 480 * 1000)}`),
          `${ex.title}: ${JSON.stringify(n)}`,
        ).toBe(true);
        expect(n.beats).toBeGreaterThan(0);
        expect(n.beat + n.beats).toBeLessThanOrEqual(
          ex.durationBeats! + 0.00001,
        );
      }
    }
  });
  it("preserves opening whole notes, independent accompaniment and final-study triplets", () => {
    expect(library[0].polyphony).toContainEqual({
      pitch: 72,
      beat: 0,
      beats: 4,
      hand: "right",
    });
    expect(library[0].polyphony).toContainEqual({
      pitch: 60,
      beat: 0,
      beats: 2,
      hand: "left",
    });
    expect(
      library[99]
        .polyphony!.filter((n) => n.hand === "right")
        .slice(0, 3)
        .map((n) => n.pitch),
    ).toEqual([61, 65, 68]);
    expect(
      library[99].polyphony!.find((n) => n.hand === "right")!.beats,
    ).toBeCloseTo(1 / 3);
    const xml = readFileSync(
      "hosted/public/scores/czerny-op599/100.musicxml",
      "utf8",
    );
    expect(xml).toContain("<fifths>-5</fifths>");
    expect(xml).toContain("<time-modification>");
    expect(xml).toContain("<step>D</step>");
  });
});
