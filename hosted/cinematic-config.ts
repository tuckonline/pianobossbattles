import { z } from 'zod';

export const cinematicSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  practice: z.boolean().default(false),
  intensity: z.enum(['low','medium','high']).default('high'),
  durationMultiplier: z.number().min(.5).max(2).default(1),
  audioEnabled: z.boolean().default(false),
  // Migrate V10 profiles. Terminal scenes always hold until a deliberate action.
  autoDismiss: z.boolean().transform(()=>false).default(false),
  showStats: z.boolean().default(true),
  reducedMotion: z.enum(['auto','always','never']).default('auto'),
});
export type CinematicSettings = z.infer<typeof cinematicSettingsSchema>;
export const defaultCinematicSettings = cinematicSettingsSchema.parse({});
