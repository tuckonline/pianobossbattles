# Piano Boss Battles — current project context

## Production promotion — 2026-10-31

Owner explicitly requested deployment for phone/Bluetooth MIDI testing. Promoted
reviewed learning features into the existing feature/end-user-website-v1 worktree;
Creator routes/services and unrelated OBS development remain excluded. Release
includes Foundations/Beginner Lessons, guided sessions, composition/fingering,
existing practice economy/library/shop, Adventure retirement and responsive fix.
No schema, DNS, billing, auth policy or reward-rate changes during promotion.
Release-worktree TypeScript, 15 focused tests, production build/Worker dry-run and
entry/API lint pass. Prior responsive screenshots covered laptop/tablet/phone.
Physical Bluetooth transport and phone Web MIDI support remain unverified.


## Learning workspace responsive fix — local, 2026-10-31

Cause: LearningHome used realm-nav without a matching navigation rule (old styles
used realm-navigation). Global nav display:grid stretched all six buttons into
rows. The raw resume aside inherited the legacy sidebar light --surface variable,
padding and flex layout while public app text remained light. Large inherited h1
and ungrouped header/MIDI controls compounded vertical displacement.

Minimal scoped fix: new learning-home.css under .public-app .learning-workspace;
explicit dark ink/muted/surface/focus tokens, compact wrapping navigation and current
page indication, 1280px content cap, restrained headings/spacing, dark resume card
and MIDI dropdown, visible focus styling. Laptop nav is horizontal, tablet wraps,
phone <=540px is two columns. Header groups brand, gold, existing MidiSetup and
logout; MIDI remains one mounted component. No learning or playback logic changes.

Changed learning-home.tsx (classes/header grouping/aria-current), new CSS, and one
focused responsive test in realm.spec.ts. No core systems modified. Test/screenshot
review at 1366x768, 820x1180, 390x844 verifies nav geometry, primary action in initial
viewport, dark card colors, no horizontal overflow and MIDI popup inside viewport.
TypeScript, changed-file lint, production build/Worker dry-run pass. Not deployed.
User attachment was a proposed compact-layout reference, not a current-site capture.


## Level 2 Beginner Pianist — local, 2026-10-31

Four implemented units, sixteen stable beginner-*-v1 lessons in beginner.ts:
Reading Music with Confidence (treble, bass, steps/skips, both staves);
Rhythm & Musical Patterns (eighths, mixed rhythms, motifs, rhythm check);
Exploring the Keyboard (G/F positions, intervals, broken triads, accompaniment);
Becoming a Pianist (phrases, articulation, sixteen-bar study, graduation).
Shared catalog/activity types now support master activities, explicit level/unit,
optional rhythm threshold. Foundations IDs/records unchanged. UI derives unit and
level progress from persisted activity evidence instead of hardcoded six lessons.

Each Beginner lesson has short Learn text plus Discover/Practice/Apply/Independent
check. Discovery is untimed without an accuracy gate. Authored content handles
specific pitches/intervals/triads/articulation; existing V2 generates harmonic
accompaniment and phrased studies within fixed-position early Beginner profiles.
G and F activities stay in explicit positions; F-position B-flat finger 4 is tested.
Triads are sequential broken chords, not graded block chords. Study hand isolation
uses the exact same sixteen-bar piece before both hands. Graduation uses a distinct
validated seed (2603; 2602 was found identical to preparation and rejected).
Slurs/staccato dots are display-only authored XML annotations. No articulation score.

Rhythm lessons 5-8 and graduation reuse RealmPerformance with lessonMode labels,
existing four-beat count-in and summarize v2, unchanged clocks/tolerances/grader.
Adventure command/reward routes stay retired. Server reassesses submitted timed
MIDI against the catalog exercise at submitted 40-160 BPM. Pitch and rhythm minima
must pass in ONE attempt; best metrics separately cannot combine into mastery.
General practice 75%, application 80%, independent 80%, unit checks 85% pitch;
timed checks additionally require 70% rhythm. Untimed hands now follow the actual
exercise hand selection rather than assuming right. Note-off/artistry/finger use
are not certified. Graduation communicates measured competence, not professional
or comprehensive Beginner qualification.

Progress uses the same transaction and idempotent receipt table; unit/level status
is derived from saved activities. No migration, new backend, economy formula or
completion gold. Existing practice meter serves both player variants. Core lessons
remain free. Supported Infinite links cover reading/rhythm/phrases; no targeted
interval/chord/articulation generation claims. Fingering preferences unchanged.

Added beginner.ts and curriculum/performance.ts adapter. Updated catalog.ts,
lesson-service.ts, learning-home.tsx, realm-performance.tsx (presentation flag only),
tests/lessons.test.ts, focused browser test, continuity docs. No composition engine,
MIDI matching, notation renderer, audio engine or economy edits.

