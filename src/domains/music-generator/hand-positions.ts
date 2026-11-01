import type { Exercise, Finger, Hand, HandPosition, ScoreNote } from "../../../hosted/sight-library";

// Explicit, bounded five-finger patterns, not a universal pitch/finger rule.
// C follows the requested middle-C / C3 anchors. G and A minor use white keys;
// D puts F# under finger 3; F puts Bb under RH 4 / LH 2 (never the thumb).
const patterns = [
  { key: "C", mode: "major", notes: [60, 62, 64, 65, 67] },
  { key: "G", mode: "major", notes: [67, 69, 71, 72, 74] },
  { key: "F", mode: "major", notes: [65, 67, 69, 70, 72], right: "B-flat is under finger 4.", left: "B-flat is under finger 2." },
  { key: "D", mode: "major", notes: [62, 64, 66, 67, 69], right: "F-sharp is under finger 3.", left: "F-sharp is under finger 3." },
  { key: "A", mode: "minor", notes: [69, 71, 72, 74, 76] },
] as const;
export function supportsNovicePosition(key: string, mode: "major" | "minor") {
  return patterns.some(p => p.key === key && p.mode === mode);
}
export function noviceHandPositions(key: string, mode: "major" | "minor", hands: Hand): NonNullable<Exercise["handPositions"]> {
  const pattern = patterns.find(p => p.key === key && p.mode === mode);
  if (!pattern) throw Error("Novice hand positions support C, G, F and D major, or A minor. Choose one of these keys.");
  const positions: NonNullable<Exercise["handPositions"]> = {};
  for (const hand of ["right", "left"] as const) {
    if (hands !== "both" && hand !== hands) continue;
    const pitches = pattern.notes.map(p => p - (hand === "left" ? 12 : 0));
    const fingerPitches = Object.fromEntries(pitches.map((p, i) => [hand === "right" ? i + 1 : 5 - i, p])) as Record<Finger, number>;
    positions[hand] = {
      hand, name: `${key} ${mode === "major" ? "Major" : "Minor"}`,
      anchorPitch: pitches[0], fingerPitches,
      hint: hand in pattern ? (pattern as { right?: string; left?: string })[hand] : undefined,
    };
    validateHandPosition(positions[hand]!);
  }
  return positions;
}
export function validateHandPosition(position: HandPosition) {
  const pitches = [1, 2, 3, 4, 5].map(f => position.fingerPitches[f as Finger]);
  if (pitches.some(p => !Number.isInteger(p) || p < 0 || p > 127) ||
      new Set(pitches).size !== 5 ||
      Math.max(...pitches) - Math.min(...pitches) > 7 ||
      pitches.slice(1).some((p, i) => position.hand === "right" ? p <= pitches[i] : p >= pitches[i]) ||
      position.anchorPitch !== position.fingerPitches[position.hand === "right" ? 1 : 5])
    throw Error("Invalid fixed hand position.");
}
export function positionFinger(position: HandPosition, pitch: number): Finger | undefined {
  return ([1, 2, 3, 4, 5] as const).find(f => position.fingerPitches[f] === pitch);
}
export function assignPositionFingers(measures: ScoreNote[][], position: HandPosition) {
  validateHandPosition(position);
  let tied = false;
  for (const note of measures.flat()) {
    const continuation = tied;
    tied = !note.rest && note.tie;
    if (note.rest) continue;
    const finger = positionFinger(position, note.pitch);
    if (finger === undefined) throw Error("Generated note leaves its fixed hand position.");
    // An untagged existing marking is treated as authored, never overwritten.
    if (note.finger !== undefined && note.fingeringSource !== "generated") continue;
    if (continuation) { delete note.finger; delete note.fingeringSource; }
    else { note.finger = finger; note.fingeringSource = "generated"; }
  }
}
export function validatePositionFingering(exercise: Exercise) {
  for (const hand of ["right", "left"] as const) {
    const position = exercise.handPositions?.[hand];
    if (position) { validateHandPosition(position); if (position.hand !== hand) throw Error("Hand position is assigned to the wrong staff."); }
    let tied = false;
    for (const note of exercise[hand].flat()) {
      const continuation = tied;
      tied = !note.rest && note.tie;
      if (note.finger !== undefined && (!Number.isInteger(note.finger) || note.finger < 1 || note.finger > 5))
        throw Error("Finger numbers must be integers from 1 to 5.");
      if (note.rest) {
        if (note.fingeringSource === "generated" && note.finger !== undefined) throw Error("A rest cannot have a generated fingering.");
        continue;
      }
      if (exercise.generatedFingering !== "fixed-position") continue;
      if (!position) throw Error("A sounding hand needs a fixed position.");
      const finger = positionFinger(position, note.pitch);
      if (finger === undefined) throw Error("Generated note leaves its fixed hand position.");
      if ((!continuation || note.finger !== undefined) && note.finger !== finger)
        throw Error("Generated fingering does not match its hand position.");
    }
  }
}
