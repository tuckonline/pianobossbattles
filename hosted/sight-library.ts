import { polyphonicXml } from "./polyphonic-score";
import { hannahSmithStartingFingers } from "./hannah-smith-fingerings";
export type Hand = "both" | "right" | "left";
export type ScoreNote = {
  pitch: number;
  beats: number;
  tie: boolean;
  finger?: number;
};
export type Exercise = {
  number: number;
  title?: string;
  tempoBpm?: number;
  beatsPerMeasure?: number;
  measuresPerSystem?: number;
  right: ScoreNote[][];
  left: ScoreNote[][];
  polyphony?: SoundNote[];
  durationBeats?: number;
  sourcePage?: number;
  collection?: string;
  bothHandsOnly?: boolean;
  singleHand?: "right" | "left";
  notationUrl?: string;
  notationXml?: string;
  composer?: string;
  difficulty?: string;
  description?: string;
  learningFocus?: string;
  practiceTip?: string;
  arrangement?: string;
  sourceUrl?: string;
};
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
export type SoundNote = {
  pitch: number;
  beat: number;
  beats: number;
  hand: "right" | "left";
};
export function soundingNotes(
  exercise: Exercise,
  hand: Hand = "both",
): SoundNote[] {
  if (exercise.polyphony)
    return exercise.polyphony
      .filter((n) => hand === "both" || n.hand === hand)
      .sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
  const result: SoundNote[] = [];
  for (const h of ["right", "left"] as const) {
    if (hand !== "both" && hand !== h) continue;
    let beat = 0,
      previous: SoundNote | undefined,
      tied = false;
    for (const bar of exercise[h])
      for (const n of bar) {
        if (tied && previous?.pitch === n.pitch) previous.beats += n.beats;
        else {
          previous = { pitch: n.pitch, beat, beats: n.beats, hand: h };
          result.push(previous);
        }
        tied = n.tie;
        beat += n.beats;
      }
  }
  return result.sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
}
export function noteGroups(exercise: Exercise, hand: Hand) {
  const groups: { beat: number; pitches: number[] }[] = [];
  for (const n of soundingNotes(exercise, hand)) {
    let group = groups.at(-1);
    if (!group || group.beat !== n.beat) {
      group = { beat: n.beat, pitches: [] };
      groups.push(group);
    }
    group.pitches.push(n.pitch);
  }
  return groups;
}
// The terminal Schmitt entry is a cadence, played only on the last repeat.
export function practicePass(exercise: Exercise, omitClosing = false): Exercise {
  if (!omitClosing || exercise.collection !== "schmitt-op16") return exercise;
  const notes = soundingNotes(exercise);
  const end = Math.max(...notes.map(n => n.beat));
  if (end <= 0) return exercise;
  return { ...exercise, durationBeats: end,
    polyphony: notes.filter(n => n.beat < end).map(n => ({ ...n, beats: Math.min(n.beats, end - n.beat) })) };
}

