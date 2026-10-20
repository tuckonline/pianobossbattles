CREATE TABLE game_players (user_id TEXT PRIMARY KEY REFERENCES users(id), total_xp INTEGER NOT NULL DEFAULT 0, rules_version INTEGER NOT NULL DEFAULT 1, curve_version INTEGER NOT NULL DEFAULT 1, revision INTEGER NOT NULL DEFAULT 0, settings TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE game_sessions (id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), started_at TEXT NOT NULL, ended_at TEXT, starting_xp INTEGER NOT NULL, PRIMARY KEY(user_id,id));
--> statement-breakpoint
CREATE TABLE game_attempts (id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), session_id TEXT NOT NULL, exercise_number INTEGER NOT NULL, condition_key TEXT NOT NULL, status TEXT NOT NULL, sequence INTEGER NOT NULL, played TEXT NOT NULL, result TEXT NOT NULL, active_ms INTEGER NOT NULL DEFAULT 0, started_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(user_id,id));
--> statement-breakpoint
CREATE INDEX game_attempt_session ON game_attempts(user_id,session_id);
--> statement-breakpoint
CREATE INDEX game_attempt_condition ON game_attempts(user_id,condition_key,status);
--> statement-breakpoint
CREATE TABLE game_xp_ledger (reward_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), source_event_id TEXT NOT NULL, attempt_id TEXT, session_id TEXT NOT NULL, category TEXT NOT NULL, amount INTEGER NOT NULL, rules_version INTEGER NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(user_id,reward_id));
--> statement-breakpoint
CREATE INDEX game_ledger_session ON game_xp_ledger(user_id,session_id);
--> statement-breakpoint
CREATE TABLE game_unlocks (user_id TEXT NOT NULL REFERENCES users(id), achievement_id TEXT NOT NULL, source_event_id TEXT NOT NULL, session_id TEXT NOT NULL, unlocked_at TEXT NOT NULL, awarded_xp INTEGER NOT NULL, PRIMARY KEY(user_id,achievement_id));
--> statement-breakpoint
CREATE TABLE game_combo_records (user_id TEXT NOT NULL REFERENCES users(id), scope TEXT NOT NULL, scope_id TEXT NOT NULL, best INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(user_id,scope,scope_id));
--> statement-breakpoint
CREATE TABLE game_days (user_id TEXT NOT NULL REFERENCES users(id), day TEXT NOT NULL, PRIMARY KEY(user_id,day));
--> statement-breakpoint
CREATE TABLE game_events (user_id TEXT NOT NULL REFERENCES users(id), id TEXT NOT NULL, session_id TEXT NOT NULL, attempt_id TEXT, sequence INTEGER NOT NULL, event TEXT NOT NULL, PRIMARY KEY(user_id,id));
