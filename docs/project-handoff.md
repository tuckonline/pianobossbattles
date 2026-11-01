# Piano Boss Battles — project handoff

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


## Infinite melodic development — local, 2026-10-31

New Infinite settings opt into compositionVersion=2. Absent version preserves the
old recipe, including all Realm configs. No tempo, assistance, progression, economy,
notation/MIDI or cinematic changes. Existing composer is extended, not replaced.

New motif-development.ts captures realized scale degrees, durations and rests,
with exact repetition, uniform diatonic shift, same-note-count rhythm substitution
from the current profile, one-note variation and answering-tail changes. Bounded
candidates pass the existing pitch/harmony/position/interval filters as complete
ideas; if no candidate fits, the existing composer supplies a safe continuation.
Optional development metadata records actual technique/source/fallback per bar.

Consequent bar 5 first tries the opening motif; bar 6 tries a related answer.
Intermediate sections try contrast; later 16-bar returns recall the opening.
Arch/descending/question-answer register preferences shape development but yield
to harmony and playability. Before answering cadences, retain opening rhythm and
use existing forced approach/resolution notes. Cadence logic/harmony plans remain.

Validator checks declared transformation identity. Existing validators enforce
measure sums, harmony, cadences, registers, leaps, ties and fixed-position fingers.
Tests cover all transformation types in actual generated samples, 36 representative
C-major/A-minor studies, MusicXML written pitch/timing alignment and reproducibility.
Early-step comparisons additionally run both old/new composition versions across
five fixed-position keys. Eleven targeted tests passed; TypeScript, changed-file
lint and production packaging passed. No browser campaign. Two 8-bar Intermediate
C-major/80 BPM MusicXML examples (seeds 7,42) are in the chat outputs directory.

Limits: small opening-gesture vocabulary; harmony can defeat requested contour or
transformation; fallback frequency depends on register/key constraints. No claim
of professional composition, expressive performance or universal motif similarity.
Local only.

## Infinite Practice early learning steps — local, 2026-10-31

Optional versioned GeneratorSettings.learningStep reuses compose and validation.
No step preserves previous seeded behavior, including Realm Quest. Six profiles
in learning-steps.ts expose a manual selector in Infinite Practice only.

- Novice 1 (50 BPM): degrees 1-3, half notes, one held root per bar.
- Novice 2 (52): add quarter notes only.
- Novice 3 (54): expand allowed melody to degrees 1-5 only; leap cap remains 4 semitones.
- Beginner 1 (56): repeat the same root twice per bar (half notes), coordination only.
- Beginner 2 (58): alternate I root/fifth and V root/fifth within fixed positions,
  accompaniment pitch movement only; the V fifth is below its root.
- Beginner 3 (60): add paired melody eighth notes only.

All steps retain fixed positions (C/G/F/D major, A minor), the original simple
I-I-V-V / I-I-V-I question-answer harmony and 2-1 melodic cadence. Cadence bars
retain longer notes/held tonic. Fingering assigned from existing position maps;
assistance preferences remain independent. No new chord vocabulary, hand shifts,
interval limit or tempo jump at the Novice/Beginner boundary. Single-hand settings
omit accompaniment as before. Existing higher tiers and original tier option remain.

Recommended start is first step of selected tier. New default Infinite setup uses
Novice 1. Selecting settings changes only the next generated exercise; busy settings
are locked. Suggested tempos rise 2 BPM and remain manually editable. Repeat retains
the generated object/seed/step. No auto advancement or official progression changes.

Tests: 21 targeted tests across steps, fingering and original generator passed.
New checks compare adjacent demand fields and generated unchanged hands/harmony,
actual new rhythm/bass demands, valid position fingers and reproducibility across
five supported keys and two seeds. One focused browser case passed for step
selection, no premature regeneration, preserved seed and editable tempo. TypeScript,
changed-file lint and production packaging passed. Local only; no API restart needed
for existing Realm paths, no MIDI/notation/gold/shop/cinematic changes.

## Progressive fingering assistance — local, 2026-10-31

Shared display-only MusicXML filter in src/domains/notation/fingering-assistance.ts
removes selected fingering elements from a parsed copy before Verovio. Original
ScoreNote.finger, authored XML, generation, seeds, pitches/durations/ties and grading
inputs are preserved. Full retains valid annotations; Light retains first per hand
and first use of each finger plus explicit changes; Minimal retains first per hand
and explicit essential position/crossing/substitution markers. Off removes all.
No inferred four-bar phrases or pitch-derived fingering guesses. Current generator
has reliable fixed-position Novice annotations; higher generated levels still omit
uncertain fingers. Existing explicit MusicXML substitutions are respected.

FingeringProvider/Control store recommended/full/light/minimal/off per user in
pbb:fingering-assistance:v1:<userId>, following existing browser preference practice.
No cross-device sync or new backend. Defaults by tier: Full, Light, Minimal, Minimal,
Off. Explicit preference survives difficulty changes, refresh and supported modes.
Use Recommended resets to tier defaults. Studio uses catalog difficulty where
available, then named exercise difficulty, conservatively Minimal if unknown.

Realm preparation/performance and ClassicalPractice (Infinite/Studio, including
legacy entry) filter only displayed XML. Controls are available before play and
after completion, not during active or paused playback. Off also hides the existing
finger-based hand-position guide. Results optionally replay with the next lower
assistance; original score is retained, including focused realm practice slices
and their tempo. No new MIDI subscriptions, rewards, scoring or progression logic.

Validation: six existing fingering tests passed; focused browser filter/UI test
checks four subsets, essential marker retention, unchanged XML music, defaults,
explicit override, restoration from Off, seed/title stability and per-account
refresh/mode persistence. Existing first-clear/replay/save safety browser case
passed. TypeScript, changed-file lint and production packaging passed. No exhaustive
playthrough. Local only. Owner can check printed guidance at the physical piano.

## Clockwork King video introduction — local

Added hosted/public/cinematics/clockwork-king-intro.mp4, supplied original unchanged
(21,953,022 bytes, 1920x1080, 6.041667s). Inspected opening/middle/late frames. Only
the supplied matching export was found in Downloads; watermark retained. No crop:
the crown approaches the source frame edge near the end.

