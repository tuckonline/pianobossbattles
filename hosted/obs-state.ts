import {shortsBroadcastSchema} from './shorts-core';
import type {GameState,GameSummary} from "./game-service";
import {gameSettingsSchema} from "./game-settings";
import { z } from "zod";
import { battleViewSchema } from "./boss-schema";

export const overlaySnapshot = z
  .object({
    shorts: shortsBroadcastSchema.optional(),
    exerciseNumber: z.number().int().min(1).max(1000000),
    title: z.string().trim().min(1).max(240),
    hand: z.enum(["both", "right", "left"]),
    status: z.enum(["ready", "practicing", "listening", "complete", "stopped"]),
    accuracy: z.number().int().min(0).max(100).nullable(),
    mistakes: z.number().int().min(0).max(100000),
    measure: z.number().int().min(1).max(10000),
    score: z.object({
      presentationId:z.string().max(100).optional(),
      activeMeasure: z.number().int().min(0).max(10000).optional(),
      activeBeat: z.number().min(0).max(100000),
      listening: z.boolean(),
      compact: z.boolean(),
      follow: z.boolean(),
      size: z.object({mode:z.enum(['auto','custom','fit-width']),percent:z.number().min(60).max(300)}),
      // Index into this exercise/hand's sounding notes, followed by feedback code.
      feedback: z.array(z.tuple([z.number().int().min(0).max(100000),z.union([z.literal(0),z.literal(1),z.literal(2)])])).max(10000),
    }).optional(),
    game:z.object({
      cinematicDismissedId:z.string().max(160).optional(),
      battle: battleViewSchema.optional(),
      sessionId:z.string().max(50),preview:z.boolean(),
      live:z.object({attemptId:z.string().max(50),sessionId:z.string().max(50),combo:z.number().int().min(0).max(1000000000),best:z.number().int().min(0).max(1000000000),attemptBest:z.number().int().min(0).max(10000).optional(),correct:z.number().int().min(0).max(10000),incorrect:z.number().int().min(0).max(10000),provisionalXP:z.number().min(0).max(20000),status:z.string().max(30),sequence:z.number().int().min(0)}),
      settings:gameSettingsSchema,
      alerts:z.array(z.object({id:z.string().max(240),kind:z.enum(['level','achievement','record','milestone']),title:z.string().max(160),description:z.string().max(240),xp:z.number().optional(),priority:z.number(),createdAt:z.number()})).max(8),
      summary:z.custom<GameSummary>().optional(),
    }).optional(),
    totalMeasures: z.number().int().min(1).max(10000),
  })
  .refine((s) => s.measure <= s.totalMeasures, "Invalid measure");
export type OverlaySnapshot = z.infer<typeof overlaySnapshot>;
export type OverlayState = {
  creator?:import('../public-app/creator-config').CreatorPreferences;
  viewerKey?:string;
  sourceId?: string;
  sequence?: number;
  snapshot: OverlaySnapshot | null;
  updatedAt: number | null;
  best: number | null;
  attempts: number;
  gamePlayer?:GameState;
};
export const overlayUpdate = z.object({
  sourceId: z.string().uuid(),
  sequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  claim: z.boolean(),
  snapshot: overlaySnapshot,
});

// HTTP is a durable fallback; direct score frames are sent on state changes.
export const OVERLAY_PUBLISH_MS = 100;
export const OVERLAY_REFRESH_MS = 500;
export const OVERLAY_SCORE_REFRESH_MS = 100;
export const OVERLAY_STALL_MS = 2000;
export const OVERLAY_RECONNECT_MS = 250;
