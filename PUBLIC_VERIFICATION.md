# Public application V1 verification — 2026-10-20

Status: implemented locally; not deployed. This records the original V1 checks.
The later [migration report](SUPABASE_MIGRATION_REPORT.md) supersedes the database
setup limitations below: migrations and live SQL-level RLS isolation are now
verified. Email flows and the application's database connection remain unverified.

## Isolation

- Imported gameplay baseline: `5828fa17fb92dcff58487a9e3c93376f82583ec6`.
- Original checkout remains on that commit with a clean working tree.
- No original D1 data, authentication settings, or deployment was changed.
- New repository has no deployment workflow or Sites identity.
- Local `.env` is ignored; `.env.example` contains placeholders.
- No service-role key or database password was supplied to this implementation.

## Automated results

- **453 tests passed across 62 files**, including the existing 447 tests and
  six PostgreSQL integration tests.
- PostgreSQL tests execute the real schema and seed migrations in PGlite.
  They cover profile creation, RLS isolation between two users, denial of
  direct client XP/achievement writes, evaluated rewards and retry idempotence,
  immutable checkpoints, settings, mixed queues, battle history/personal bests,
  and OBS/Shorts session persistence.
- **Four public browser tests passed in Chromium**:
  - Signup, login, logout, reset-request UI, and desktop/mobile layouts.
  - MIDI connection gate, queue ordering and loops, immediate note evaluation,
    continuous loops and exercise advancement under one battle identity,
    pause/resume, and the same mounted score when returning to setup.
  - Victory reaches a persistent holding state over the mounted score;
    deliberately starting the next attempt dismisses it and starts its countdown.
  - Real local API rejects unsigned requests and cross-origin session writes.
- Browser checks rendered `/obs/recording` at 1920×750 and `/obs/shorts` at
  1080×1920, with zero MIDI-access requests from those presentation pages.
- Theatre notation bounds were asserted inside the white score region;
  screenshots of Theatre and both OBS layouts were visually inspected.
- TypeScript passed. Changed-file lint: zero errors, one retained
  `react-hooks/exhaustive-deps` warning in the existing exercise completion effect.
- Public production build passed. Verovio emits its existing browser-external
  module warning; notation rendered in the browser checks.
- Production dependency audit: **zero vulnerabilities**. The complete dependency
  audit still reports 13 findings in retained development tooling (4 moderate,
  9 high). No forced/breaking toolchain replacement was applied.

## What these checks do not establish

Browser account/gameplay responses use explicit isolated fixtures. They verify
the UI/controller integration, not real email delivery or production database
access. The real Supabase settings endpoint accepted the publishable key and
reported email signup enabled with email confirmation required. No remote
migrations, test-account creation, or gameplay writes were performed.

No physical piano, real OBS recording, email confirmation callback, or password
recovery email was tested. Only the selected representative public browser
scenarios were run; the entire legacy browser matrix was not rerun. Loop coverage
includes existing automated rules and a two-loop browser transition, not live
performances at every count through 100.

An optional compiled-server smoke-test launch was rejected by the execution
policy without a stated reason. It was not bypassed. The production bundle
compiled successfully, and browser/API checks used the existing approved local
development servers.

## Required before release

Follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md): apply the two migrations to the new
Supabase project, configure email and exact redirects, and set `DATABASE_URL`
only in the ignored local environment file. Then run the listed live account,
cross-account isolation, persistence, physical MIDI, and OBS recording checks.
Production deployment still requires the owner's explicit approval.
