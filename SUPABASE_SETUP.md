# Public Piano Boss Battles: local setup

This is an independent app. It has no Sites deployment identity, D1 binding,
deployment workflow, or connection to the original live application. Nothing here
migrates player data from that application.

## 1. Authentication (Supabase dashboard)

Open your `huxmltjtovpxxxupuxdg` project.

1. Under **Authentication → Sign In / Providers → Email**, enable email/password
   and **Confirm email**. Set the minimum password length to **12**. Enable
   leaked-password protection if your plan supports it.
2. Under **Authentication → URL Configuration**, use `http://localhost:5173`
   as the development Site URL. Add these exact redirect URLs:
   - `http://localhost:5173/`
   - `http://localhost:5173/?recovery=1`
3. Configure a verified sender under **Authentication → Email / SMTP**.
   Supabase's default sender is restricted and is unsuitable for public launch.
   Leave signup/password-reset rate limits enabled.
4. Keep production deployment disabled. When release is approved, change Site URL
   to `https://www.pianobossbattles.com` and explicitly add its `/` and
   `/?recovery=1` redirects. Do not add wildcard redirects.

The app uses Supabase JS PKCE sessions. Confirm/reset links should be opened in
the browser where the request started. The game API verifies the access token
with Supabase and requires a verified email. Client-supplied player IDs and
ChatGPT identity headers are not accepted as authentication.

## 2. Database migrations

**Completed on 2026-10-20:** both migrations were applied by Supabase CLI 2.121.0
to `huxmltjtovpxxxupuxdg`. Remote migration history matches the local files.
Do not rerun these initial files manually in SQL Editor.

1. `supabase/migrations/202610200001_public_players.sql`
2. `supabase/migrations/202610200002_music_catalog.sql`

The first creates player profiles (`users`), server-evaluated XP/reward ledgers,
achievements, session/attempt history, personal bests, and OBS session state.
Level is derived from saved XP using the unchanged game progression curve.
All tables have RLS enabled. Authenticated users may read only their own player
records. Direct client progression writes are denied. Only the authenticated
server API writes evaluated results. The second file seeds versioned music
definitions only; it contains no original player data.

Supabase Auth creates profile rows on signup and synchronizes email/name changes.
The API also initializes a profile for accounts created before migration.
See [SUPABASE_MIGRATION_REPORT.md](SUPABASE_MIGRATION_REPORT.md) for the live
schema audit and transaction-scoped two-account isolation results.

For future migrations, run from this independent repository:

```sh
npx --yes supabase@2.121.0 login
npx --yes supabase@2.121.0 link --project-ref huxmltjtovpxxxupuxdg
npx --yes supabase@2.121.0 migration list --linked
npx --yes supabase@2.121.0 db push --linked --dry-run --skip-vault
# Apply only after reviewing the pending files and confirming the project ref:
npx --yes supabase@2.121.0 db push --linked --skip-vault
```

The CLI login is stored outside Git; `supabase/.temp` is ignored. Complete login
and any credential prompts in your terminal, never in chat. The CLI's dry run
lists pending migrations; it does not execute or semantically validate SQL.
Never use a linked reset. Do not push `config.toml` to the hosted project: it
describes local development defaults and is not an instruction to overwrite
live Auth or other service settings.

## 3. Local server connection (keep credentials on your computer)

The supplied project URL and publishable key are already in the ignored `.env`.
The framework is Vite/React, so browser-safe names begin with `VITE_`.

1. In Supabase, choose **Connect → Session pooler**.
2. Copy its PostgreSQL connection URI into `DATABASE_URL` in the local `.env`.
   Replace the password placeholder locally. Percent-encode special characters
   in the password. **Do not paste the URI or password into chat or commit it.**
3. Keep `APP_ORIGIN=http://localhost:5173` and `PORT=8788`.
4. Install dependencies with `npm ci`.
5. Run `npm run dev:api` in one terminal and `npm run dev` in a second terminal.
6. Open `http://localhost:5173`. Use that hostname consistently for redirects
   and cookies. The API binds loopback only.

The server uses `pg` over certificate-verified TLS. No service-role key is needed
in browser code. The database connection is server-only. The independent Node
runtime retains the original scoring, persistence transactions, OBS streaming
and signaling functions through a tested PostgreSQL adapter.

`npm run build` creates the frontend files and Node API bundle. It does not deploy anything.
`npm start` serves that build and API locally; set `APP_ORIGIN` to that local
origin if testing the combined server directly.

## 4. Live integration checks after setup

- Create two test accounts using inboxes you control. Verify each email.
- Log in/out; request a reset; open the reset link and change the password.
- Verify account B cannot see A's history, XP, achievements, or OBS state.
- Connect a real MIDI piano. Confirm starting is disabled until connected.
- Complete a short piece, refresh, log out/in, and confirm saved progress.
- Build a mixed queue, reorder it, use 1/5/10/100 loops, and confirm only one
  countdown per battle, continuous notes/HP, and correct final results.
- Start Theatre Mode; pause/resume and return to setup. The score stays mounted.
- Verify `/obs/recording` and `/obs/shorts` after signing into that browser
  context. OBS uses its own browser cookie store: use Interact to sign in there.
  Do not put access tokens in URLs. The existing original OBS URLs still work
  independently and are not modified by this project.
- Choose audience-only audio if recording, designate one OBS audio source,
  and confirm no doubled effects in an actual recording.

Browser tests use isolated mocked auth/network responses to verify UI behavior;
they do not prove email delivery or the application's server connection. Local
PostgreSQL tests execute the real migrations and RLS policies in PGlite. The
live database migrations and SQL-level cross-account isolation are now verified;
real email/password sessions and the app's `DATABASE_URL` connection remain to test.
Do not approve public deployment until live authentication, database persistence,
physical MIDI, and recording checks have passed.

## Reference

- [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