CinematicVideo now accepts title/subtitle/eyebrow, labels, zoom and ending-hold
options. RealmCinematic intro uses it at zoom 1 with no final hold; ended/Skip/error
all use the existing callback into details, never performance. Minimal bypass and
reduced-motion static Continue remain. Victory/defeat and realm entrance unchanged.
Title appears near the end: THE CLOCKWORK KING / THE GRAND TRIAL OF TIME.

Targeted browser cases cover King video -> preparation/no receipts, existing tablet
reduced-motion boss and realm entrance regression. TypeScript, changed-file lint
and production packaging checked. No gameplay/reward/service changes; local only.

## Cinematic title hold follow-up

Entrance now lasts approximately 7.5s: original 6.04s playback, final-frame hold,
then a 650ms overlay/title fade. Native ended starts the hold; duplicate ended
events are guarded. Skip/error remain immediate, unmount clears both timers.
Source asset and playback speed unchanged. Targeted entrance test verifies hold,
fade and duplicate ended handling; TypeScript, lint and production build passed.

## Cinematic framing follow-up

Centered CSS zoom is 115% inside a responsive clipped 16:9 frame. 110% left
watermark fragments; 115% excludes them in frames at 0.1, 2, 4 and 5.9 seconds.
Clock face and central mechanism remain visible, with peripheral scenery trimmed.
Original MP4 unchanged; no re-encoding or playback changes. Desktop 1440x900 and
tablet 1024x768 / 768x1024 frame bounds and aspect ratio checked. Targeted entrance
browser test, TypeScript, changed-file lint and production build passed. Local only.

## Kling entrance integration — local, 2026-11-01

First realm visits now use CinematicVideo in the existing RealmTransition, with
muted inline playback, object-fit contain, full-screen dark letterboxing, a late
title reveal and immediate Skip. Native ended/error events and a stalled-playback
watchdog complete once; unmount pauses and releases the media. Returning transitions
and all trial/boss/gameplay/reward logic stay unchanged. Replay Cinematic on the map
uses the same presentation path; Minimal and reduced motion still bypass it.

Asset: hosted/public/cinematics/clockwork-kingdom-intro.mp4, copied unchanged from
the supplied Kling file and explicitly included by public-app/build.mjs. 21,497,012
bytes, 1920x1080, 6.041667 seconds. Consider a smaller H.264 fast-start web encode
before release; no transcoding was performed. Media loads only when mounted.

TypeScript, changed-file lint, production packaging and two focused browser cases
passed (video/skip/replay/error/preferences and existing reward consistency).
Actual local MP4 decoded and reached ended in Chromium. Title timing tests use
controlled media events. Tablet autoplay/layout still needs owner review. Local
only; production unchanged.

## Balanced pacing follow-up — local, 2026-10-31

Owner found the brief transitions rushed and requested deliberate visual beats.
This supersedes the durations in the original implementation record below.

- First/return realm entrance: 6.5/2.3s; first trial entry: 2.8s; retries immediate;
  first/repeated successful clear: 4.6/2.6s; failed trial: 1.3s.
- CSS now stages arrival, gear winding, hand alignment, an energy trace, title and
  objective reveals, then a readable hold. Trial/clear sequences include a single
  expanding mechanism activation ring. First-clear keepsake -> stars -> gold are
  delayed independently; replay stars/gold/PB use a shorter staged sequence.
  Failure has a small settling hand and quiet text, without success effects.
- Fade-in/out remain fixed at 0.35/0.25s rather than stretching with scene length.
  Movement finishes before the reading hold. Existing boss scenes, Skip, viewed
  metadata, Minimal/reduced-motion paths, reward saving and active performance
  guards are untouched. No API, grading, music, notation or gold-rule changes.
- Reused the 3 presentation unit tests and 2 Balanced browser cases; all passed.
  Browser checks now inspect early/late CSS reveal phases, activation, natural
  completion, return/skip/retry, accessibility paths and saved reward consistency.
  TypeScript, changed-file lint and production packaging passed. Reviewed entrance
  and reward screenshots. No broad playthrough or new physical MIDI claim.
- Client changes are live on localhost:5173 via Vite; nothing deployed. Owner can
  review the new rhythm/pacing on their usual screen or tablet.

## Balanced animation system — local, 2026-10-31

Owner requested a small presentation layer around Clockwork Kingdom, preserving
music, grading, MIDI, notation, metronome, gold rules and the existing boss scenes.
Implemented without new dependencies or database migrations. Local only;
production remains 4d313d8.

- New pure presentation configuration in src/domains/realms/presentation.ts and
  reusable RealmClock / RealmTransition plus preference hooks in
  public-app/realm-animation.tsx and realm-animation.css. RealmHome triggers them
  around map, preparation and results; the MIDI setup stays mounted and accessible.
- Balanced is the default. First realm entrance: 5.6s; returning: 0.7s; first trial
  entry: 1.6s; retry: immediate; first saved successful clear: 3.6s; replay: 0.7s;
  failed attempt: calm 0.35s. Cinematic uses the same sequences for this milestone.
  Minimal immediately advances all new sequences and existing boss cinematics.
- OS reduced motion immediately advances new sequences; the existing boss keeps
  its static Continue presentation. Otherwise its existing 8s intro and 5s
  victory/defeat remain unchanged. No forced audio, flashes or infinite loops.
  Decorative boss motion is disabled during active performance.
- Preference and viewed metadata use pbb:realm-presentation:v1:<userId> in this
  browser. Realm/trial entry keys are shared across tiers; clear keys include the
  difficulty. Keys are added only on natural completion or explicit skip (Minimal
  and reduced motion complete immediately), never at animation mount. Reloading
  an unfinished entrance therefore does not mark it seen. Skip is focused and
  completion returns focus to the next heading; timers clean up on unmount.
- The existing authoritative attempt transaction adds presentation-only
  completion.firstClear and completion.improved facts to the saved attempt.
  Idempotent finish retries return those original facts. useRealmProgress exposes
  the confirmed result/award; RealmHome waits for both before revealing a success.
  Save failure leaves the existing retry/outbox path and honest pending results.
  Late saves cannot interrupt another exercise or destination. Skipping/dismissing
  a scene only changes presentation metadata; it never awards or saves anything.
