import type { Pool } from "pg";
import { z } from "zod";
import { midiEventSchema } from "../src/domains/blocks/schema";
import { DomainError } from "../src/domains/auth/permissions";
import { realmScore } from "../src/domains/realms/content";
import { summarize, performanceEnd } from "../src/domains/realms/performance";
import { advanceProgress } from "../src/domains/realms/progression";
import {
  challengeById,
  emptyProgress,
  unlocked,
  realms,
} from "../src/domains/realms/registry";
import type { RealmProgress } from "../src/domains/realms/types";

export const realmConfigSchema = z
  .object({
    version: z.literal(1),
    challengeId: z
      .string()
      .max(80)
      .refine(
        (id) => realms.some((r) => r.challenges.some((c) => c.id === id)),
        "Unknown musical challenge.",
      ),
    seed: z.number().int().min(0).max(0xffffffff),
    key: z.enum(["C", "G", "F"]),
    tempo: z.number().int().min(40).max(160),
    gradingVersion: z.literal(2).optional(),
    curriculumVersion: z.literal(2).optional(),
    difficulty: z.number().int().min(1).max(5).optional(),
  })
  .refine(
    (c) => (c.curriculumVersion === 2) === (c.difficulty !== undefined),
    "Difficulty and curriculum version must be supplied together.",
  ).refine(
    c=>c.curriculumVersion!==2||c.gradingVersion===2,
    "Tiered attempts require the current grading version.",
  );
export const realmReceiptSchema = z.object({
  id: z.uuid(),
  config: realmConfigSchema,
  events: z
    .array(
      midiEventSchema.safeExtend({
        timestamp: z.number().finite().min(-500).max(3600000),
      }),
    )
    .max(12000),
  elapsedMs: z.number().finite().min(0).max(400000),
});
const sessionId = "realm:clockwork:v1";
export async function realmCommand(pool: Pool, userId: string, input: unknown) {
  const command = z
    .discriminatedUnion("action", [
      z.object({
        action: z.literal("state"),
        expectedUserId: z.string(),
        difficulty: z.number().int().min(1).max(5).optional(),
      }),
      z.object({
        action: z.literal("finish"),
        expectedUserId: z.string(),
        receipt: realmReceiptSchema,
      }),
    ])
    .parse(input);
  if (command.expectedUserId !== userId)
    throw new DomainError(
      "Account changed. Sign back into the account that played this attempt.",
      409,
    );
  const difficulty =
    command.action === "state"
      ? command.difficulty
      : command.receipt.config.difficulty;
  const progressId =
    difficulty === undefined
      ? "realm:progress:v1"
      : `realm:progress:v2:difficulty:${difficulty}`;
  if (command.action === "state") {
    const row = (
      await pool.query(
        "SELECT event FROM game_events WHERE user_id=$1 AND id=$2",
        [userId, progressId],
      )
    ).rows[0];
    return {
      progress: row
        ? (JSON.parse(row.event).payload as RealmProgress)
        : emptyProgress(),
    };
  }
  const receipt = command.receipt,
    c = challengeById(receipt.config.challengeId);
  const score = realmScore(receipt.config),
    duration = (score.exercise.durationBeats! * 60000) / receipt.config.tempo;
  const fixed = receipt.config.gradingVersion === 2,
    end = fixed ? performanceEnd(score) : duration;
  if (
    receipt.elapsedMs < end ||
    receipt.elapsedMs > end + 1000 ||
    receipt.events.some(
      (e, i) =>
        e.timestamp > end ||
        e.timestamp < (fixed ? -500 : 0) ||
        (i > 0 && e.timestamp < receipt.events[i - 1].timestamp) ||
        (e.type === "NOTE_ON" && !e.velocity),
    )
  )
    throw new DomainError("Invalid performance timeline.", 400);
  const result = summarize(
    score,
    receipt.events,
    c,
    Infinity,
    receipt.config.gradingVersion,
  );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      userId,
    ]);
    const row = (
      await client.query(
        "SELECT event FROM game_events WHERE user_id=$1 AND id=$2",
        [userId, progressId],
      )
    ).rows[0];
    const prior: RealmProgress = row
      ? JSON.parse(row.event).payload
      : emptyProgress();
    const id = "realm:attempt:" + receipt.id;
    const existing = (
      await client.query(
        "SELECT event FROM game_events WHERE user_id=$1 AND id=$2",
        [userId, id],
      )
    ).rows[0];
    if (existing) {
      const event = JSON.parse(existing.event);
      if (JSON.stringify(event.payload.receipt) !== JSON.stringify(receipt))
        throw new DomainError(
          "This attempt is already saved with different notes.",
          409,
        );
      await client.query("COMMIT");
      return { progress: prior, result: event.payload.result };
    }
    if (!unlocked(c.id, prior))
      throw new DomainError("Complete the prerequisite trials first.", 403);
    const at = new Date().toISOString(),
      next = advanceProgress(prior, receipt.config, result, at);
    await client.query(
      "INSERT INTO game_events(user_id,id,session_id,attempt_id,sequence,event) VALUES($1,$2,$3,$4,0,$5)",
      [
        userId,
        id,
        sessionId,
        receipt.id,
        JSON.stringify({
          type: "realm.attempt.completed",
          version: 1,
          timestamp: at,
          payload: { receipt, result },
        }),
      ],
    );
    await client.query(
      "INSERT INTO game_events(user_id,id,session_id,sequence,event) VALUES($1,$2,$3,0,$4) ON CONFLICT(user_id,id) DO UPDATE SET event=excluded.event",
      [
        userId,
        progressId,
        sessionId,
        JSON.stringify({
          type: "realm.progress",
          version: 1,
          timestamp: at,
          payload: next,
        }),
      ],
    );
    await client.query("COMMIT");
    return { progress: next, result };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
