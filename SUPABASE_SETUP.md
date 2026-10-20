# Public Piano Boss Battles: local setup

This is an independent app. It has no Sites deployment identity, D1 binding,
deployment workflow, or connection to the original live application. Nothing here
migrates player data from that application.

## 1. Authentication (Supabase dashboard)

Open your `huxmltjtovpxxxupuxdg` project.

**Configured on 2026-10-20:** hosted Auth now uses the local Site URL and exact
redirects below, with a 12-character password minimum. Email signup and email
confirmation remain enabled. Only these declared Auth settings were changed;
the existing production redirect and all other remote settings were preserved.
Custom SMTP and real email delivery still require verification.

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

1. From this repository, run
   `powershell -NoProfile -File scripts/configure-public-database.ps1`.
   The helper verifies the linked project and session-pooler destination before
   prompting for the database password with hidden input. It percent-encodes
   the password and writes `DATABASE_URL` only to the ignored local `.env`.
2. Use the project's **database password**, not your Supabase login password.
   If necessary, locate/reset it yourself in the Supabase dashboard. Never paste
   the password or connection URI into chat. Restart the API after saving it.
3. Keep `APP_ORIGIN=http://localhost:5173` and `PORT=8788`.
4. Install dependencies with `npm ci`.
5. Run `npm run dev:api` in one terminal and `npm run dev` in a second terminal.
6. Open `http://localhost:5173`. Use that hostname consistently for redirects
   and cookies. The API binds loopback only.

The server uses `pg` over certificate-verified TLS. No service-role key is needed
in browser code. The database connection is server-only. The independent Node
runtime retains the original scoring, persistence transactions, OBS streaming
and signaling functions through a tested PostgreSQL adapter.

For Supabase's private root CA, download the certificate from **Database Settings
→ SSL configuration → Download certificate**, save it outside tracked files,
and set `DATABASE_SSL_CA_FILE` to its path. The local configuration uses
`.local/certificates/supabase-prod-ca-2021.crt`. This is the official public CA
linked by Supabase's dashboard, downloaded over HTTPS from
`https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`.
Never set `rejectUnauthorized: false` or disable Node TLS verification.

**Connection verified on 2026-10-20:** the local Node client connected to the
session pooler over TLS 1.3 with certificate verification enabled and read all
228 exercise definitions. This verifies database connectivity, not registration
email delivery or saved progress through a real player session.

`npm run build` creates the frontend files and Node API bundle. It does not deploy anything.
`npm start` serves that build and API locally; set `APP_ORIGIN` to that local
origin if testing the combined server directly.

## 4. Live integration checks after setup

Until custom SMTP is configured, Supabase's default sender permits only project
team email addresses and currently limits delivery to two messages per hour.
Use your project-team address for the first registration/confirmation and reset
test; do not disable email confirmation to work around a delivery error.

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
the app's `DATABASE_URL` connection is verified with certificate-checked TLS 1.3.

### Local authentication verification — 2026-10-20

- Registration: passed with a real project-team email address.
- Default-sender confirmation email: user confirmed receipt and completion.
- Email confirmation: independently verified one confirmed Supabase Auth account
  and its matching application profile, without printing credentials.
- Email/password login: passed in the local browser; the account page displayed
  the correct player name, Level 1, and 0 XP.
- Logout: passed; the signed-in player view returned to the login form.
- Password reset email: user confirmed receipt. The link opened in a different
  browser, which lacked the PKCE verifier and displayed the login form. The
  application previously ignored that unexchanged callback and its recovery
  route marker. It now explains missing-browser-proof/expired-link errors,
  waits for SDK initialization, and retains the password form across reloads
  until a successful update. PKCE and session validation remain enabled.
- Password change and login with the new password: **not yet verified live**.
  One fresh reset request returned `email rate limit exceeded`; retries stopped.
  After the default sender quota resets, request a new reset link in the browser
  you intend to use and open the latest email link there. Enter and submit the
  new password on the website only, then log out/in and verify saved progress.
  Do not treat an accepted request or a simulated test as delivered email.
- Real gameplay save/reload: passed using the user's Roland Digital Piano.
  Supabase stored two completed Schmitt Exercise 1 attempts (66 correct notes
  each; 100% and 97.06% accuracy), 789 XP, and five achievements. After a browser
  reload, the authenticated page restored 789 XP, five achievements, a best
  combo of 93, and the 100% personal best. The page reported `All progress saved`.
  No test XP or achievements were inserted directly into the database.
- Checks after the CA configuration change: 8 database integration tests,
  TypeScript, changed-file lint, and production build passed. Browser assets
  were checked for accidental inclusion of the database password: none found.
- Checks after the recovery fix: all 8 public browser tests passed (including
  4 recovery regressions covering missing PKCE verifier with/without a previous
  session, successful recovery/reload/update, and expired links). These Auth
  responses are isolated fixtures, not live password changes. TypeScript,
  changed-file lint, and production build also passed.

Do not approve public deployment until live authentication, database persistence,
physical MIDI, and recording checks have passed.

## Reference

- [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
