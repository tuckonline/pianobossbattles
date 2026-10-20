# Boss Battle V5 integration

The existing React/Vite practice client evaluates notes with `evaluateGame` in
`game-core.ts` and sends those approved events to `boss-battle.ts`. D1 progression
still independently validates practice through `game-service.ts`; combat never
writes XP. `game-settings.ts` persists the existing boss settings. `boss-schema.ts`
validates OBS snapshots; `obs-direct.ts` supplies the same direct transport and
HTTP restoration. `boss-ui.tsx`, `battle-animation-director.ts`, `battle-stage.tsx`
and the canvas animation registry own presentation. No second MIDI listener,
layout changes or additional synchronization service is needed.

Multi-round is opt-in. The first boss still requires every scored note in the
selected run, including loops. A replacement boss requires all **remaining**
expected notes. Wrong pitches do not consume expected occurrences in the current
pitch-only evaluator. Explicit uniquely identified misses do; an unidentified
miss makes the remaining count unknown and safely disables continuation.
The evaluator currently emits neither timed misses nor retrospective corrections;
V5 does not invent either capability. A full-piece boss normally wins/loses at
the end: early victories are not artificially created to produce more rounds.

Round IDs derive from the run ID and round number. Individual cue IDs retain their
source evaluation ID and round ID. The reducer orders and deduplicates events,
finalizes a knockout, and starts the eligible next round within the same update.
The canonical evaluator emits a complete ordered prefix on each update; delayed
older sequences cannot damage a later round. Only a new manually started run
resets round totals. Loops preserve them. Switching multi-round off stops future
continuation; switching Boss Mode off abandons the active round.

Round history is transient attempt state, not a new permanent rewards ledger.
The current round, totals and eight recent results use the existing OBS snapshot
storage/reconnect path. Full history is retained in the practice reducer while
the run remains open. OBS only restores state and never initializes rounds.
Closing/reloading the practice controller still ends its live run; saved XP,
achievements and configuration use the existing durable recovery path.

Signature attacks reuse distinct existing atlas poses with authored motion and
contact timings. They are not newly illustrated 10–12 / 8–10 frame assets. Damage
is allocated only from approved note batches; cosmetic contacts cannot award XP
or create additional hits.

## Verification

249 unit tests and 18 distinct targeted browser checks passed. TypeScript,
changed-file ESLint and the production build passed. The browser suite includes
single-round compatibility, MIDI simulation and preview isolation, saved settings,
round continuation, OBS reload, read-only OBS behavior, unchanged XP/achievements,
Boss Mode ON/OFF, multiple source heights, and full-ink Schmitt 1 containment.
Physical MIDI and OBS Studio capture are not available in this environment;
these are synthetic inputs through the existing evaluator, not real performances.

Final local Chromium measurements at 1920×750, with browser video enabled:

| Scenario | Accepted damage events | Max queued batches | Mean / max contact latency | Frame interval p95 |
|---|---:|---:|---:|---:|
| hero-signature | 3 | 2 | 257 / 404 ms | 16.7 ms |
| boss-signature | 4 | 1 | 128 / 198 ms | 16.8 ms |
| multi-hanon | 124 | 2 | 308 / 521 ms | 16.7 ms |
| multi-schmitt | 67 | 2 | 306 / 512 ms | 16.8 ms |
| multi-mixed | 75 | 2 | 337 / 561 ms | 16.8 ms |
| multi-ending | 3 | 1 | 127 / 150 ms | 16.7 ms |

All scenarios finished with exact authoritative and displayed HP. No duplicate
or lost damage was observed. Some stale **cosmetic** swings were skipped during
catch-up (20 in the rapid Hanon scene); musical notes and damage were retained.
Contact latency includes transport, grouping, authored wind-up and sequence time;
it is not MIDI evaluation latency. The three Azure contacts intentionally span
about 0.4 seconds. Sampled contact-anchor separation stayed below 0.02 px, and no
scrollbars appeared. These approximately 60 FPS frame timings do not guarantee
performance on the user's OBS hardware.

The initial stress runs measured slower frames. CPU profiling identified
Playwright's repeated full-score DOM trace snapshots (`visitNode` in its injected
snapshotter) as substantial measurement overhead. The benchmark now disables
that trace while retaining video, explicit screenshots and evaluator traces.
Inter-round flames also use a 256-pixel canvas, 14 flame paths and 8 embers instead
of the full ending's 512-pixel canvas, 33 paths and 22 embers. The full final
victory/defeat effect remains intact. Earlier instrumented reports are retained
separately and are not treated as runtime performance measurements.

## Visual review and behavior

`work/v5-review/` contains six video clips, idle/end screenshots, synthetic replay
files and JSON measurements. Rendered frames were inspected for both signatures,
controlled overlap, contact/recoil, recovery, red defeat, blue victory and the
return to a new round. The prior V4 recordings remain in
`work/choreography-review/` for comparison. Asset pose changes are still visible;
these are existing illustrated poses, not new in-between drawings or skeletal
animation.

The normal result duration is configurable from 0.5–2 seconds (default 1.5).
If more evaluated notes arrive, the director preserves roughly 420 ms for final
contact/recoil/collapse, then catches up to the current round. Old-round cues and
flames are cancelled at that boundary. Several already-finished rounds received
in one delayed snapshot restore the latest state rather than replaying a backlog.
Pause freezes the presentation clock; reconnect does not replay old knockouts.

## Live setup and test

No migration, new assets, new OBS URL or extra source is required. Refresh the
practice page and the existing `/obs/recording` Browser Source after deployment.
Enable **Progression & recording controls → Boss Battle Mode → Continue into new
rounds**. It is OFF by default. The same panel exposes the minimum remaining notes
(default 10) and result duration. Wait for the normal saved indicator before
closing after changing settings.

For a short live check, choose Hanon No. 1 or Schmitt Op. 16 No. 1, enable multiple
rounds and temporarily select One-hit difficulty before starting. Make a mistake
early: the practice HP readout should immediately show the next round and restored
HP, while OBS resolves the ending briefly. Keep playing during the transition;
every approved note must continue damaging the new boss. Complete the piece and
confirm the final W/L count. Repeat with multiple rounds OFF to confirm one loss
ends the battle. Restore your preferred difficulty afterward.

To capture the physical keyboard timing, add `&battleDebug=1` to the practice URL,
open **Character animation library → Capture actual practice and replay locally**,
choose **Record next practice**, play, then **Stop & download recording**. Replay
is local and grants no rewards. Test with OBS at 1920×750 and the intended frame
rate. Report/capture any live delay so the real hardware path can be measured.

## Files and persistence

Modified combat/state/configuration: `hosted/boss-battle.ts`, `boss-config.ts`,
`boss-schema.ts`. Modified presentation: `battle-animation-director.ts`,
`battle-animation-library.ts`, `battle-stage.tsx`, `battle-finisher.tsx`,
`boss-ui.tsx`, `boss.css`. Controls/readout/replay: `game-ui.tsx`,
`practice-battle-status.tsx`, `battle-replay.ts`.
Added: `tests/battle-rounds.test.ts`, `tests/battle-signatures.test.ts`,
`tests/e2e-sites/battle-v5.spec.ts` and this report.

Configuration uses the existing saved settings JSON with backward-compatible
schema defaults. Round snapshots use the existing OBS transport/storage. No new
D1 tables or migrations; no changes to the evaluator, XP ledger or notation.
This explicitly requested V5 implementation supersedes the expansion gate in
the historical V4 checkpoint report.

