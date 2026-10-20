import { expect, it } from "vitest";
import {
  sightLibrary,
  soundingNotes,
  noteGroups,
  assessPractice,
  musicXml,
} from "../hosted/sight-library";
import { importMusicXml } from "../src/domains/notation/musicxml";
import { hannahSmithStartingFingers } from "../hosted/hannah-smith-fingerings";
it("includes the printed starting fingers for both hands without changing MIDI events", () => {
  expect(Object.keys(hannahSmithStartingFingers)).toHaveLength(60);
  for (const exercise of sightLibrary) {
    for (const [index, hand] of (["right", "left"] as const).entries()) {
      const fingers = exercise[hand].flat().filter(note => note.finger !== undefined);
      expect(fingers).toHaveLength(1);
      expect(fingers[0]).toBe(exercise[hand][0][0]);
      expect(fingers[0].finger).toBe(hannahSmithStartingFingers[exercise.number][index]);
      expect(fingers[0].finger).toBeGreaterThanOrEqual(1);
      expect(fingers[0].finger).toBeLessThanOrEqual(5);
    }
    const withoutFingers = { ...exercise,
      right: exercise.right.map(bar => bar.map(({ finger, ...note }) => note)),
      left: exercise.left.map(bar => bar.map(({ finger, ...note }) => note)),
    };
    expect(soundingNotes(exercise)).toEqual(soundingNotes(withoutFingers));
    expect(musicXml(exercise).match(/<fingering>/g)).toHaveLength(2);
  }
  // Independent hands: these are deliberately not mirrored finger numbers.
  expect(sightLibrary[36].left[0][0].finger).toBe(1);
  expect(sightLibrary[54].right[0][0].finger).toBe(5);
  expect(sightLibrary[54].left[0][0].finger).toBe(5);
});
it("contains all 60 complete exercises with balanced measures and valid ties", () => {
  expect(sightLibrary.map((e) => e.number)).toEqual(
    Array.from({ length: 60 }, (_, i) => i + 1),
  );
  for (const exercise of sightLibrary) {
    expect(exercise.right.length).toBe(exercise.left.length);
    for (const hand of ["right", "left"] as const) {
      for (const bar of exercise[hand])
        expect(bar.reduce((sum, n) => sum + n.beats, 0)).toBe(4);
      const notes = exercise[hand].flat();
      notes.forEach((n, i) => {
        if (n.tie) expect(notes[i + 1]?.pitch).toBe(n.pitch);
      });
    }
    expect(() => importMusicXml(musicXml(exercise))).not.toThrow();
  }
  expect(sightLibrary[31].right).toHaveLength(8); // Both pages of exercise 32.
});
it("merges held bass and final ties without demanding another key press", () => {
  const exercise = sightLibrary[33];
  expect(soundingNotes(exercise, "left")).toHaveLength(4);
  expect(soundingNotes(exercise, "left")[0]).toMatchObject({
    pitch: 48,
    beat: 0,
    beats: 8,
  });
  expect(
    noteGroups(exercise, "both").find((g) => g.beat === 4)?.pitches,
  ).not.toContain(48);
  expect(soundingNotes(sightLibrary[0], "right").at(-1)?.beats).toBe(8);
});
it("waits for both hands, counts wrong pitches, and keeps hands separate", () => {
  const e = sightLibrary[0];
  expect(assessPractice(e, "both", [60]).cursor).toBe(0);
  expect(assessPractice(e, "both", [61, 60, 48])).toMatchObject({
    cursor: 1,
    correct: 2,
    mistakes: 1,
    accuracy: 67,
  });
  const right = noteGroups(e, "right").flatMap((g) => g.pitches);
  expect(assessPractice(e, "right", right)).toMatchObject({
    complete: true,
    accuracy: 100,
  });
  expect(assessPractice(e, "left", right).complete).toBe(false);
});
