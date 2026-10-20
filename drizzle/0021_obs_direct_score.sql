-- Short-lived, account-scoped WebRTC handshake data only; never piano progress.
CREATE TABLE obs_score_peers (
  user_id TEXT NOT NULL,
  viewer_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  offer TEXT NOT NULL,
  answer TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, viewer_id)
);
--> statement-breakpoint
CREATE INDEX obs_score_peers_source ON obs_score_peers(user_id, source_id, created_at);
