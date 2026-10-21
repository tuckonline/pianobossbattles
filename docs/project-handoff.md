# Piano Boss Battles — project handoff

Updated: **2026-10-21**, America/Los_Angeles. This is the current continuity guide
for the independent public website. Read it with [AGENTS.md](../AGENTS.md).
Older reports preserve historical evidence; their pending-deployment statements
and test counts must not be treated as current facts. Recheck Git and service state
when work resumes. No functionality or deployment was changed for this handoff.

## Hybrid battle layout published — 2026-10-21

The owner approved publication after local review. Development commit `b9bdf48`
was promoted selectively to release commit `2a9f941` on
`feature/end-user-website-v1`. Creator Studio, its migration, OBS redesign, and
server/database changes were excluded. No preview environment was recreated.

Production: https://www.pianobossbattles.com/; deployment
`d2d42ba1-2273-4e71-bb64-e8b0a768bac3`; client `index-2Uu52Qw3.js`;
stylesheet `index-Dow57WRU.css`. Rollback:
`0b2d7346-c0a5-490e-92d3-3037e5d9ae15` (`76f3752`).

The exact production candidate passed 480 unit/database/network tests (66 suites),
all 47 public browser cases, TypeScript, changed-file lint, production packaging,
and a private-credential scan of 73 packaged files. Development totals of 486/52
also include unreleased Creator features and should not be confused with these.

Live checks confirmed matching assets, both OBS routes and branding returning 200,
unsigned writes returning 401, and foreign-origin writes returning 403. The real
signed-in production session reloaded with Level 3, 4,809 XP, All progress saved,
and the direct Start Battle flow. Screenshot:
`.local/hybrid-layout/production-dashboard.png` (ignored). Physical MIDI and native
OBS recordings specifically on this release remain manual checks. Production
bindings, original ChatGPT/D1, auth, DNS, SMTP and existing player data are intact.
The earlier deployment-withheld notes below are superseded by this release.

## Local hybrid battle layout review — 2026-10-21

The owner approved local implementation of the music-first active battle overlay,
with production deployment explicitly withheld. The removed preview must not be
recreated. The current working-tree changes are on `feature/creator-studio-v1`.

The public dialog now uses a 48px title/control strip and a 52px, opt-in music HUD:
player HP left, combo/accuracy and Combo Power center, boss HP right. Timed modes
keep their existing clock prominent over the action stage; shields and story
notices remain visible. Other `BossBattlePanel` callers retain their default HUD.
Reclaimed chrome gives notation 52px more height without changing the existing
fighter canvas height, layout configuration, sprite scale, grounding, or weapon
contact solver. The score uses its existing full-ink contain fit, not stretching.
Measured Schmitt 7 grand-staff height increases from 175 to 227px at 1366×768 and
220 to 272px at 1440×900. The score allocation is responsive, not a rigid 45%.

`BattleCinematicSurface` is an optional React context: only this dialog supplies
its content surface as a portal target. Results cover the arena and notation,
while the same score and cinematic controller stay mounted. Original assets,
timelines, audio cues and holding/dismissal logic are unchanged. Dialog-scoped CSS
restores original cinematic title sizes against the generic public h2 rule and
keeps result text within the overlay. OBS/Shorts do not supply this context and
retain their existing composition and routing.

Runtime files: `public-app/player-home.tsx`, `public-app/player-home.css`,
`hosted/boss-ui.tsx`, `hosted/boss.css`, `hosted/cinematic-controls.tsx`.
Browser regressions: `tests/public-browser/home.spec.ts`. Local before/after,
attack, Hanon, and terminal-scene captures are in ignored `.local/hybrid-layout/`.
These are fixture browser tests, not a new physical-MIDI/OBS recording validation.
No auth, SQL, database, MIDI evaluator, gameplay, recording-layout or asset edits
are part of this change. Review locally at http://localhost:5173/ before requesting
any production release. Verification: all 486 unit/database/network tests (68
suites), all 52 public browser cases, TypeScript, changed-file ESLint, production
build, and diff whitespace checks passed. Browser coverage includes all three
requested desktop sizes, both bosses, Schmitt/Hanon grand staffs, attacks, retained
score identity, pause/resume without countdown replay, and all three result types
held and contained at each viewport. Existing build warnings about future Vite
config loading and Verovio browser externalization remain unchanged. No deployment
was performed.

