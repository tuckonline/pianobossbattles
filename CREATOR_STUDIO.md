# Creator Studio V1

Branch: `feature/creator-studio-v1`. No production or preview deployment is part
of this change until the owner approves it. The existing public navigation,
Theatre Mode, legacy OBS routes, authentication, and audio preferences remain.

## Routes and ownership

- `/creator`: Supabase-signed-in MUSIC_ADMIN only. Server verifies the trusted
  roles table before mounting the controller and on every creator API request.
- `/creator/obs/horizontal`: 1920 × 750; separate OBS camera below it.
- `/creator/obs/vertical`: 1080 × 1920; transparent camera reservation at bottom.

Studio reuses SightReading, GameClient, BattleSettings, the music catalog, score
preloader, MIDI setup, battle reducer, animation director, story notices, and
cinematic controller. Only Studio evaluates MIDI and persists progress. Keep one
active controller tab. The monitor itself does not own combat audio.

The existing overlay publisher and WebRTC viewer use a separate creator endpoint
and storage namespace. Local/LAN peer transport remains the fast path. The
recoverable snapshot is polled every 500 ms when direct transport is unavailable;
this is also the authorization/revocation check. No new game clock or evaluator
is created in a presentation page. Link revocation closes peers at the next
successful authorization check. On authorization/network failure, Creator views close the peer and clear the
presentation until a successful access check restores the snapshot. A failed
request is bounded by the existing eight-second network timeout.

The existing contact-synchronized HP presentation remains during attacks. Creator
views show authoritative HP when paused/offline so an interrupted visual combo
cannot leave different frozen health values on the two outputs.

## Storage activation (pending owner approval)

Migration `supabase/migrations/202610200005_creator_studio.sql` adds only
`creator_sessions` and `creator_peers`. Both enable RLS and revoke all browser-role
grants, matching existing server-only runtime storage. Existing player policies,
tables, data, auth configuration, and D1 are not modified. Preferences, including battle mode/boss/difficulty, are separate
from player choices. Creator game responses merge only the scoped battle config;
all progress commands still execute the original authenticated service. Database integration tests execute the
migration in disposable PGlite PostgreSQL, not the live Supabase project.

Before enabling this on the real local account or preview, review the migration,
confirm project `huxmltjtovpxxxupuxdg`, then use the existing authenticated Supabase
CLI workflow: `supabase migration list`, `supabase db push --dry-run`, inspect the
pending list, and `supabase db push` only after authorization. Never reset linked
storage. Do not place a database URL, service key, or access token in OBS.

## Viewing links

Create links from Studio. Each link contains a 256-bit random read-only capability
in a URL fragment. The browser exchanges it for a Secure (HTTPS), HttpOnly,
SameSite=Strict cookie scoped to `/api/creator/view`, then removes the fragment.
Only a SHA-256 hash is stored. Links expire after 30 days. Rotation/revocation
invalidates existing cookies and signaling. Reopening OBS's original configured
URL exchanges its fragment again; ordinary refresh works with the scoped cookie.

Viewers can read only the current creator snapshot and current/next score, and
submit a WebRTC offer/read its answer. They cannot submit publisher answers,
mutate gameplay, read arbitrary catalog scores, use admin APIs, or read player
profiles/history. Snapshots intentionally include public battle/achievement
presentation but no account ID, email, profile, or private history. No credentials
appear in query strings. Do not share the complete viewing link publicly.

## OBS and Aitum audio verification

Choose exactly one audience owner in Studio; horizontal is the default. Browser
previews stay silent unless deliberately opened with `?battleAudio=1` for testing.
Native OBS is detected through its existing `obsstudio` integration.

1. Enable **Control audio via OBS** on the designated Browser Source.
2. Unmute that channel; set Advanced Audio Properties → **Monitor Off**.
3. Route that mixer channel to the horizontal recording track.
4. Configure Aitum Vertical to include that same source/track in its recording.
   Aitum version/settings determine the mapping; do not assume automatic sharing.
5. Leave the second Browser Source silent. Do not also capture a monitored copy
   through Desktop Audio. Piano audio comes from the existing independent source.
