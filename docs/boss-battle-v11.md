# V11 — Persistent results, victory choreography and timed loops

Presentation follow-up: [Original cinematic restoration](cinematic-visual-restoration.md) supersedes the victory-artwork/choreography sections below. V11's functional improvements remain in place; this document retains the original release history.

This supersedes V10's automatic exit and focus/offline dismissal policy. This is the verified V11 release candidate; deployment and live verification are recorded separately after publication. The earlier approval-service capacity failure was an infrastructure limitation. Browser execution subsequently became available under the supplied permissions; the standard runner executed without changing security settings. See the results below and [the manual verification guide](v11-manual-verification.md).

## Integration and audit

The existing React/Vite frontend, Worker/D1 persistence, practice MIDI evaluator and single OBS live receiver remain in place. The score remains mounted underneath the cinematic, and the HUD and 22%/78% battle/score split remain unchanged.

- `battle-cinematic.ts`: deterministic terminal-result controller, stable battle result IDs and persistent `holding` state. A first terminal snapshot restores the final scene immediately. Receipts prevent replay of animation, not restoration. Loading placeholders cannot be mistaken for an exercise selection change.
- `battle-cinematic-ui.tsx`: elapsed-time rendering stops requesting animation frames at holding. Visibility changes retain the scene and catch up without restarting it. Resizing repaints the held composition once.
- `cinematic-controls.tsx`, `cinematic-config.ts`: automatic dismissal is removed. Legacy `autoDismiss: true` settings normalize to false. Duration controls affect the animation only; manual dismissal and opt-in practice display remain available.
- `cinematic-choreography.ts`, `battle-cinematic.css`: victory preparation, sword-tip-to-chest contact, recoil, stagger, collapse and a distinct victory pose. Geometry uses authored artwork landmarks and responsive stage dimensions. Motion remains layered 2.5D, not a new sprite sequence.
- `obs.tsx`, `obs-score.tsx`, `boss-ui.tsx`, `practice-battle-status.tsx`: compact duplicate result text is suppressed during cinematics; the underlying actor animation loop is paused while holding. Disabling cinematics restores compact outcomes. Normal practice HP remains visible.
- `game-client.ts`, `sight-reading.tsx`: explicit restart resets the battle presentation; post-result notes and Stop retain the terminal result. The existing scoring loop counter remains authoritative.
- `battle-modes.ts`, `boss-battle.ts`, `boss-schema.ts`, `battle-mode-ui.tsx`: selected loop metadata is carried into the existing run and timer; the UI explains per-loop manual limits.

## Lifecycle

`hidden → preparing → entering → action → impact → result → holding`

Victory runs 4.8 seconds; defeat 4.1 seconds; TIME OUT 3.1 seconds at the normal multiplier. The last exit interval now retains the finished scene. There is no automatic dismissal. TIME OUT's existing artwork, CSS, title, stage boundaries and transitions up to the old exit remain unchanged; the requested persistent ending replaces the exit.

Only a fresh terminal transition observed for an existing battle animates. OBS refresh or a stale/offline terminal snapshot restores the final held composition, with no audio or gameplay event. New exercise, new battle identity, explicit restart, Boss OFF, cinematic OFF, or manual dismissal clears it. Focus changes, elapsed time, additional note feedback and achievements do not dismiss it.

Result statistics freeze from the authoritative terminal snapshot. Presentation never updates HP, MIDI connectivity, evaluator cursor, scoring, XP or unlocks. No database migration or new MIDI listener is introduced.

## Loop calculation and root cause

`battleMusicalBeats(exercise, loops)` already returns the complete run duration. It accounts for Schmitt's final cadence only on the last pass. Multiplying that value by loops again would be incorrect.

The manual `explicitTimeLimitSeconds` path previously ignored loops. It now means **seconds per loop**, with total limit `ceil(explicitSeconds * selectedLoops)`. Automatic timing remains `ceil(fullRunQuarterNoteBeats * 60 / selectedBpm * allowanceMultiplier)`; rounding occurs once after the full duration calculation. Boss HP uses the existing complete scored-note count, without another multiplier.

A separate boundary bug paused the battle while saving each pass. Pass completion now ticks the existing clock; `next-loop` changes the scoring attempt identity without resetting, pausing or resuming the timer. Explicit user pause still stops elapsed time. Both Time Attack and Ultimate Boss use the same path. BPM, allowance, loops and manual limit are frozen for the running battle; saved changes apply to the next run.

For a score whose final cadence is omitted from intermediate repetitions, three passes have three repetitions of the main section and one cadence, so they are intentionally slightly shorter than three complete single-pass scores.

## Notification policy

The existing celebration queue is blocked while the cinematic is active or held. Its cosmetic TTL is extended for the hold duration. Manual dismissal or a new attempt in the same exercise resumes deferred celebrations in normal priority order. Changing exercise/session clears stale cosmetic presentations. Earned unlocks and XP remain persisted regardless of whether a notification is shown. Existing standalone OBS routes retain their independent behavior.

## Artwork

One new transparent asset: `hosted/public/battle/cinematics/hero-victory.png` (1024 × 1536 RGBA). Generated using the built-in image-generation tool with the existing `hero-finish.png` as the canonical reference. The four V10 illustrations and all gameplay atlases remain unchanged.