## Hosting decision update — 2026-10-21

The owner requested **public production only**. Cloudflare Pages project
`pianobossbattles-preview` was deleted, including its Creator and older public
preview deployments/aliases. Production project `pianobossbattles`, its domain,
and deployment `e4854b83-8382-40a7-a416-d6a88b49eb47` were verified unchanged.
The shared Hyperdrive resource, Supabase DB, source branches and Creator code were
not deleted. No new application release was made. Local testing remains available.
Do not recreate a preview project or run historical preview deployment commands
without a new request. Creator branch changes are still not live in production.
All preview availability and deployment instructions below are historical where
they conflict with this update. `build:preview` only packages assets; it remains
part of the production build process despite its name.

### Workers Paid and storage recovery — 2026-10-21

The owner explicitly authorized Workers Paid and completed Cloudflare's agreement
checkboxes/Activate step. The dashboard displayed **Purchase complete; subscription
active**, Workers Paid **$5/month base plus usage overages**. Do not describe the
account as Free or ask the owner to purchase it again. Hyperdrive's Free-plan
100,000-query daily cap no longer applies; other service limits still do.

The owner confirmed production login and saved progress. The signed-in dashboard
was observed at Level 3, 4,468 XP, “All progress saved.” Subsequent read-only SQL
confirmed two newly completed Schmitt 6 attempts: 34 correct notes, and 34 correct
plus 2 incorrect notes. These establish actual reads and new persisted note writes,
not just a configured health endpoint. New-result refresh/re-login and native OBS
recording checks must still be distinguished from those observations.

The owner reported a short-lived “Waiting for battle note checkpoint” warning,
which cleared after a few seconds. This is a separate save-ordering race: while
an older note checkpoint is in flight, MIDI can queue a newer terminal prefix;
the flush then submits the story summary before that newer checkpoint is sent.
The server correctly returns 409. The client fix defers a story receipt while
any of its pass checkpoints remain queued, preserving all server validation and
the local outbox. It also avoids premature summary SQL/retry traffic.

Related query optimizations remove account-initialization transactions from
already authenticated catalog/OBS/Shorts requests (their own fresh owner/role
checks remain). Unchanged catalog revalidation goes from eight SQL statements
to two. An OBS SSE stream still reads the live snapshot at its existing cadence;
only unchanged durable statistics are reused, within that one stream, for at most
two seconds. Any source/sequence/content change bypasses reuse immediately.
No cross-user cache, schema, MIDI, damage, audio-timing or UI-layout change is needed.
The owner separately approved the production-only release. These fixes are now
live as commit `76f3752`, deployment `0b2d7346-c0a5-490e-92d3-3037e5d9ae15`.
Only three runtime files and their tests were promoted from the Creator branch;
the unreleased Creator/layout changes were not included. The retained release
checkout is `.local/production-query-fix` on `feature/end-user-website-v1`.
The current development branch carries the same fixes in `32ed15b`.

Verification: 486 unit/database/network tests and 34 browser cases passed on the
development branch. The production-only candidate passed 30 focused SQL/service
tests, TypeScript, changed-file lint, build, and all 29 browser cases across its
full run and one unchanged origin-test recheck. That test initially used the
other local server's APP_ORIGIN; matching the candidate proxy/API origins fixed
the harness, without changing assertions or production security. An optional
compiled Node server launch was policy-blocked; verification used the permitted
Vite development server plus local API. A scan of 73 built files found no local
DB URL/password. Removing the checkpoint guard temporarily reproduced the original
premature 409 in the delayed-MIDI browser regression; restoring it passed.

Live checks: production serves matching client `index-WHhsOz83.js`; health is
configured, unsigned writes return 401, foreign-origin writes 403, and both OBS
routes return 200. More importantly, the real signed-in account was refreshed on
the new build and showed **4,809 XP, 5 bosses defeated, 12 pieces practiced, All
progress saved**, with no alert. This confirms retained newly earned progress
after a real physical-MIDI exercise and subsequent reload. Native OBS recordings
and an additional physical-MIDI performance specifically on this new build remain
manual checks. Prior deployment `e4854b83-8382-40a7-a416-d6a88b49eb47` is the rollback
target for this release. No preview hosting was recreated; no schema, DNS, SMTP,
Supabase auth or original D1 changes were made.

