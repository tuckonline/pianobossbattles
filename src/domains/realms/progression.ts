import { challengeById, unlocked } from "./registry";
import type { PerformanceResult, RealmProgress, RunConfig } from "./types";
export function advanceProgress(
  prior: RealmProgress,
  config: RunConfig,
  result: PerformanceResult,
  at: string,
): RealmProgress {
  if (!unlocked(config.challengeId, prior))
    throw Error("Complete the prerequisite trials first.");
  const next = structuredClone(prior),
    old = next.challenges[config.challengeId],
    challenge = challengeById(config.challengeId);
  next.challenges[config.challengeId] = {
    completed: !!old?.completed || result.passed,
    bestStars: Math.max(old?.bestStars ?? 0, result.stars),
    bestAccuracy: Math.max(old?.bestAccuracy ?? 0, result.accuracy),
    bestPitch: Math.max(old?.bestPitch ?? 0, result.pitch),
    bestRhythm: Math.max(old?.bestRhythm ?? 0, result.rhythm),
    bestStreak: Math.max(old?.bestStreak ?? 0, result.bestStreak),
    attempts: (old?.attempts ?? 0) + 1,
    lastCompleted: result.passed ? at : old?.lastCompleted,
    lastConfig: config,
  };
  if (result.passed && !next.rewards.includes(challenge.reward))
    next.rewards.push(challenge.reward);
  if (challenge.kind === "boss" && result.passed) next.bossDefeated = true;
  return next;
}
