import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import data from "../hosted/data/burgmuller-op100.json";
import fingerings from "../source-scores/burgmuller/fingerings.json";
import {
  assessPractice,
  noteGroups,
  type Exercise,
} from "../hosted/sight-library";
import { importMusicXml } from "../src/domains/notation/musicxml";

it("anchors source fingerings to playable notes in every study, including crossed hands", () => {
  expect(new Set(fingerings.map((f) => f.study)).size).toBe(25);
  const seen = new Set<string>();
  for (const f of fingerings) {
    expect([1, 2, 3, 4, 5]).toContain(f.finger);
    expect(["left", "right"]).toContain(f.hand);
    const ex = data[f.study - 1];
    const beat = (f.measure - 1) * ex.beatsPerMeasure + f.beat;
    expect(
      ex.polyphony.some(
        (n) => n.pitch === f.pitch && Math.abs(n.beat - beat) < 0.001,
      ),
      JSON.stringify(f),
    ).toBe(true);
    const id = `${f.study}:${f.measure}:${f.beat}:${f.pitch}`;
    expect(seen.has(id), id).toBe(false);
    seen.add(id);
  }
  // L'hirondelle's high melody is played by the crossing left hand.
  expect(fingerings).toContainEqual({
    study: 24,
    measure: 1,
    beat: 1,
    pitch: 74,
    hand: "left",
    finger: 2,
  });
  expect(fingerings).toContainEqual({
    study: 24,
    measure: 1,
    beat: 0.25,
    pitch: 62,
    hand: "right",
    finger: 1,
  });
  const xml = readFileSync(
    "hosted/public/scores/burgmuller-op100/24.musicxml",
    "utf8",
  );
  expect(xml).toContain('<fingering placement="below">LH 2</fingering>');
});

it("includes all 25 complete studies with the exact source MIDI attacks", () => {
  const sources = JSON.parse(
    gunzipSync(
      readFileSync("source-scores/burgmuller/study-events.json.gz"),
    ).toString(),
  );
  expect(data.map((e) => e.number)).toEqual(
    Array.from({ length: 25 }, (_, i) => 5001 + i),
  );
  for (const ex of data as Exercise[]) {
    expect(ex.bothHandsOnly).toBe(true);
    const source = sources[ex.number - 5001];
    const raw = source.tracks.flatMap(
      (t: { notes: { beat: number; beats: number; pitch: number }[] }) =>
        t.notes,
    );
    const origin =
      Math.min(...raw.map((n: { beat: number }) => n.beat)) >= 4
        ? 4
        : 4 - ex.beatsPerMeasure!;
    const expected = raw
      .map(
        (n: { beat: number; beats: number; pitch: number }) =>
          `${n.pitch}:${(n.beat - origin).toFixed(5)}:${n.beats.toFixed(5)}`,
      )
      .sort();
    expect(
      ex
        .polyphony!.map(
          (n) => `${n.pitch}:${n.beat.toFixed(5)}:${n.beats.toFixed(5)}`,
        )
        .sort(),
      ex.title,
    ).toEqual(expected);
    const score = importMusicXml(
      readFileSync(`hosted/public${ex.notationUrl}`, "utf8"),
    );
    expect(score.measures.length, ex.title).toBe(ex.right.length);
    for (const n of ex.polyphony!) {
      expect(
        score.notes.some(
          (w) =>
            w.midiPitch === n.pitch &&
            Math.abs(w.onsetTick / 480 - n.beat) < 0.00001,
        ),
        `${ex.title}: ${JSON.stringify(n)}`,
      ).toBe(true);
      expect(n.beat + n.beats).toBeLessThanOrEqual(
        ex.durationBeats! + 0.000001,
      );
    }
    const played = noteGroups(ex, "both").flatMap((g) => g.pitches);
    expect(assessPractice(ex, "both", played)).toMatchObject({
      complete: true,
      mistakes: 0,
    });
    expect(assessPractice(ex, "both", played.slice(0, -1)).complete).toBe(
      false,
    );
  }
});