6. If OBS blocks Web Audio, use Interact and click inside the source once.
7. Record short horizontal and vertical samples; listen to each independently,
   including rapid notes, a wrong note, and a result. Confirm one sound per cue,
   no combat effects in the performer's monitors, and the intended piano balance.

Browser audio tests instrument Web Audio starts and exercise owner switching,
refresh, silence in Studio, and explicit audition. They do **not** certify native
OBS mixer routing, Aitum recording tracks, physical MIDI hardware, or acoustic
piano audibility. Those remain manual checks after activation.

## Release and rollback

The existing preview deploy script intentionally permits only the approved older
branch; do not bypass its guard silently. After approval, explicitly deploy this
reviewed branch to the isolated `pianobossbattles-preview` project with a creator
branch alias (never the production project), retaining the existing preview.
Build with `PUBLIC_ASSET_ORIGIN` set to that isolated preview URL. Production
requires separate approval. No DNS or auth redirect changes are required.
Rollback the application deployment to the prior verified build if necessary;
the unused additive creator tables may safely remain, with no player data loss.

## Verification — 2026-10-20

- Full public browser regression suite: 32 passed before the final creator-only
  battle-preference isolation. All four Creator browser tests passed again after
  that final change and explicit sound-audition fix.
- Focused PostgreSQL, music access, mode settings, Worker, and Creator tests:
  28 passed across five files, including RLS/grants, scoped settings, revocation,
  and read-only viewing capabilities.
- TypeScript, changed-file ESLint, production/preview build, and Worker dry run:
  passed. Existing Vite configuration/import warnings remain non-blocking.
- Horizontal and vertical screenshots inspected; both bosses and all three held
  terminal scenes exercised. Local evidence: `.local/creator-studio/`.
- Browser tests use disposable/mocked state and MIDI events. Live Supabase creator
  activation, physical MIDI, native OBS/Aitum recordings, and hardware 60 FPS
  performance remain unverified. No deployment or live migration was performed.

## Preview activation authorization

Owner authorized the additive migration and isolated preview on 2026-10-20.
Supabase CLI confirmed project huxmltjtovpxxxupuxdg and only migration
202610200005 pending, then applied it successfully. Creator preview uses the
explicit public-app/creator-preview/wrangler.jsonc configuration and branch
feature/creator-studio-v1 in pianobossbattles-preview. This provides its exact
APP_ORIGIN with the existing secure Hyperdrive binding. No production settings,
DNS, SMTP, or authentication configuration changes are required.

Horizontal layout refinement: arena now spans the recording width above the
notation, with player/boss HUDs side by side. Horizontal arena height defaults
55% of content and is adjustable 40–65%; older width preferences are ignored.
Vertical framing and camera allocation are unchanged. Four Creator browser tests,
five service tests, TypeScript, changed-file lint, and preview build passed.

Action-first horizontal refinement: compact 7% title band, 60px HUD, and 68%
content allocation to the arena (adjustable 55–75%). A new horizontal-only
side-by-side fitting option removes the legacy combined-height constraint;
closer normalized idle anchors keep both fighters prominent. Shorts retains its
original fitting path. Complete notation is contained in the compact lower strip.
Four Creator browser tests, 28 layout/contact/service tests, TypeScript, lint,
and preview build passed; horizontal capture inspected before publishing preview.

## Single-page player flow

The public player UI now uses setup → Start Battle → modal arena, with no preview
page or step navigation. Legacy ?view=preview links resolve to setup. The native
dialog keeps focus inside the arena; Escape/Back to setup pauses the existing
attempt, and Resume Battle reopens it without another countdown. End Battle
returns to setup. The score remains mounted, and the original evaluator,
authorization, countdown, loop handling, rewards, and audio owner logic are reused.
Notation presets and time estimates are available directly on setup.

Verification: all 28 player browser tests and four Creator tests passed. After
final spacing/HP visibility fixes, the direct-start and three viewport tests
passed again. Also passed 22 mode/layout/Worker tests, TypeScript, changed-file
lint, production build, and preview Worker dry run. Screenshots inspected at
1366×768, 1440×900, and 1920×1080. Production is not part of this release.