- First-clear reveals use actual saved stars and milestone gold. Replays explicitly
  say the keepsake is already restored and show saved accuracy/PB and actual gold,
  including zero. Practice gold continues saving independently as before.
  Existing completed trials do not become new keepsakes on another browser.
- Browsing clock has five restored sectors, center glow, gears, hands and energy
  stages, plus a boss crown. State comes directly from the selected difficulty's
  saved known trial completions and bossDefeated; there is no second progress count
  and no constant browsing motion.
- Validation: 12 targeted unit/database tests passed (presentation 3, realm-service
  3, economy 6). Three browser cases passed: entrance/return/entry/retry/skip/
  interrupted entrance/Minimal/reduced motion; server-save failure/retry followed
  by first clear/replay/failure and duplicate-skip reward consistency; existing
  tablet boss reduced-motion/playback coverage. Fixtures use mocked browser APIs
  and PGlite, not live player writes. TypeScript, changed-file lint and production
  client/worker packaging passed. Reviewed desktop entrance/reward/restored-clock
  screenshots. Local API restarted for the new completion response metadata.
- Manual review remaining: animation pacing on an actual tablet and physical MIDI
  play through entry -> performance -> results, including metronome/scrolling feel.
  No exhaustive trial/difficulty campaign, physical MIDI claim or deployment.

## Position-aware Novice fingering — local, 2026-10-31

Owner requested fixed beginner positions without changing difficulty complexity,
economy, progression, grading, timing or gameplay. New generated settings/realm
configs carry positionVersion=1 so pending older attempts reconstruct unchanged.
This is local only; production remains 4d313d8.

- Audit: ScoreNote.finger already reaches the existing MusicXML technical/fingering
  element (RH above, LH below) and Verovio correctly. The old starting-finger
  heuristic inferred a position from up to eight opening attacks, with no
  declared hand position; LH bass voicing could choose a lower octave. The
  starting-note annotation helper also overwrote an existing first-note finger.
- Added explicit positions for C/G/F/D major and A minor. RH C4–G4 uses 1–5,
  LH C3–G3 uses 5–1. D places F# under finger 3; F places Bb under RH4/LH2.
  New Novice key selection is limited to these defined positions; all earlier
  keys remain available at Beginner+. Unsupported Novice requests fail clearly.
- Generator selects positions first, filters candidate pitches against them,
  keeps the existing three-note melody vocabulary, rhythms, harmony and cadences,
  and uses one sustained bass note per measure within the fixed LH position.
  LH-only melodies now use the declared third-octave position. Every generated
  attack is annotated and validated; tied continuations do not repeat markings.
- Explicit generated/authored note metadata; untagged existing finger numbers are
  conservatively treated as authored. Starting-note marking and focused slicing
  preserve authored markings. Imported simple numeric fingers are retained in
  ExpectedNote.fingering; original MusicXML keeps more complex source markings.
- New generated Beginner–Maestro phrases omit uncertain starting finger guesses.
  Planned shifts, scale crossings and phrase optimization are not implemented.
  Authored repertoire stays untouched. Mixed-level boss phrases may retain
  validated Novice-phase markings but do not claim a fixed position for the
  entire score. No changes to challenges, difficulty presets or saved progression.
- Compact collapsible starting-position guide appears only before play in the
  generator and realm preparation, including focused practice. It names the
  anchor and first sounding note/finger, shows only the active hands, and reflects
  black keys in F/D. New scores carry hand-position metadata for guide/validation.
- 42 targeted unit/database checks passed across fingering, existing authored
  repertoire, generator presets, realms/timing, persistence and economy. Two
  browser cases verified generated MIDI practice/guide dismissal/engraved numbers
  and reopening saved trials with the new version. Reviewed one rendered C-major
  score: clear RH-above/LH-below finger numbers without overlap. TypeScript,
  changed-file lint and production packaging passed; no exhaustive playthrough.
  Local API restarted. Owner still needs to try the guidance on a physical piano.

## Practice-time gold rebalance — local, 2026-10-31

Owner clarified there are no active players, authorized changing reward rules and
prices (and resetting test balances if needed), and requested a simple prelaunch
pace of roughly 50 gold per active practice hour. This supersedes the original
completion/replay economy described below. No balance reset was necessary.

- Base pay: 1 gold per 72,000 active MIDI milliseconds, identical across difficulty,
  note density, score accuracy and replay count. Fractional progress carries over
  between exercises, sessions and purchases. Mistakes still earn practice time.
  Trial/Studio/generated/focused practice all use the same passive MIDI activity
  observer; existing grading, notation, scrolling and audio clocks are unchanged.
- Activity is measured between valid note-on/release events during active play,
  using arrival performance.now(). Simultaneous hands/chords count elapsed time
  once. No time is extrapolated after the last event. Gaps over 10 seconds are
  discarded; pause, disconnect, hidden tab, completion and exercise switches reset
  the interval. This is an activity estimate, not a new correctness evaluator.
- Cumulative checkpoints save every 15 seconds and on stopping. Browser backup
  retains unsaved time for retry/reload. The existing music-room endpoint accepts
  a zero-time session start then cumulative active milliseconds. PostgreSQL rows
  economy:practice:<uuid> and the wallet update atomically under the existing user
  lock; retries/stale checkpoints cannot pay twice. A basic wall-time sanity bound
  is retained. No fingerprinting, replay discounts, daily caps or advanced anti-cheat.
- Wallet keeps integer gold plus total practiceMs and one-time milestone IDs.
  Old test-wallet fields default on read; no schema migration or live data reset.
  First trial clear: +2 gold; first boss clear: +5, once per challenge across all
  difficulties. Star and personal-best payouts are removed. Existing realm begin,
  authoritative results and progression remain in place for those small bonuses.
- All existing learning music remains free. Behr In May stays 150 gold (~3 hours);
  Czerny Op. 821 No. 2 is now 200 (~4 hours). Shop describes the intended 100–500
  gold / 2–10 hour range; future repertoire can be priced within that range.
