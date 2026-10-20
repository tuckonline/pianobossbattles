import type { D1Platform, HostedActor } from "./service";

// A single D1 batch gives the export one consistent database snapshot.
// Table names are a fixed allowlist; identity always comes from Sites auth.
export async function exportProgress(p: D1Platform, actor: HostedActor) {
  const tables = [
    "game_players",
    "game_xp_ledger",
    "game_unlocks",
    "game_combo_records",
    "game_sessions",
    "game_attempts",
    "game_days",
    "game_events",
    "battle_story_attempts",
    "battle_story_records",
  ];
  const result = await p.db.batch(
    tables.map((table) =>
      p.stmt(`SELECT * FROM ${table} WHERE user_id=?`, actor.id),
    ),
  );
  return {
    format: "pianopath-progress-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    account: { id: actor.id, name: actor.name, email: actor.email },
    records: Object.fromEntries(
      tables.map((table, i) => [table, result[i].results]),
    ),
  };
}
