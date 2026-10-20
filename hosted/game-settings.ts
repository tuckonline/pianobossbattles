import { cinematicSettingsSchema, defaultCinematicSettings } from './cinematic-config';
import {shortsDisplaySchema,defaultShortsDisplay} from './shorts-display';
import { z } from "zod";
import { bossConfigSchema, defaultBossBattleConfig } from "./boss-config";
import { defaultGameSettings, type GameSettings } from "./game-core";
export const gameSettingsSchema = z.object({
  notationPreset: z.enum(['classic','studio','slate','night']).default('studio'),
  shortsDisplay:shortsDisplaySchema.default(defaultShortsDisplay),
  cinematics: cinematicSettingsSchema.default(defaultCinematicSettings),
  bossBattle: bossConfigSchema.default(defaultBossBattleConfig),
  xp: z.boolean(),
  combo: z.boolean(),
  achievements: z.boolean(),
  milestones: z.boolean(),
  intensity: z.enum(["low", "medium", "high"]),
  duration: z.number().min(0.5).max(2),
  sound: z.boolean(),
  volume: z.number().min(0).max(0.5),
  soundAchievement: z.boolean(),
  soundLevel: z.boolean(),
  soundRecord: z.boolean(),
  soundMilestone: z.boolean(),
  brightness: z.number().min(0).max(1),
  expanded: z.boolean(),
  recording: z.boolean(),
  timezone: z
    .string()
    .max(80)
    .refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }),
});

// Upgrade saved settings on every read, including nested defaults introduced
// after the profile was saved. A shallow object spread leaves old boss configs
// without gameMode and crashes the V9 controls after the first API response.
export function normalizeGameSettings(value: unknown): GameSettings {
  const saved = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return gameSettingsSchema.parse({ ...defaultGameSettings, ...saved });
}