Validation: 15 focused lesson/session/economy tests pass, covering all 82 activities
across Foundations + Beginner, all four units, valid measures/XML/fingers, left-hand
and simultaneous-hand pitch targets, explicit intervals/triads, subdivision values,
distinct assessment, same-study isolation, all progression saves/idempotency,
slower timed graduation and rejection of pitch-only timing evidence. One bounded
browser test checks all unit titles, introductory MIDI completion and refresh.
TypeScript, changed-file lint and production build/Worker dry-run pass. Local API
restarted; not deployed. Physical MIDI/audio/count-in/reconnect/scroll evaluation
remains with owner. Offline unsaved evidence still requires Retry Save before leaving.
No extensive browser campaign or live fixture writes.


## Lessons replaces Adventure — local, 2026-10-31

LearningHome is the default authenticated workspace. Navigation: Home, Lessons,
Infinite Practice, Music Library, Music Shop, Progress. Signed-out copy is learning
focused. RealmHome/cinematics remain source archives, not imported by the default
app; cinematic files are no longer copied into new public builds. Existing legacy
battle route remains separate. /api/realms state reads remain compatible; begin and
finish reject with 410 so stale clients cannot award Adventure bonuses. Historical
records, source assets, purchases and reusable music infrastructure remain intact.

New curriculum/catalog.ts contains stable curriculum/level/unit/lesson/activity IDs,
six broad level outlines, and six implemented Foundations lessons: Middle C, finger
numbers, C-D-E, five notes, quarter/half notes, first performance. Each has instruction,
objective, prerequisites, position, skill identifier, authored Try/Practice/Apply
scores, and pitch-specific criteria. Application ends on a held tonic. All are free.
Later units explicitly say Not yet implemented. These are not conservatory grades.

Existing ClassicalPractice already waits for correct pitches. Reused unchanged
assessment with completed played pitches passed to the completion callback; lesson
server independently reassesses against authored music. No timing/finger/posture/
expression mastery claims. Discovery has no accuracy gate or time penalty; later
practice/application uses 75/80%, final application 85%. Finger use and rhythm are
explicitly self-checked. Best activity accuracy and attempts persist, with completion
and mastered pitch skill inferred from the declared criteria. No artificial repeat
requirement. Repeat/slower use the same music. Failed saves show Retry Save.

/api/lessons uses authenticated account identity, existing PostgreSQL game_events,
transaction/advisory lock and idempotent attempt UUIDs. Last visited lesson, activity
best/attempts and evidence receipts persist. Prerequisites are enforced server-side.
No schema migration, economy writes or completion awards. The existing active-MIDI
practice meter remains the only lesson gold path. Old realm progress is not migrated
to mastery. Reload resumes at the first activity whose criteria are not yet met;
an unfinished/unsaved activity restarts (no durable offline evidence outbox).

Lessons 3 onward offer constrained existing Infinite recipes (right hand, C major,
three/five-note learning steps). Guided Practice accepts an optional current-lesson
recipe without altering existing session checkpoints. First two lessons use authored
homepage Start Practice instead; separate Guided Practice remains accessible. Musical
content, MIDI matching/tolerances, fingering preferences, rendering, metronome and
scrolling were not rewritten. Generated practice is reinforcement, not finger or
rhythm certification.

Added: public-app/learning-home.tsx, lesson-service.ts, src/domains/curriculum/catalog.ts,
tests/lessons.test.ts. Updated home.tsx, api.ts, realm-service.ts, build.mjs,
classical-practice.tsx, practice-home.tsx/css, src/lib/platform-request.ts, focused
browser/economy tests and continuity docs. Existing Adventure browser/service tests
are historical expectations, not current navigation/award acceptance tests.

Validation: 13 targeted curriculum/session/economy tests passed, including all six
lessons, 18 activities, exact targets, valid notation/fingers, prerequisite gating,
persistence, idempotency and retired reward rejection. One focused browser test
completed Middle C through synthetic MIDI, refreshed, and opened finger numbers.
TypeScript, changed-file lint, production build and Worker dry-run passed. Local API
restarted. Not deployed. Owner should test physical MIDI, audio/scroll alignment,
reconnect and eligible gold over real elapsed practice time. No live fixture writes.


## Practice Experience 2.0 — local, 2026-10-31

Guided practice retains ClassicalPractice and its notation DOM at completion,
instead of replacing the score with a standalone results card. The stable toolbar
contains Start/Pause/Resume, Repeat, Slower, Continue (completion only), End Session.
Repeat/slower reset to preparation, never autoplay. Retry seed/music are unchanged;
slower updates tempo and checkpoint duration estimate. Current/next generated
studies are cached in the session workspace. Metronome choice survives transitions
in the mounted session, but playback still requires Start. MIDI connection remains
owned by the existing parent. No extra MIDI listener or grading engine.

Removed duplicate guided title/header and economy prose above notation. Preparation
retains title, difficulty, tempo, fingers/positions and score preview; lesson text
appears only before playing. Completion is compact with expandable details. Session
summary retains actual eligible active time, pitch results, objective and confirmed
gold. Existing gold flush is requested at completion; no new reward calculation.
Old completed checkpoints initialize a completed player without re-recording results.