- Targeted validation: 22 economy/realm/persistence unit and database tests passed;
  3 browser cases covered milestone saving, active MIDI time/idle/pause/error retry/
  fractional reload and the existing purchase/Studio flow. TypeScript, changed-file
  lint and client/worker production packaging passed. Physical MIDI remains an owner
  check. Local API restarted; nothing deployed. The original gold report in chat
  outputs describes superseded rules and should not be used as the current spec.

## Distinct first three trials — local, 2026-10-31

Owner reported Trials 1, 2 and 3 were the same. Confirmed: tier selection replaced
their original challenge levels, leaving identical seed, hands, length, rhythm
selection and difficulty inputs. At Novice seed 1 all three had the exact same
17 sounding notes. Their different objectives did not change the music.

- New realm attempts carry studyVersion=2. The shared composer receives a lesson
  rhythm focus only for these three trials. Novice uses half-note pulse, flowing
  quarter notes, then mixed quarter/half-note counting. Higher tiers distinguish
  steady quarters, even subdivisions, and dotted/offbeat phrases (Intermediate+).
  Pitch generation, starting fingers, notation, clocks and MIDI windows are intact.
- Map and detail descriptions match the selected tier. Opening completed trials
  preserves seed/key/tempo and progression while selecting the current lesson.
  Old queued receipts omit studyVersion and reconstruct their original music.
  Trials 4–5 and the boss keep their previous scores. No schema migration.
- Targeted checks: 20 realm/persistence/economy tests and 3 existing generator
  tests passed; two browser checks covered reopening completed trials with three
  distinct previews and the existing MIDI/reward/difficulty flow. TypeScript,
  changed-file lint and production packaging passed. No exhaustive playthroughs.
  Local API restarted for matching client/server generation. Physical keyboard
  feel remains an owner check. This fix and the economy are not deployed.

## Gold economy, Royal Music Shop and Practice Studio — local, 2026-10-31

The attached brief authorized implementation, not publication. The owner clarified:
"Keep existing music free for everyone; add new pieces." Production remains
`4d313d8`. Development work and unrelated Creator changes remain preserved.

- Added Realm Quest / Practice Studio / Royal Music Shop navigation and a compact
  balance outside active performances. Results show server-confirmed gold after
  the existing outbox saves. No optimistic gold is awarded on the client.
- Central rules: eligible trial 20 gold / boss 75; two stars +10 OR three stars
  +20; improving an existing difficulty-specific best by at least 2 points +10.
  A first result is not an improvement bonus. Minimum: passed challenge, 70% pitch
  AND rhythm, eight expected attacks, full score and at least 12 seconds.
- New musical studies get full rewards; similar-study completions get 50% on the
  second, then 25%, with a five-gold floor. The +10 improvement bonus is separate.
  Compare actual onset groups, durations, hands and key-relative pitch classes,
  ignoring tempo, register and seed/tier labels. At least four changed groups AND
  30% difference are required for a new study. The last 32 study families per
  challenge are retained across difficulties. This is intentionally simple, not
  a claim of tamper-proof physical-keyboard attestation.
- `/api/realms` begin records server start time under the existing verified
  identity. Finish regrades the canonical score as before and checks real elapsed
  time plus non-overlapping reward intervals. Missing starts/instant fabricated
  timelines earn no gold; old queued receipts still save realm progress. Raw MIDI
  grading and all timing windows are unchanged. Starting locks setup navigation
  until its request resolves so settings cannot change under a pending run.
- Wallet `economy:wallet:v1`, immutable purchase rows and award metadata in the
  existing realm-attempt rows share PostgreSQL transactions and the same per-user
  advisory lock. Gold/ownership are global to the account, separate from all five
  mastery tracks. Defaults are zero gold / no purchases. No migration or existing
  data rewrite is needed. An ownership check prevents charging twice even with
  different purchase IDs. Transaction IDs reject cross-item reuse.
- Shared metadata/access rules in `src/domains/economy/music-catalog.ts`. Existing
  published music is read from the existing catalog/service and stays included;
  existing admin publication controls still apply. Imported-owner and generated
  access categories are represented without implementing future import/save tools.
- Shop: Behr, In May (150 gold, Beginner); Czerny, Op. 821 No. 2 (100 gold,
  Intermediate). Each has a two-measure preview. Full private scores are returned
  only after ownership authorization; client builds reject the full score JSON.
  Rights, pinned source hashes and source-conversion notes are in
  `source-scores/royal/README.md` and `provenance.json`. Satie was excluded because
  its candidate conversion has invalid bar timing. The first catalog has two
  verified pieces, not fabricated entries to reach three.
- Studio extends the existing ClassicalPractice component with a supplied-score
  option. It reuses assessPractice, the MIDI bus, Verovio, score following and
  AudioEngine. Tempo, hand selection, replay and pitch feedback work without combat.
  Studio is self-paced and awards no official realm stars or gold in this version;
  gold is earned through validated Realm Quest completions. Existing generated
  practice remains free. Full-score practice uses source XML, not regenerated
  approximate notation. Both new scores pass pitch/onset/duration and hand tests.
- Targeted verification: 25 unit/database cases (economy, realms, realm persistence,
  existing music access); 4 browser cases (new reward/difficulty flow, purchase /
  shared MIDI / reload, existing failed-save recovery, existing generated MIDI
  practice). TypeScript, changed-file lint and production build passed. No exhaustive
  difficulty/trial browser campaign. Physical keyboard/audio and real account
  award/purchase flows remain owner checks; automated DB tests use local PGlite.

Files introduced: `public-app/economy-store.ts`, `music-room-service.ts`,
`music-room.tsx`, `music-room.css`, `royal-scores.json`; `src/domains/economy/*`;
`source-scores/royal/*`; `scripts/build-royal-repertoire.py`; `tests/economy.test.ts`.
Integration changes: realm service/progress/home, ClassicalPractice, API routing,
platformRequest, private-music-build and the existing realm browser fixture.

## Production publication — 2026-10-30

Owner instruction: "lets push this to production". Selectively promoted the
generator, Clockwork Kingdom, musical difficulty tiers and timing fixes into the
existing production worktree. Unreleased Creator Studio remains on development.

