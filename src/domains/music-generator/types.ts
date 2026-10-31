import type { Exercise, Hand } from "../../../hosted/sight-library";
export type GeneratorSettings = {
  difficulty: number; key: string; mode: "major" | "minor";
  tempoBpm: number; measures: number; hands: Hand; seed: number;
  curriculumVersion?: 2;
};
export type Harmony = { degree: number; secondary: boolean; function: "tonic" | "predominant" | "dominant"; cadence?: "half" | "authentic" | "imperfect" | "plagal" };
export type ClassicalExercise = Exercise & {
  generated: { version: 1; settings: GeneratorSettings; harmony: Harmony[]; motif: number[] };
};