Changed classical-practice.tsx, practice-home.tsx, practice-home.css and the existing
focused browser test. No generator, curriculum, Realm or economy changes.
Validation: 10 session/economy tests, one focused flow browser test covering resume,
repeat/identical music, slower/identical notes, pause/resume, score DOM retention,
all stages and end; TypeScript, changed-file lint and production build passed.
A mixed-encoding edit caught by build was corrected. No deployment.
Physical MIDI/audio still needs owner validation: metronome stop/resume, disconnect,
scroll following and real eligible practice earnings. Existing ClassicalPractice has
no separate count-in; this update preserves its metronome start behavior rather than
introducing new audio scheduling. No invented duration/accuracy/improvement metrics.


## Guided lesson coherence — local, 2026-10-31

lesson-focus.ts is a small data catalog of objectives, explanations and three
stage instructions, with eligibility and actual-score checks. New sessions store
one optional focus ID. Existing checkpoints without it retain their old flow and
seeds. No generator settings, tempo presets, MIDI or reward behavior changed.

Supported: note recognition (validated tonal study with at least two melody
pitches), and steady pulse (early steps through Beginner 2, or current Novice
profile without rhythmFocus; all score durations must be 1/2/4 beats, no ties,
4/4). All tasks are checked at assembly through the existing exercise validator.
Unsupported objectives are excluded; an incompatible generated score causes a
clear preparation error rather than silently changing difficulty or music.
Stepwise-motion drills are deferred because the current composer does not ensure
predominantly stepwise movement. No scale/arpeggio drill claims are made.

UI offers available lesson objectives in Customize, shows the objective at
preparation and results, uses related instructions for each stage, and displays a
short explanatory note before focused study. Timing remains an unscored listening
goal; completed music does not imply mastery. Existing fixed positions/fingers,
assistance preferences, phrase/cadence logic and learning steps remain intact.

Changed: new src/domains/music-generator/lesson-focus.ts; practice-session.ts,
public-app/practice-home.tsx, tests/practice-session.test.ts, continuity docs.
Validation: all four focused session tests passed (representative seeds and early
steps, both objectives, all stages, cadence/fingers, determinism and old checkpoints),
TypeScript, changed-file ESLint, production build/Worker dry-run passed. No browser
automation or physical MIDI test for this update. Not deployed.


## Play-first homepage and guided sessions — local, 2026-10-31

Default RealmHome screen is now Home; Adventure stays available (also ?mode=adventure).
The pure practice-session module assembles existing Composition V2 exercises into
warm-up/focused/application stages with 20/50/30 percent target budgets. Eight-bar
studies lead to sixteen-bar application; estimates use 4/4, actual tempo and ten
seconds per transition. Warm-up is five BPM slower, never below 40. No timer cuts
music off. Duration choices are 5/10/15 minutes. Existing ClassicalPractice owns
notation, MIDI, scrolling and completion; only an optional completion callback and
guided presentation were added. No grader or generator changes.

Recommendations reuse saved Infinite settings and three comparable guided pitch
results: all below 70% suggests previous learning step; all >=95% suggests next,
preserving tempo. Otherwise retain level. Missing settings start Novice 1. There
is no rhythm metric in the reused player, so no rhythm personalization or invented
improvement claims. Focus options accurately cover current/familiar reading only.
Fingering preferences remain shared. Recommendations are rule-based, not AI.

Account-scoped browser storage saves settings, last 60 guided results, and latest
session configuration, seeds, stage/index, attempts, timestamps and completion.
Resume restarts unfinished music from its beginning; completed attempts stay on
the transition screen. Same exercise retries preserve seed, slower retry changes
only tempo. These checkpoints/history do not sync across devices. Older Realm
results are not treated as comparable guided pitch results. No official Realm
records are written. A completed session can be reopened from Home.

Scoped usePracticeGold uses session UUID in the existing PostgreSQL game_events
practice ledger. It records active MIDI through the existing provider only; parent
meter does not receive these events. Cumulative earned is recorded transactionally
and returned via music-room-service, so retries/resume restore server-confirmed
session totals. No rate, eligibility, shop, idle reward or completion payout changes.
Pending saves are labeled separately. Existing global practice gold remains intact.

Added: src/domains/music-generator/practice-session.ts, public-app/practice-home.tsx,
public-app/practice-home.css, tests/practice-session.test.ts.
Updated: classical-practice.tsx, realm-home.tsx, player-home.tsx, practice-gold.tsx,
practice-gold-service.ts, music-room-service.ts, tests/economy.test.ts,
tests/public-browser/realm.spec.ts and continuity docs.

Validation: 8 session/economy tests passed; focused browser session test passed
through all stages, reload/resume, actual synthetic MIDI results and standalone
Infinite access; prior targeted King cinematic and learning-step tests passed.
TypeScript, changed-file ESLint and production build/Worker dry-run passed.
Homepage screenshot reviewed. No deployment. Local API restarted for response
field change. Owner should verify physical MIDI, audio pulse/scroll alignment,
real-time eligible gold accumulation and disconnect/reconnect. No exhaustive
browser campaign. Limitations: local-only history/checkpoint, pitch-only guidance,
no specialized scale/arpeggio drills or cross-device session resume.