export function assessPractice(
  exercise: Exercise,
  hand: Hand,
  played: number[],
) {
  const groups = noteGroups(exercise, hand);
  const evaluations: {sequence:number; outcome:"correct"|"incorrect"; occurrence:string|null; pitch:number; groupId:string; groupSize:number; groupComplete:boolean}[] = [];
  const feedback = new Map<
    string,
    { beat: number; pitch: number; status: "correct" | "incorrect" }
  >();
  let cursor = 0,
    mistakes = 0,
    correct = 0;
  let pending = [...groups[0].pitches];
  for (const pitch of played) {
    if (cursor === groups.length) break;
    const index = pending.indexOf(pitch);
    if (index < 0) {
      evaluations.push({sequence:evaluations.length,outcome:"incorrect",occurrence:null,pitch,groupId:String(cursor),groupSize:groups[cursor].pitches.length,groupComplete:false});
      mistakes++;
      // A wrong key is not necessarily printed in the score. Mark only the
      // still-missing targets at this entry; already-correct chord tones stay green.
      for (const missing of pending)
        feedback.set(`${cursor}:${missing}`, {
          beat: groups[cursor].beat,
          pitch: missing,
          status: "incorrect",
        });
    } else {
      feedback.set(`${cursor}:${pitch}`, {
        beat: groups[cursor].beat,
        pitch,
        status: "correct",
      });
      const ordinal=groups[cursor].pitches.filter(p=>p===pitch).length-pending.filter(p=>p===pitch).length;
      evaluations.push({sequence:evaluations.length,outcome:"correct",occurrence:`${cursor}:${pitch}:${ordinal}`,pitch,groupId:String(cursor),groupSize:groups[cursor].pitches.length,groupComplete:pending.length===1});
      pending.splice(index, 1);
      correct++;
    }
    if (!pending.length) {
      cursor++;
      pending = [...(groups[cursor]?.pitches ?? [])];
    }
  }
  return {
    cursor,
    pending,
    mistakes,
    correct,
    complete: cursor === groups.length,
    accuracy: Math.round((100 * correct) / Math.max(1, correct + mistakes)),
    feedback: [...feedback.values()],
    evaluations,
  };
}
export function musicXml(
  exercise: Exercise,
  measureOffset = 0,
  finalPage = true,
) {
  if (exercise.polyphony) return polyphonicXml(exercise);
  const beatsPerMeasure = exercise.beatsPerMeasure ?? 4;
  const clef = (i: number) =>
    exercise.beatsPerMeasure === 2 && exercise.right[i][0].pitch < 60
      ? "<sign>F</sign><line>4</line>"
      : "<sign>G</sign><line>2</line>";
  const names = ["C", "", "D", "", "E", "F", "", "G", "", "A", "", "B"];
  const tied = { right: false, left: false };
  const bars = exercise.right
    .map((_, i) => {
      const voices = (["right", "left"] as const).map((h, voice) =>
        exercise[h][i]
          .map((n, index, notes) => {
            const beat = notes
              .slice(0, index)
              .reduce((sum, note) => sum + note.beats, 0);
            const previousEighth =
              n.beats === 0.5 &&
              notes[index - 1]?.beats === 0.5 &&
              Math.floor((beat - 0.5) / 2) === Math.floor(beat / 2);
            const nextEighth =
              n.beats === 0.5 &&
              notes[index + 1]?.beats === 0.5 &&
              Math.floor((beat + 0.5) / 2) === Math.floor(beat / 2);
            const beam =
              previousEighth || nextEighth
                ? `<beam number="1">${previousEighth ? (nextEighth ? "continue" : "end") : "begin"}</beam>`
                : "";
            const stop = tied[h];
            tied[h] = n.tie;
            const ties = `${stop ? '<tie type="stop"/>' : ""}${n.tie ? '<tie type="start"/>' : ""}`;
            const notation = `${stop ? '<tied type="stop"/>' : ""}${n.tie ? '<tied type="start"/>' : ""}${n.finger ? `<technical><fingering>${n.finger}</fingering></technical>` : ""}`;
            const sixteenthBeam =
              n.beats === 0.25
                ? [1, 2]
                    .map(
                      (level) =>
                        `<beam number="${level}">${index % 4 === 0 ? "begin" : index % 4 === 3 ? "end" : "continue"}</beam>`,
                    )
                    .join("")
                : "";
            return `<note><pitch><step>${names[n.pitch % 12]}</step><octave>${Math.floor(n.pitch / 12) - 1}</octave></pitch><duration>${n.beats * 4}</duration>${ties}<voice>${voice + 1}</voice><type>${n.beats === 4 ? "whole" : n.beats === 2 ? "half" : n.beats === 1 ? "quarter" : n.beats === 0.5 ? "eighth" : "16th"}</type><staff>${voice + 1}</staff>${beam}${sixteenthBeam}${notation ? `<notations>${notation}</notations>` : ""}</note>`;
          })
          .join(""),
      );
      return `<measure number="${i + 1 + measureOffset}">${i > 0 && i % (exercise.measuresPerSystem ?? Math.ceil(exercise.right.length / 2)) === 0 ? '<print new-system="yes"/>' : ""}${i === 0 ? `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>${beatsPerMeasure}</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1">${clef(i)}</clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>` : clef(i) !== clef(i - 1) ? `<attributes><clef number="1">${clef(i)}</clef></attributes>` : ""}${voices[0]}<backup><duration>${beatsPerMeasure * 4}</duration></backup>${voices[1]}${finalPage && i === exercise.right.length - 1 ? '<barline location="right"><bar-style>light-heavy</bar-style></barline>' : ""}</measure>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><work><work-title>${exercise.title ?? `Exercise ${exercise.number}`}</work-title></work><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${bars}</part></score-partwise>`;
}
