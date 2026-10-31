import type { Exercise } from "../../../hosted/sight-library";
import type { MidiEvent } from "../blocks/schema";
export type ChallengeKind =
  "tempo" | "streak" | "precision" | "coordination" | "phrase" | "boss";
export type Challenge = {
  id: string;
  title: string;
  subtitle: string;
  kind: ChallengeKind;
  objective: string;
  requires: string[];
  level: number;
  measures: number;
  hands: "right" | "both";
  streak?: number;
  crystals?: number;
  reward: string;
};
export type Realm = {
  id: string;
  title: string;
  description: string;
  challenges: Challenge[];
};
export type RunConfig = {
  version: 1;
  challengeId: string;
  seed: number;
  key: "C" | "G" | "F";
  tempo: number;
  gradingVersion?: 2;
  curriculumVersion?: 2;
  difficulty?: number;
};
export type Section = { start: number; end: number; title: string };
export type RealmScore = {
  exercise: Exercise;
  phrases: Section[];
  phases: Section[];
};
export type PhraseResult = Section & {
  pitch: number;
  rhythm: number;
  passed: boolean;
};
export type PerformanceResult = {
  pitch: number;
  rhythm: number;
  accuracy: number;
  stars: number;
  passed: boolean;
  bestStreak: number;
  streak: number;
  right: number | null;
  left: number | null;
  early: number;
  late: number;
  missed: number;
  extra: number;
  wrong?: number;
  timing?: {rhythmToleranceMs:number;matchWindowMs:number;meanOffsetMs:number|null;meanAbsoluteMs:number|null;samples:{pitch:number;beat:number;deltaMs:number;onTime:boolean}[]};
  crystals: number;
  phrases: PhraseResult[];
  phases: PhraseResult[];
  weak: Section;
  feedback: {
    pitch: number;
    beat: number;
    beats: number;
    hand: "right" | "left";
    status: "correct" | "incorrect";
  }[];
};
export type ChallengeProgress = {
  completed: boolean;
  bestStars: number;
  bestAccuracy: number;
  bestPitch: number;
  bestRhythm: number;
  bestStreak: number;
  attempts: number;
  lastCompleted?: string;
  lastConfig: RunConfig;
};
export type RealmProgress = {
  version: 1;
  challenges: Record<string, ChallengeProgress>;
  rewards: string[];
  bossDefeated: boolean;
};
export type AttemptReceipt = {
  id: string;
  config: RunConfig;
  events: MidiEvent[];
  elapsedMs: number;
};
