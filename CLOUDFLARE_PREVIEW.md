# Cloudflare preview

> Current status and deployment procedure: [docs/project-handoff.md](docs/project-handoff.md).
> This file includes chronological implementation notes. Earlier pending-approval
> and deployment statements are historical where superseded in the handoff.

This deployment uses a **Cloudflare Pages feature-branch preview** with an
advanced-mode Worker backend, not a production deployment, Git integration, or
the original ChatGPT-hosted app. The feature branch is
`feature/end-user-website-v1`. Do not connect a custom domain or merge to main.

## Runtime and deployment

The Vite SPA uses Cloudflare Static Assets. A small Node-compatible Worker invokes
the same authenticated API, PostgreSQL adapter, scoring service and OBS handlers
as the local Node server. OBS SSE connections retain their database pool until
the stream ends or is cancelled. The presentation routes do not create MIDI
evaluators.

Build: `npm run build:preview`

Deploy the preview only: `npm run deploy:preview`

Configuration: `wrangler.jsonc`; Pages project `pianobossbattles-preview`, branch
`feature/end-user-website-v1`. The project reserves `main` as its production
branch, but has no Git integration and no production deployment. The deployment
script rejects other branches and dirty working trees. Auth and Hyperdrive
bindings exist only in the preview environment.

`wrangler.preview.jsonc` also supplies the Worker bundling settings for the dry-run
build. Initial Worker Previews and a version preview uploaded successfully, but
returned platform 404 responses; neither was promoted to production. Their
workers.dev production endpoint remains disabled. Pages uses the identical
Worker code and the same isolated Hyperdrive connection.

Hyperdrive `pianobossbattles-preview` stores the database credentials server-side.
It connects to the new Supabase project through its session pooler with
`verify-full` and the official Supabase Root 2021 CA. Query caching is disabled.
The original D1 database is not bound or modified. The public publishable key is
intentionally included in the SPA; no privileged Supabase key is used.

The local `.env`, certificate setup and Wrangler credentials remain ignored.
Do not put `DATABASE_URL` or database passwords in Vite variables, CLI arguments,
Wrangler configuration, browser assets, or Git. Preview API responses are private
and uncacheable; preview pages advertise `noindex, nofollow` (not access control).
Authentication and email verification are still required to access player data.

## Auth redirects

The exact stable preview root and `/?recovery=1` callback are added to Supabase's
allowlist. Existing localhost and production-domain entries are preserved; Site
URL remains localhost during local testing. Unique per-deployment URLs are not
auth callback destinations. Use the stable preview URL for sign-in and testing.

## Current limited-beta release authorization

Updated from the owner's latest manual verification. This section supersedes older
email and device-testing statements below and in earlier setup notes.

**Completed, owner-confirmed:** Resend account and pianobossbattles.com sending-domain
verification; DKIM and sending records verified; Supabase custom SMTP at
smtp.resend.com using accounts@pianobossbattles.com; real password-reset email,
password change and successful recovery; physical MIDI gameplay on the Cloudflare
preview; Cloudflare Email Routing for accounts@ and support@ to the verified
Outlook inbox. The owner subsequently confirmed registration with a new email
address worked and supplied a screenshot of the signed-in new player dashboard.
Non-team registration/confirmation is therefore recorded as owner-confirmed passed.
These steps are complete, not remaining blockers. No SMTP credential,
Resend configuration or email DNS changes are required or authorized by this report.

The current approved preview is deployed at commit ee1cba2. Its 474 unit/database
and 23 local browser tests passed, as did TypeScript, changed-file lint and build.
Post-deployment audio/notation checks passed after rechecking two loading-sensitive
failures. Fixture tests do not replace the remaining real-account checks.

Remaining launch gates:

1. **New earned progress:** complete a real MIDI battle on preview, record the
   resulting XP/history/personal best, log out and back in, and confirm it persists.
   Existing saved-progress restoration and physical MIDI playback are already
   confirmed; the combined new-write/re-login scenario remains unverified.
2. **Two real accounts:** verify private progress/OBS-state isolation and that a
   normal account cannot use admin publication endpoints. Existing live SQL RLS
   isolation and automated permission tests passed; real browser-account coverage
   is still required.
3. **Production operations/security:** review production secrets/bindings and
   origin/cookie protections, verify backup coverage and a restoration procedure,
   enable appropriate error/uptime monitoring, document/test rollback, and check
   capacity/abuse controls for the expected limited beta. Current automation is
   intentionally preview-only. Paid services and security-sensitive decisions
   require owner approval.
4. **Public readiness:** provide privacy/terms pages, support and a verified
   account-deletion process; complete a distribution-license review of the music,
   artwork and audio. Some license documents exist, but a complete release review
   has not been recorded. Do not delete an actual account as a test without consent.
