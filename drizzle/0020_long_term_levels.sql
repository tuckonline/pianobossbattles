-- Rebalance levels explicitly; preserve lifetime XP, ledger and permanent unlocks.
UPDATE game_players SET curve_version=2,revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE curve_version=1;
--> statement-breakpoint
ALTER TABLE game_sessions ADD COLUMN curve_version INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
-- Closed sessions keep the historical v1 interpretation. Active sessions adopt v2.
UPDATE game_sessions SET curve_version=2 WHERE ended_at IS NULL;
