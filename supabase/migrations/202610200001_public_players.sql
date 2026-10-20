-- Independent public app only. No connection to the original D1 database.
BEGIN;
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"created_at" text NOT NULL
);
ALTER TABLE public.users ADD COLUMN auth_user_id uuid GENERATED ALWAYS AS (id::uuid) STORED UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.users TO authenticated;
CREATE POLICY own_player_read ON public.users FOR SELECT TO authenticated USING ((SELECT auth.uid())::text = id);
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE CASCADE
);
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.roles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.roles TO authenticated;
CREATE POLICY own_player_read ON public.roles FOR SELECT TO authenticated USING ((SELECT auth.uid())::text = user_id);
CREATE TABLE "mutation_guards" (
	"id" text PRIMARY KEY NOT NULL,
	"accepted" bigint NOT NULL CONSTRAINT "mutation guard" CHECK (accepted=1)
);
ALTER TABLE public.mutation_guards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mutation_guards FROM PUBLIC, anon, authenticated;
CREATE TABLE "practice_exercises" (
	"number" bigint PRIMARY KEY NOT NULL,
	"collection" text NOT NULL,
	"source_number" bigint NOT NULL,
	"title" text NOT NULL,
	"source_url" text NOT NULL,
	"source_page" bigint NOT NULL,
	"definition" text NOT NULL
);
ALTER TABLE public.practice_exercises ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.practice_exercises FROM PUBLIC, anon, authenticated;
CREATE TABLE "sight_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"exercise_number" bigint NOT NULL,
	"hand" text NOT NULL,
	"accuracy" numeric NOT NULL,
	"mistakes" bigint NOT NULL,
	"created_at" text NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE CASCADE
);
ALTER TABLE public.sight_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sight_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sight_attempts TO authenticated;
CREATE POLICY own_player_read ON public.sight_attempts FOR SELECT TO authenticated USING ((SELECT auth.uid())::text = user_id);
CREATE TABLE "practice_stream_stats" (
	"user_id" text PRIMARY KEY NOT NULL,
	"started_at" text NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE CASCADE
);
ALTER TABLE public.practice_stream_stats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.practice_stream_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.practice_stream_stats TO authenticated;
CREATE POLICY own_player_read ON public.practice_stream_stats FOR SELECT TO authenticated USING ((SELECT auth.uid())::text = user_id);
CREATE TABLE game_players (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, total_xp bigint NOT NULL DEFAULT 0, rules_version bigint NOT NULL DEFAULT 1, curve_version bigint NOT NULL DEFAULT 1, revision bigint NOT NULL DEFAULT 0, settings TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL);
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_players FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.game_players TO authenticated;
CREATE POLICY own_player_read ON public.game_players FOR SELECT TO authenticated USING ((SELECT auth.uid())::text = user_id);
CREATE TABLE game_sessions (id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, started_at TEXT NOT NULL, ended_at TEXT, starting_xp bigint NOT NULL, curve_version bigint NOT NULL DEFAULT 1, PRIMARY KEY(user_id,id));
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.game_sessions TO authenticated;
CREATE POLICY own_player_read ON public.game_sessions FOR SELECT TO authenticated USING ((SELECT auth.uid())::text = user_id);
CREATE TABLE game_attempts (id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, session_id TEXT NOT NULL, exercise_number bigint NOT NULL, condition_key TEXT NOT NULL, status TEXT NOT NULL, sequence bigint NOT NULL, played TEXT NOT NULL, result TEXT NOT NULL, active_ms bigint NOT NULL DEFAULT 0, started_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(user_id,id));
ALTER TABLE public.game_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.game_attempts TO authenticated;
CREATE POLICY own_player_read ON public.game_attempts FOR SELECT TO authenticated USING ((SELECT auth.uid())::text = user_id);
CREATE TABLE game_xp_ledger (reward_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, source_event_id TEXT NOT NULL, attempt_id TEXT, session_id TEXT NOT NULL, category TEXT NOT NULL, amount bigint NOT NULL, rules_version bigint NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(user_id,reward_id));
ALTER TABLE public.game_xp_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_xp_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.game_xp_ledger TO authenticated;
CREATE POLICY own_player_read ON public.game_xp_ledger FOR SELECT TO authenticated USING ((SELECT auth.uid())::text = user_id);
CREATE TABLE game_unlocks (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, achievement_id TEXT NOT NULL, source_event_id TEXT NOT NULL, session_id TEXT NOT NULL, unlocked_at TEXT NOT NULL, awarded_xp bigint NOT NULL, PRIMARY KEY(user_id,achievement_id));
ALTER TABLE public.game_unlocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_unlocks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.game_unlocks TO authenticated;
CREATE POLICY own_player_read ON public.game_unlocks FOR SELECT TO authenticated USING ((SELECT auth.uid())::text = user_id);
CREATE TABLE game_combo_records (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, scope TEXT NOT NULL, scope_id TEXT NOT NULL, best bigint NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(user_id,scope,scope_id));
ALTER TABLE public.game_combo_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_combo_records FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.game_combo_records TO authenticated;
CREATE POLICY own_player_read ON public.game_combo_records FOR SELECT TO authenticated USING ((SELECT auth.uid())::text = user_id);
CREATE TABLE game_days (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, day TEXT NOT NULL, PRIMARY KEY(user_id,day));
ALTER TABLE public.game_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_days FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.game_days TO authenticated;
CREATE POLICY own_player_read ON public.game_days FOR SELECT TO authenticated USING ((SELECT auth.uid())::text = user_id);
CREATE TABLE game_events (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, id TEXT NOT NULL, session_id TEXT NOT NULL, attempt_id TEXT, sequence bigint NOT NULL, event TEXT NOT NULL, PRIMARY KEY(user_id,id));
ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.game_events TO authenticated;
CREATE POLICY own_player_read ON public.game_events FOR SELECT TO authenticated USING ((SELECT auth.uid())::text = user_id);
CREATE TABLE battle_story_attempts (
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 attempt_id text NOT NULL,
 challenge_key text NOT NULL,
 challenge text NOT NULL,
 result text NOT NULL,
 PRIMARY KEY(user_id,attempt_id)
);
ALTER TABLE public.battle_story_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.battle_story_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.battle_story_attempts TO authenticated;
CREATE POLICY own_player_read ON public.battle_story_attempts FOR SELECT TO authenticated USING ((SELECT auth.uid())::text = user_id);
CREATE TABLE battle_story_records (
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 challenge_key text NOT NULL,
 last_result text NOT NULL,
 best_result text NOT NULL,
 PRIMARY KEY(user_id,challenge_key)
);
ALTER TABLE public.battle_story_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.battle_story_records FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.battle_story_records TO authenticated;
CREATE POLICY own_player_read ON public.battle_story_records FOR SELECT TO authenticated USING ((SELECT auth.uid())::text = user_id);
CREATE TABLE "obs_sessions" (
	"user_id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"sequence" bigint NOT NULL,
	"snapshot" text NOT NULL,
	"updated_at" bigint NOT NULL,
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE CASCADE
);
ALTER TABLE public.obs_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.obs_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.obs_sessions TO authenticated;
CREATE POLICY own_player_read ON public.obs_sessions FOR SELECT TO authenticated USING ((SELECT auth.uid())::text = user_id);
CREATE TABLE obs_score_peers (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  offer TEXT NOT NULL,
  answer TEXT,
  created_at bigint NOT NULL,
  PRIMARY KEY (user_id, viewer_id)
);
ALTER TABLE public.obs_score_peers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.obs_score_peers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.obs_score_peers TO authenticated;
CREATE POLICY own_player_read ON public.obs_score_peers FOR SELECT TO authenticated USING ((SELECT auth.uid())::text = user_id);
CREATE TABLE shorts_sessions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  revision bigint NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id,id)
);
ALTER TABLE public.shorts_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shorts_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.shorts_sessions TO authenticated;
CREATE POLICY own_player_read ON public.shorts_sessions FOR SELECT TO authenticated USING ((SELECT auth.uid())::text = user_id);
CREATE UNIQUE INDEX "role_membership" ON "roles" ("user_id","role");
CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email");
CREATE INDEX "sight_attempt_user_created" ON "sight_attempts" ("user_id","created_at");
CREATE UNIQUE INDEX "practice_collection_number" ON "practice_exercises" ("collection","source_number");
CREATE INDEX game_attempt_session ON game_attempts(user_id,session_id);
CREATE INDEX game_attempt_condition ON game_attempts(user_id,condition_key,status);
CREATE INDEX game_ledger_session ON game_xp_ledger(user_id,session_id);
CREATE INDEX obs_score_peers_source ON obs_score_peers(user_id, source_id, created_at);
CREATE INDEX shorts_sessions_owner_updated ON shorts_sessions(user_id,updated_at DESC);
CREATE FUNCTION public.create_player_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 INSERT INTO public.users(id,email,name,created_at) VALUES(new.id::text,coalesce(new.email,''),left(coalesce(new.raw_user_meta_data->>'name','Pianist'),80),now()::text)
 ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name;
 RETURN new;
END; $$;
REVOKE ALL ON FUNCTION public.create_player_profile() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER piano_player_created AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_player_profile();
COMMIT;
