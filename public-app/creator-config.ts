import {z} from 'zod';
export const creatorPreferencesSchema=z.object({
 notation:z.enum(['classic','studio','slate','night']).default('studio'),
 notationScale:z.number().min(90).max(160).multipleOf(5).default(115),
 measures:z.enum(['automatic','current','next']).default('automatic'),
 characterScale:z.number().min(80).max(140).multipleOf(5).default(110),
 cameraPercent:z.number().min(15).max(35).default(25),
 arenaPercent:z.number().min(30).max(50).default(40),
 horizontalArenaHeightPercent:z.number().min(40).max(65).default(55),
 hudScale:z.number().min(90).max(120).default(100),
 soundEnabled:z.boolean().default(true),volume:z.number().min(0).max(.2).default(.08),
 audioOwner:z.enum(['horizontal','vertical']).default('horizontal'),
}).refine(p=>p.cameraPercent+p.arenaPercent<=78,'Reserve at least 12% for notation.');
export const defaultCreatorPreferences=creatorPreferencesSchema.parse({});
export type CreatorPreferences=z.infer<typeof creatorPreferencesSchema>;