Latest Infinite composition: compositionVersion=2 stores and develops realized
motifs with repeat/sequence/rhythm/one-note/answer transformations and bounded
fallbacks. Existing cadence and fixed-position rules remain. New Infinite settings
opt in; old seeds and Realm configs without this version keep their old recipe.
See newest handoff for tests and limitations. Not deployed.

Latest local Infinite Practice progression: six opt-in/versioned early learning
steps (3 Novice, 3 Beginner), defaulting new Infinite setup to Novice 1. One musical
demand changes per step; 50/52/54/56/58/60 BPM defaults remain editable. Original
tier profiles and seeds without learningStep, Realm generation and progression
remain unchanged. Fixed-position fingers work with assistance. See newest handoff.

Latest local fingering assistance: Full/Light/Minimal/Off plus Use Recommended,
shared across Realm/Infinite/Studio and persisted per account in this browser.
Display-only XML filtering preserves original fingers/music. Defaults follow tier
unless explicitly overridden; optional results action repeats identical music with
less help. No new finger guesses, grading or economy changes. See newest handoff.

Latest local boss presentation: King intro now uses the supplied original 6.04s
MP4 through CinematicVideo, uncropped, ending at boss preparation. Realm entrance
hold/crop and victory/defeat remain unchanged. Watermark retained; no matching
watermark-free local export found. Not deployed.

Latest local cinematic (2026-11-01): supplied 6.04s Kling MP4 replaces the first
realm entrance; map includes Replay Cinematic. Returning/trial sequences remain.
Muted inline video, Skip, native completion/error fallback and existing accessibility
preferences are preserved. See newest handoff; not deployed.

Latest local presentation (2026-10-31): Balanced animations are the default, with
Minimal immediate and Cinematic currently sharing Balanced. Lightweight SVG/CSS
realm/trial entrances and confirmed first-clear/replay transitions wrap existing
screens; the realm clock derives restoration from saved trials and boss progress.
Pacing follow-up: first/return realm 6.5/2.3s, trial entry 2.8s (retry immediate),
first/repeated clear 4.6/2.6s, failure 1.3s. Sequences now stage mechanism movement,
activation, titles and rewards with reading holds and short fixed fades.
Account-scoped browser metadata records completed/skipped presentations; the
existing attempt transaction records first-clear/PB facts for accurate reveals.
Rewards, MIDI, music, difficulty and production are unchanged. See the handoff.

Latest local fingering (2026-10-31): positionVersion=1 establishes Novice hand
positions before pitch generation (C/G/F/D major, A minor), assigns/validates
finger numbers and adds a collapsible preparation guide. Higher generated levels
omit uncertain annotations; authored fingers and prior receipts remain intact.
Economy, progression, timing, MIDI and production are unchanged by this task.

Latest local economy (2026-10-31): gold now follows active MIDI practice at 50/hour,
including Studio/generated/focused practice, with +2 first-trial / +5 first-boss
bonuses. Replay/star/PB payouts are removed. Partial gold carries over; Behr costs
150 and Czerny 200. No deployment or schema change. See the newest handoff section.

Local correction (2026-10-31): Trials 1–3 now use distinct lesson rhythms via
studyVersion=2. Prior queued scores, difficulty progression and timing windows are
preserved. See the newest handoff section; production is still unchanged.

Latest local implementation (2026-10-31): persistent gold, Royal Music Shop and
Practice Studio. Production remains release `4d313d8`; this feature has not been
published. All existing music stays free for everyone by explicit owner decision.
Two new verified editions are registered; see `source-scores/royal/README.md` and
the newest handoff section for rewards, access rules, safeguards and test evidence.

Prepared 2026-10-30 (America/Los_Angeles). Read **AGENTS.md**, this file, then
[docs/project-handoff.md](docs/project-handoff.md). This is the current summary;
the longer handoff preserves historical evidence. Old previews, layouts, release
IDs and pending items in historical sections are not current instructions.
The original handoff was documentation only. Subsequent explicit requests
authorized local Infinite Classical Practice and the Clockwork Kingdom gameplay
rebuild, now in this checkout. The default player page is the realm map; the
previous battle flow remains at `/legacy-battles` for compatibility.
See the newest section of docs/project-handoff.md. The owner explicitly requested
production publication on 2026-10-30. Release `4d313d8` is now live; existing
hosting, authentication and database bindings were preserved without migrations.

Latest release: five musical tiers (Novice/Beginner/Intermediate/Advanced/
Maestro) with 50/65/80/105/130 BPM presets and independent per-tier progress.
The owner paused forgiveness changes: numerical rhythm/pitch windows are unchanged.
Confirmed live timing/duplicate-penalty bugs are fixed and onset diagnostics added.
Use targeted testing; future Learn/Practice/Challenge modes are outside this scope.
See the newest handoff section for versioned compatibility and verification.

