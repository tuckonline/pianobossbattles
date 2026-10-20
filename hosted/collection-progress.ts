// Derived from completed attempts, never stored as separate progress counters.
export const masteryRule = { accuracy: 95, consecutivePasses: 3, reviewDays: 7, hand: "both" } as const;
export type ProgressState = "mastered" | "learning" | "due" | "notStarted";
export const progressLabels: Record<ProgressState, string> = {
  mastered: "Mastered", learning: "Learning", due: "Due for review", notStarted: "Not started",
};
export type ProgressAttempt = { exerciseNumber: number; hand: string; accuracy: number; createdAt: string };
export type ExerciseProgress = { state: ProgressState; reviewAt: string | null };
export type ProgressMap = Record<number, ExerciseProgress>;
export function progressState(progress?: ExerciseProgress, now = Date.now()): ProgressState {
  if (!progress) return "notStarted";
  return progress.reviewAt ? (Date.parse(progress.reviewAt) <= now ? "due" : "mastered") : progress.state;
}
export function deriveProgress(attempts: ProgressAttempt[], now = Date.now(), rule: { accuracy: number; consecutivePasses: number; reviewDays: number; hand: string } = masteryRule): ProgressMap {
  const result: ProgressMap = {};
  const runs = new Map<number, number>();
  // Stable chronological order; input should use rowid to resolve tied timestamps.
  for (const a of [...attempts].sort((a,b) => a.createdAt.localeCompare(b.createdAt))) {
    const p = result[a.exerciseNumber] ??= { state: "learning", reviewAt: null };
    if (a.hand !== rule.hand) continue;
    const successful = a.accuracy >= rule.accuracy;
    const run = successful ? (runs.get(a.exerciseNumber) ?? 0) + 1 : 0;
    runs.set(a.exerciseNumber, run);
    if (successful && (p.reviewAt || run >= rule.consecutivePasses)) {
      p.reviewAt = new Date(Date.parse(a.createdAt) + rule.reviewDays * 86400000).toISOString();
      p.state = "mastered";
    }
  }
  for (const p of Object.values(result)) p.state = progressState(p, now);
  return result;
}
export function collectionProgress(exercises: {number: number}[], progress: ProgressMap, now = Date.now()) {
  const counts = { mastered: 0, learning: 0, due: 0, notStarted: 0 };
  for (const ex of exercises) counts[progressState(progress[ex.number], now)]++;
  return { ...counts, total: exercises.length, percent: exercises.length ? Math.round(1000 * counts.mastered / exercises.length) / 10 : 0 };
}
