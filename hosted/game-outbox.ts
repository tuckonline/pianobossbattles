import { z } from "zod";
import { gameSyncSchema, type GameSync } from "./game-sync";
import {storySaveSchema} from './battle-story';

// Each document owns one journal. The browser releases its Web Lock even when
// the process crashes, so another document can safely recover it on next launch.
export const outboxPrefix = (user: string) => `pianopath-game-outbox:${user}:`;
export const outboxLock = (key: string) => `recovery:${key}`;
const schema = z.object({
  version: z.literal(2),
  pending: z.array(gameSyncSchema),
  checkpoint: gameSyncSchema.nullable(),
  storyPending:z.array(storySaveSchema).optional(),
});
export type Outbox = z.infer<typeof schema>;
export function readOutbox(raw: string): Outbox {
  const value: unknown = JSON.parse(raw);
  // Upgrade the previous per-tab arrays without discarding offline progress.
  return Array.isArray(value)
    ? {
        version: 2,
        pending: z.array(gameSyncSchema).parse(value),
        checkpoint: null,
      }
    : schema.parse(value);
}
export function recoveryReceipts(box: Outbox): GameSync[] {
  const receipts = new Map<string, GameSync>();
  for (const item of [
    ...box.pending,
    ...(box.checkpoint ? [box.checkpoint] : []),
  ]) {
    if ((receipts.get(item.attemptId)?.sequence ?? -1) < item.sequence)
      receipts.set(item.attemptId, item);
  }
  return [...receipts.values()].map((item) =>
    item.status === "playing" || item.status === "paused"
      ? { ...item, status: "abandoned", sequence: item.sequence + 1 }
      : item,
  );
}
export function outboxKeys(storage: Storage, user: string): string[] {
  return Array.from({ length: storage.length }, (_, i) =>
    storage.key(i),
  ).filter((key): key is string => !!key?.startsWith(outboxPrefix(user)));
}