- Live domain: https://www.pianobossbattles.com/
- Release: `4d313d85d74c3c6cd9619d23b716fe242945d2ce`, pushed to
  `feature/end-user-website-v1`; release worktree clean.
- Cloudflare Pages production deployment:
  `9837911d-31e8-469e-8970-c641cbaddcdc`.
- Previous deployment for rollback: `c85acc6b-0c62-4a6b-87d3-26f199ea127c`,
  source `54541d0`. No schema migration or auth/hosting/binding change was made.
- Production worktree validation: TypeScript, changed-file lint, 16 realm/
  persistence/audio tests, 23 generator/engine tests and production client/worker
  packaging passed. No extensive browser playthrough campaign was run.
- Live HTML and JS/CSS byte hashes match the release build
  (`index-BrHZ1A1C.js`, `index-DA4JkZgp.css`). Health is 200/configured;
  unauthenticated realm POST is 401; cross-origin POST is 403.
- One live browser render showed the new welcome heading with no runtime errors.
  The first smoke attempt waited for network idle and timed out; a check waiting
  for the actual heading passed. This did not require an application change.
- Two private environment values were checked against release sources/output;
  no exposure found. Private music asset files are absent from the deployment.
- Real signed-in persistence and physical MIDI/audio/visual alignment still need
  owner verification. Public health and fixture tests do not prove those flows.
- Development files remain uncommitted and preserved. The release's homepage/API
  adaptations deliberately omit Creator routes. Do not merge the whole development
  branch to reproduce this release. Release details are in
  `.local/production-query-fix/RELEASE_CLOCKWORK_KINGDOM.md`.

## Musical difficulty and timing bug fixes — local, 2026-10-30

Owner steering superseded the initial forgiveness-mode request: keep all current
timing tolerances unchanged, prioritize five musical tiers, separate progression
by difficulty, and use targeted checks to minimize development/compute cost.
No Relaxed/Balanced/Precise selector, calibration, new performance modes, broad
browser playthrough, deployment or schema migration is included in this change.

- Tiers: Novice 50 BPM (suggested 40–60), Beginner 65 (55–75), Intermediate 80
  (70–100), Advanced 105 (90–125), Maestro 130 (110–160). Selecting a tier applies
  its preset; existing tempo adjustment remains. These are curriculum defaults,
  not new timing-forgiveness settings.
- New curriculumVersion=2 makes Novice use three-note melodies inside a fixed
  five-finger position, movements of at most four semitones, quarter/half notes
  plus held cadences, and one whole-note bass per bar. Other tiers retain the
  existing composer's increasing rhythmic/harmonic vocabulary. Lower tiers use
  steady-pulse preparation in the Syncopation Trap; dotted rhythms start at
  Intermediate. Boss phases use the selected tier with a gradual introduction.
  Original unversioned generator settings still reproduce their existing music.
- Per-difficulty snapshots use `realm:progress:v2:difficulty:<1..5>` in existing
  game_events. Stars, completion, attempts, rewards and unlocks are independent.
  `realm:progress:v1` and old receipts remain untouched; old untiered records are
  not silently assigned to a new musical tier. New tier tracks start separately.
  The client guards stale responses/outbox acknowledgements during tier changes.
- Timing values remain exactly rhythm +/-clamp(beatMs*.2,70,150), pitch matching
  +/-min(beatMs*.45,300). At 40/80/120/160 BPM these are rhythm 150/150/100/75 ms
  and pitch 300/300/225/168.75 ms. Difficulty never enters these formulas.
  Rhythm remains the original binary tolerance-based metric; stars stay 70/85/95.
- gradingVersion=2 fixes live target handling: targets participate immediately,
  early first notes are captured, unmatched targets remain pending until their
  full existing pitch-matching deadline, and final capture respects that deadline.
  The shared scorer consumes attacks chronologically and gives overlapping
  repeated pitches to the nearest expected onset, without widening windows.
  Exact duplicate packets are removed for analysis. Wrong-pitch substitutions
  are accounted once, and pitch denominators avoid counting one missed/replacement
  pair as two penalties. Raw timestamps are sorted rather than clamped forward.
  Old receipts retain their earlier grading interpretation.
- Live feedback shows the last matched onset deviation. Result diagnostics show
  signed/absolute mean deviations and each matched pitch's deviation. Negative
  means early; positive means late. This is not a hardware-latency measurement;
  player timing, MIDI/audio delay and display latency remain distinct. No offset
  compensation is applied. Shared MIDI, notation, scrolling and metronome engines
  are retained; count-in pause/resume preserves its remaining time.

Targeted verification: 14 realm/scoring/database tests and 2 generator tests pass,
including unchanged thresholds at four BPMs, early inputs, pending deadlines,
simultaneous hands/repeats/duplicates, 27 small Novice configurations, five presets,
Novice versus Maestro content, and separate persistent difficulty records.
One reused Classical-practice browser case passes MIDI/notation/repeat behavior.
TypeScript, changed-file lint, build and diff whitespace checks pass. No full
test suite or cross-difficulty browser campaign was run for this iteration.
Two genuine failures found and fixed were an unreachable Novice melodic
continuation and a Maestro content filter requiring Intermediate-only notation.
Existing Vite/Verovio build warnings are unchanged. Physical MIDI timing and
audible alignment still require owner testing on the actual piano/audio device.

## Clockwork Kingdom — local playable rebuild, 2026-10-30

The owner explicitly authorized replacing the default combat loop with the
music-first realm described in `docs/proposals/clockwork-kingdom.md`. This
supersedes the old default-gameplay preservation rule for the local player page.
Implemented on `feature/creator-studio-v1` at HEAD `714fdb8` plus uncommitted work.
NOT deployed; production remains in the separate `54541d0` release worktree.
No migration, RLS/auth/SMTP/DNS/billing change, new dependency, or player-data reset.

Default `/` now opens the Clockwork map after login. Five sequential trials teach
steady pulse, eighth-note streaks, dotted/offbeat precision, staff coordination
and phrase mastery. The King combines four eight-measure phases. Regular trials
have no combat controller, damage, HP, attacks or cinematic interruptions.
`/legacy-battles` retains the previous player page and saved records. Creator,
OBS, admin music and auth/recovery routes remain available. The old combat files
still have active legacy/Creator/OBS consumers, so deleting them would be unsafe.

