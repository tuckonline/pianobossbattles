import { expect, it } from "vitest";
import { schmittLibrary } from "../hosted/schmitt-library";
import {
  musicXml,
  soundingNotes,
  noteGroups,
  assessPractice,
  practicePass,
} from "../hosted/sight-library";
import { importMusicXml } from "../src/domains/notation/musicxml";

it("contains precisely numbered exercises 1–213 with source page references", () => {
  expect(schmittLibrary.map((e) => e.number)).toEqual(
    Array.from({ length: 213 }, (_, i) => 2001 + i),
  );
  expect(schmittLibrary[204].sourcePage).toBe(13);
  expect(schmittLibrary[205].sourcePage).toBe(14);
});

it("preserves every pitch, onset and duration through MusicXML, including independent held voices", () => {
  const sort = (rows: number[][]) =>
    rows.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  for (const exercise of schmittLibrary) {
    const expected = soundingNotes(exercise, "both");
    const imported = importMusicXml(musicXml(exercise));
    expect(
      sort(
        imported.notes.map((n) => [n.onsetTick, n.midiPitch, n.durationTicks]),
      ),
      exercise.title,
    ).toEqual(
      sort(expected.map((n) => [n.beat * 480, n.pitch, n.beats * 480])),
    );
    expect(Math.max(...expected.map((n) => n.beat + n.beats))).toBe(
      exercise.durationBeats,
    );
    expect(
      soundingNotes(exercise, "left").map((n) => [
        n.pitch + 12,
        n.beat,
        n.beats,
      ]),
    ).toEqual(
      soundingNotes(exercise, "right").map((n) => [n.pitch, n.beat, n.beats]),
    );
    expect(
      assessPractice(
        exercise,
        "both",
        noteGroups(exercise, "both").flatMap((g) => g.pitches),
      ),
    ).toMatchObject({ complete: true, accuracy: 100 });
  }
});

it("matches source examples for initial scale pattern, held fingers, thirds and shifting positions", () => {
  const right = (number: number) =>
    soundingNotes(schmittLibrary[number - 1], "right");
  expect(
    right(1)
      .slice(0, 8)
      .map((n) => n.pitch),
  ).toEqual([60, 62, 64, 65, 67, 65, 64, 62]);
  expect(right(1).at(-1)).toMatchObject({ pitch: 60, beat: 8, beats: 1 });
  const held = right(111).filter((n) => n.beats === 4);
  expect(held.map((n) => n.pitch)).toEqual([62, 64, 65, 67]);
  expect(noteGroups(schmittLibrary[110], "right")[1]).toEqual({
    beat: 0.5,
    pitches: [60],
  });
  expect(noteGroups(schmittLibrary[118], "both")[0].pitches).toEqual([
    48, 52, 60, 64,
  ]);
  expect(
    right(182)
      .slice(0, 8)
      .map((n) => n.pitch),
  ).toEqual([60, 65, 64, 67, 65, 69, 67, 64]);
  expect(
    right(208)
      .slice(16, 24)
      .map((n) => n.pitch),
  ).toEqual([67, 65, 67, 65, 69, 67, 69, 67]);
  expect(right(170).at(-1)).toMatchObject({ pitch: 84, beats: 1, beat: 19 });
});

it("omits only the final onset on nonfinal Schmitt passes in every hand mode", () => {
  for (const ex of schmittLibrary) {
    const body = practicePass(ex, true);
    const lastBeat = Math.max(...soundingNotes(ex).map(n => n.beat));
    expect(body.durationBeats).toBe(lastBeat);
    for (const hand of ["both", "left", "right"] as const) {
      const groups = noteGroups(body, hand);
      expect(groups.every(g => g.beat < lastBeat)).toBe(true);
      const played = groups.flatMap(g => g.pitches);
      expect(assessPractice(body, hand, played).complete).toBe(true);
      expect(assessPractice(ex, hand, played).complete).toBe(false);
    }
    expect(practicePass(ex, false)).toBe(ex);
  }
});
