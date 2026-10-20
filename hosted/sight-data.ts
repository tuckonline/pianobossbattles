import type { Exercise, ScoreNote } from "./sight-library";
import { hannahSmithStartingFingers } from "./hannah-smith-fingerings";
const pitches: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};
function parse(pattern: string): ScoreNote[][] {
  return pattern.split("|").map((bar) => {
    const tokens = bar.trim().split(/\s+/);
    return tokens.map((token) => {
      const match = /^([A-G])(\d)(?::([\d.]+))?(~)?$/.exec(token);
      if (!match) throw new Error(`Invalid score token ${token}`);
      return {
        pitch: pitches[match[1]] + (Number(match[2]) + 1) * 12,
        beats: match[3] ? Number(match[3]) : 4 / tokens.length,
        tie: !!match[4],
      };
    });
  });
}
const exercises: Exercise[] = [];
function add(number: number, right: string, left: string | number = -12) {
  const r = parse(right);
  exercises.push({
    number,
    right: r,
    left:
      typeof left === "string"
        ? parse(left)
        : r.map((bar) => bar.map((n) => ({ ...n, pitch: n.pitch + left }))),
  });
}
// Transcribed from the eleven photographs supplied by the site owner. A tilde
// indicates a tie to the next printed note; beats are quarter-note units.
add(1, "C4|D4|E4|F4|G4|F4|E4|D4|C4|D4|E4|D4|C4|D4|C4~|C4");
add(2, "E4|F4|G4|F4|E4|F4|E4|D4|C4|D4|E4|F4|E4|D4|C4~|C4");
add(3, "G4|F4|E4|F4|E4|D4|C4|D4|E4|F4|G4|F4|E4|D4|C4~|C4");
add(4, "C4|D4|E4|G4|F4|E4|D4|F4|E4|D4|C4|E4|D4|F4|C4~|C4");
add(5, "C4|E4|G4|E4|F4|E4|D4|F4|E4|F4|G4|E4|F4|D4|C4~|C4");
add(6, "C4|E4|F4|E4|D4|F4|G4|F4|E4|C4|D4|F4|E4|D4|C4~|C4");
add(7, "G4|A4|B4|A4|B4|C5|D5|B4|C5|D5|B4|C5|A4|B4|G4");
add(8, "G4|A4|G4|C5|B4|D5|C5|B4|A4|G4|A4|C5|B4|D5|C5");
add(9, "G4|C5|B4|C5|D5|B4|C5|A4|G4|C5|A4|D5|C5|B4|C5", -24);
add(10, "G4 A4|B4 C5|A4 B4|C5 D5|C5 B4|A4 B4|C5~|C5");
add(11, "F4 E4|F4 G4|F4 E4|D4 C4|D4 G4|F4 A4|G4|G4");
add(12, "C5 B4|A4 G4|B4 A4|G4 F4|G4 A4|B4 G4|C5|C5");
add(13, "G4 A4|G4 C5|A4 C5|G4|A4 D5|C5 B4|D5|B4", -24);
add(14, "F4 E4|D4 C4|D4 F4|C4|D4 G4|E4 C4|F4|F4");
add(15, "C5 B4|A4 G4|A4 D5|B4|C5 B4|A4 D5|C5 B4|C5", -24);
add(
  16,
  "C4 D4 E4 F4|G4 F4 E4 D4|E4 D4 C4 E4|D4|C4 D4 E4 F4|G4 F4 E4 D4|C4 F4 E4 D4|C4",
);
add(
  17,
  "F5 E5 F5 G5|F5 E5 D5 C5|D5 E5|F5|G5 F5 E5 D5|E5 F5 G5 F5|E5 D5|C5|D5 C5 D5 E5|F5:1 E5:1 D5:2|E5 D5 E5 F5|G5:1 F5:1 E5:2|F5 E5 D5 C5|D5 E5 F5 G5|F5 E5|F5",
  -24,
);
add(
  18,
  "D5 C5 B4 D5|C5 B4 A4 C5|B4 A4 G4 B4|A4|D5 C5 B4 D5|C5 B4 A4 C5|B4 A4 G4 A4|G4",
);
add(
  19,
  "C5 B4 C5 D5|E5:1 D5:1 C5:2|B4 C5 D5 E5|D5|C5 B4 C5 D5|E5:1 D5:1 C5:2|B4 F5 E5 D5|C5",
  -24,
);
add(
  20,
  "G4 A4 G4 C5|B4:1 D5:1 C5:2|G4 A4 B4 C5|B4:2 A4:1 G4:1|G4 A4 G4 C5|B4:1 D5:1 C5:2|A4 D5 C5 B4|C5",
  -24,
);
add(
  21,
  "G4 F4 E4 F4|E4:1 D4:1 C4:2|D4 F4 E4 G4|D4|G4 F4 E4 F4|E4:1 D4:1 C4:2|D4 G4 F4 D4|C4",
);
add(
  22,
  "C5 G4|A4 B4 C5 D5|C5 B4 A4 B4|C5|D5 A4|B4 C5 D5 C5|B4 C5 B4 A4|G4|D5 C5 B4 A4|B4:1 C5:1 D5:2|E5 D5 C5 B4|C5:1 D5:1 E5:2|D5 C5 B4 A4|B4 C5 D5 E5|D5 C5 B4 C5|D5",
  -24,
);
add(23, "B4 A4 G4 A4|B4 G4|A4 D5|B4 G4|B4 A4 G4 A4|C5 G4|A4 E5|B4");
add(
  24,
  "E4 F4 E4 D4|C4 D4 E4 F4|G4:2 E4:1 D4:1|C4 F4|F4 E4 D4 F4|E4 D4 C4 E4|D4 E4|D4 G4|E4 F4 E4 D4|C4 D4 E4 G4|F4 G4 F4 E4|D4 E4 F4 G4|E4 G4 F4 E4|D4 G4 F4 D4|C4 F4|C4",
);
add(
  25,
  "G4 B4 D5 B4|C5:1 C5:1 A4:2|A4 B4 C5 A4|B4:1 B4:1 G4:2|G4 B4 D5 B4|A4 B4 C5 A4|G4 A4 B4 G4|A4:1 A4:1 G4:2",
);
add(
  26,
  "G5:1 F5:.5 E5:.5 F5:1 E5:.5 D5:.5|E5:1 D5:.5 C5:.5 D5:1 E5:.5 F5:.5|G5:1 F5:.5 E5:.5 F5:1 E5:.5 D5:.5|E5:.5 F5:.5 E5:.5 D5:.5 C5:2",
  -24,
);
add(
  27,
  "G4:1 A4:.5 B4:.5 C5:1 B4:.5 C5:.5|A4:1 B4:.5 C5:.5 D5:1 C5:.5 D5:.5|C5:1 B4:.5 A4:.5 G4:1 A4:.5 B4:.5|C5:.5 B4:.5 A4:.5 B4:.5 C5:2",
);
add(
  28,
  "G4:.5 F4:.5 E4:.5 F4:.5 E4:.5 D4:.5 C4:1|E4:.5 F4:.5 G4:.5 E4:.5 D4:2|G4:.5 F4:.5 E4:.5 F4:.5 E4:.5 D4:.5 C4:1|D4:.5 G4:.5 F4:.5 D4:.5 C4:2",
);
add(
  29,
  "A4:.5 G4:.5 F4:.5 E4:.5 D4:1 F4:1|E4:.5 F4:.5 G4:.5 A4:.5 G4:2|A4:.5 G4:.5 F4:.5 E4:.5 D4:1 F4:1|E4:.5 G4:.5 F4:.5 E4:.5 F4:2",
);
add(
  30,
  "C5:1 G4:1 A4:.5 B4:.5 C5:.5 D5:.5|C5:.5 B4:.5 A4:.5 B4:.5 C5:1 G4:1|C5:1 G4:1 A4:.5 B4:.5 C5:.5 D5:.5|C5:.5 B4:.5 A4:.5 B4:.5 C5:2|D5:1 A4:1 C5:.5 B4:.5 A4:.5 G4:.5|D5:.5 C5:.5 B4:.5 A4:.5 C5:.5 B4:.5 A4:.5 G4:.5|C5:1 G4:1 A4:.5 B4:.5 C5:.5 D5:.5|C5:.5 B4:.5 A4:.5 B4:.5 C5:2",
  -24,
);
add(
  31,
  "C5:1 C5:1 C5:.5 B4:.5 A4:.5 G4:.5|A4:1 B4:1 C5:2|D5:1 D5:1 D5:.5 C5:.5 B4:.5 A4:.5|B4:1 A4:1 G4:2|A4:1 A4:1 A4:.5 B4:.5 C5:.5 A4:.5|B4:1 B4:1 B4:.5 C5:.5 D5:.5 B4:.5|C5:1 C5:1 A4:.5 B4:.5 C5:.5 D5:.5|C5:1 B4:1 C5:2",
  -24,
);
add(
  32,
  "D5:1 C5:.5 B4:.5 A4:.5 B4:.5 G4:.5 B4:.5|A4:1 A4:1 B4:2|D5:1 C5:.5 B4:.5 A4:.5 B4:.5 G4:.5 B4:.5|A4:1 A4:1 G4:2|C5:1 B4:.5 A4:.5 B4:.5 A4:.5 G4:.5 B4:.5|C5:.5 B4:.5 C5:.5 A4:.5 B4:.5 A4:.5 G4:.5 B4:.5|D5:1 C5:.5 B4:.5 A4:.5 B4:.5 G4:.5 B4:.5|A4:1 A4:1 G4:2",
  -24,
);
add(
  33,
  "C5:1 G4:1 A4:.5 B4:.5 C5:.5 A4:.5|G4:.5 C5:.5 B4:.5 C5:.5 D5:2|C5:1 G4:1 A4:.5 B4:.5 C5:.5 A4:.5|G4:.5 C5:.5 B4:.5 D5:.5 C5:2|D5:1 C5:1 B4:.5 A4:.5 G4:.5 B4:.5|D5:.5 C5:.5 B4:.5 A4:.5 C5:.5 B4:.5 A4:.5 G4:.5|C5:1 G4:1 A4:.5 B4:.5 C5:.5 D5:.5|C5:.5 B4:.5 A4:.5 B4:.5 C5:2",
  -24,
);
const bass = "C3~|C3|G3~|G3|C3~|C3|G3|C3";
add(
  34,
  "C4 D4|E4 F4|G4 F4|E4 D4|C4 D4|E4 D4|C4~|C4",
  "C3~|C3|E3~|E3|G3~|G3|C3~|C3",
);
add(35, "E5 F5|G5 F5|E5 D5|C5 D5|E5 F5|E5 D5|C5 D5|C5", bass);
add(36, "G4 F4|E4 F4|E4 D4|C4 D4|E4 F4|G4 F4|E4 D4|C4", bass);
add(
  37,
  "C4 D4|E4 G4|F4 E4|D4 F4|E4 D4|C4 E4|D4 F4|C4",
  "C3~|C3|G2~|G2|C3~|C3|G2|C3",
);
add(
  38,
  "C5 D5|E5 F5|G5 F5|E5 D5|C5 D5|E5 F5|E5 D5|C5",
  "C4~|C4|G3~|G3|C4~|C4|G3|C4",
);
add(
  39,
  "C5 B4|A4 G4|A4 B4|C5 A4|G4 A4|B4 D5|C5~|C5",
  "C3~|C3|F2~|F2|G2~|G2|C3~|C3",
);
add(40, "C5 D5|E5 C5|D5 E5|F5 D5|E5 F5|G5 F5|E5 D5|C5", bass);
add(41, "G4 F4|E4 G4|F4 E4|D4 F4|E4 D4|C4 E4|D4 E4|C4", bass);
add(
  42,
  "B4 A4|G4 B4|C5 B4|A4 C5|D5 C5|B4 C5|A4 G4|G4",
  "G3~|G3|D4~|D4|B3~|B3|D4|G3",
);
add(
  43,
  "E4 D4|C4 E4|F4 E4|D4 F4|G4 F4|E4 D4|C4~|C4",
  "C3~|C3|G2~|G2|B2~|B2|C3~|C3",
);
add(
  44,
  "G4 A4|B4 C5|A4 B4|C5 D5|C5 B4|A4 B4|C5~|C5",
  "C3~|C3|F3~|F3|G3~|G3|C3~|C3",
);
add(
  45,
  "C5 B4|C5 D5|C5 B4|A4 G4|A4 C5|C5 B4|C5~|C5",
  "C3~|C3|E3~|E3|F3|G3|C3~|C3",
);
add(46, "C5|G4|A4 B4|C5 D5|C5 B4|A4 B4|C5~|C5", "C3~|C3|F3|D3|G3~|G3|C3~|C3");
add(47, "C4 D4 E4 G4|F4 E4 D4 F4|E4 D4 C4 E4|D4:1 E4:1 C4:2", "C3|G3|C3|G3 C3");
add(
  48,
  "C4 E4 G4 E4|F4:1 E4:1 D4:2|E4 F4 G4 E4|F4:1 D4:1 C4:2",
  "C3|G3|C3|G3 C3",
);
add(49, "G4 A4 B4 A4|B4 C5 D5 B4|C5 B4 A4 G4|A4:1 A4:1 G4:2", "G3|G3|D4|D4 G3");
add(
  50,
  "G4 A4 B4 C5|A4 B4 C5 D5|C5 B4 A4 B4|C5 A4|G4 A4 B4 C5|A4 B4 C5 D5|C5 B4 A4 B4|C5",
  "C3|F3|G3|C3|E3|F3|G3|C3",
);
add(
  51,
  "C4 E4 F4 E4|D4 F4 G4 F4|E4 C4 D4 F4|E4:1 D4:1 C4:2",
  "C3|G3|C3 F3|G3 C3",
);
add(
  52,
  "C4 E4 G4 E4|F4:1 E4:1 D4:2|D4 E4 F4 D4|E4:1 D4:1 C4:2|C4 E4 G4 E4|D4 E4 F4 D4|C4 D4 E4 C4|E4:1 D4:1 C4:2",
  "C3|G3|G3|C3|C3|F3|G3|G3 C3",
);
add(
  53,
  "G4 A4 B4 A4|B4:1 C5:1 D5:2|C5 B4 A4 G4|A4:1 B4:1 A4:2|G4 A4 B4 A4|B4:1 C5:1 D5:2|C5 B4 A4 B4|A4 G4",
  "G3|G3|D3|D3|G3|G3|D3|D3 G3",
);
add(
  54,
  "E5 E5|E5 D5 C5 E5|G5:2 F5:1 E5:1|F5:1 E5:1 D5:2|E5 E5|E5 D5 C5 E5|G5:1 F5:.5 E5:.5 F5:1 E5:.5 D5:.5|C5",
  "C3|C3|E3|G3|C3|C3|E3 G3|C3",
);
add(
  55,
  "G4:.5 F4:.5 E4:.5 F4:.5 E4:.5 D4:.5 C4:1|F4:.5 E4:.5 D4:.5 C4:.5 D4:.5 E4:.5 D4:1|G4:.5 F4:.5 E4:.5 F4:.5 E4:.5 D4:.5 C4:1|F4:.5 E4:.5 D4:.5 E4:.5 D4:1 C4:1",
  "C3|G3|C3|G3 C3",
);
add(
  56,
  "C5 D5 E5 F5 G5 F5 E5 D5|C5 E5 D5 F5|E5 F5 G5 E5 D5 C5 B4 C5|D5:1 C5:1 B4:2",
  "C4|C4 G3|C4|G3 C4",
);
add(
  57,
  "B4 C5 D5 C5 B4 D5 C5 B4|A4 B4 C5 B4 A4 C5 B4 A4|G4 A4 B4 A4 G4 B4 A4 G4|A4:.5 C5:.5 B4:.5 A4:.5 G4:2",
  "G3|D4|B3|D4 G3",
);
add(
  58,
  "G5 F5 E5 F5 E5 D5 C5 D5|E5 D5 D5 C5|D5 E5 F5 E5 G5 F5 E5 D5|E5:1 D5:1 C5:2",
  "C3|G3 C3|G3|G3 C3",
);
add(
  59,
  "F5 E5 D5 C5 D5 E5 F5 G5|F5:.5 E5:.5 D5:.5 E5:.5 D5:1 C5:1|F5 E5 D5 C5 D5 E5 F5 G5|F5:.5 E5:.5 D5:.5 E5:.5 F5:2",
  "F3|C3 F3|F3|C3 F3",
);
add(
  60,
  "C4:.5 D4:.5 E4:.5 F4:.5 G4:.5 F4:.5 E4:1|F4:.5 E4:.5 D4:1 E4:.5 D4:.5 C4:1|C4:.5 D4:.5 E4:.5 F4:.5 G4:.5 F4:.5 E4:1|F4:.5 E4:.5 D4:.5 E4:.5 D4:1 C4:1",
  "C3|G3 C3|C3|G3 C3",
);
export const sightLibrary = exercises.map((exercise) => ({
  ...exercise,
  collection: "hannah-smith-part1",
  title: `Hannah Smith Part 1 · Exercise ${exercise.number}`,
  ...Object.fromEntries((["right", "left"] as const).map((hand, handIndex) => [
    hand,
    exercise[hand].map((bar, barIndex) => bar.map((note, noteIndex) =>
      barIndex === 0 && noteIndex === 0
        ? { ...note, finger: hannahSmithStartingFingers[exercise.number]?.[handIndex] }
        : note,
    )),
  ])),
}));
