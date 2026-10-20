CREATE TABLE IF NOT EXISTS shorts_sessions (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id,id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS shorts_sessions_owner_updated ON shorts_sessions(user_id,updated_at DESC);
