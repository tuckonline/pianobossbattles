import { z } from "zod";
const uuid = z.string().uuid();
export const gameSyncSchema = z.object({
  action: z.literal("gameSync"),
  expectedUserId: z.string().min(1).max(200).optional(),
  attemptId: uuid,
  sessionId: uuid,
  sequence: z.number().int().min(1),
  exerciseNumber: z.number().int().min(1).max(1000000),
  hand: z.enum(["both", "right", "left"]),
  omitClosing: z.boolean().default(false),
  played: z.array(z.number().int().min(0).max(127)).max(10000),
  status: z.enum(["playing", "paused", "completed", "abandoned"]),
  activeMs: z.number().int().min(0).max(86400000),
});
export type GameSync = z.infer<typeof gameSyncSchema>;