Implementation boundaries:

- `src/domains/realms/types.ts`, `registry.ts`: challenge metadata, prerequisites,
  thresholds/objectives, rewards and versioned progress. `content.ts` reuses the
  existing Classical generator, retaining key/seed/tempo/version for replay. It
  requires actual dotted/tied rhythm vocabulary, combines boss phases and slices
  measured weak phrases without changing their notes. Initial keys are C/G/F
  major, 4/4, 40–160 BPM. Starting-finger suggestions remain on both active staves.
- `performance.ts` aggregates the existing `scorePerformance` matches, using an
  opt-in fixed timeline instead of aligning the first played note. Targets receive
  rhythm credit only inside the onset tolerance; absent notes receive none.
  Stars use the lower of pitch/rhythm: 70/85/95, with streak/coordination/crystal/
  phase gates. A full-duration attempt can end in failure even with no input.
  Staff accuracy includes timing and pitch; MIDI does not identify physical hands.
  This release does not award mastery for release duration, pedal or dynamics.
- `progression.ts` preserves bests and prior completion, counts attempts, grants
  each reward once and applies data-driven prerequisites. The Singing Forest is
  an explicitly nonplayable next-realm destination after victory.
- `public-app/realm-service.ts` reconstructs exercises and regrades receipts on
  the server. `/api/realms` uses existing verified identity and origin checks.
  A per-user PostgreSQL advisory lock plus one transaction makes attempts and
  progress atomic. Identical UUID replay is idempotent; altered replay, locked
  challenges and account swaps are rejected. Namespaced `game_events` rows
  (`realm:progress:v1`, `realm:attempt:<uuid>`) coexist with all legacy records.
  No XP is granted or existing XP rewritten. Existing RLS remains intact.
- `realm-progress.ts` implements a per-user durable localStorage outbox, retry and
  online recovery. Progress/unlocks update after server acknowledgement. Browser
  E2E found and fixed an empty-outbox promise that blocked subsequent saves.
- `realm-home.tsx`, `realm-performance.tsx`, `realm.css`: map, details, focused
  performance, measured results, retries, slower weak-measure practice and separate
  staff preparation. A shared MIDI subscription and one performance clock drive
  grading, current measure and notation. Count-in happens once; pause/resume,
  disconnect/background pause and restart keep clock state coherent. No notes
  are saved for abandoned or isolated practice runs. A compact text feedback line
  accompanies note colors. Tablet attempts use two measures per line with frozen
  line breaks and measured SVG bounds; desktop uses four.
- `realm-cinematic.tsx`: local SVG Clockwork King, an eight-second introduction
  and five-second victory/defeat transitions. Skip is always available; reduced
  motion disables animation/timed dismissal and provides Continue. No autoplay
  cinematic sound. The active boss portrait stays small and static.
- Shared changes: optional fixed-origin/match-window and returned matches in
  `src/domains/scoring/engine.ts`; optional clock alignment and cancellation of
  pending starts in `src/domains/music/audio.ts`; optional readiness callback and
  broadcast page width in `src/components/music/notation.tsx`; optional realm
  endpoint in `src/lib/platform-request.ts`. Existing defaults are retained.

Verification: **519 tests passed in 75 suites**, including PGlite persistence,
RLS isolation, replay, locks, star thresholds, offbeat failures, measured staff
timing, phrase targeting, seeded vocabulary and metronome scheduling/cancellation.
The four new Playwright cases pass all six encounters/reload, queued-save recovery,
pause/reconnect/restart, and tablet/reduced-motion boss phase/defeat flows. TypeScript,
changed-file ESLint, production build and `git diff --check` pass. The build retains
the existing Vite native-config/Verovio external-module warnings.

The final browser regression selection covered 22 cases: 21 passed together and
the expired-recovery case passed on rerun after the legacy test fixture was fixed
to preserve URL hashes. Coverage includes login/registration/recovery, Creator
access and both layouts, continuous legacy MIDI/loops, held victory, notation
themes, Hanon containment, audio preferences, inert previews, Classical practice
and all four new realm cases. This was a selected regression run, not all 72
public browser cases.

Limits: browser MIDI/Auth/persistence are fixtures; database behavior was tested
with real SQL in PGlite using the existing migration, not production accounts.
Physical MIDI, audible latency and real account save/recovery need owner testing.
The new realm is not wired into legacy Creator/OBS broadcasting. Artwork is
lightweight local vector/CSS rather than commissioned cinematic assets. The
generator is a constrained Classical study vocabulary, not general composition.
No adaptive difficulty or further playable realms were added.

Next realm: extend the registry/content with Singing Forest melodic intervals,
question/answer phrasing and controlled articulation; add measured velocity or
release grading only after validating hardware variability. Keep independent
realm completion state when introducing the second playable realm, and preserve
the v1 Clockwork receipts/seed reconstruction for old records.

## Infinite Classical Practice — local implementation, 2026-10-30

Follow-up: generated exercises now mark the first sounding note of each selected
hand with a suggested starting finger. The deterministic opening-position helper
uses nearby notes and prefers longer fingers on black keys where a five-finger
position permits it; this is not full-piece fingering. The existing ScoreNote.finger
field is emitted through MusicXML technical/fingering (RH above, LH below), and
the practice panel explains the start pitches and finger numbers. Opening rests
and inactive hands receive no marking. Notes, seeds and MIDI grading are unchanged.
Verification: 14 focused generator/legacy-notation tests and two practice browser
cases passed, including visible Verovio fingerings for both and single hands.

Implemented locally on feature/creator-studio-v1; NOT deployed. Production remains
54541d0 in the separate release worktree. No migrations, auth/SMTP/DNS, preview
hosting, original Sites/D1, or reward-service changes.

- Entry: the separate Infinite Classical Practice button in public-app/player-home.tsx.
  The battle controller and MIDI setup remain mounted; entry is disabled during an
  active battle or held cinematic. New practice uses the shared MIDI bus directly
  and the unchanged assessPractice evaluator, never GameClient reward commands.