## Open the exact repository

- GitHub: https://github.com/tuckonline/pianobossbattles
- Local root: `C:/Users/aaron/Documents/Codex/2026-09-18/what-are-the-most-popular-online/outputs/pianobossbattles-public`
- Development checkout: `feature/creator-studio-v1`, HEAD `714fdb8` plus local
  uncommitted generator and realm implementation. The branch name does NOT
  imply that Creator Studio is released.
- Production release checkout: `.local/production-query-fix`, branch
  `feature/end-user-website-v1`, commit `4d313d8` (clean and pushed after release).
- These are separate Git worktrees with deliberately different content.
  Development contains unreleased Creator code. Never deploy the entire development
  branch as a shortcut or reset/switch either checkout without understanding its state.
- Before handoff edits, the only uncommitted change was
  `docs/project-handoff.md`: the 2026-10-30 inactive-Supabase incident record.
  Preserve it. No application changes were pending. Development was five commits
  ahead of its local remote-tracking ref; no network fetch was performed for this
  handoff. Use actual Git status/logs rather than treating recorded HEADs as immutable.

## What the website does

The local default is a music-first adventure: five Classical rhythm/coordination
trials followed by the four-phase Clockwork King. A fixed performance clock,
shared MIDI evaluator and Verovio notation determine mastery, stars, phrase
crystals and unlocks. Results save through `/api/realms`, using namespaced rows in
existing `game_events`; no schema migration or legacy XP writes. Failed saves
remain in a per-user browser outbox for retry.

The explicit `/legacy-battles` route retains the previous
setlists, modes, HP, XP, battle records and cinematics. Creator/OBS still use the
legacy authoritative session. They do not yet broadcast the new realm.

## Architecture and stack

The public runtime is **React 19 + TypeScript + Vite**, NOT the retained Next.js app.
Check package-lock.json for exact installed versions. Tooling includes Node 22,
Vitest, Playwright, ESLint, esbuild, Zod, pg, Supabase JS and Verovio WASM.

```text
Physical piano -> shared Web MIDI input -> SightReading / GameClient
                -> note evaluation, cursor, battle reducer, countdown, timers
                -> authenticated API -> validated/idempotent rewards -> PostgreSQL
                -> shared presentation stream -> OBS viewers (no second evaluator)

Supabase Auth -> browser session -> verified secure HttpOnly API session cookie
Vite assets -> Cloudflare Pages
/api/* -> Pages Worker -> Hyperdrive -> Supabase PostgreSQL
Local Vite -> local Node API -> same shared services / public PostgreSQL
```

Player tables have RLS. Trusted server identity/roles, publication checks and
origin validation matter; hiding a UI control is not authorization. Some shared
services use a D1-shaped PostgreSQL bridge. This does not connect the public app
to the original ChatGPT application's live D1 database.

## Source map

| Path | Purpose |
| --- | --- |
| `public-app/main.tsx`, `home.tsx` | SPA entry, routes and account dispatch; development home also includes unreleased Creator routes |
| `public-app/auth.tsx`, `supabase.ts` | Login, verification, password recovery, token refresh and server-cookie synchronization |
| `public-app/player-home.tsx`, `player-home.css` | Setup, queue, mounted modal preview/arena and learner layout |
| `public-app/battle-layout-presets.ts` | Current numeric sizing preference/framing; filename retained after presets were retired |
| `public-app/battle-settings.tsx`, `battle-audio-settings.tsx` | Mode-aware settings and audio preferences |
| `public-app/catalog.ts`, `queue-scores.ts`, `music-updates.ts` | Metadata catalog, selected-score preload, publication updates |
| `public-app/admin-music.tsx`, `music-service.ts` | Music admin, server publication/access checks, persisted exercise definitions |
| `public-app/api.ts`, `postgres.ts`, `server.ts`, `worker.ts` | Shared API, PostgreSQL bridge, local Node / deployed Worker adapters |
| `public-app/build*.mjs`, `vite.config.ts`, `private-music-build.ts` | Bundles, private-score exclusion, allowlisted assets and Worker packaging |
| `public-app/production/wrangler.jsonc`, `deploy-production.mjs` | Production-only bindings and guarded release |
| `hosted/sight-reading.tsx`, `sight-library.ts`, `polyphonic-score.ts` | Practice controller, Exercise types, pitch-group evaluator and MusicXML generators |
| `hosted/game-client.ts`, `game-core.ts`, `game-service.ts`, `service.ts` | Authoritative progression/checkpoints/reward services and client outbox |
| `hosted/boss-*`, `battle-modes.ts` | Bosses, HP/damage, timers and modes |
| `hosted/battle-stage.tsx`, `battle-layout.ts`, `battle-animation-*` | Canvas sprites, choreography, director and weapon contact |
| `hosted/battle-cinematic*`, `cinematic-presentation.ts`, `battle-intro.tsx` | Countdown, persistent results and original visual definitions |
| `hosted/battle-pressure*`, `battle-story*`, `battle-audio*` | Hesitation, story beats and sound scheduling/ownership |
| `hosted/obs*`, `shorts-*` | Recording views, snapshots/peer transport, reconnect and notation |
| `src/components/music/notation.tsx`, `broadcast-layout.ts` | Verovio-to-SVG rendering, highlighting, full-bounds fit/follow |
| `src/domains/music`, `src/domains/notation` | Shared audio/MIDI and MusicXML utilities |
| `supabase/migrations`, `supabase/verification` | Public SQL and security checks; do not edit applied migrations |
| `hosted/public/battle`, `audio`, `branding` | Approved sprites, selected sound assets, transparent emblem and social previews |
| `hosted/public/scores`, `source-scores` | Source/private music; not a public static dump |
| `tests/`, `tests/public-browser` | Unit/database/network tests and browser fixtures |
| `src/app`, `drizzle`, `postgres`, original `hosted` adapters | Retained legacy code; not the public Next.js/Better Auth runtime |
| `.local`, `.env*`, `dist`, `.wrangler`, `test-results` | Ignored credentials, worktree/evidence/build state; not portable source |

