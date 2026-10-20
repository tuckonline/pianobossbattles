# V10 — Cinematic battle results

## Integration audit

The deployed application is React 19/Vite in `hosted/`, served by the existing Cloudflare Worker/D1 application. It does not use a new animation dependency or MIDI subscription.

| Existing system | Integration |
| --- | --- |
| `app.tsx`, `obs.tsx` | `/obs/recording` retains its banner and single `OverlayReceiver`, SSE/HTTP fallback and local WebRTC feed. A result overlay is a sibling of the existing score, inside `obs-recording-content`. |
| `obs-score.tsx`, `src/components/music/notation.tsx` | Verovio SVG, full visual bounds fitting, note feedback and score following are unchanged. Notation never unmounts when a cinematic starts or ends. |
| `boss-battle.ts`, `battle-modes.ts` | Existing authoritative victory, knockout defeat and timeout determine the scene. Abandonment/unfinished attempts are excluded. The exclusive timer deadline still wins against a final note delivered at/after expiry. No gameplay changes. |
| `battle-animation-director.ts`, `battle-stage.tsx`, `boss-ui.tsx` | Existing attacks and terminal finishers run during the first 100–500 ms. Large scenes cover the entire middle region afterward. The active 22%/78% split and normal sprite animations are unchanged. `boss-ui` adds only an attempt identity diagnostic attribute. |
| `battle-animation-player.tsx` | Exports its existing cached image loader. Four fixed cinematic assets preload through the same cache; no new full-size canvas per ending. |
| `game-client.ts`, `obs-state.ts` | A presentation-only dismissed-result ID travels through the existing live snapshot. The dismiss action emits UI state; it never invokes an evaluation/reward command. |
| `game-core.ts`, `game-settings.ts` | A defaulted nested `cinematics` settings object uses the existing saved settings and normalization. The existing celebration queue can defer its cosmetic age during a cinematic. |
| `game-ui.tsx`, `sight-reading.tsx` | Saved settings and remote dismiss button live in normal practice controls. Practice cinematics are opt-in. A local Skip button appears outside the read-only recording output. |

## New presentation modules

- `cinematic-config.ts`: validated/defaulted settings, including upgrades for old saved profiles.
- `battle-cinematic.ts`: stable IDs, three data-driven timelines, bounded receipts, pure deterministic state machine, frozen authoritative result statistics.
- `battle-cinematic-ui.tsx`: lifecycle hook, shared image loading, independent renderer and optional audio cue callback. Phase changes update React; per-frame transforms/opacity update the overlay DOM only.
- `battle-cinematic.css`: responsive layered composition, cyan finishing crescent, crimson impact, defeated poses, typography and reduced motion.
- `cinematic-controls.tsx`: persisted controls, optional practice overlay, presentation skip, developer-only opt-in preview.

## Timelines and art

Victory lasts 4.8 seconds, defeat 4.1 seconds and timeout 3.1 seconds at normal duration. Each timeline contains preparing, entering, action, impact, result and exiting states. `Date.now()` elapsed time selects the phase, so slow frames skip forward rather than delaying game logic. A manual hold stops at the result stage; Skip cancels presentation only.

The four existing atlases are 1024×1536, divided into 4×8 cells. Individual poses are approximately 256×192 before crop/registration, unsuitable for a 600px cinematic figure. The four new transparent illustrations are 1024–1208px wide and 1302–1536px high. All use the existing canonical sprite sheets as identity references.

The new scenes use layered 2.5D translation, authored energy geometry and crossfades between genuine distinct standing/defeated illustrations. They are not new articulated frame sequences. Existing in-arena sprite sequences still animate normally underneath.

Assets are in `hosted/public/battle/cinematics/`:

- `hero-finish.png`: grounded Piano Blade follow-through, two cyan blades, navy armor/cloak, piano-key details, facing right.
- `hero-defeated.png`: same hero kneeling and bracing on a dim cyan sword, head bowed.
- `boss-dominant.png`: Crimson Colossus roaring and reaching left, original horned anatomy, dark armor, music-staff markings and fissures.
- `boss-fallen.png`: same boss collapsed on one knee with lowered head and grounded claw.

Created with the built-in image-generation tool. Prompt set: high-resolution, single full-body transparent 2.5D anime fighting-game cutouts; preserve the supplied canonical identity, costume, anatomy and weapons; no redesign, duplicates, text, interface, ground plane or unnecessary background. Each pose is specified above. Original generated alpha is preserved. No existing atlas is replaced. Registry paths can be replaced independently.

