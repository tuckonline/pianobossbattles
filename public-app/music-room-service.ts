import type { Pool } from "pg";
import { z } from "zod";
import { DomainError } from "../src/domains/auth/permissions";
import type { Exercise } from "../hosted/sight-library";
import { hasMusicAccess, legacyMusicItem, royalCatalog } from "../src/domains/economy/music-catalog";
import { publicEconomy } from "../src/domains/economy/rewards";
import { readEconomy, writeEconomy } from "./economy-store";
import { handleMusic, requireMusic, readMusicExercise } from "./music-service";
import royalScores from "./royal-scores.json";
import { savePracticeGold } from "./practice-gold-service";

export const royalScoresById = royalScores as Record<string, { exercise: Exercise; previewXml: string }>;
export async function musicRoomCommand(pool: Pool, userId: string, input: unknown) {
  const command = z.discriminatedUnion("action", [
    z.object({ action: z.literal("state"), expectedUserId: z.string() }),
    z.object({ action: z.literal("practice"), expectedUserId: z.string(), sessionId: z.uuid(), activeMs: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }),
    z.object({ action: z.literal("preview"), expectedUserId: z.string(), itemId: z.string().max(100) }),
    z.object({ action: z.literal("exercise"), expectedUserId: z.string(), itemId: z.string().max(100) }),
    z.object({ action: z.literal("purchase"), expectedUserId: z.string(), itemId: z.string().max(100), transactionId: z.uuid() }),
  ]).parse(input);
  if (command.expectedUserId !== userId) throw new DomainError("Account changed. Please sign in again.", 409);
  if (command.action === "practice") {
    const saved = await savePracticeGold(pool, userId, command.sessionId, command.activeMs);
    return { economy: saved.economy, activeMs: saved.activeMs, earned: saved.earned, totalEarned: saved.totalEarned };
  }
  if (command.action === "state") {
    const [wallet, response] = await Promise.all([
      readEconomy(pool, userId), handleMusic(new Request("https://music.local/api/music"), pool, userId),
    ]);
    const { pieces } = await response.json() as { pieces: (Exercise & { available: boolean; published?: boolean })[] };
    return { economy: publicEconomy(wallet), catalog: [...pieces.filter(p => p.available && p.published !== false).map(legacyMusicItem), ...royalCatalog] };
  }
  const item = royalCatalog.find(i => i.id === command.itemId);
  if (command.action === "exercise" && /^legacy:\d+$/.test(command.itemId)) {
    const number = Number(command.itemId.slice(7));
    // Exactly the existing publication gate, never a new gold paywall.
    await requireMusic(pool, userId, [number]);
    return { exercise: await readMusicExercise(pool, number) };
  }
  if (!item?.available) throw new DomainError("Music not found.", 404);
  if (command.action === "preview") return { item, xml: royalScoresById[item.id].previewXml };
  if (command.action === "exercise") {
    const wallet = await readEconomy(pool, userId);
    if (!hasMusicAccess(item, wallet.owned, userId)) throw new DomainError("Unlock this piece in the Royal Music Shop first.", 403);
    return { exercise: royalScoresById[item.id].exercise };
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // The same player lock serializes purchases with realm gold awards.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [userId]);
    const wallet = await readEconomy(client, userId), id = `economy:purchase:${command.transactionId}`;
    const prior = (await client.query("SELECT event FROM game_events WHERE user_id=$1 AND id=$2", [userId, id])).rows[0];
    if (prior && JSON.parse(prior.event).itemId !== item.id) throw new DomainError("This purchase reference belongs to a different piece.", 409);
    let charged = 0;
    if (!hasMusicAccess(item, wallet.owned, userId)) {
      const price = item.goldPrice!;
      if (wallet.gold < price) throw new DomainError("Not enough gold yet. Keep practising in Realm Quest or Practice Studio.", 409);
      wallet.gold -= price; wallet.owned.push(item.id); charged = price;
      await writeEconomy(client, userId, wallet);
    }
    await client.query("INSERT INTO game_events(user_id,id,session_id,sequence,event) VALUES($1,$2,'economy:v1',0,$3) ON CONFLICT(user_id,id) DO NOTHING",
      [userId, id, JSON.stringify({ type: "economy.purchase", version: 1, itemId: item.id, charged, at: new Date().toISOString() })]);
    await client.query("COMMIT");
    return { economy: publicEconomy(wallet), purchased: item.id, charged };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
