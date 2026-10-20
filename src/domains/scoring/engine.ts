import {
  dimensions,
  type MidiEvent,
  type ScoringProfile,
  scoringSchema,
} from "../blocks/schema";
import { pairNotes } from "../music/model";
export interface Analysis {
  overall: number;
  passed: boolean;
  dimensions: Record<(typeof dimensions)[number], number>;
  missedNotes: number[];
  extraNotes: number[];
  earlyNotes: number[];
  lateNotes: number[];
  problemMeasures: number[];
  matched: number;
  version: "1";
}
const clamp = (v: number) => Math.max(0, Math.min(100, v));
export function scorePerformance(
  expected: MidiEvent[],
  actual: MidiEvent[],
  profile: ScoringProfile,
  tempo = profile.targetTempo,
): Analysis {
  scoringSchema.parse(profile);
  const reference = pairNotes(expected),
    played = pairNotes(actual),
    rate = profile.targetTempo / tempo;
  const used = new Set<number>();
  const missed: number[] = [],
    early: number[] = [],
    late: number[] = [];
  const matches: { e: number; a: number; delta: number }[] = [];
  const origin = played[0]?.onset ?? 0,
    expectedOrigin = reference[0]?.onset ?? 0;
  reference.forEach((e, i) => {
    let best = -1,
      distance = Infinity;
    played.forEach((a, j) => {
      if (used.has(j) || a.pitch !== e.pitch) return;
      const d = Math.abs(a.onset - origin - (e.onset - expectedOrigin) * rate);
      if (d < distance) {
        best = j;
        distance = d;
      }
    });
    if (best < 0) {
      missed.push(i);
      return;
    }
    used.add(best);
    const delta =
      played[best].onset - origin - (e.onset - expectedOrigin) * rate;
    matches.push({ e: i, a: best, delta });
    if (delta < -profile.onsetTolerance) early.push(i);
    if (delta > profile.onsetTolerance) late.push(i);
  });
  const extra = played.map((_, i) => i).filter((i) => !used.has(i));
  const average = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const pitch = reference.length
    ? (100 * matches.length) / (reference.length + extra.length)
    : 0;
  const rhythm = average(
    matches.map((m) =>
      clamp(100 - (Math.abs(m.delta) / profile.onsetTolerance) * 25),
    ),
  );
  const duration = average(
    matches.map((m) =>
      clamp(
        100 -
          (Math.abs(played[m.a].duration - reference[m.e].duration * rate) /
            Math.max(100, reference[m.e].duration * rate)) *
            100,
      ),
    ),
  );
  const velocity = average(
    matches.map((m) =>
      clamp(
        100 -
          (Math.abs(played[m.a].velocity - reference[m.e].velocity) / 127) *
            100,
      ),
    ),
  );
  const continuity = reference.length
    ? clamp(
        100 -
          (100 * (missed.length + extra.length + late.length)) /
            (reference.length + extra.length),
      )
    : 0;
  const chordPairs = matches.flatMap((m, i) =>
    matches
      .slice(i + 1)
      .filter(
        (n) =>
          Math.abs(reference[m.e].onset - reference[n.e].onset) <=
          profile.chordTolerance,
      )
      .map((n) =>
        clamp(
          100 -
            (Math.abs(
              played[m.a].onset -
                played[n.a].onset -
                (reference[m.e].onset - reference[n.e].onset) * rate,
            ) /
              profile.chordTolerance) *
              25,
        ),
      ),
  );
  const pedalEvents = (events: MidiEvent[]) =>
    events.filter((e) => e.type === "CONTROL_CHANGE" && e.controller === 64);
  const ep = pedalEvents(expected),
    ap = pedalEvents(actual);
  const pedal = ep.length
    ? average(
        ep.map((e, i) =>
          ap[i] && (e.value ?? 0) >= 64 === (ap[i].value ?? 0) >= 64
            ? clamp(
                100 -
                  (Math.abs(
                    ap[i].timestamp -
                      origin -
                      (e.timestamp - expectedOrigin) * rate,
                  ) /
                    profile.onsetTolerance) *
                    25,
              )
            : 0,
        ),
      ) * Math.min(1, ep.length / Math.max(1, ap.length))
    : ap.length
      ? 0
      : 100;
  const scores = {
    pitch,
    rhythm,
    duration,
    continuity,
    chord: chordPairs.length ? average(chordPairs) : 100,
    velocity,
    pedal,
  };
  const total = Object.values(profile.weights).reduce((a, b) => a + b, 0);
  const overall =
    reference.length && played.length
      ? Math.round(
          dimensions.reduce(
            (sum, d) => sum + scores[d] * profile.weights[d],
            0,
          ) / total,
        )
      : 0;
  return {
    overall,
    passed: overall >= profile.passingScore && tempo >= profile.minimumTempo,
    dimensions: scores,
    missedNotes: missed,
    extraNotes: extra,
    earlyNotes: early,
    lateNotes: late,
    problemMeasures: [
      ...new Set(
        [...missed, ...early, ...late].map(
          (i) =>
            Math.floor(
              reference[i].onset / ((60000 / profile.targetTempo) * 4),
            ) + 1,
        ),
      ),
    ],
    matched: matches.length,
    version: "1",
  };
}