5. **Production cutover:** configure exact production Auth callbacks, Site URL and
   application origin, production backend bindings, custom domain/HTTPS and the
   chosen bare-domain redirect; smoke-test registration/login/recovery and progress
   at www.pianobossbattles.com. Preserve preview and the original application.

The owner subsequently explicitly authorized production launch and requested
www.pianobossbattles.com setup. The unchecked items above remain recorded; this
authorization is not evidence that unperformed tests passed. Do not announce the
beta or invite users.

## Preview verification — 2026-10-20

Stable URL: https://feature-end-user-website-v1.pianobossbattles-preview.pages.dev/

The deployed application at commit `a494af8` passed HTTPS checks for the homepage,
`/obs/recording`, `/obs/shorts`, and `/api/health`. An unsigned player API request
returned 401; a cross-origin session write returned 403. Cloudflare reports a
successful **preview** deployment with no production deployment or Git integration.
The owner confirmed successful real-account login on the preview and that saved
player progress remained visible after refreshing the signed-in preview page.

Automated checks:

- 459 tests passed in 63 files, including four Worker-adapter tests covering
  request cleanup, SSE connection lifetime, static assets and body-size limits.
- All eight public browser tests passed against the deployed preview. These use
  explicit Supabase/game-state fixtures for UI scenarios and simulated MIDI;
  they do not prove live email delivery, physical piano input or database writes.
  Coverage includes boss selection, queue reorder, continuous loops, immediate
  scoring, pause/resume, Theatre Mode, held Victory and deliberate dismissal,
  both OBS layouts, and zero MIDI access requests from OBS presentation routes.
- The unsigned API and cross-origin rejection assertions exercise the real
  deployed backend. Their same-origin header now follows the configured test
  base URL rather than assuming localhost; the security assertions are unchanged.
- TypeScript, changed-file ESLint, production build and preview Worker bundling
  passed. A scan of 223 generated files found no local DATABASE_URL or database
  password in the output; privileged credentials are held by Hyperdrive.
- Inspected horizontal 1920x750 and vertical 1080x1920 screenshots from the
  deployed UI fixture run: fighters, branding and complete grand staff render.
  Evidence remains in ignored `test-results/public-obs-recording.png` and
  `test-results/public-obs-shorts.png`.

Still requires real-device verification: physical MIDI on the preview origin,
live OBS session/recording synchronization and audio routing, and sustained load.
The prior local saved-progress tests passed; real preview login and saved-progress
refresh recovery were confirmed by the owner. The available inspection tabs did
not share that signed-in session, so this is explicitly owner-confirmed evidence,
separate from the fixture tests. A new physical-MIDI performance saved through
the preview has not yet been verified.

**Historical status superseded:** the owner subsequently configured Resend SMTP
and completed real password recovery, as recorded in the current launch decision above.


## Production deployment workflow

Production is a separate, manually deployed Pages project, `pianobossbattles`,
with production branch label `production`. The existing `pianobossbattles-preview`
project and original ChatGPT-hosted application remain unchanged. Neither Pages
project has Git integration; a Git push alone does not publish production.

Production uses APP_ORIGIN=https://www.pianobossbattles.com and the same independent
Supabase project/Hyperdrive connection as the preview. Existing players retain
progress; no data or schema is migrated. Database credentials remain server-side
in Hyperdrive. The browser receives only the existing public Supabase settings.

After explicit release approval, run all relevant checks, then:

1. `npm run build:preview` (shared Pages/Worker packaging, not a deployment).
2. Commit and push the reviewed release to `feature/end-user-website-v1`.
3. `npm run deploy:production -- --confirm-production`.
4. Verify the custom-domain HTTPS response, matching client build, real API
   authentication/origin protections, and browser behavior before reporting success.

The deployment helper refuses dirty/unpushed releases and does not merge main.
Keep `noindex` during the limited beta; no announcements are automated.

For a later application rollback, use Cloudflare Pages > pianobossbattles >
Deployments to select a prior known-good **production** deployment and Rollback.
Verify the custom domain afterwards. This is code rollback only, not a database
restore. The initial release has no earlier production deployment; preserve its
commit/deployment ID as the first recovery baseline. Database backup/restore
validation remains a separate operational check. Never point production at a
preview deployment as an improvised rollback, and never reset the linked database.


## Historical production preparation interruption — 2026-10-20

- Both Cloudflare and the intended Supabase dashboard are signed in.
- The separate Pages project `pianobossbattles` was created with production origin,
  Supabase public settings and the existing Hyperdrive binding. No code has been
  deployed there yet, and no custom domain/DNS record has been added.