## 1. Open the correct project

- Repository: https://github.com/tuckonline/pianobossbattles
- Local root: `C:\Users\aaron\Documents\Codex\2026-09-18\what-are-the-most-popular-online\outputs\pianobossbattles-public`
- Current development branch: `feature/creator-studio-v1`.
- Latest development application commit: `32ed15b` (query/save-order fixes).
- Public release branch: `feature/end-user-website-v1`, at `76f3752`.
- The containing workspace has other projects, including the original application.
  Do not run Git/build/deploy commands from the parent directory by accident.

The new conversation does not need this entire chat. Open this exact directory,
read these documents, inspect Git, and continue from the checked-out branch.
Do not assume a fresh clone contains local credentials or verification artifacts.

## 2. Architecture and boundaries

The public website is a **React 19 + TypeScript + Vite single-page application**,
not the retained Next.js application. Local Node and deployed Cloudflare Workers
invoke the same API and gameplay services. Zod validates API inputs. Supabase Auth
provides email/password accounts; Supabase PostgreSQL stores public-player data.
Cloudflare Hyperdrive supplies deployed server-side DB connections.

```text
Piano MIDI -> SightReading/GameClient -> immediate evaluation + battle state
                                      -> authenticated API -> reward/persistence service
                                                             -> PostgreSQL
                                      -> direct WebRTC presentation frames
                                         + recoverable database snapshot
                                         -> OBS/Creator viewers (presentation only)

React account UI -> Supabase Auth -> verified API session cookie
Vite SPA assets -> Cloudflare Pages
/api/*          -> Pages advanced-mode Worker -> Hyperdrive -> PostgreSQL
```

The public app reuses original gameplay modules through a PostgreSQL compatibility
adapter (`PostgresBridge`), including the D1-shaped service interface. It does **not**
connect to the original production D1 database. Legacy Sites identity headers are
not a public authentication mechanism. Next.js, Better Auth, old authoring routes,
and D1 files remain for retained code/tests; do not remove them indiscriminately.

### File map

| Path | Responsibility |
| --- | --- |
| `public-app/main.tsx`, `home.tsx` | React entry, account/route dispatch, logged-out home |
| `public-app/auth.tsx`, `supabase.ts` | Supabase sessions, confirmation/recovery UI, server cookie synchronization |
| `public-app/player-home.tsx` | Authenticated setup, queue, direct battle start, modal Theatre arena |
| `public-app/player-home.css`, `compact-dashboard.css`, `public.css` | Approved dashboard and responsive styling |
| `public-app/battle-settings.tsx`, `battle-audio-settings.tsx` | Mode-aware settings and audio presets |
| `public-app/catalog.ts`, `queue-scores.ts`, `music-updates.ts` | Lightweight catalog, score preloading, publication refresh |
| `public-app/admin-music.tsx`, `music-service.ts` | MUSIC_ADMIN publishing UI and server access checks |
| `public-app/api.ts`, `postgres.ts` | Shared authenticated API and PostgreSQL adapter |
| `public-app/server.ts`, `worker.ts` | Node adapter / Cloudflare adapter; Worker pools are request-scoped, retained for SSE lifetime |
| `public-app/creator-*`, `creator.css` | Separate admin Creator Studio, settings, capabilities and recording composition |
| `public-app/vite.config.ts`, `build*.mjs`, `private-music-build.ts` | Client/server builds, asset allowlist, private-score exclusion, Pages packaging |
| `public-app/brand-emblem.tsx`, `branding-metadata.ts`, `index.html` | Approved emblem, initial-response social metadata, canonical URL |
| `hosted/sight-reading.tsx`, `sight-library.ts`, `schmitt-chain.ts` | Practice controller, notation data helpers, exercise/loop chain planning |
| `hosted/game-client.ts`, `game-core.ts`, `service.ts`, `game-service.ts` | Client state, evaluator/progression, authenticated persistence and idempotent rewards |
| `hosted/boss-battle.ts`, `boss-config.ts`, `battle-modes.ts`, `boss-registry.ts` | Battle reducer, difficulty, musical-time budgets, bosses |
| `hosted/battle-stage.tsx`, `battle-layout.ts`, `battle-animation-*`, `battle-timeline.ts` | Canvas combat, sprite library/director, contact geometry and timing |
| `hosted/battle-cinematic*`, `cinematic-presentation.ts` | Result lifecycle and restored visual definitions |
| `hosted/battle-pressure*`, `battle-story*` | Hesitation reactions and lightweight battle story direction |
| `hosted/battle-audio*`, `battle-sample-plan.ts`, `player-audio.ts` | Web Audio, approved samples, cue timing, player/audience ownership |
| `hosted/obs.tsx`, `obs-direct.ts`, `obs-service.ts`, `obs-signaling.ts` | Snapshot publishing, fast peer transport, cloud fallback, reconnect/signaling |
| `hosted/obs-score*`, `shorts-*`, `shorts-view.tsx` | Recording notation, vertical presentation and Shorts support |
| `hosted/request-backoff.ts` | Bounded exponential outage retries; no normal-playback timing changes |
| `hosted/public/battle`, `audio`, `branding` | Shipped sprites, approved audio, transparent logo/favicons/social art |
| `hosted/public/scores`, `source-scores`, `catalog-seed.json` | Source/private music; not a public static-score library |
| `src/` | Shared music/MIDI/notation primitives plus retained Next.js authoring source |
| `supabase/migrations`, `supabase/verification` | Public schema/seed/publication/Creator SQL and security checks |
| `drizzle/`, `postgres/`, `hosted/build.mjs` | Legacy adapters/fixtures; not the public production deploy path |
| `tests/public-browser`, `tests/public-postgres.test.ts`, `tests/creator-service.test.ts` | Public UI fixtures, SQL/RLS and Creator coverage |
| `docs/` | Gameplay/animation/audio implementation history and provenance |
| `.local/`, `test-results/`, `.wrangler/`, `dist/`, `.env` | Ignored local state/builds/evidence/secrets; not portable source |

