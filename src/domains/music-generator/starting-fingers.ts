import type { Hand, ScoreNote } from "../../../hosted/sight-library";

const steps = "CDEFGAB";
const blackKeys = new Set([1, 3, 6, 8, 10]);

// Suggest an initial five-finger position, not a fingering for the entire piece.
// Stop at the first shift beyond a comfortable five-note opening position.
export function startingFinger(measures: ScoreNote[][], hand: Exclude<Hand, "both">): number | undefined {
  const opening: ScoreNote[] = [];
  let tied = false, low = Infinity, high = -Infinity, lowPitch = Infinity, highPitch = -Infinity;
  const position = (n: ScoreNote) => n.spelling!.octave * 7 + steps.indexOf(n.spelling!.step);
  for (const note of measures.flat()) {
    const continuation = tied; tied = note.tie;
    if (note.rest) { tied = false; continue; }
    if (continuation || !note.spelling) continue;
    const nextLow = Math.min(low, position(note)), nextHigh = Math.max(high, position(note));
    const nextLowPitch = Math.min(lowPitch, note.pitch), nextHighPitch = Math.max(highPitch, note.pitch);
    if (nextHigh - nextLow > 4 || nextHighPitch - nextLowPitch > 7) break;
    opening.push(note); low = nextLow; high = nextHigh; lowPitch = nextLowPitch; highPitch = nextHighPitch;
    if (opening.length === 8) break;
  }
  if (!opening.length) return undefined;
  const first = position(opening[0]), direction = hand === "right" ? 1 : -1;
  const baseline = hand === "right" ? 1 + first - low : 1 + high - first;
  const choices = [1, 2, 3, 4, 5].map(finger => {
    const assigned = opening.map(note => ({ note, finger: finger + direction * (position(note) - first) }));
    if (assigned.some(n => n.finger < 1 || n.finger > 5)) return { finger, cost: Infinity };
    const awkward = assigned.reduce((cost, n) => cost + (blackKeys.has(n.note.pitch % 12)
      ? n.finger === 1 ? 5 : n.finger === 5 ? 2 : 0 : 0), 0);
    return { finger, cost: awkward + Math.abs(finger - baseline) * .1 };
  });
  return choices.sort((a,b) => a.cost-b.cost || a.finger-b.finger)[0].finger;
}

export function markStartingFingers(right: ScoreNote[][], left: ScoreNote[][]) {
  for (const [hand, measures] of [["right", right], ["left", left]] as const) {
    const first = measures.flat().find(note => !note.rest);
    if (first && first.finger === undefined) {
      first.finger = startingFinger(measures, hand);
      if (first.finger !== undefined) first.fingeringSource = "generated";
    }
  }
}