## Music representation and generator integration

`hosted/sight-library.ts` defines:

```ts
type ScoreNote = { pitch: number; beats: number; tie: boolean; finger?: number };
type SoundNote = { pitch: number; beat: number; beats: number; hand: 'right' | 'left' };
// Selected fields from Exercise (see source for complete metadata):
type Exercise = {
  number: number; title?: string; tempoBpm?: number; beatsPerMeasure?: number;
  measuresPerSystem?: number; right: ScoreNote[][]; left: ScoreNote[][];
  polyphony?: SoundNote[]; durationBeats?: number;
  notationUrl?: string; notationXml?: string;
};
```

Pitch is a MIDI number; beats are quarter-note units; nested hand arrays represent
measures. `soundingNotes`, `noteGroups`, `assessPractice` drive grouped expected
pitches. The inspected practice evaluator advances on correct pitch groups and
computes note accuracy; do not assume it already grades precise note-on/off rhythm
just because a separate scoring engine exists elsewhere.

`musicXml(exercise, measureOffset=0, finalPage=true)` returns MusicXML 4.0 and
routes polyphony through `polyphonicXml`. `SightReading` prefers supplied
`exercise.notationXml`, otherwise generates XML. Verovio renders SVG; this is not
VexFlow and MIDI files are not the primary notation format. The basic converter
assumes natural pitch spellings / a zero-fifths key and has limited rhythm/rest
representation. Inspect both conversion paths before adding accidentals, keys,
rests, chords, dotted rhythms or expressive metadata. Keep notation and evaluation
in agreement; never silently change old field semantics.

Selected published definitions are fetched via authenticated `practiceExercise`
commands and `/api/music/authorize`; server services validate known exercise IDs.
A generated client-only exercise cannot simply impersonate a persisted exercise
number or trust arbitrary client notes for XP. Resolve the catalog/attempt/reward
boundary explicitly before integrating generated content.

Metronome/audio utilities exist in `src/domains/music/audio.ts`, with a player UI
in `src/components/music/player.tsx`. Inspect actual public controller wiring
before promising that legacy UI behavior is already exposed in the battle route.
Reuse existing MIDI, notation/follow and audio systems; do not introduce VexFlow,
a separate evaluator, unnecessary backend/AI service, or dependencies.

## Approved design and behavior

The combat-specific rules below describe the retained legacy battle flow.
The owner's new Clockwork brief explicitly supersedes them for the local default
realm. It uses focused notation, one timed attempt, no HP/damage, and lightweight
skippable cinematics only for the final encounter. See the newest handoff section.

- Dark navy/cyan identity, white Piano Boss Battles wordmark, actual transparent
  piano-keys/crossed-swords emblem. Tagline: Play Music. Defeat Bosses.
  Recording handle: red YouTube icon + @PianoBossBattles, no second tagline.
- One setup page -> **Preview Battle** -> existing modal with **Start Battle** ->
  one 3–2–1–FIGHT countdown per attempt/whole chain. Preview is inert and need not
  have MIDI permission; starting requires connected MIDI and readiness checks.
- Single default sizing: **40% arena / 60% music** of area beneath HUD. Preview-only
  slider allows 30–70% arena, Reset=40, stores per-player local preference at
  `pbb:battle-layout:v2:<userId>`. Retired three-option v1 values do not override it.
  Sizing locks for play/pause/results; score remains mounted. No in-battle divider.
- Back/Escape pauses; Resume does not repeat countdown. Loops 1–100 and entire
  chains are continuous; no loop title pause, intermediate victory or orphaned
  final Schmitt note. Preload selected scores; guard exercise/pass identities.
- Preserve character artwork, apparent scale rules, foot grounding, weapon contact
  and original animations. Shorter public arenas use closer idle positions.
  Notation always uses contain, aspect preservation, full visual bounds/padding.
