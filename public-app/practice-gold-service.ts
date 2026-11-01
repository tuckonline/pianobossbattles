import type { Pool } from "pg";
import { DomainError } from "../src/domains/auth/permissions";
import { creditPractice, publicEconomy } from "../src/domains/economy/rewards";
import { readEconomy, writeEconomy } from "./economy-store";

export async function savePracticeGold(pool: Pool, userId: string, sessionId: string, activeMs: number) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [userId]);
    const id = `economy:practice:${sessionId}`;
    const row = (await client.query("SELECT event FROM game_events WHERE user_id=$1 AND id=$2", [userId, id])).rows[0];
    if (!row && activeMs !== 0) throw new DomainError("Start the practice session before saving time.", 409);
    const session = row ? JSON.parse(row.event) as { activeMs: number; startedAt: number; earned?:number }
      : { activeMs: 0, startedAt: Date.now() };
    // Basic sanity bound only, not physical-keyboard attestation or anti-cheat.
    if (activeMs > Date.now() - session.startedAt + 1000)
      throw new DomainError("Practice time has not elapsed yet. Retry saving shortly.", 409);
    const wallet = await readEconomy(client, userId);
    const delta = Math.max(0, activeMs - session.activeMs);
    const earned = creditPractice(wallet, delta);
    if (delta > 0) await writeEconomy(client, userId, wallet);
    if (!row || delta > 0) {
      session.earned = (session.earned ?? 0) + earned;
      session.activeMs = Math.max(session.activeMs, activeMs);
      await client.query("INSERT INTO game_events(user_id,id,session_id,sequence,event) VALUES($1,$2,'economy:v1',0,$3) ON CONFLICT(user_id,id) DO UPDATE SET event=excluded.event",
        [userId, id, JSON.stringify(session)]);
    }
    await client.query("COMMIT");
    return { economy: publicEconomy(wallet), activeMs: session.activeMs, earned, totalEarned: session.earned ?? 0 };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