## 3. Approved product and design decisions

- Brand: **Piano Boss Battles**. Dark cinematic navy, cyan accents, bold white
  wordmark. Use the actual approved transparent piano-keys/crossed-swords emblem,
  not a Roman numeral, invented replacement, or unrelated logo.
- Emblem assets are in `hosted/public/branding`; header uses `emblem-128.png` and
  `emblem-256.png`. Favicons and Apple touch icon ship through the build allowlist.
- Sharing tagline: **Play Music. Defeat Bosses.** Canonical/OG page identity is
  always `https://www.pianobossbattles.com/`; `PUBLIC_ASSET_ORIGIN` only changes
  the absolute social-image asset origin for a preview build. Metadata is in initial HTML.
- Recording branding: subtle red YouTube icon + **@PianoBossBattles**, no extra tagline.
- Compact, readable UI, few steps. Latest branch removes the intermediate Battle
  Preview page: setup -> **Start Battle** -> native dialog arena -> automatic countdown.
  Old `?view=preview` links resolve to setup. Escape/Back to setup pauses; Resume
  Battle preserves the attempt/countdown; End Battle stops it. Score remains mounted.
- The normal learner's music must stay readable. Creator Studio prioritizes large,
  close-up action with compact notation. Never crop notation to enlarge it.
- Horizontal Creator view stacks a full-width arena above full-width notation;
  compact title band, side-by-side HUDs/fighters. Arena defaults to 68% of content,
  adjustable 55–75%. Legacy 22% battle/sidebar requirements are historical for
  earlier layouts, not a direction to undo this approved Creator composition.
- Preserve the existing vertical composition and separate transparent camera area.
  Physical keyboard camera is always a separate OBS source, never website capture.
- Original Victory/Defeat art/staging was restored at the owner's request. Do not
  reintroduce the rejected V11 result choreography. See
  [cinematic-visual-restoration.md](cinematic-visual-restoration.md).
- Character motion uses canvas sprite clips plus procedural positioning/contact
  effects. Visible artwork bounds, foot registration and shadows matter. Preserve
  apparent scale; do not shrink attacks to avoid body overlap. Do not describe
  metadata/timing changes as visually improved without matching rendered comparisons.
- Prefer small, shared implementations, no unsolicited redesigns/refactors/new dependencies.

### Personal display/audio preferences