- Practice=self-paced; Survival=HP; Time Attack=BPM-derived clock;
  Ultimate Boss=HP AND clock. Correct-note evaluation must remain immediate even
  when many notes share a continuous animated combo.
- Victory, Defeat and TIME OUT animate once then hold until deliberate next attempt,
  restart/exercise change/Boss OFF or supported dismissal. Preserve restored
  original Victory/Defeat visuals and unchanged TIME OUT. No automatic dismissal.
  MIDI continues according to existing rules underneath; no duplicated rewards.
- HUD: player HP left, combo/accuracy and Combo Power center, boss HP right.
  Score area is stable. Dense two-hand music and result text must fit laptops.
- Notation appearances: Studio Light default, Classic Paper, Slate Focus, Night.
  Personal styling must not silently affect OBS. No CSS inversion filters.
- Audio: Focus default (silent player effects), Immersive, Cinematic; explicit
  preview/test permitted. Never mute actual piano. One OBS audience-audio owner,
  other source silent. Real OBS/Aitum recordings, not fixtures, prove routing.
- Admin music link and MUSIC_ADMIN checks permit collection/piece publication;
  changes propagate site-wide. Owner admin identity is recorded in the older handoff.
- OBS horizontal/Shorts layouts and separate keyboard-camera source remain intact.
  Creator Studio exists on development only; removed preview hosting stays removed.

## Completed work / evidence

Implemented public Supabase accounts/profiles/progress, music admin publication,
mode-aware settings, queues/chains, countdown, persistent cinematic lifecycle,
restored result artwork, reaction/animation/story systems, approved Sonniss sounds,
notation themes, branding/social assets, compact dashboard/hybrid arena, session
save recovery and query/save-order optimizations. Latest UI release adds preview
and adjustable sizing. See detailed handoff for provenance and historical tests.

Previous production release `54541d0` passed **491 unit/database/network tests**, **16 focused
browser tests**, TypeScript, changed-file lint, build/package and credential scan.
Development candidate passed **497 tests** and **17 focused browser cases** (extra
Creator tests explain the different unit count). These are dated Oct 21 evidence,
not freshly rerun during the Oct 30 documentation handoff. Physical MIDI, live
account recovery and native OBS recordings must be distinguished from fixtures.

## Outstanding issues and next priorities

1. **Earlier login blocker, diagnosed Oct 30:** public HTML and `/api/health` returned 200,
   but the project's Supabase hostname returned NXDOMAIN from local, Google and
   Cloudflare DNS. Auth health could not resolve; authenticated CLI project list
   reported the correct linked project **INACTIVE**. Later read-only checks found
   ACTIVE_HEALTHY, resolving DNS and Auth health 200. Recovery cause is unconfirmed.
   Owner verification of real login, physical MIDI and saved progress remains
   outstanding. Do not create a replacement DB, reset or assume a paid upgrade.
   `/api/health` alone does not prove working storage.
2. **Infinite Classical Practice — fixed-length version deployed in `4d313d8`.** Full owner proposal:
   [docs/proposals/infinite-classical-practice.md](docs/proposals/infinite-classical-practice.md).
   The subsequent pasted proposal authorized implementation. Local features include
   seeded deterministic composition, functional harmony, related
   phrases/motifs/cadences, playable hands and five difficulty profiles. Settings:
   major/minor keys, 40–160 BPM, 8/16/32/64 measures, right/left/both. Fixed-length
   generation/repeat first; continuous phrase streaming and adaptive learning later.
   No random scale-note substitute or external AI API. Validate hundreds of seeds,
   keys and levels, exact measure totals, notation/MIDI agreement and existing games.
   The new generator and UI are described at the top of docs/project-handoff.md.
   Results are local pitch accuracy with no XP or saved-record writes. Future
   streaming, adaptation and rewarded attempts need separate follow-up work.
3. Confirm fresh earned progress after real battle + refresh/re-login, two real
   account privacy/admin UI checks, and both native OBS/Aitum recordings as needed.
4. Confirm backups/restore drill, quota/error monitoring and rollback practice;
   privacy/terms/account deletion and music/art/sound licensing before wider access.
5. Broader query-budget/event-driven transport work remains possible. Do not disable
   permission freshness, weaken security, or slow MIDI/audio to reduce polling.

Historical Hyperdrive incident is separate from the current Supabase inactivity:
Free's 100,000 daily query quota was exhausted. Owner upgraded Workers Paid and
confirmed saved progress; targeted query and checkpoint-order fixes shipped.
Workers Paid is already active as last verified; do not ask to buy it again.

## Local development and verification

Use the exact root above, Node 22-compatible tooling and committed lockfile.
For missing dependencies use `npm ci`; do not reinstall unnecessarily.
Ignored `.env` supplies VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY, local
APP_ORIGIN, PORT=8788, server-only DATABASE_URL and optional DATABASE_SSL_CA_FILE.
See `.env.example`; never print/copy its real counterpart into a report or Git.

```powershell
npm run dev:api
# Separate terminal, same repository:
npm run dev
```

