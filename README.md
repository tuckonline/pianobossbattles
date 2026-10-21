# Piano Boss Battles — independent public application

**Start here:** [Current project handoff](docs/project-handoff.md) and
[agent instructions](AGENTS.md). The handoff records live production, retained
Creator Studio development, retired preview hosting, and supersedes historical notes.

React/Vite frontend, Supabase Auth, Supabase PostgreSQL, and a shared API running
locally in Node and on Cloudflare Workers in the deployed application.
The original MIDI evaluator, battle engine, animation library, scoring, and OBS
presentations are reused. The original ChatGPT-hosted app and D1 database remain
independent and unchanged.

## Start locally

Follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md) first. The ignored local `.env`
contains browser-safe Supabase settings; add the server-only database connection
locally after applying the migrations. Never commit `.env` or privileged keys.

```sh
npm ci
npm run dev:api
# In another terminal:
npm run dev
```

Open http://localhost:5173. Starting requires a verified account, a connected
MIDI device, and a compatible musical queue. Single-hand pieces must match the
selected hands; loops are bounded to 1–100 per entry. On the current Creator branch,
Start Battle opens the arena directly from setup. Theatre Mode shares the same
MIDI controller and mounted score. Escape/Back to setup pauses the current attempt;
Resume Battle continues without a new countdown. Queue/boss/mode changes remain
locked while an attempt is active.

## Structure

- `public-app/`: public account/setup/Theatre UI and independent API server.
- `supabase/migrations/`: fresh-project PostgreSQL schema, RLS, and music seeds.
- `hosted/`: reused production gameplay, notation, combat, audio, and OBS code.
- `src/`: shared MIDI/music/notation code and retained legacy authoring source.
- `drizzle/`: retained D1 migration fixtures for compatibility tests only.
- `tests/public-postgres.test.ts`: real PostgreSQL migration/RLS/evaluator tests.
- `tests/public-browser/`: browser UI tests with explicit auth/network fixtures.

No D1 connection is used by the public server. No production player data is
copied or migrated. Server-validated note receipts remain the basis for rewards;
a browser cannot directly write XP, achievements, or personal-best records.

## Checks

```sh
npm test
npm run typecheck
npm run test:public-browser  # local servers must already be running
npm run build
```

`npm test` prepares a local legacy Worker fixture before the compatibility suite.
This fixture is not a deployment target. `npm run build` builds the public client
and Node server. `npm start` serves both locally after a build (adjust APP_ORIGIN
for its port). Automated browser fixtures do not establish that production email,
Supabase storage, a physical MIDI keyboard, or OBS recordings work. Complete the
live checks in the setup guide before release.

## Deployment status

Production is live at https://www.pianobossbattles.com in Cloudflare Pages project
`pianobossbattles`. The owner requested production-only hosting; the separate
`pianobossbattles-preview` project and its aliases have been deleted. Creator Studio
source remains on `feature/creator-studio-v1` and has not been promoted to production.
Production's Supabase database and Hyperdrive resource remain intact. The original
ChatGPT/D1 app is separate. Test locally before an authorized production release.

Git push does not deploy production. Read the target/configuration, approval
boundaries, release commands, and incident status in the [handoff](docs/project-handoff.md)
before publishing. Do not use legacy Sites deployment helpers for this public app.
