import {z} from 'zod';
export const defaultShortsDisplay={characterScale:110,notationScale:125,notationView:'automatic' as 'automatic'|'current'|'next',safeLeft:7,safeRight:12,safeTop:2,safeBottom:3};
export const shortsDisplaySchema=z.object({
  characterScale:z.number().min(80).max(140).multipleOf(5).default(110),
  notationScale:z.number().min(90).max(160).multipleOf(5).default(125),
  notationView:z.enum(['automatic','current','next']).default('automatic'),
  safeLeft:z.number().min(3).max(15).default(7),safeRight:z.number().min(3).max(18).default(12),
  safeTop:z.number().min(1).max(5).default(2),safeBottom:z.number().min(1).max(6).default(3),
});
export type ShortsDisplay=z.infer<typeof shortsDisplaySchema>;
