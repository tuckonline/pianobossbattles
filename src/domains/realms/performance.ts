import { soundingNotes } from "../../../hosted/sight-library";
import { defaultScoring, type MidiEvent } from "../blocks/schema";
import { pairNotes } from "../music/model";
import { scorePerformance } from "../scoring/engine";
import { deduplicateMidi, clockworkTiming } from "../scoring/timing";
import type {
  Challenge,
  PerformanceResult,
  RealmScore,
  Section,
} from "./types";
export function referenceEvents(score: RealmScore): MidiEvent[] {
  const ms = 60000 / score.exercise.tempoBpm!;
  return soundingNotes(score.exercise)
    .flatMap((n) => [
      {
        type: "NOTE_ON" as const,
        pitch: n.pitch,
        velocity: 80,
        channel: n.hand === "right" ? 0 : 1,
        timestamp: n.beat * ms,
      },
      {
        type: "NOTE_OFF" as const,
        pitch: n.pitch,
        velocity: 0,
        channel: n.hand === "right" ? 0 : 1,
        timestamp: (n.beat + n.beats) * ms,
      },
    ])
    .sort((a, b) => a.timestamp - b.timestamp);
}
// Close held notes only for analysis at the current horizon. The original receipt
// retains real note-off events. Duration is not a realm reward dimension.
export function closeHeld(events: MidiEvent[], until: number): MidiEvent[] {
  const open = new Map<string, MidiEvent[]>();
  const result = events.filter((e) => e.timestamp <= until);
  for (const e of result) {
    const key = `${e.channel}:${e.pitch}`;
    if (e.type === "NOTE_ON") {
      const q = open.get(key) ?? [];
      q.push(e);
      open.set(key, q);
    }
    if (e.type === "NOTE_OFF") open.get(key)?.shift();
  }
  return [
    ...result,
    ...[...open.values()].flat().map((e) => ({
      ...e,
      type: "NOTE_OFF" as const,
      velocity: 0,
      timestamp: until,
    })),
  ];
}
export function summarize(
  score: RealmScore,
  events: MidiEvent[],
  challenge: Challenge,
  until = Infinity,
  gradingVersion?: 2,
): PerformanceResult {
  const ms = 60000 / score.exercise.tempoBpm!,
    duration = score.exercise.durationBeats! * ms;
  // Old receipts keep their interpretation. v2 fixes event ownership and live
  // deadlines, while retaining the exact original acceptance/scoring thresholds.
  const fixed = gradingVersion === 2;
  const horizon = Math.min(until, duration + (fixed ? 500 : 0)),
    finished = until >= (fixed ? performanceEnd(score) : duration);
  const thresholds = clockworkTiming(score.exercise.tempoBpm!);
  const tolerance = thresholds.rhythmToleranceMs;
  const allExpected = referenceEvents(score);
  const expected = allExpected.filter(
    (e) => fixed || e.type !== "NOTE_ON" || e.timestamp <= horizon - tolerance,
  );
  const actual = closeHeld(
    fixed ? deduplicateMidi(events) : events,
    fixed ? horizon : Math.max(0, horizon),
  );
  const profile = {
    ...defaultScoring,
    targetTempo: score.exercise.tempoBpm!,
    minimumTempo: 40,
    onsetTolerance: tolerance,
  };
  const analyze = (ref: MidiEvent[], played: MidiEvent[]) =>
    scorePerformance(ref, played, profile, profile.targetTempo, {
      fixedOrigin: 0,
      matchWindowMs: thresholds.matchWindowMs,
      ...(fixed
        ? {
            windows: pairNotes(ref).map(() => ({
              early: thresholds.matchWindowMs,
              late: thresholds.matchWindowMs,
            })),
            observedUntilMs: horizon,
          }
        : {}),
    });
  const report = analyze(expected, actual),
    notes = pairNotes(expected),
    played = pairNotes(actual);
  const matched = new Map(report.matches.map((m) => [m.expected, m]));
  const pending = new Set(report.pendingNotes);
  const resolved = notes.map((_, i) => i).filter((i) => !pending.has(i));
  const quality = (i: number) => (onTime(i) ? 100 : 0);
  const onTime = (index: number) =>
    matched.has(index) && Math.abs(matched.get(index)!.delta) <= tolerance;
  const pitch = Math.round(report.dimensions.pitch);
  // Missing targets cannot receive rhythm credit. Every target contributes once.
  const rhythm = fixed
    ? resolved.length
      ? Math.round(
          resolved.reduce((sum, i) => sum + quality(i), 0) / resolved.length,
        )
      : 0
    : notes.length
      ? Math.round(
          (100 * notes.filter((_, i) => onTime(i)).length) / notes.length,
        )
      : 0;
  const ordered = [
    ...resolved.map((i) => ({ at: notes[i].onset, good: onTime(i) })),
    ...report.extraNotes.map((i) => ({ at: played[i].onset, good: false })),
  ].sort((a, b) => a.at - b.at);
  let streak = 0,
    bestStreak = 0;
  for (const n of ordered) {
    streak = n.good ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
  }
  const sectionResult = (section: Section) => {
    const indices = notes.flatMap((n, i) =>
      !pending.has(i) &&
      n.onset >= section.start * 4 * ms &&
      n.onset < section.end * 4 * ms
        ? [i]
        : [],
    );
    const extra = report.extraNotes.filter(
      (i) =>
        played[i].onset >= section.start * 4 * ms &&
        played[i].onset < section.end * 4 * ms,
    ).length;
    const p = indices.length
      ? Math.round(
          (100 * indices.filter((i) => matched.has(i)).length) /
            (fixed
              ? Math.max(
                  indices.length,
                  indices.filter(
                    (i) =>
                      matched.has(i) ||
                      report.incorrectNotes.some((n) => n.expected === i),
                  ).length + extra,
                )
              : indices.length + extra),
        )
      : 0;
    const r = indices.length
      ? Math.round(
          indices.reduce((sum, i) => sum + quality(i), 0) / indices.length,
        )
      : 0;
    return {
      ...section,
      pitch: p,
      rhythm: r,
      passed:
        horizon >= section.end * 4 * ms &&
        !notes.some(
          (n, i) =>
            pending.has(i) &&
            n.onset >= section.start * 4 * ms &&
            n.onset < section.end * 4 * ms,
        ) &&
        p >= 70 &&
        r >= 70,
    };
  };
  const phrases = score.phrases.map(sectionResult),
    phases = score.phases.map(sectionResult);
  const staffAccuracy = (channel: number) => {
    if (fixed) {
      if (!notes.some((n) => n.channel === channel)) return null;
      const indices = resolved.filter((i) => notes[i].channel === channel);
      const extras = report.extraNotes.filter((i) =>
        channel === 0 ? played[i].pitch >= 60 : played[i].pitch < 60,
      ).length;
      return indices.length
        ? Math.round(
            Math.min(
              (100 * indices.filter((i) => matched.has(i)).length) /
                Math.max(
                  indices.length,
                  indices.filter(
                    (i) =>
                      matched.has(i) ||
                      report.incorrectNotes.some((n) => n.expected === i),
                  ).length + extras,
                ),
              indices.reduce((sum, i) => sum + quality(i), 0) / indices.length,
            ),
          )
        : 0;
    }
    const ref = expected.filter((e) => e.channel === channel);
    if (!ref.some((e) => e.type === "NOTE_ON")) return null;
    // Generated staves occupy disjoint registers; MIDI cannot identify a physical hand.
    const staff = analyze(
      ref,
      actual.filter(
        (e) =>
          e.pitch !== undefined &&
          (channel === 0 ? e.pitch >= 60 : e.pitch < 60),
      ),
    );
    const targetCount = pairNotes(ref).length;
    const timed = staff.matches.filter(
      (m) => Math.abs(m.delta) <= tolerance,
    ).length;
    return Math.round(
      Math.min(staff.dimensions.pitch, (100 * timed) / targetCount),
    );
  };
  const right = staffAccuracy(0),
    left = staffAccuracy(1),
    accuracy = Math.min(pitch, rhythm);
  const crystals = phrases.filter((p) => p.passed).length;
  const objective =
    challenge.kind === "streak"
      ? bestStreak >= challenge.streak!
      : challenge.kind === "coordination"
        ? (right ?? 0) >= 70 && (left ?? 0) >= 70
        : challenge.kind === "phrase"
          ? crystals >= challenge.crystals!
          : challenge.kind === "boss"
            ? phases.filter((p) => p.passed).length >= 3
            : true;
  const passed = finished && accuracy >= 70 && objective;
  const weak = [...phrases].sort(
    (a, b) => Math.min(a.pitch, a.rhythm) - Math.min(b.pitch, b.rhythm),
  )[0] ?? { start: 0, end: 4, title: "Opening" };
  const feedback = resolved.map((i) => {
    const n = notes[i];
    return {
      pitch: n.pitch,
      beat: n.onset / ms,
      beats: n.duration / ms,
      hand: n.channel === 0 ? ("right" as const) : ("left" as const),
      status: onTime(i) ? ("correct" as const) : ("incorrect" as const),
    };
  });
  const samples = report.matches.map((m) => ({
    pitch: notes[m.expected].pitch,
    beat: notes[m.expected].onset / ms,
    deltaMs: Math.round(m.delta),
    onTime: Math.abs(m.delta) <= tolerance,
  }));
  return {
    pitch,
    rhythm,
    accuracy,
    passed,
    stars: passed ? (accuracy >= 95 ? 3 : accuracy >= 85 ? 2 : 1) : 0,
    bestStreak,
    streak,
    right,
    left,
    feedback,
    early: fixed
      ? report.matches.filter((m) => m.delta < -tolerance).length
      : report.earlyNotes.length,
    late: fixed
      ? report.matches.filter((m) => m.delta > tolerance).length
      : report.lateNotes.length,
    missed: report.missedNotes.length,
    extra: report.extraNotes.length,
    ...(fixed
      ? {
          wrong: report.incorrectNotes.length,
          timing: {
            ...thresholds,
            samples,
            meanOffsetMs: samples.length
              ? Math.round(
                  report.matches.reduce((sum, m) => sum + m.delta, 0) /
                    samples.length,
                )
              : null,
            meanAbsoluteMs: samples.length
              ? Math.round(
                  report.matches.reduce(
                    (sum, m) => sum + Math.abs(m.delta),
                    0,
                  ) / samples.length,
                )
              : null,
          },
        }
      : {}),
    crystals,
    phrases,
    phases,
    weak,
  };
}

export function performanceEnd(score: RealmScore) {
  const notes = pairNotes(referenceEvents(score)),
    window = clockworkTiming(score.exercise.tempoBpm!).matchWindowMs;
  return Math.max(
    (score.exercise.durationBeats! * 60000) / score.exercise.tempoBpm!,
    ...notes.map((n) => n.onset + window + 1),
  );
}
