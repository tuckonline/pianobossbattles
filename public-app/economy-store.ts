import type { Pool } from "pg";
import { DomainError } from "../src/domains/auth/permissions";
import { emptyEconomy, type EconomyState } from "../src/domains/economy/rewards";
export type EconomyDb = Pick<Pool, "query">;
const walletId = "economy:wallet:v1";
export async function readEconomy(db: EconomyDb, userId: string): Promise<EconomyState> {
  const row = (await db.query("SELECT event FROM game_events WHERE user_id=$1 AND id=$2", [userId, walletId])).rows[0];
  if (!row) return emptyEconomy();
  const value = JSON.parse(row.event).payload as EconomyState;
  if (value.version !== 1 || !Number.isSafeInteger(value.gold) || value.gold < 0 || !Array.isArray(value.owned))
    throw new DomainError("Your gold record could not be read. It has been preserved; please retry or contact support.", 503);
  // Existing test wallets need no migration; old replay bookkeeping is unused.
  return { version: 1, revision: value.revision, gold: value.gold, owned: value.owned,
    practiceMs: value.practiceMs ?? 0, milestones: value.milestones ?? [] };
}
export async function writeEconomy(db: EconomyDb, userId: string, state: EconomyState) {
  if (!Number.isSafeInteger(state.gold) || state.gold < 0) throw new Error("Invalid gold balance");
  state.revision++;
  await db.query("INSERT INTO game_events(user_id,id,session_id,sequence,event) VALUES($1,$2,'economy:v1',0,$3) ON CONFLICT(user_id,id) DO UPDATE SET event=excluded.event",
    [userId, walletId, JSON.stringify({ type: "economy.wallet", version: 1, payload: state })]);
}