Prompt intent: one high-resolution full-body Piano Blade victory pose; preserve dark spiky hair, navy/black armor, piano-key waist details, cape and two cyan swords; upright proud three-quarter stance facing right; lowered arms and blades diagonally downward; consistent anatomy and proportions; all weapon tips within the frame; transparent background; no interface, text, ground plane or ground shadow.

Original generated asset: `C:/Users/aaron/.codex/generated_images/01a0b704-b192-75e1-8ab2-85aaaef0ba0e/exec-5a0ded35-4bf4-4b2c-a560-878dc8fe9d0e.png`. No image post-processing was used. Asset paths remain replaceable through the existing cinematic registry.

## Verification status

### Follow-up: root cause of the three reported browser failures

The dismissal failure reproduced specifically at **cinematics disabled**, not restart, exercise selection, or Boss OFF. The test changed `snapshot.game.settings.cinematics.enabled` only in the temporary `/api/obs` payload. `readOverlay()` in `hosted/obs-service.ts` deliberately replaces those settings with the player's persisted profile settings from `readGame()`. The persisted setting was still enabled, so the presentation correctly remained visible. This was a fixture error, not a missing effect dependency or cinematic cleanup failure.

The corrected fixture saves through the existing `/api/platform` `gameSettings` action. Assertions explicitly prove that an unsaved snapshot setting cannot override the authoritative profile, then verify the saved setting reaches OBS and dismisses the cinematic. The cancellation test now covers all three results against restart, new attempt, exercise change, Boss OFF, and cinematic OFF, with retained-score identity checks and before/after screenshots. Additional tests exercise actual practice controls and ordinary MIDI beneath held endings. The existing playback already contains result, exercise and attempt identity; no redundant held-result store or new dismissal timer was introduced.

The other two failures expected compact victory/defeat messages during a cinematic. Their assertions now require the correct full cinematic and absence of duplicate compact notifications. Separate fallback assertions require compact Victory, Defeat and TIME OUT results when cinematics are disabled. Existing HP, scoring, XP, personal-best, reconnect and performance assertions remain.

This follow-up changes tests and documentation only; the existing V11 application implementation is preserved. Targeted regression: **10 browser tests passed**, including the expanded 15-case cancellation matrix. Combined unit/database/network run: **344 tests passed across 46 suites** (the original 314 plus 30 database/network tests). TypeScript passed; changed-file lint reported no errors and one existing hook-dependency warning. The production build passed; complete-suite results and limitations are recorded below.

### Current validation and release scope

- Preserved baseline: **314 non-network tests**. The combined rerun passed **344 tests across 46 suites**, including all 30 database/network tests.
- The focused cinematic/OBS run passed **10 tests**; real practice-control dismissal tests passed **3 more**. The expanded cancellation test covers Victory, Defeat and TIME OUT against all five intended triggers. Ordinary MIDI, Stop, score DOM identity, reconnect, XP deduplication and fallback compact outcomes are asserted.
- TypeScript, production build and changed-file lint passed. Changed-file lint has one existing hook-dependency warning in `sight-reading.tsx`. Full-project lint previously reported 11 unrelated errors and is not represented as clean.
- Complete historical browser run: **101 passed, 39 failed, 0 skipped (140 tests, 28 minutes)**. Every V11-focused test passed in this run. Two additional V5 signature-ending tests used the same obsolete compact-result expectation; their assertions now require the full matching cinematic and no duplicate compact outcome. Both signature-ending reruns passed (2/2, 28.2 seconds), preserving damage, contact geometry and performance assertions. The other 37 failures remain outside this follow-up: retired collections/exercises, unscoped progressbar locators, collapsed reference sections, older layout/contact/XP expectations, missing local teacher-owner configuration, and recovery/history checks needing further investigation. They are not all claimed to be harmless or fully triaged. Full output: workspace `work/v11-full-browser.log`; traces: `work/v11-full-browser/`. Exploratory legacy-test maintenance was saved separately in workspace `work/v11-unrelated-test-maintenance.patch` and excluded from this release, preserving the requested source scope.
- Screenshots and normal-speed recordings are in workspace `work/v11-review/`. Held results, restart, new attempt, exercise selection, Boss OFF, cinematic OFF and real-control dismissal screenshots were inspected. TIME OUT retains its red background, white title and artwork composition; its pre-holding stage boundaries are covered by tests.
- Rapid two-handed Hanon at 60/120/240 BPM and local OBS synchronization were exercised. Observed MIDI-to-score/attack samples were 15–29 ms. These local Chromium measurements are not a hardware/OBS latency guarantee.
- The supplied permissions allowed the standard browser runner without weakening security or bypassing approval. Physical piano and actual OBS/CEF verification remain manual.
- The user's latest instruction authorizes publication once reasonably confident. Publication is based on the focused V11 checks and build, with historical-suite failures disclosed; this is not a claim that every legacy browser test passes.
## Setup after verification and publication

No database migration or new OBS URL. Refresh the practice page and existing `/obs/recording` Browser Source. A saved nonzero explicit duration now scales per loop. Controls are under **Progression & recording controls → Battle result cinematics**. Developer preview uses `?cinematicPreview=1` on the practice page and cannot award progress.
