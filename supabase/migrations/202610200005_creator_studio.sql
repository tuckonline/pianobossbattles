-- Additive Creator Studio storage. No changes to player tables, roles, or data.
BEGIN;
CREATE TABLE creator_sessions (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
 battle_config jsonb,
 view_hash text UNIQUE,
 view_expires bigint,
 source_id text NOT NULL DEFAULT '',
 sequence bigint NOT NULL DEFAULT 0,
 snapshot text,
 updated_at bigint NOT NULL DEFAULT 0
);
CREATE TABLE creator_peers (
 user_id uuid NOT NULL REFERENCES creator_sessions(user_id) ON DELETE CASCADE,
 viewer_id text NOT NULL, source_id text NOT NULL, offer text NOT NULL,
 answer text, created_at bigint NOT NULL,
 PRIMARY KEY(user_id,viewer_id)
);
ALTER TABLE creator_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_peers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON creator_sessions,creator_peers FROM PUBLIC,anon,authenticated;
-- Server-only access: trusted MUSIC_ADMIN role is checked for controls AND
-- viewing capabilities. Bearer tokens are random, hashed, expiring, revocable.
-- No client grants or broad RLS policies are introduced.
COMMIT;