Notation presets: Studio Light (new-player default, `#FFFFFF`), Classic Paper
(`#F7F3E8`), Slate Focus (`#D6E2EE`), Night Mode (`#091727`). They affect appearance
only, use the existing renderer, and persist through user settings. Personal
notation changes must not silently alter recording-specific appearance. No CSS inversion.

Battle Audio: Focus (new-player default, mute player effects), Immersive (quieter
effects), Cinematic (full configured mix). Volume appears when enabled; explicit
Test Sound/audition is allowed. Technical routing stays in collapsed advanced settings.
Never mute the physical piano. Creator controls are silent except explicit audition.
Exactly one designated audience source (normally horizontal) plays effects; second
OBS source silent. Monitor Off; route the same channel to horizontal and Aitum
recording tracks. Actual output recordings still require manual verification.

## 4. Important functional invariants

- Modes: Practice (self-paced, no battle pressure), Survival (HP/mistake damage),
  Time Attack (BPM/musical-duration-based time budget), Ultimate Boss (both HP and
  clock, with existing shields/enrage). Zero HP -> DEFEAT; zero time -> TIME OUT;
  victory requires the entire selected run completed while its mode constraints hold.
- Current common difficulty damage: Easy 2, Normal 4, Hard 6, Expert 10 HP per
  mistake, 30 player HP default. Legacy saved Brutal/One-hit values are supported.
  Preserve formulas/configuration rather than hard-coding UI-only behavior.
- Time Attack can progress 60 -> 80 -> 110 -> 140 BPM across loops. This saved
  preference must not accidentally shorten Ultimate Boss's full-run timer.
- Loops are bounded 1–100. Battle HP/progress span the entire chain/selected loops;
  no intermediate victory, battle reset, new title screen, or extra countdown.
- Countdown is tied to attempt/session identity. MIDI evaluation, damage and game
  clocks stay gated until FIGHT; resume/reconnect/measure changes do not restart it.
- Only valid evaluated exercise notes award damage/progress. Animation queues can
  combine rapid notes, but evaluation must remain synchronous and rewards idempotent.
- Full score bounds include clefs, beams, ledger lines, fingerings, both staves,
  etc. Fit with contain and safety padding. No stale final-note orphan on Schmitt
  boundaries. Preload chain scores before start; guard exercise/pass/render tokens.
- Victory, Defeat and TIME OUT animate once and hold indefinitely. New exercise,
  explicit restart/new attempt, Boss OFF or supported manual dismissal clears them.
  MIDI activity/focus/achievements/elapsed time do not. Reconnect restores holding
  without duplicate rewards or animation entrance. Score remains mounted underneath.
- Suppress duplicate compact result messages during cinematics. Defer achievement
  cosmetics while held; resume/discard stale cosmetics according to existing policy,
  never discard earned records. Keep TIME OUT visual definitions unchanged.
- MUSIC_ADMIN account: owner `aaron.r.tucker@outlook.com`, granted through trusted
  server roles. `/admin/music` is linked in that account. Collection/piece publishing
  propagates across the site; server authorization is mandatory, not UI hiding alone.
- Catalog returns metadata, not every note/XML definition. Selected chain scores
  load via authenticated publication checks with bounded concurrency before start.
  Bundler blocks private music data; static `/scores/` must not expose unpublished content.
- Player profiles, XP/levels, records, achievements, attempts and bests are server
  persisted. Local queued changes must not be cleared to fix a transient storage error.

## 5. Hosting, identities and release state

Read-only Cloudflare inspection on 2026-10-21 confirmed the following. Deployment
success here means Cloudflare accepted the artifact, not that every live feature was retested.

| Target | Project / branch | Latest deployment at handoff |
| --- | --- | --- |
| Public production | Pages `pianobossbattles`, deployment branch `production` | `0b2d7346-c0a5-490e-92d3-3037e5d9ae15`, source `76f3752` |
| Creator preview — removed | Deleted project `pianobossbattles-preview` | Historical: `4266857e-bb7d-45d9-ba93-dc654381ef02`, source `ab63a2f` |
| Older public preview — removed | Deleted with the same project | No active preview alias |