- Existing eight DNS records were inspected; all are email-related and unchanged.
  There was no existing www record. Supabase Site URL remains localhost; production
  URL changes have not been saved pending a deployable release.
- TypeScript, changed-file ESLint and Pages/Worker production packaging passed.
  A scan of 65 built client files found no local database credential value.
- A rerun with one worker and workspace-local temp files passed 440 tests; 34 tests
  could not run because five Miniflare suites hit sandbox EACCES on localhost.
  The 24 browser tests could not launch because the sandbox's Playwright browser
  executable was absent. These are infrastructure limits, not passing test results.
  Earlier full-suite results remain historical evidence, not a fresh full pass.
- Git remote access failed (`getaddrinfo() thread failed to start`) in the current
  restricted execution environment. Current release changes remain uncommitted and
  unpushed. Do not report production deployment success or bypass approvals.


## Production release candidate — 2026-10-20

Network and filesystem permissions were subsequently restored by the session.
GitHub connectivity is confirmed. All 474 tests (65 suites) now pass, including
Miniflare/local-network suites. TypeScript, changed-file lint and production
Pages/Worker build passed. Exact www root and password-recovery redirects are
added alongside the existing localhost/preview callbacks, without SMTP changes.
The branded dashboard loading fallback replaces the transient Music library
heading and retains error/retry behavior; it does not change admin permissions.

Browser verification: 23/24 passed in the full local run. The audio fixture was
returning JSON for an SSE endpoint, forcing fallback polling and stale-cue drops;
it now returns real event-stream messages and waits for the rendered battle panel
before the unlock gesture. The corrected audio/duplicate-source/reconnect case
passed twice consecutively. No production audio/gameplay behavior was changed.
All 24 browser cases therefore passed across the full run and targeted rechecks.

Production deployment uses `public-app/production/wrangler.jsonc` via explicit
Wrangler working directory. This is essential: the repository-root config contains
only preview bindings and overwrites dashboard production settings on deployment.
The initial deployment exposed this during the health check (503); the dedicated
production config supplies the exact origin, public Auth settings and existing
Hyperdrive binding. It contains no database password or privileged credentials.

## Production dashboard loading fix - 2026-10-20

The owner's real production sign-in reached the dashboard loading screen but did
not complete. Cloudflare's live deployment tail confirmed `/api/music` requests
with outcome `exceededCpu`, HTTP 503, and `Worker exceeded CPU time limit`.
Authentication requests succeeded. This was not an SMTP or redirect failure.

The catalog previously fetched and serialized all 404 exercise definitions and
score XML in one Worker invocation (12,776,056 database bytes). It now returns
library metadata only (122,055 metadata bytes), excluding note arrays and XML in
SQL before transfer to the Worker. Selected setlist entries load through the
existing authenticated, publication-checked `practiceExercise` endpoint, with
three concurrent requests at most. The complete chain is preloaded before Start
Battle is enabled, preserving synchronous scoring and transitions. Exact stored
notes/XML, gameplay engines, database schema and authentication are unchanged.
Catalog requests have bounded waits and useful retry errors, including non-JSON
infrastructure failures; score download failures also provide a retry control.

Verification: all 475 unit/database/network tests (65 suites), all 25 local
browser tests in one full run, TypeScript, changed-file ESLint and production
Pages/Worker build passed. Browser fixtures now use the lightweight catalog and
real score-loading flow. The new regression checks a delayed two-piece preload,
then immediate correct scoring across Schmitt 7 to 8 with no further score fetch.
SQL tests compare returned note data and XML with originals and retain unsigned,
unpublished-piece and administrator access checks. Browser tests use explicit
fixture identities; they are not proof of real production account recovery.

The owner must still confirm that the patched production dashboard opens and
shows saved progress. Earlier production deployments b8e83290 and 89529576 are
not verified rollback targets: the former lacked bindings and the latter has the
catalog CPU issue. Preserve the preview and original application unchanged.

Production verification after the fix: deployed commit `c941f68` as Pages
`51fe80d9-83b4-4d66-9ad9-c962e6f832d3`. The www domain serves the matching built
client hash; `/api/health` returns 200/configured, private unsigned endpoints
return 401, and both OBS routes return 200. Three focused browser regressions
passed against the deployed assets (two use mocked account/data responses; the
unsigned/cross-origin test uses the real API). The owner refreshed their real
signed-in production page and confirmed: "Dashboard opens and saved progress
appears." This verifies real production authentication and progress retrieval,
not a newly completed physical-MIDI battle on this release. Preview deployment
and configuration were compared with the pre-cutover snapshot and are unchanged.
Original hosted application, D1, SMTP and existing email DNS were not modified.
The post-fix tail did not deliver events during the observation window, so no
claim is made that production logs were exhaustively verified as error-free.
