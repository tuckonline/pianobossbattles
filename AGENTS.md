# Piano Boss Battles: instructions for future sessions

Read [docs/project-handoff.md](docs/project-handoff.md) before changing code or deploying.
It records architecture, approved behavior, infrastructure, outstanding work,
verification limits, and release procedures. Update it when decisions change.

## Identify the correct application

- This is the independent public React 19 / TypeScript / Vite application.
  Entry: `public-app/main.tsx`; local API: `public-app/server.ts`; deployed API:
  `public-app/worker.ts` on Cloudflare Pages/Workers.
- `hosted/` contains shared gameplay and original Sites/D1 code; `src/app/`
  retains an older Next.js/Better Auth app. Neither is the public runtime entry.
  Do not replace Supabase Auth with those legacy authentication adapters.
- Start with Git status, current branch, and recent commits. Development branch
  at handoff: `feature/creator-studio-v1`. Do not reset user changes, switch branches,
  or merge to main merely to satisfy a deployment script.

## Owner constraints and approval boundaries

- Preserve the original ChatGPT-hosted game, Sites identity, authentication, D1
  database, and player data. The public application is independent.
- Ask before a production release unless explicitly authorized for that release.
  Preview approval is not blanket production approval. This handoff task authorizes
  documentation and a Git commit only, not deployment.
- Ask before paid plans, DNS/domain changes, auth/SMTP/security-policy changes,
  destructive database operations, live account deletion, or privilege grants.
  Working Resend SMTP, email routing, and email DNS must not be casually reconfigured.
- Never reset linked Supabase storage, drop live tables, disable RLS, import original
  D1 player data, or weaken email verification/TLS to bypass failures.
- Keep local environment files, DB passwords, service-role keys, CLI tokens, session
  cookies, and complete Creator viewing links out of Git, logs, screenshots, and
  browser assets. Have the owner enter credentials securely outside chat.
- Review migrations, confirm the exact project, dry-run, and obtain appropriate
  authorization before live schema changes. Do not edit applied migrations.
- Do not announce launches, invite users, or purchase services automatically.

## Preserve gameplay and presentation invariants

- Reuse the existing MIDI evaluator and authoritative progress/reward service.
  Recording viewers must never create independent MIDI evaluators or game clocks.
- Correct notes/damage evaluate immediately. Animation combos may coalesce visual
  attacks without dropping or duplicating notes, HP, XP, or achievements.
- One countdown per new attempt/entire chain; none at loops, pause/resume, measure
  changes, remounts, or OBS reconnects. Supported loop range: 1–100.
- Ultimate Boss combines existing health/difficulty and timing mechanics. Preserve
  other modes; do not add a second timer or damage engine.
- Results hold indefinitely until deliberate dismissal. Keep the score mounted and
  state intact underneath. Reconnect must not replay entrances or rewards.
- Preserve restored original Victory/Defeat visuals and unchanged TIME OUT visuals.
  Keep lifecycle fixes separate from presentation definitions.
- Contain all notation bounds. Guard exercise/pass identity against stale notes and
  callbacks; visual transitions must not delay MIDI evaluation.
- Current public flow: setup -> Start Battle -> modal arena/countdown. Do not restore
  the removed intermediate Battle Preview page.
- Preserve approved navy/cyan branding, compact setup, actual transparent emblem,
  and @PianoBossBattles recording handle. No unsolicited redesign or asset substitution.
- Focus Mode defaults to silent player effects. Audience audio has one designated
  OBS owner; the other source stays silent. Preserve audio priorities and timing.
- The keyboard camera is a separate OBS source. Do not add webcam capture.

## Development and verification

- Prefer small changes, existing components/configuration/tokens, and relevant tests.
  No unnecessary dependencies, unrelated refactors, or tests mirroring implementation.
- For code changes run relevant tests, TypeScript, changed-file lint, and build.
  Public browser tests need the local API and Vite servers already running.
- Distinguish fixture tests, owner confirmations, and real live/OBS verification.
  Mocked browser responses and `/api/health` do not prove DB access or physical MIDI.
- Hyperdrive previously exhausted the Free daily quota. Workers Paid is now active
  and real player-storage reads/writes have been confirmed. Read the incident update;
  do not ask the owner to upgrade again. Avoid unnecessary live polls/load tests.
  Any further billing changes require approval; keep query usage efficient.
- The owner requested production-only hosting. The preview Pages project was
  deleted; do not recreate it or run retained preview deployment helpers/configs.
  `build:preview` only packages assets and is still used for production builds.
  The production helper accepts `feature/end-user-website-v1`; current Creator
  branch changes are not automatically approved for production. Follow the handoff
  and do not silently bypass a target/branch/security guard.
- The generated Next.js block below applies to retained Next.js code only. It is
  not an instruction to migrate the public Vite app.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