- public-app/classical-practice.tsx/.css: level 1–5, 12 major/relative minor keys,
  40–160 BPM, 8/16/32/64 bars, either/both hands, seed reproduction, new/repeat,
  pause/resume, disconnect pause, existing AudioEngine metronome and Verovio follow.
  Results are session-local pitch accuracy, not precise rhythm/release grading,
  persisted progress, XP or battle records. UI explicitly states this boundary.
- src/domains/music-generator/: deterministic versioned generation, difficulty
  rhythms, tonal spelling, functional harmony, related four-bar question/answer
  phrases, motif sequencing, bass voice leading, half/authentic/imperfect/plagal
  cadences, secondary dominants, natural/harmonic and contextual melodic minor.
  The fixed-length engine emits existing Exercise/ScoreNote data, with bounded
  retries and independent checks for bars, durations, ranges, ties, harmonic
  membership, cadences and unambiguous MIDI groups. Continuous streaming and
  automatic adaptation remain future work. This is a constrained homophonic
  vocabulary, not a general contrapuntal composition system.
- hosted/sight-library.ts adds optional rest/spelling/keySignature fields.
  hosted/structured-score.ts is the opt-in MusicXML conversion path for keyed,
  sequential hand voices, supporting rests, dotted values, ties and beat beams.
  Old basic/polyphonic engraving stays on its original path; the generated mode
  does not use the old sharp-only polyphonic converter or pretend it supports
  arbitrary independent chord voices. Shared notation adds an optional readiness
  callback so practice cannot start before rendering.
- Generated number 0 is never sent as a catalog ID. A future rewarded version must
  introduce a reviewed server-reconstructed seed/settings/version attempt contract
  and retain authorization/idempotency. Do not relax catalog publication checks.
- Read-only service inspection in the continuation found Supabase ACTIVE_HEALTHY,
  DNS resolving and Auth health 200, with production assets still matching 54541d0.
  Recovery cause and real user login/progress remain unverified.
- Automated evidence is fixture/simulated MIDI only; it does not prove physical
  piano input, acoustic metronome output, real saved progress or native OBS.
  See tests/classical-generator.test.ts and the classical cases in
  tests/public-browser/home.spec.ts for reproduction.

Verification: 505 unit/database/network tests passed (72 suites); seven focused
browser cases passed (two new practice cases, two inert battle previews, Hanon
rendering, held Victory, and continuous loops/pause/mounted score). TypeScript,
changed-file lint and build passed.
The generator suite includes 720 settings/seed combinations and 72 MusicXML
round trips. Existing Vite/Verovio build warnings remain unchanged.

Updated: **2026-10-30**, America/Los_Angeles. This is the detailed continuity guide
for the independent public website. Read it with [AGENTS.md](../AGENTS.md).
Older reports preserve historical evidence; their pending-deployment statements
and test counts must not be treated as current facts. Recheck Git and service state
when work resumes. No functionality or deployment was changed for this handoff.

Read [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) first for the consolidated current
architecture, source map, release/worktree distinctions, login blocker and next
feature. Earlier dated sections below preserve history; their old direct-start
flow, Balanced default, preview hosting and release tables are superseded by the
Oct 21 release update and Oct 30 context. Existing instructions remain in force.

The full Infinite Classical Practice proposal is archived at
[proposals/infinite-classical-practice.md](proposals/infinite-classical-practice.md).
It is pending work, not implemented during the documentation handoff. At handoff
start only this file had uncommitted edits (the inactive-Supabase incident note);
the production release worktree was clean at 54541d0. No application tests were
rerun for this documentation-only update; previous test counts remain dated evidence.

## Login fetch incident — 2026-10-30

Owner reported login "failed to fetch". Public HTML and /api/health return 200,
but huxmltjtovpxxxupuxdg.supabase.co returns NXDOMAIN from local DNS and both
Google/Cloudflare DNS-over-HTTPS. Auth health cannot resolve. Existing Supabase
CLI authorization confirms the correct linked project exists with status INACTIVE.
This establishes backend unavailability, not invalid player credentials. Whether
it was auto-paused or manually paused is not yet confirmed. The dashboard opens
at sign-in and requires owner login before inspecting a normal restore action.
No code, billing, DNS, auth settings, data or deployments changed. Do not replace
the project, reset its database or upgrade billing as an assumed fix. After a
normal restore, verify DNS/auth health and real player login/progress.

## Adjustable battle sizing published — 2026-10-21

Owner authorized "push to production". The approved preview/start and sizing
files from 529776e were promoted selectively to production release 54541d0,
preserving e499e13 storage fixes and excluding unrelated Creator changes.
Deployment c85acc6b-0c62-4a6b-87d3-26f199ea127c is active at
https://www.pianobossbattles.com/. Client index-Ceq2q5lZ.js and CSS
index-Cmy41hxy.css match the release. Rollback remains
b6ba6b74-7727-4912-9493-f1e4ce0228d0 (e499e13).

Exact release: 491 unit/database/network tests, 16 focused browser tests,
TypeScript, changed-file lint, packaged build and credential scan passed.
Live HTML/assets/branding and both OBS routes returned 200; unsigned platform
writes returned 401 and foreign-origin session writes 403. Authenticated
physical-MIDI gameplay remains owner verification; fixture tests do not prove
that live behavior. No DNS, auth/SMTP, database or original-app changes.
The local-only statements below are historical and superseded by this release.

## Local adjustable battle sizing — 2026-10-21

The owner superseded the three presets: use Music Focus dimensions (40% arena,
60% music) as the single default, with manual sizing. Preview now offers an
Arena size slider, 30–70%, percentage labels and Reset to 40%. No in-battle
control was added. Existing attempt locking, mounted score and result lifecycle
remain unchanged. Local preference key is pbb:battle-layout:v2:<userId>; retired
v1 preset values intentionally do not override this new default. Nothing is
written to the database. Public-only idle framing interpolates closer positions
for shorter arenas using cached configurations and existing scaling/contact
rules. OBS and Shorts remain unchanged. Local only; no release authorized.

