-- Read-only. Run only after confirming the linked project reference.
SELECT jsonb_build_object(
  'database', current_database(),
  'server_version', current_setting('server_version'),
  'tables', (SELECT jsonb_agg(jsonb_build_object(
    'name',c.relname,'rls',c.relrowsecurity,
    'anonymous_read',has_table_privilege('anon',c.oid,'SELECT'),
    'authenticated_read',has_table_privilege('authenticated',c.oid,'SELECT'),
    'authenticated_write',has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE'),
    'policies',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'using',pg_get_expr(p.polqual,p.polrelid))),'[]'::jsonb) FROM pg_policy p WHERE p.polrelid=c.oid)
  ) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'),
  'profile_function', (SELECT jsonb_build_object('security_definer',p.prosecdef,'config',p.proconfig,
    'anonymous_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
    'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE')) FROM pg_proc p WHERE p.oid='public.create_player_profile()'::regprocedure),
  'auth_trigger',(SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgname='piano_player_created' AND tgrelid='auth.users'::regclass),
  'catalog_rows',(SELECT count(*) FROM public.practice_exercises),
  'migration_versions',(SELECT jsonb_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations),
  'auth_accounts',(SELECT count(*) FROM auth.users),
  'profiles',(SELECT count(*) FROM public.users)
) AS audit;
