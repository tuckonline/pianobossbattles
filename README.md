# Piano Boss Battles — independent public application

React/Vite frontend, Supabase Auth, Supabase PostgreSQL, and a small Node API.
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
selected hands; loops are bounded to 1–100 per entry. Theatre Mode shares the
same MIDI controller and mounted score as setup. Returning to setup during a
battle leaves it running and locks queue/boss/mode changes until it ends.

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

**Production deployment is disabled pending owner approval.** There is no Sites
project identity, Cloudflare binding, GitHub Actions deployment, or domain setup
in this repository. Pushing a feature branch only publishes source. Do not run
legacy deployment helpers against the original application.
