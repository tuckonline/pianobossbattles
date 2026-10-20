# Supabase migration report — 2026-10-20

Target: `huxmltjtovpxxxupuxdg` (`https://huxmltjtovpxxxupuxdg.supabase.co`).
Independent repository: `tuckonline/pianobossbattles`, branch
`feature/end-user-website-v1`.

## Completed

- Authenticated Supabase CLI **2.121.0** through the owner's interactive login.
  No password, access token, or service-role key was supplied through chat.
- Confirmed the project ref, healthy status, and PostgreSQL **17.11**. Before
  applying migrations, the public schema had no tables and Auth had no accounts.
- Initialized the local CLI configuration and linked the exact project ref.
  The CLI's local connection metadata is ignored by Git.
- Reviewed both SQL files and reran focused PostgreSQL integration tests.
- Ran two pre-application dry runs, including one after the review fixes. Each
  listed only the two expected migrations, without extra seeds, roles, or Vault
  changes. A dry run only lists pending files; SQL correctness was tested locally.
- Applied `202610200001_public_players.sql` and
  `202610200002_music_catalog.sql` successfully through `supabase db push`.
- Verified both versions in remote migration history. The final dry run reports
  **up to date**, with no pending migrations.

## Review fixes made before the initial application

- Explicitly revoke table privileges from `PUBLIC`, `anon`, and `authenticated`,
  then grant authenticated owner-only reads. All progression writes go through
  the existing authenticated server evaluator.
- Revoke execution of the privileged signup trigger function from browser roles
  as well as `PUBLIC`, including grants inherited from Supabase default privileges.
- Preserve the trigger function's fixed empty search path and qualified writes.
- Synchronize profile email/name changes when Supabase Auth updates them, avoiding
  stale unique emails blocking later registrations.
- Make player foreign keys consistently cascade if an account is deliberately
  deleted in the future; add missing owner foreign keys to OBS peers and Shorts.
  No live account or existing data was deleted during this work.

## Live verification

- **19 public tables**, all with RLS enabled.
- **17 player-owned tables**, each with an authenticated SELECT policy comparing
  `auth.uid()` with its owner ID. No anonymous table access or authenticated
  INSERT/UPDATE/DELETE/TRUNCATE grants.
- The two internal tables, `mutation_guards` and `practice_exercises`, have RLS
  enabled and no browser policies or grants. They are intentionally server-only.
- The profile trigger is installed on `auth.users` for INSERT and email/metadata
  UPDATE. Its function is SECURITY DEFINER with a fixed search path; neither
  anonymous nor authenticated roles can execute it directly.
- **228 music definitions** loaded; no original application player data imported.
- Supabase security advisors returned **zero WARN/ERROR findings**, with two
  expected INFO notices for the intentionally policy-free internal tables.

### Two-account privacy test

Executed `supabase/verification/player-isolation.sql` against the live database.
It creates two synthetic Auth records and one fixture per owned table inside a
single transaction, then assumes the actual `authenticated` role with each
record's JWT subject claims. It verifies, in both directions:

1. Each identity sees exactly its own row in all **17** player-owned tables.
2. Explicit queries for the other identity's data return no rows.
3. Direct client mutation grants are absent and attempted XP updates are rejected.
4. The anonymous role has no table grants and cannot read progress.

All assertions passed. The transaction was rolled back. A follow-up read confirmed
**0 Auth accounts, 0 profiles, 0 game players**, and the unchanged **228 music
definitions**. No emails were sent and no test credentials or permanent test
accounts were created. This verifies live PostgreSQL/RLS isolation, not a real
email/password login or browser-issued JWT flow.

Read-only inspection is reproducible with `supabase/verification/security-audit.sql`.
Always confirm the linked project ref before either verification command.

## Local regression results

- **455 tests passed across 62 files**, including eight focused PostgreSQL tests.
- New coverage verifies every table's RLS/grants under Supabase-style default
  privileges, Auth profile synchronization, and deletion compatibility using
  disposable local test data only.
- TypeScript passed; changed-file lint passed with no findings.
- No UI or gameplay code changed; browser/physical MIDI/recording tests were not
  rerun for this database-only update.

## Remaining setup

- Add the server-only Supabase Session pooler connection to `DATABASE_URL` in the
  ignored local `.env`, following [SUPABASE_SETUP.md](SUPABASE_SETUP.md). CLI login
  authorization does not provide the running application with a database password.
- Verify hosted email confirmation, minimum password length, exact localhost
  redirects, and SMTP delivery in the Supabase dashboard. Local `config.toml`
  was aligned to the app but was **not pushed** to change hosted Auth settings.
- Test real registration, email confirmation, password recovery, and app persistence
  using inboxes controlled by the owner, then physical MIDI and OBS recordings.
- Public deployment remains disabled pending owner approval.

No linked reset, table drop, data deletion, RLS disablement, website deployment,
Cloudflare DNS change, or original ChatGPT application/D1 modification occurred.