- Public: https://www.pianobossbattles.com/
- Retired Creator URL: https://feature-creator-studio-v1.pianobossbattles-preview.pages.dev/
- Retired older preview URL: https://feature-end-user-website-v1.pianobossbattles-preview.pages.dev/
- GitHub integration: **none on either Pages project**. Git pushes do not deploy.
- Preview project reserves `main` as production branch; do not deploy there accidentally.
- Cloudflare account ID: `c5fd2cb61b7bd05dac120e8f23d303a6`.
- Public Supabase project: `huxmltjtovpxxxupuxdg`,
  `https://huxmltjtovpxxxupuxdg.supabase.co`.
- Hyperdrive: `pianobossbattles-preview`, ID `f4dddfd90fcf4d7c9ac1d748fd77eeef`.
  Despite its name, this resource serves **production** and must remain in place.
  The deleted preview used the same public DB; its deletion did not delete player data.
- Original ChatGPT-hosted PianoPath/Learn Piano Fast and D1 remain separate.
- Migrations `202610200001` through `202610200005` were applied with authorization.
  Initial players/catalog, music publication/visibility, then Creator tables.
  Verify remote history before future changes. Creator tables have RLS and no
  browser-role grants; read-only viewer access is through the server.

### Auth, email and security state

Supabase email/password registration, confirmation, secure sessions and recovery
are implemented. Owner confirmed real password recovery after configuring **Resend
custom SMTP** (`smtp.resend.com`, sender `accounts@pianobossbattles.com`). Domain
verification and working email DNS are complete; Cloudflare Email Routing sends
accounts@ and support@ to the owner's verified Outlook inbox. Do not revert to
default Supabase email or report recovery blocked by its old limit. Owner also
confirmed non-team signup, physical MIDI on preview, and production saved progress.

Supabase project URL/publishable key are browser-safe; DB credentials are not.
Server verifies confirmed Auth users and trusted roles, rejects foreign mutation
origins, uses secure HttpOnly session cookies, and routes all progression writes
through validation. RLS protects player-owned tables; browser direct XP writes are
not allowed. Never grant broad table access or trust a browser-supplied player ID.

Creator Studio `/creator` requires MUSIC_ADMIN. `/creator/obs/horizontal` and
`/creator/obs/vertical` use expiring, revocable 256-bit capability links: fragment
exchanged for scoped HttpOnly cookie, hash stored server-side. Links are secrets.
Viewers have no MIDI access, no gameplay writes, no arbitrary private account reads.
Only one controller tab should own the active session.

## 6. Run and verify locally

Use Node 22-compatible tooling and the committed lockfile. Preserve the existing
ignored `.env`; see [`.env.example`](../.env.example). Do not print it in tool output.
It supplies browser-safe `VITE_SUPABASE_*`, local `APP_ORIGIN`, `PORT=8788`, and
server-only `DATABASE_URL` plus optional `DATABASE_SSL_CA_FILE`. TLS validation stays on.

```powershell
# From the repository root; npm ci is for a fresh/missing dependency installation.
npm ci
npm run dev:api
# In a second terminal, same directory:
npm run dev
```

Open `http://localhost:5173/`; `/api` proxies to `127.0.0.1:8788`. Local use normally
targets the real public Supabase DB, not a disposable database. Do not seed/reset it.
Sign in on the website; passwords/tokens never belong in chat. PKCE confirmation/
reset links should open in the browser that requested them. CLI login does not
provide the application's DB password. On another machine, the owner must configure
ignored local credentials securely; `.env.example` is only a template.

```powershell
npm test
npm run typecheck
# ESLint: pass only files changed by the task when unrelated legacy warnings exist.
npx eslint path/to/changed-file.ts
# API + Vite must already be running:
npm run test:public-browser
npm run build:preview
```

`npm test` prepares a legacy Worker fixture before Vitest. PostgreSQL/RLS tests
use disposable PGlite; some network suites use local Miniflare. Browser fixtures
mock accounts/API and simulate MIDI. Do not mistake those for actual production
email, real piano, Supabase persistence, OBS/Aitum recordings, or hardware 60 FPS.
Do not weaken network/approval restrictions to make a test run.

Latest application-change verification (`ab63a2f`): 16 focused unit/service tests,
5 Creator browser tests, TypeScript, changed-file lint and Pages build passed.
Browser test simulates storage failure/recovery. Earlier single-page change:
28 player + 4 Creator browser tests, then focused direct-start/viewport checks.
Historical full public suite: 475 tests after the catalog CPU fix; **not a fresh
full-suite pass for the latest branch**. Documentation-only handoff does not warrant
rerunning live queries or asserting fresh gameplay verification.

