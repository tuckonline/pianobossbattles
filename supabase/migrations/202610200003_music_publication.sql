-- Public app only. No player data or existing definitions are changed.
BEGIN;
CREATE TABLE music_collections (
  id text PRIMARY KEY,
  published boolean NOT NULL DEFAULT false
);
ALTER TABLE music_collections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON music_collections FROM PUBLIC, anon, authenticated;
ALTER TABLE practice_exercises ADD COLUMN published boolean NOT NULL DEFAULT false;
CREATE TABLE music_scores (
  exercise_number bigint PRIMARY KEY REFERENCES practice_exercises(number),
  xml text NOT NULL
);
ALTER TABLE music_scores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON music_scores FROM PUBLIC, anon, authenticated;
-- Publication writes and complete score reads are server-only. The server checks
-- the trusted roles table on every admin request; Auth metadata is never a role.
-- Existing tables retain their deny-by-default RLS and revoked client grants.
COMMIT;
