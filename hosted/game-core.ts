import {defaultShortsDisplay} from './shorts-display';
import { defaultCinematicSettings } from './cinematic-config';
import { assessPractice, type Exercise, type Hand } from "./sight-library";
import { defaultBossBattleConfig } from "./boss-config";
export const GAME_RULES = {
  version: 1,
  curveVersion: 2,
  levelFactor: 100,
  noteXP: 2,
  completionXP: 30,
  timezone: "America/Los_Angeles",
  tempoPBAccuracy: 95,
} as const;
// Immutable curve versions: v1 remains available for historical session summaries.
export const LEVEL_CURVES = {
  1: { factor: 100 },
  2: {
    maxLevel: 100,
    openingCosts: [1000, 2500, 4500, 7000],
    developingStart: 10000,
    developingStep: 3500,
    beginnerStart: 25000,
    beginnerStep: 250,
    advancedStart: 30000,
    advancedStep: 1500,
    advancedAcceleration: 100,
  },
} as const;
export function levelCost(
  targetLevel: number,
  version: number = GAME_RULES.curveVersion,
): number {
  if (!Number.isInteger(targetLevel) || targetLevel < 2)
    throw new Error("Invalid target level");
  if (version === 1)
    return 100 * ((targetLevel - 1) ** 2 - (targetLevel - 2) ** 2);
  if (version !== 2) throw new Error("Unsupported progression curve");
  const c = LEVEL_CURVES[2];
  if (targetLevel > c.maxLevel) throw new Error("Maximum level is 100");
  if (targetLevel <= 5) return c.openingCosts[targetLevel - 2];
  if (targetLevel <= 10)
    return c.developingStart + (targetLevel - 6) * c.developingStep;
  if (targetLevel <= 25)
    return c.beginnerStart + (targetLevel - 11) * c.beginnerStep;
  const n = targetLevel - 26;
  return c.advancedStart + c.advancedStep * n + c.advancedAcceleration * n * n;
}
export function levelThreshold(
  level: number,
  version: number = GAME_RULES.curveVersion,
): number {
  if (!Number.isInteger(level) || level < 1) throw new Error("Invalid level");
  if (version === 1) return LEVEL_CURVES[1].factor * (level - 1) ** 2;
  if (version !== 2 || level > 100)
    throw new Error("Unsupported progression curve or level");
  let total = 0;
  for (let l = 2; l <= level; l++) total += levelCost(l, version);
  return total;
}
export function levelInfo(
  xp: number,
  version: number = GAME_RULES.curveVersion,
) {
  if (version !== 1 && version !== 2)
    throw new Error("Unsupported progression curve");
  xp = Math.max(0, Number.isFinite(xp) ? xp : 0);
  let level = 1,
    lower = 0;
  if (version === 1) {
    level = 1 + Math.floor(Math.sqrt(xp / 100));
    lower = levelThreshold(level, 1);
  } else
    while (level < 100) {
      const next = lower + levelCost(level + 1, 2);
      if (xp < next) break;
      lower = next;
      level++;
    }
  const maxed = version === 2 && level === 100;
  const upper = maxed ? lower : lower + levelCost(level + 1, version);
  const title =
    version === 1
      ? level >= 20
        ? "Virtuoso in Training"
        : level >= 10
          ? "Pianist"
          : level >= 5
            ? "Apprentice"
            : "Beginner"
      : level >= 100
        ? "Expert"
        : level >= 75
          ? "Advanced"
          : level >= 50
            ? "Intermediate"
            : level >= 25
              ? "Advanced Beginner"
              : level >= 10
                ? "Developing Beginner"
                : level >= 5
                  ? "Apprentice"
                  : "Beginner";
  return {
    level,
    lower,
    upper,
    maxed,
    remaining: maxed ? 0 : upper - xp,
    percent: maxed ? 100 : (100 * (xp - lower)) / (upper - lower),
    title,
  };
}
// Repeatable streak celebrations are separate from permanent achievements.
export const milestones = [10, 25, 50, 100, 250, 500, 1000, 2000, 3000,
  4000, 5000, 6000, 7000, 8000, 9000, 10000].map(at => ({
    at, title: `${at.toLocaleString("en-US")} notes in a row`,
  }));