Verification: 497 unit/database/network tests, TypeScript, changed-file lint and
build passed. All 17 focused browser cases passed: 30/40/70% at all three target
viewports with full notation containment, weapon contact and held results;
both-boss default layout tests; continuous loops/pause/resume and OBS routes;
local persistence, custom 57% size and Reset without server preference writes.
Screenshots are ignored under .local/layout-presets/ (numeric size prefixes).
The first run's three default-size failures were a test assumption: filling a
slider with its unchanged default emits no change event or storage write. Tests
now explicitly change the value before verifying persistence. No runtime fix
was needed for that assertion. Browser tests use simulated MIDI fixtures.

The preset implementation and verification below describe its predecessor.

## Local battle layout presets — 2026-10-21

Pre-start arena preview now includes three visible Battle Layout buttons with
an explicit pressed state (replacing the initial dropdown at the owner's request). Battle
Focus uses 70/30 and Music Focus 40/60 of space below the HUD. Balanced leaves
the existing responsive grid and framing unchanged and is the default. The
preference is stored per user in localStorage (`pbb:battle-layout:v1:<userId>`),
with safe fallback if storage is unavailable. There are no server preference or
schema changes. Start Battle captures the selection for the attempt; controls
disappear during play, pause/resume and held results. The score remains mounted.

Only public-app layout configuration/CSS changes. Music Focus uses closer idle
horizontal anchors (.395/.605) to maintain weapon reach in its shorter arena;
existing scale, foot anchors, solver, animation and gameplay rules are retained.
The original Balanced configuration was moved unchanged into
public-app/battle-layout-presets.ts. OBS and Shorts are unaffected.

Verification: 497 unit/database/network tests, TypeScript, changed-file lint and
build passed. Ten focused browser tests passed: all three presets at 1366x768,
1440x900 and 1920x1080, plus persistence without server preference writes. These
cover Schmitt/Hanon, both bosses, full visual notation bounds, mounted score,
first-note scoring, sword contact, layout locking, and held Victory/Defeat/TIME
OUT text containment. Four existing preview/loop/pause/resume browser regressions
also passed, including both OBS routes. Captures are ignored under .local/layout-presets/. These
are simulated-MIDI fixture tests, not physical MIDI or OBS recording validation.
Local only at http://localhost:5173/; production approval is still required.

## Local arena preview action — 2026-10-21

The owner requested replacing setup's Start Battle with Preview Battle. The
preview opens the existing modal arena and mounted score; Start Battle inside
that same modal is the sole action that authorizes music and starts the attempt
and countdown. This is not the removed separate Battle Preview page.

Preview requires an available, loaded setlist, but not MIDI access. Starting
still requires connected MIDI and the existing readiness/authorization checks.
Closing a preview makes no attempt; MIDI during preview does not score, damage,
advance notation, or create checkpoints. The existing MIDI setup stays mounted
in setup, with no additional listener. Back to setup pauses a running attempt;
Resume Battle resumes it without another countdown. One mounted score is reused.
Authorization errors are shown once inside the modal rather than duplicated
behind it. Gameplay, data, OBS/Shorts, auth and storage are unchanged.

Runtime change: public-app/player-home.tsx. Tests adapt the existing launch path
and explicitly exercise inert previews with both bosses, connection gating,
score identity, first-note scoring, and pause/resume. Screenshots are ignored at
.local/hybrid-layout/preview-grinwick.png and preview-crimson.png. This feature
is local for review at http://localhost:5173/ and has not been deployed. The live
release remains e499e13 below; a new production release needs explicit approval.

Verification: 58 focused unit tests, TypeScript, changed-file lint and build
passed. The full 56-case browser run passed 53 cases and exposed two UI issues
(duplicate authorization alert and missing loading feedback) plus a timing issue
in the expired-save fixture. UI issues were fixed; the fixture now rejects a
non-empty MIDI checkpoint and compares its first rejected/accepted receipt,
rather than a later periodic checkpoint. All six targeted rechecks passed,
including every failed case and previews with both bosses. No full-suite rerun
was made after those final corrections. No gameplay/auth runtime was changed.

## Save-session recovery published — 2026-10-21

Owner explicitly approved this release with "YES DEPLOY". Runtime/tests from
`704efc8` were promoted selectively to release commit `e499e13` and deployed using
the guarded production helper. Deployment:
`b6ba6b74-7727-4912-9493-f1e4ce0228d0`; client `index-CSq6jZ42.js`.
Rollback: `d2d42ba1-2273-4e71-bb64-e8b0a768bac3` (`2a9f941`).

The exact production candidate passed 489 unit/database/network tests (68 suites),
seven focused browser regressions, TypeScript, changed-file lint, build packaging,
and the 73-file private-credential scan. Live HTML/client/CSS matched; both OBS
routes returned 200, unsigned writes 401, and foreign-origin writes 403. The
verification browser showed the login page, so authenticated saved progress and
actual expiration recovery on this release remain owner verification steps.
No auth settings, DNS, schema, layout, gameplay or removed preview were changed.
The earlier local-only status below is historical and superseded by this release.

Owner reported the live "Your session expired. Verify your email and sign in"
save warning. It was observed in the real production UI. The exact provider-side
reason for that rejection was not captured. Code inspection established that
platform commands retried the rejected HttpOnly session cookie without renewing
it; provider outages were also mislabeled as expired/unconfirmed accounts.

The local fix registers a public-only session recovery adapter. A platform 401
renews the same Supabase user's session, synchronizes the server cookie, and
retries the identical command once. Concurrent failures share recovery; failed
recovery leaves the outbox intact. Legacy/Sites calls have no adapter and remain
unchanged. Provider throttling/unavailability now returns 503; rejected sessions
and unconfirmed emails remain authenticated failures with distinct messages.
No auth configuration, email verification, database or gameplay rules change.

Verification: 495 unit/database/network tests, TypeScript, changed-file lint,
production build and seven focused browser cases passed, including expired save
recovery, queued MIDI during a temporary provider outage, unchanged checkpoint
identity, retained battle/countdown, and password-recovery regressions. This fix
was initially local, then approved and released as recorded above. Do not clear
browser storage or discard queued progress as a workaround.

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







