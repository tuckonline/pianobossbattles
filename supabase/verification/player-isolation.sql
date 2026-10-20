-- Requires a trusted administrative SQL session, never a browser connection.
-- Two synthetic Auth records and all fixtures exist only in this transaction.
-- No emails, passwords, sessions, rewards, or persistent accounts are created.
-- Any failed assertion aborts execution. Successful execution ends in ROLLBACK.
BEGIN;
SET LOCAL statement_timeout='30s';
SELECT set_config('pbb.test_a',gen_random_uuid()::text,true),set_config('pbb.test_b',gen_random_uuid()::text,true);
DO $$
DECLARE uid text; t record; c record; fixture jsonb;
BEGIN
  FOREACH uid IN ARRAY ARRAY[current_setting('pbb.test_a'),current_setting('pbb.test_b')] LOOP
    INSERT INTO auth.users(id,email,raw_user_meta_data)
      VALUES(uid::uuid,'pbb-rls-'||uid||'@example.invalid','{"name":"Temporary RLS verification"}'::jsonb);
    -- The signup trigger creates public.users. Seed one row per other owned table.
    FOR t IN SELECT cl.relname,cl.oid FROM pg_class cl JOIN pg_namespace n ON n.oid=cl.relnamespace
      WHERE n.nspname='public' AND cl.relkind='r' AND EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=cl.oid AND a.attname='user_id' AND NOT a.attisdropped)
    LOOP
      fixture='{}'::jsonb;
      FOR c IN SELECT attname,atttypid FROM pg_attribute WHERE attrelid=t.oid AND attnum>0 AND NOT attisdropped ORDER BY attnum LOOP
        fixture=fixture||jsonb_build_object(c.attname,CASE
          WHEN c.attname='user_id' THEN to_jsonb(uid)
          WHEN c.atttypid IN ('int8'::regtype,'int4'::regtype,'numeric'::regtype) THEN '1'::jsonb
          WHEN c.attname IN ('played') THEN to_jsonb('[]'::text)
          WHEN c.attname IN ('settings','result','event','challenge','last_result','best_result','snapshot','payload') THEN to_jsonb('{}'::text)
          ELSE to_jsonb('rls-test-'||uid||'-'||c.attname) END);
      END LOOP;
      EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I,$1)',t.relname,t.relname) USING fixture;
    END LOOP;
  END LOOP;
END $$;

SET LOCAL ROLE authenticated;
DO $$
DECLARE uid text; other_uid text; t text; owner_col text; visible_count bigint; foreign_count bigint;
BEGIN
  FOREACH uid IN ARRAY ARRAY[current_setting('pbb.test_a'),current_setting('pbb.test_b')] LOOP
    other_uid=CASE WHEN uid=current_setting('pbb.test_a') THEN current_setting('pbb.test_b') ELSE current_setting('pbb.test_a') END;
    PERFORM set_config('request.jwt.claim.sub',uid,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
    IF auth.uid()::text<>uid THEN RAISE EXCEPTION 'Auth identity did not change'; END IF;
    FOREACH t IN ARRAY ARRAY['users','roles','sight_attempts','practice_stream_stats','game_players','game_sessions','game_attempts','game_xp_ledger','game_unlocks','game_combo_records','game_days','game_events','battle_story_attempts','battle_story_records','obs_sessions','obs_score_peers','shorts_sessions'] LOOP
      owner_col=CASE WHEN t='users' THEN 'id' ELSE 'user_id' END;
      EXECUTE format('SELECT count(*) FROM public.%I',t) INTO visible_count;
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I=$1',t,owner_col) INTO foreign_count USING other_uid;
      IF visible_count<>1 OR foreign_count<>0 THEN RAISE EXCEPTION 'Isolation failure on % for %: visible %, foreign %',t,uid,visible_count,foreign_count; END IF;
      IF has_table_privilege(current_user,'public.'||t,'INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'Client mutation grant on %',t; END IF;
    END LOOP;
    BEGIN
      UPDATE public.game_players SET total_xp=999999 WHERE user_id=uid;
      RAISE EXCEPTION 'Direct XP mutation unexpectedly succeeded';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END LOOP;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','roles','sight_attempts','practice_stream_stats','game_players','game_sessions','game_attempts','game_xp_ledger','game_unlocks','game_combo_records','game_days','game_events','battle_story_attempts','battle_story_records','obs_sessions','obs_score_peers','shorts_sessions','mutation_guards','practice_exercises'] LOOP
    IF has_table_privilege(current_user,'public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'Anonymous access grant on %',t; END IF;
  END LOOP;
  BEGIN
    PERFORM * FROM public.game_players;
    RAISE EXCEPTION 'Anonymous progress read unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
SELECT 'passed: 2 Auth identities, 17 owned tables, bidirectional isolation, client writes denied, anonymous access denied; all test fixtures rolled back' AS result;