export type GameEvent = {
  id: string;
  version: 1;
  playerId: string;
  sessionId: string;
  attemptId?: string;
  exerciseId?: number;
  sequence: number;
  timestamp: number;
  type:
    | "session.started"
    | "session.ended"
    | "attempt.started"
    | "attempt.paused"
    | "attempt.resumed"
    | "attempt.completed"
    | "attempt.abandoned"
    | "note.evaluated"
    | "note.evaluation_corrected"
    | "midi.disconnected";
  payload: {
    outcome?: "correct" | "incorrect" | "missed" | "unscored";
    occurrence?: string | null;
    replaces?: string;
    // Evaluator annotations for presentation, never an additional scoring rule.
    pitch?: number;
    groupId?: string;
    groupSize?: number;
    groupComplete?: boolean;
  };
};
// Corrections replace a prior evaluation in its original canonical position.
// Today's pitch-only evaluator never emits misses or retrospective corrections.
export function replayEvents(input: GameEvent[], initialCombo = 0) {
  const unique = new Map<string, GameEvent>();
  for (const event of input)
    if (!unique.has(event.id)) unique.set(event.id, event);
  const ordered = [...unique.values()].sort(
    (a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id),
  );
  const corrections = new Map<string, GameEvent>();
  for (const e of ordered)
    if (e.type === "note.evaluation_corrected" && e.payload.replaces)
      corrections.set(e.payload.replaces, e);
  let combo = initialCombo,
    best = initialCombo,
    correct = 0,
    incorrect = 0,
    paused = false;
  const occurrences = new Set<string>();
  const crossings: { eventId: string; at: number; title: string }[] = [];
  const comboByEvent: Record<string,number> = {};
  for (const raw of ordered) {
    if (raw.type === "attempt.started") {
      combo = 0;
      paused = false;
      continue;
    }
    if (raw.type === "attempt.paused") {
      paused = true;
      continue;
    }
    if (raw.type === "attempt.resumed") {
      paused = false;
      continue;
    }
    if (raw.type !== "note.evaluated" || paused) continue;
    const e = corrections.get(raw.id) ?? raw;
    if (e.payload.outcome === "correct" && e.payload.occurrence) {
      const key = `${raw.attemptId}:${e.payload.occurrence}`;
      if (occurrences.has(key)) continue;
      occurrences.add(key);
      correct++;
      combo++;
      best = Math.max(best, combo);
      const threshold = milestones.find(m => m.at === combo);
      if (threshold) crossings.push({eventId: raw.id, ...threshold});
    } else if (
      e.payload.outcome === "incorrect" ||
      e.payload.outcome === "missed"
    ) {
      combo = 0;
      incorrect++;
    }
    comboByEvent[raw.id] = combo;
  }
  return {
    comboByEvent,
    combo,
    best,
    correct,
    incorrect,
    noteXP: correct * GAME_RULES.noteXP,
    crossings,
  };
}
export function evaluateGame(
  exercise: Exercise,
  hand: Hand,
  played: number[],
  context: {
    playerId: string;
    sessionId: string;
    attemptId: string;
    timestamp: number;
  },
  approved?: ReturnType<typeof assessPractice>,
) {
  const result = approved ?? assessPractice(exercise, hand, played);
  const events: GameEvent[] = result.evaluations.map((e) => ({
    id: `${context.attemptId}:note:${e.sequence}`,
    version: 1,
    ...context,
    exerciseId: exercise.number,
    sequence: e.sequence,
    type: "note.evaluated",
    payload: { outcome: e.outcome, occurrence: e.occurrence, pitch:e.pitch, groupId:e.groupId, groupSize:e.groupSize, groupComplete:e.groupComplete },
  }));
  return {
    ...replayEvents(events),
    complete: result.complete,
    accuracy:
      (100 * result.correct) / Math.max(1, result.correct + result.mistakes),
    events,
  };
}
export function accuracyBonus(accuracy: number) {
  return accuracy === 100 ? 75 : accuracy >= 95 ? 40 : accuracy >= 90 ? 20 : 0;
}
export function accuracyPB(accuracy: number, prior: number | null) {
  return prior !== null && accuracy > prior;
}
export function practiceDay(now: number, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}
export type AchievementContext = {
  complete: boolean;
  accuracy: number;
  best: number;
  prior: number | null;
  days: number;
  exercises: number;
  xp: number;
};
export type AchievementDefinition = {
  id: string;
  title: string;
  description: string;
  reward: number;
  category: string;
  priority: number;
  scope: "global";
  repeatable: false;
  icon: string;
  test: (c: AchievementContext) => boolean;
};
const achievement = (
  id: string,
  title: string,
  description: string,
  reward: number,
  category: string,
  priority: number,
  test: AchievementDefinition["test"],
): AchievementDefinition => ({
  id,
  title,
  description,
  reward,
  category,
  priority,
  scope: "global",
  repeatable: false,
  icon: category,
  test,
});
export const achievements: AchievementDefinition[] = [
  achievement(
    "first_steps",
    "First Steps",
    "Complete your first exercise.",
    25,
    "practice",
    2,
    (c) => c.complete,
  ),
  achievement(
    "finding_my_rhythm",
    "Finding My Rhythm",
    "Build a 10-note combo.",
    25,
    "combo",
    2,
    (c) => c.best >= 10,
  ),
  achievement(
    "on_a_roll",
    "On a Roll",
    "Build a 50-note combo.",
    50,
    "combo",
    3,
    (c) => c.best >= 50,
  ),
  achievement(
    "century_streak",
    "Century Streak",
    "Build a 100-note combo.",
    100,
    "combo",
    4,
    (c) => c.best >= 100,
  ),
  achievement(
    "unstoppable",
    "Unstoppable",
    "Build a 250-note combo.",
    150,
    "combo",
    5,
    (c) => c.best >= 250,
  ),
  achievement(
    "precision_player",
    "Precision Player",
    "Complete an exercise with at least 95% accuracy.",
    75,
    "accuracy",
    3,
    (c) => c.complete && c.accuracy >= 95,
  ),
  achievement(
    "flawless_victory",
    "Flawless Victory",
    "Complete an exercise without a wrong note.",
    125,
    "accuracy",
    4,
    (c) => c.complete && c.accuracy === 100,
  ),
  achievement(
    "breakthrough",
    "Breakthrough",
    "Improve a comparable accuracy best by 10 percentage points.",
    75,
    "record",
    4,
    (c) => c.complete && c.prior !== null && c.accuracy - c.prior >= 10,
  ),
  achievement(
    "dedicated_student",
    "Dedicated Student",
    "Practise on seven distinct calendar days.",
    100,
    "practice",
    4,
    (c) => c.days >= 7,
  ),
  achievement(
    "exercise_explorer",
    "Exercise Explorer",
    "Complete ten distinct exercises.",
    100,
    "practice",
    4,
    (c) => c.exercises >= 10,
  ),
  achievement(
    "level_10_pianist",
    "Level 10 Pianist",
    "Reach Pianist Level 10.",
    125,
    "level",
    5,
    (c) => levelInfo(c.xp).level >= 10,
  ),
];
export type Celebration = {
  id: string;
  kind: "level" | "achievement" | "record" | "milestone";
  title: string;
  description: string;
  xp?: number;
  priority: number;
  createdAt: number;
};
export class CelebrationQueue {
  private items: Celebration[] = [];
  private seen = new Set<string>();
  private achievementsSeen = new Set<string>();
  push(e: Celebration) {
    if (e.kind === "achievement") {
      if (this.achievementsSeen.has(e.id)) return;
      this.achievementsSeen.add(e.id);
    }
    if (this.seen.has(e.id)) return;
    this.seen.add(e.id);
    if (this.seen.size > 500)
      this.seen.delete(this.seen.values().next().value!);
    this.items.push(e);
    this.items.sort(
      (a, b) => b.priority - a.priority || a.createdAt - b.createdAt,
    );
    this.items = this.items.slice(0, 12);
  }
  deferBy(ms:number) {
    this.items=this.items.map(e=>({...e,createdAt:e.createdAt+Math.max(0,ms)}));
  }
  next(now: number) {
    this.items = this.items.filter((e) => now - e.createdAt < 30000);
    return this.items.shift();
  }
  clear() {
    this.items = [];
  }
}
export const defaultGameSettings = {
  shortsDisplay: defaultShortsDisplay,
  cinematics: defaultCinematicSettings,
  bossBattle: defaultBossBattleConfig,
  xp: true,
  combo: true,
  achievements: true,
  milestones: true,
  intensity: "high" as "low" | "medium" | "high",
  duration: 1,
  sound: false,
  volume: 0.12,
  soundAchievement: true,
  soundLevel: true,
  soundRecord: true,
  soundMilestone: false,
  brightness: 0.5,
  expanded: false,
  recording: false,
  timezone: GAME_RULES.timezone as string,
};
export type GameSettings = typeof defaultGameSettings;