If required art is unavailable after 650 ms, the scene uses a clean CSS/typographic fallback for that playback. A late image cannot suddenly pop into the ending. Loaded artwork stays in the existing fixed-path cache. No repeated downloads or canvas allocations per result.

## State and interruption policy

Result ID is `<stable battle attempt ID>:<victory|defeat|timeout>`. The controller must have observed that same battle before the terminal snapshot. Initial terminal snapshots after refresh/reconnect are restoration, not new events. A bounded local receipt list (128 IDs per viewer/player) is claimed when a result arrives, not when it finishes. In-memory deduplication also remains active if storage is unavailable or corrupt.

Switching exercises, starting a different battle, disabling Boss Mode or cinematics, going offline/hidden, or pressing Skip cancels the overlay. Returning to a hidden page does not replay an old result. Same-battle completion and loop snapshot updates do not unmount the score or restart playback. Leaving the recording route unmounts the presentation and cancels its animation frames/listeners.

The score underneath keeps receiving current note feedback, following and progress. No notation cache or frozen score image is used. The banner remains visible. The scene is bounded to the website middle region and cannot cover the separate OBS camera.

## Notifications

In the unified recording view and opt-in practice view, result cinematics temporarily hide and pause the existing celebration queue, including an already-visible notification. Queued notification age is extended by the hold duration; a manually held result does not expire earned announcements. After exit, the current notification resumes with a fresh display interval, then the existing priority order proceeds. Already-started achievement receipts are retained; no extra audio/reward is issued on resume.

Changing exercise/session clears stale queued cosmetic presentations. Permanent XP, achievements and records remain stored and untouched. Legacy standalone overlay routes retain their independent presentation behavior during migration.

## Settings, setup and limitations

Use **Progression & recording controls → Battle result cinematics**. OBS cinematics default on; practice cinematics default off. Settings include intensity, duration (0.5×–2×), automatic dismissal, minimal statistics and motion preference. Reduced-motion `auto` respects the device outside dedicated recording; `always` applies to OBS too. Audio is silent. The persisted `audioEnabled` setting and renderer `onAudioCue` callback provide optional future impact/result audio integration without creating an AudioContext now.

The statistics use the terminal snapshot's HP, mistakes, expected-note progress and evaluated attempt-best combo. XP is intentionally omitted: the OBS feed does not expose a committed per-battle XP transaction, so the cinematic cannot label provisional XP as earned. The existing live banner still displays durable XP normally.

No SQL migration, account reset, new permissions or OBS URL change is required. Refresh the existing practice page and OBS Browser Source after deployment. Continue using `/obs/recording` at 1920×750 or another source height.

Developer preview is explicitly opt-in on the practice URL with `?cinematicPreview=1` (or `&cinematicPreview=1`). It supports all three outcomes, scrubbing, half speed, impact/results jumps, debug bounds, multiple aspect ratios, reduced motion, missing assets and cancellation. It never mutates game progress and never mounts controls inside OBS.

## Validation

- 327 unit/integration tests pass, including 22 V10 tests and existing D1, timer tie-breaking, correction, idempotency, loops, difficulty and scoring tests.
- Seven targeted browser scenarios pass: three real-time captured scenes, notification priority/skip/cancellation/layout, real MIDI evaluation during a held defeat, failed network artwork/repeated playback/preview isolation, and legacy-profile compatibility.
- Eight existing OBS/V9 scenarios pass: all three game modes, timeout/pause, Boss ON/OFF, five notation collections, viewport changes, live XP/PBs/reconnect, achievements/streaks, and rapid two-handed Hanon.
- Unified Hanon at 240 BPM: p95 frame interval 16.7 ms, maximum queued combat batches 4 in local Chromium.
- TypeScript and production build pass. Targeted lint for new cinematic modules/tests and edited UI passes. Full-project lint reports 11 pre-existing errors in older preview/score-size/test files; no new errors.
- 1920×750 normal-speed browser recordings and representative frames saved in workspace `work/v10-review/`. Reviewed all three recordings at 1× speed, including title readability, large character composition, color transitions and score restoration. Screenshot captures and DOM-identity assertions verify complete grand-staff visibility after restoration.
- The actual OBS application/CEF build and physical piano hardware were not directly exercised. Tests use Chromium Browser Source-sized viewports and the existing MIDI test device through the real evaluator. Local performance is not a guarantee for every OBS device/GPU.