## 7. Deployment runbook — only when authorized

First inspect status/branch, review diff, run relevant checks, commit and push the
exact reviewed release. Confirm account/project/origin/binding before deployment.
Never use a stale `dist/client` from another origin. Vite builds the client and Node
server; `build:preview` additionally bundles the Worker and writes `_worker.js`,
`_headers`, `_routes.json`. Only `/api/*` enters the Worker. No private music or
DB secrets may enter static assets. `/api/health` checks configuration only, not DB.

### Historical Creator preview — retired, do not run

The project below no longer exists. Retained configuration/scripts are historical;
do not run this workflow or the ignored Creator upload helper without a new request.

Use the dedicated config `public-app/creator-preview/wrangler.jsonc`, which binds
the exact Creator alias origin. The generic `npm run deploy:preview` rejects this
branch intentionally and is not the Creator workflow.

```powershell
# Working directory: repository root; after review/checks/commit/push.
$env:PUBLIC_ASSET_ORIGIN='https://feature-creator-studio-v1.pianobossbattles-preview.pages.dev'
npm run build:preview
$env:CLOUDFLARE_ACCOUNT_ID='c5fd2cb61b7bd05dac120e8f23d303a6'
npx wrangler pages deploy --cwd public-app/creator-preview --project-name pianobossbattles-preview --branch feature/creator-studio-v1 --commit-dirty=false
```

Before release, verify clean Git and `HEAD` matches the pushed branch. Wrangler
normally uses local CLI authorization (`npx wrangler whoami`; interactive
`npx wrangler login` if needed). Do not request tokens/passwords in chat.

Past Windows uploads intermittently failed in Wrangler's HTTP transport. A local,
ignored native-fetch helper was used with the same authentication and a strict
Creator target guard (`.local/creator-studio/prepare-upload.mjs`, generated file in
`node_modules`). It is not portable, not part of the repository release workflow,
and can disappear on `npm ci`. Try standard Wrangler first. Inspect transport
failures separately from code failures; do not disable TLS, bypass approval/security
controls, or assume a patched dependency will exist in a new clone.

### Public production

Current checked-out Creator changes are **not approved as a production release**.
Existing production helper requires `feature/end-user-website-v1`, clean/pushed
HEAD and explicit `--confirm-production`. Do not change branch/guard merely to
force Creator into production; obtain release direction and review the promotion.

For an approved public release on the supported release branch:

```powershell
Remove-Item Env:PUBLIC_ASSET_ORIGIN -ErrorAction SilentlyContinue
npm run build:preview
npm run deploy:production -- --confirm-production
```

The helper uses **`public-app/production/wrangler.jsonc`**, project `pianobossbattles`,
deployment branch `production`, exact production APP_ORIGIN and existing binding.
Do not deploy production with the root preview config: it previously produced 503
by overwriting required bindings. Do not merge main, reconnect DNS, or change SMTP
as part of ordinary application release. Root `wrangler.preview.jsonc` bundles the
Worker; its old workers.dev preview experiments are not the live website target.

After any authorized deployment: capture deployment ID/commit, verify initial HTML,
matching asset version, static asset responses, actual authenticated DB/progress,
origin/authorization protections, relevant gameplay/OBS views. A 200 health response
or a success banner alone is insufficient. Never claim live audio works without
recordings. Application rollback uses a known-good production deployment in the
production Pages project; this does not restore a database. Bad early production
builds `b8e83290`/`89529576` are not verified rollback targets. Preserve current
preview and original app during releases/rollbacks.

## 8. Current incident and outstanding work

### Historical incident: Hyperdrive quota exhaustion (Paid now active)

Owner received Cloudflare email confirming the **100,000 queries/day** limit was
exhausted. Requests failed with `Connection terminated unexpectedly`; UI showed
“Player storage is unavailable. Your unsaved gameplay stays queued locally.”
Direct Supabase `SELECT 1` succeeded during investigation. Quota exhaustion, not
proven data loss or incorrect auth, explains that observed outage. Production and
preview share the binding, so both may be affected. Recovery has **not been
live-verified since the quota reset** at the time of that report. This is historical:
Workers Paid and actual production storage recovery are now confirmed above.

