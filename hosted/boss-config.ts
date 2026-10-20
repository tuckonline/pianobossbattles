import { z } from "zod";
import { canonicalCharacters, type CharacterId } from "./battle-animation-library";
import type { GameMode } from './battle-modes';

// Balance and artwork live outside the combat engine. Add skins here without
// changing how musical evaluations affect HP.
export const battleCharacters = canonicalCharacters;
export const defaultBossBattleConfig = {
  enabled: false,
  pressureReactions: true,
  gameMode: 'survival' as GameMode,
  selectedBpm: 60,
  allowanceMultiplier: 1.5,
  explicitTimeLimitSeconds: 0,
  progressiveTempo: false,
  powerThreshold: 100,
  adaptivePower: true,
  multiRoundEnabled: false,
  minimumRoundNotes: 10,
  roundTransitionMs: 1500,
  playerMaxHp: 30,
  playerDamagePerCorrectNote: 1 as const,
  bossDamagePerMistake: 4,
  animationSpeed: 1,
  effectIntensity: 1,
  showDamageNumbers: true,
  soundEnabled: false,
  audioOutput: 'practice' as 'practice' | 'obs',
  volume: 0.08,
  playerId: "piano_blade_warrior" as Exclude<CharacterId,"grinwick">,
  bossId: "crimson_musical_colossus" as CharacterId,
};
export type BossBattleConfig = typeof defaultBossBattleConfig;
export const bossDifficulties = [
  { label: "Easy", damage: 2 },
  { label: "Normal", damage: 4 },
  { label: "Hard", damage: 6 },
  { label: "Expert", damage: 10 },
  { label: "Brutal", damage: 15 },
  { label: "One-hit", damage: 30 },
] as const;
export function bossDifficultyLabel(damage: number) {
  return bossDifficulties.find(d => d.damage === damage)?.label ?? "Custom";
}
export const bossConfigSchema = z.object({
  enabled: z.boolean().default(false),
  pressureReactions: z.boolean().default(true),
  gameMode: z.enum(['survival','timeAttack','ultimateBoss']).default('survival'),
  selectedBpm: z.number().int().min(20).max(300).default(60),
  allowanceMultiplier: z.number().min(1).max(3).default(1.5),
  explicitTimeLimitSeconds: z.number().int().min(0).max(86400).default(0),
  progressiveTempo: z.boolean().default(false),
  powerThreshold: z.number().int().min(1).max(1000).default(100),
  adaptivePower: z.boolean().default(true),
  // V9 retires continuation; retained keys migrate old saved preferences safely.
  multiRoundEnabled: z.boolean().transform(()=>false).default(false),
  minimumRoundNotes: z.number().int().min(1).max(1000).default(10),
  roundTransitionMs: z.number().int().min(500).max(2000).default(1500),
  playerMaxHp: z.number().int().min(1).max(10000).default(30),
  // Normalize saved balance settings: every scored note always deals one HP.
  // Legacy targetRatio/bossMaxHp fields are stripped by this object schema.
  playerDamagePerCorrectNote: z.number().int().min(1).max(100).transform(() => 1 as const).default(1),
  bossDamagePerMistake: z.number().int().min(1).max(100).default(4),
  animationSpeed: z.number().min(0.8).max(1.3).default(1),
  effectIntensity: z.number().min(0).max(1.5).default(1),
  showDamageNumbers: z.boolean().default(true),
  soundEnabled: z.boolean().default(false),
  audioOutput: z.enum(['practice','obs']).default('practice'),
  volume: z.number().min(0).max(0.2).default(0.08),
  // Upgrade legacy saved skins on read; balance and progress are untouched.
  playerId: z.enum(["beginner_pianist", "training_dummy", "piano_blade_warrior", "crimson_musical_colossus"])
    .transform(id => id === "beginner_pianist" || id === "training_dummy" ? "piano_blade_warrior" as const : id).default("piano_blade_warrior"),
  bossId: z.enum(["grinwick", "beginner_pianist", "training_dummy", "piano_blade_warrior", "crimson_musical_colossus"])
    .transform(id => id === "beginner_pianist" || id === "training_dummy" ? "crimson_musical_colossus" as const : id).default("crimson_musical_colossus"),
});
export function bossHpTarget(notes: number) {
  // No percentage discount or HP cap. Empty exercises stay idle in the engine.
  return Math.max(1, Math.ceil(Math.max(0, notes)));
}