Open http://localhost:5173/; Vite proxies API to 127.0.0.1:8788. Local auth/storage
normally uses the real public Supabase project, NOT disposable data. Do not seed,
reset or run legacy migration scripts against it. Missing env in a worktree may
need secure owner setup. `.env.local` is read by Vite; Node dotenv needs
DOTENV_CONFIG_PATH=.env.local if that is the chosen local API env file.

```powershell
npm run typecheck
npm test
npx eslint <changed TypeScript files>
npm run build
npx playwright test --config playwright.public.config.ts
```

Public browser tests need local API/Vite and use fixtures/simulated MIDI. Keep
separate suites from racing over test-results. Private-score bundler checks are
intentional. Existing Vite import/configLoader and Verovio externalization notices
were non-blocking; do not conflate them with backend outages. This docs-only
handoff did not rerun application tests.

## Hosting and publishing safely

- Public domain: https://www.pianobossbattles.com/
- Cloudflare Pages project `pianobossbattles`, deployment branch `production`.
  Pages serves assets; advanced-mode Worker handles /api through Hyperdrive.
- Last verified deployment: `9837911d-31e8-469e-8970-c641cbaddcdc`, source `4d313d8`.
  Client `index-BrHZ1A1C.js`, CSS `index-DA4JkZgp.css`.
- Rollback: `c85acc6b-0c62-4a6b-87d3-26f199ea127c`, source `54541d0`.
  Recheck actual remote deployment state before another release.
- Supabase ref `huxmltjtovpxxxupuxdg`; auth and PostgreSQL belong to this independent
  public app. Hyperdrive binding ID `f4dddfd90fcf4d7c9ac1d748fd77eeef` remains production
  infrastructure even though its historical name includes preview.
- Production config is `public-app/production/wrangler.jsonc`; do not deploy using
  old preview bindings. Replacing bindings previously caused production failure.
- Original ChatGPT-hosted game, auth and D1 are separate and must not be modified.
- Preview Pages project was deleted at owner's request. Never recreate it or run
  deploy:preview without new authorization. build:preview only PACKAGES locally.
- No GitHub automatic deployment integration was configured at last inspection;
  Git push is not publication. Recheck if infrastructure changed.
- Resend custom SMTP and accounts@/support@ routing were working and password-reset
  flow was owner-confirmed. Preserve SMTP credentials, verified DNS and email
  verification; older default-email rate-limit blockers are historical.

Every production release needs explicit approval for that release. Review changes
against the production baseline; selectively promote approved files/commits into
release branch rather than merging unreleased Creator code. Do not bypass branch,
clean-tree, remote-HEAD, origin or binding guards. Never merge main merely to deploy.
From a clean, tested, pushed release checkout, with current approval:

```powershell
Remove-Item Env:PUBLIC_ASSET_ORIGIN -ErrorAction SilentlyContinue
npm run build:preview
# Check exact project/origin/bindings and scan output for private credentials/music.
git push origin feature/end-user-website-v1
node public-app/deploy-production.mjs --confirm-production
```

The helper requires `feature/end-user-website-v1` and HEAD matching its pushed
remote ref. Direct node invocation avoids Windows npm argument forwarding dropping
--confirm-production; this is the same guarded helper, not a bypass. CLI login may
expire: ask the owner to authenticate interactively, never paste tokens/passwords.
Never disable TLS, security approval, RLS or email verification to unblock work.

After deployment verify actual custom-domain HTML and asset version, browser
render, authorization/origin protections, OBS routes and authenticated saved
progress when available. Record deployment ID and rollback target; do not claim
real MIDI/audio/database success from HTTP 200 alone. No DNS/auth/billing/schema
changes are implied by ordinary UI release approval.

## Instructions that require asking first

Keep every existing AGENTS.md safeguard. In particular: new production release,
paid-service/billing decisions, DNS/domain changes, auth/SMTP/security settings,
privilege grants, destructive data work, applied schema changes, account deletion,
replacing artwork or approved sounds, and recreating preview hosting need specific
authorization. Preserve pending progress/outboxes on transient errors. Passwords
and credentials are entered securely outside chat. Never commit secrets or full
Creator viewing links, copy the entire Sonniss library, announce beta/invite users,
or claim planned features are completed.

## Start the next conversation

Open this exact repository as the Codex project, start a new LOCAL chat in it,
and reuse its existing checkout (not an empty repo or a default-branch worktree).
Paste:

> Continue Piano Boss Battles in this exact repository. Read AGENTS.md,
> PROJECT_CONTEXT.md and docs/project-handoff.md first. Inspect Git status, both
> worktrees and current production release. Preserve existing gameplay and the
> separate original ChatGPT/D1 app. First confirm the inactive Supabase login
> blocker is resolved. Then review docs/proposals/infinite-classical-practice.md
> and propose the integration before implementation. Do not deploy or change
> infrastructure until I authorize that specific action.

Adjust the final task sentence if another priority comes first. Local environment
files, OS CLI logins and screenshots do not transfer with Git to another computer.