Cloudflare documents reset at 00:00 UTC (5 p.m. Pacific during daylight saving;
4 p.m. standard time). Recheck current account usage/plan before further diagnosis:
https://developers.cloudflare.com/hyperdrive/platform/pricing/

`ab63a2f` adds exponential failure backoff (3s, 6s, 12s, 24s, 48s, capped 60s)
for overlay cloud requests, publisher handshake and automatic catalog refresh.
Successful live timing is unchanged. The fix was deployed only to the now-deleted
Creator preview and remains in source; it is **not live in production** and cannot
lift the quota block. Close unused OBS sources and avoid load probes.

The original next task was to audit/reduce **successful** background SQL traffic, not just
failure retries. Catalog checks every 2s, Creator cloud reads roughly every 500ms,
publisher/signaling and legacy SSE also generate queries; multiple layouts/tabs can
multiply them. Cached Hyperdrive queries still count toward the limit. Consider
less frequent recoverable snapshots/authorization checks with immediate peer data,
event-driven publication refresh, and measured query budgets. Preserve revocation,
privacy, reconnect reliability and frame-accurate MIDI/audio; do not blindly slow
the game loop or enable stale caches for auth/permissions. The targeted account-write
and unchanged-OBS-stat optimizations are described above; broader event-driven
transport redesign remains future work. Any further paid-service change requires approval.

### Remaining validation/operations

- Production dashboard recovery and new saved note checkpoints were confirmed after
  upgrading. Still verify a newly earned result across refresh/logout/login on the
  next released build; preserve retained pending changes.
- Creator native OBS/Aitum: record both outputs, check one audio owner, Monitor Off,
  shared track inclusion, no duplicate sounds, reconnect/holding scenes, sustained
  performance. Fixture screenshots/audio starts are not completed recordings.
- Confirm fresh two-real-account privacy/admin UI checks if required for a release.
  Historical live SQL role-impersonation isolation passed and rolled back; do not
  represent that alone as two separate current browser accounts.
- Backups/restore drill, ongoing error/quota monitoring, rollback practice and
  production load budget need operational confirmation. Do not claim these exist
  from a deployment success response.
- Confirm public privacy policy, terms, account-deletion process and full music/art
  licensing before widening access. Older library contains repertoire that may not
  be public-domain; do not publish every stored score indiscriminately.
- Approved Sonniss sample edits/provenance live in `hosted/battle-samples.json`,
  `tests/fixtures/sonniss-approvals.json`, [battle-audio-sonniss.md](battle-audio-sonniss.md).
  Full extracted libraries remain outside the repo. Never copy the entire library,
  replace approved sounds, redistribute source packs, or publish new sounds without approval.
- Existing Vite config/import and Verovio externalization notices are non-blocking
  build warnings; not evidence of the Hyperdrive outage.
- Local CLI/browser login, ignored `.env`, patched upload helper, and screenshots do
  not transfer with Git. Reauthorize interactively if needed. Never copy sessions.

## 9. Fresh-conversation starter

Open this repository directory as the local project in Codex and start a **new
conversation in that project**, using the existing checkout. Do not create a new
empty repository or start from a remote default branch accidentally. If choosing
a worktree, explicitly use `feature/creator-studio-v1`; configure ignored local
environment securely because worktrees/clones may not include it.

Suggested first message:

> Continue Piano Boss Battles in this repository. Read AGENTS.md and
> docs/project-handoff.md first, inspect Git status and branch, and summarize the
> current production state, retired preview hosting and Hyperdrive incident before editing.
> Preserve the original ChatGPT/D1 app and all existing gameplay. Work on
> feature/creator-studio-v1. Do not deploy or change infrastructure until I request
> the specific release. My next task is: [describe task].

When a release is wanted, explicitly authorize **public production** after local testing.
Preview hosting has been removed; do not recreate it without a new request.
The new agent can use the runbook and existing CLI authorization, or request secure
interactive login. Past production approvals are not standing permission for all
future changes. If infrastructure/network approval blocks execution, report the
specific blocker; do not claim deployment success or weaken security controls.

Official context on repository instructions and project workflows:
https://developers.openai.com/codex/guides/agents-md
and https://developers.openai.com/codex/app/features .
