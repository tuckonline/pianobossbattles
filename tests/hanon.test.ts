import { expect, it } from "vitest";
import { practiceLibrary } from "../hosted/practice-library";
import {
  musicXml,
  soundingNotes,
  assessPractice,
  noteGroups,
} from "../hosted/sight-library";
import { importMusicXml } from "../src/domains/notation/musicxml";
it("adds Hanon No. 2 with its distinct pattern, turn, fingering and MIDI grading", () => {
  const e = practiceLibrary.find(e => e.number === 1002)!;
  expect(e.right).toHaveLength(29);
  expect(e.right[0].map(n => n.pitch)).toEqual([60,64,69,67,65,67,65,64]);
  expect(e.right[14].map(n => n.pitch)).toEqual([91,88,84,86,88,86,88,89]);
  expect(e.right[0].map(n => n.finger)).toEqual([1,2,5,4,3,4,3,2]);
  expect(e.left[0].map(n => n.finger)).toEqual([5,3,1,2,3,2,3,4]);
  e.right.forEach((bar, i) => {
    expect(bar.reduce((sum,n) => sum+n.beats,0)).toBe(2);
    expect(e.left[i].map(n=>n.pitch)).toEqual(bar.map(n=>n.pitch-24));
  });
  expect(soundingNotes(e, 'right').at(-1)).toMatchObject({pitch:60,beat:56,beats:2});
  expect(importMusicXml(musicXml(e)).notes[0].durationTicks).toBe(120);
  expect(assessPractice(e,'both',noteGroups(e,'both').flatMap(g=>g.pitches))).toMatchObject({complete:true,accuracy:100});
});
it("transcribes both Hanon pages with sixteenth durations, the turn, and closing half note", () => {
  const e = practiceLibrary[0];
  expect(e.right).toHaveLength(30);
  expect(e.left[29]).toEqual([{ pitch: 36, beats: 2, tie: false }]);
  expect(assessPractice(e, "left", [36]).correct).toBe(1);
  expect(assessPractice(e, "left", [48]).correct).toBe(0);
  expect(noteGroups(e, "both")[0].pitches).toEqual([36, 48]);
  expect(assessPractice(e, "right", [48]).correct).toBe(1);
  expect(assessPractice(e, "right", [60]).correct).toBe(0);
  expect(e.right[0].map((n) => n.pitch)).toEqual([
    48, 52, 53, 55, 57, 55, 53, 52,
  ]);
  expect(e.right[14].map((n) => n.pitch)).toEqual([
    79, 76, 74, 72, 71, 72, 74, 76,
  ]);
  // Independently read from the close-up: F-D-C-B-A-B-C-D; E-C-B-A-G-A-B-C.
  expect(e.right[15].map(n => n.pitch)).toEqual([77,74,72,71,69,71,72,74]);
  expect(e.right[16].map(n => n.pitch)).toEqual([76,72,71,69,67,69,71,72]);
  expect(e.left[14].map(n => n.pitch)).toEqual([67,64,62,60,59,60,62,64]);
  expect(e.right[28].map((n) => n.pitch)).toEqual([
    55, 52, 50, 48, 47, 48, 50, 52,
  ]);
  expect(e.right[29]).toEqual([{ pitch: 48, beats: 2, tie: false }]);
  e.right.forEach((bar, i) => {
    expect(bar.reduce((s, n) => s + n.beats, 0)).toBe(2);
    expect(e.left[i].map((n) => n.pitch)).toEqual(bar.map((n) => n.pitch - 12));
  });
  const imported = importMusicXml(musicXml(e));
  expect(imported.meter).toEqual({ numerator: 2, denominator: 4 });
  expect(imported.notes[0].durationTicks).toBe(120);
  expect(soundingNotes(e, "right").at(-1)).toMatchObject({
    beat: 58,
    beats: 2,
  });
  expect(
    assessPractice(
      e,
      "both",
      noteGroups(e, "both").flatMap((g) => g.pitches),
    ),
  ).toMatchObject({ complete: true, accuracy: 100 });
});
