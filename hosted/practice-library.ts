import type { Exercise, ScoreNote } from "./sight-library";
// Hanon No. 1, transcribed from the owner's two photographs: 14 ascending
// patterns, 15 descending patterns, then the optional closing half note.
// Photo-verified No. 1: RH starts C3 (MIDI 48), cross-staff in bass clef;
// LH starts C2 (MIDI 36). Each bar is 2/4 with eight sixteenths.
const scale = [0, 2, 4, 5, 7, 9, 11];
const pitch = (degree: number) =>
  60 + Math.floor(degree / 7) * 12 + scale[((degree % 7) + 7) % 7];
const right: ScoreNote[][] = [],
  left: ScoreNote[][] = [];
function pattern(
  start: number,
  offsets: number[],
  rightFingers: number[],
  leftFingers: number[],
) {
  right.push(
    offsets.map((offset, i) => ({
      pitch: pitch(start + offset) - 12,
      beats: 0.25,
      tie: false,
      finger: rightFingers[i],
    })),
  );
  left.push(
    offsets.map((offset, i) => ({
      pitch: pitch(start + offset) - 24,
      beats: 0.25,
      tie: false,
      finger: leftFingers[i],
    })),
  );
}
for (let start = 0; start < 14; start++)
  pattern(
    start,
    [0, 2, 3, 4, 5, 4, 3, 2],
    [1, 2, 3, 4, 5, 4, 3, 2],
    [5, 4, 3, 2, 1, 2, 3, 4],
  );
// Descending source: G5 E5 D5 C5 B4 C5 D5 E5, then a step lower per bar.
// The first interval is a third (not a step), mirrored one octave down in LH.
for (let start = 18; start >= 4; start--)
  pattern(
    start,
    [0, -2, -3, -4, -5, -4, -3, -2],
    [5, 4, 3, 2, 1, 2, 3, 4],
    [1, 2, 3, 4, 5, 4, 3, 2],
  );
right.push([{ pitch: 48, beats: 2, tie: false }]);
left.push([{ pitch: 36, beats: 2, tie: false }]);
// No. 2: 14 ascending and 14 descending patterns, then the closing half note.
// Preserve the same C4/C2 starting registers requested for No. 1.
const secondRight: ScoreNote[][] = [], secondLeft: ScoreNote[][] = [];
for (let bar = 0; bar < 28; bar++) {
  const ascending = bar < 14;
  const start = ascending ? bar : 18 - (bar - 14);
  const offsets = ascending ? [0, 2, 5, 4, 3, 4, 3, 2] : [0, -2, -4, -3, -2, -3, -2, -1];
  // The source prints complete fingering on the first pattern of each direction.
  const rf = ascending ? [1, 2, 5, 4, 3, 4, 3, 2] : [5, 2, 1, 2, 3, 2, 3, 4];
  const lf = ascending ? [5, 3, 1, 2, 3, 2, 3, 4] : [1, 3, 5, 4, 3, 4, 3, 2];
  secondRight.push(offsets.map((offset, i) => ({ pitch: pitch(start + offset), beats: 0.25, tie: false, finger: bar === 0 || bar === 14 || i < 2 ? rf[i] : undefined })));
  secondLeft.push(offsets.map((offset, i) => ({ pitch: pitch(start + offset) - 24, beats: 0.25, tie: false, finger: bar === 0 || bar === 14 || i < 2 ? lf[i] : undefined })));
}
secondRight.push([{ pitch: 60, beats: 2, tie: false }]);
secondLeft.push([{ pitch: 36, beats: 2, tie: false }]);
export const practiceLibrary: Exercise[] = [
  {
    number: 1001,
    title: "Hanon No. 1",
    beatsPerMeasure: 2,
    measuresPerSystem: 5,
    right,
    left,
  },
  {
    number: 1002,
    title: "Hanon No. 2",
    beatsPerMeasure: 2,
    measuresPerSystem: 5,
    right: secondRight,
    left: secondLeft,
  },
];
