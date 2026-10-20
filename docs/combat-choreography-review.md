# Combat choreography checkpoint — Sprint A and Sprint B

## Scope and architecture

React/Vite, existing canvas sprite atlases, WAAPI movement, evaluator-approved combat journal, direct OBS transport and D1 progression are retained. No migrations, new MIDI listeners, scoring changes, damage multipliers, XP changes, layout redesign or multi-round features are included.

The previous director already synchronized initial contacts, but merged three nearby individual notes into one hit, aimed follow-up strikes at the opponent's idle position, restarted full hit reactions, and offered no quantitative latency or capture/replay inspection. This revision extends that director rather than creating another combat engine.

## Sprint A

- Attack metadata still supplies the contact pose and timestamp. The target's current pose/position is held through approach, including when a previous recoil is unfinished. The weapon and localized effect aim at that visible position.
- HP, impact, defender reaction and hit-stop share the contact clock. Authoritative damage still happens immediately in `reduceBattle`; the website HP readout is unchanged.
- Routine hit-stop is 12–16 ms, strong 40–60 ms, finishing 85 ms; these wall-clock presentation holds do not pause evaluation or audio. Hero and boss retain different movement curves.
- Movement and ground shadows follow the same track. The next action begins at the current transform and returns to the existing collision-free idle zones. Cooldown exhaustion falls back to an authored light strike, never an idle clip with missing contact data.

## Sprint B

- Separate notes retain separate contacts in small combinations. Three rapid notes now form three strikes. Written chord notes can strengthen the current strike without restarting its approach.
- The configurable grouping window is 125 ms. Dense adjacent queued actions can share a visual strike; they never merge across a counterattack. A counterattack condenses preceding pending swings, retaining their chronological HP endpoint.
- Six pending batches maximum. Stale cosmetic actions can be skipped; all authoritative HP is reconciled. The 650 ms age budget reserves time for approach. Finishes, disconnect, restart and stale revisions retain priority and deduplication protection.
- Chains carry current transforms, reuse reaction poses for small recoil, and use a stronger last hit. Existing 0/10/25/50/100/200 cosmetic tiers remain. Effects are confined to the arena.
- Director diagnostics expose accepted evaluation/damage counts, contact latency mean/max, visual strikes/combinations, queue maximum, cosmetic merge operations and skipped visual hits. Contact latency includes delivery, queueing and authored wind-up; it is not input-to-attack-onset latency. Coalescing and skipping are cosmetic, not lost scoring events.

## Capture and replay

Open `/student/practice?collection=hanon&exercise=1001&battleDebug=1`, then **Progression & recording controls → Character animation library → Capture actual practice and replay locally**.

1. Enable Boss Battle Mode and click **Record next practice**.
2. Start a new MIDI practice attempt and play the passage.
3. Click **Stop & download recording**. The file contains only new evaluator results, accepted battle cues, configuration and monotonic arrival times. No account ID, email or saved progression is exported.
4. Load/replay the file in that panel. Replay is isolated from real progress and the live OBS publisher.
5. For deterministic measurements: `npx tsx scripts/replay-battle.ts path/to/recording.json`.

Capture is opt-in, memory-only, bounded to 6,000 updates/30 minutes, and stops at exercise completion or abandonment. Download before closing the page. Captured evaluator provenance is not hardware attestation: a synthetic test using the evaluator can also produce a recording, and must remain labelled synthetic. D1 checkpoint timestamps are unsuitable for reconstructing real note-arrival timing, so old saved attempts are not presented as live recordings.

## Verification and review gate

Individual attacks were verified before expanding the rapid-note scheduler. Unit checks cover exact HP, duplicate/reordered snapshots, pause/resume, chords, three-contact sequences, 8/16/256-note bursts, mixed attacks, journal overflow, restart, terminal priority and deterministic capture replay. Browser checks cover actual renderer contact, both endings, simulated MIDI at 60/120/240 BPM, capture isolation, and the unified 1920×750 route.

The review artifacts in `work/choreography-review/` include seven browser videos (slow, moderate, fast Hanon, two-handed Hanon, mixed mistakes, victory, defeat), screenshots, labelled synthetic event traces and measured JSON reports. These are browser recordings of the OBS route, **not recordings made by OBS Studio and not physical MIDI tests**. The HTTP fallback reports are retained separately; they are not normal direct-transport measurements.

Physical MIDI and actual OBS capture remain pending. The current pitch-only evaluator does not manufacture timed misses; the explicit missed-event reaction is covered in the laboratory/tests. Each action has four illustrated key poses, so this is timed sprite choreography rather than skeletal interpolation. No new artwork is needed to run it, but more in-between drawings would improve pose continuity.

Multi-round combat is not implemented. Before expansion, review these clips and a real captured Hanon/Schmitt session, confirm the live feel, and explicitly approve the next stage.

## Measured results (local Chromium, 1920�750)

| Scenario | Damage events | Visual strikes | Max queue | Mean / max contact latency | Merges / skips | Frame interval p95 |
|---|---:|---:|---:|---:|---:|---:|
| slow | 6 | 6 | 1 | 107 / 111 ms | 0 / 0 | 16.8 ms |
| moderate | 24 | 24 | 1 | 110 / 128 ms | 0 / 0 | 16.8 ms |
| fast-hanon | 64 | 31 | 2 | 368 / 453 ms | 33 / 0 | 16.8 ms |
| two-handed-hanon | 128 | 27 | 2 | 425 / 503 ms | 101 / 0 | 16.8 ms |
| mixed | 45 | 13 | 3 | 400 / 536 ms | 32 / 0 | 16.8 ms |
| victory | 12 | 3 | 2 | 148 / 153 ms | 6 / 0 | 33.3 ms |
| defeat | 8 | 4 | 2 | 194 / 287 ms | 3 / 0 | 33.3 ms |

Every scenario retained exact final authoritative/displayed HP. No duplicate or lost damage events were observed. No scrollbars were found. Latest sampled contact-anchor error was below 0.2 px; the browser checks allow 25 px for compositor sampling, and planned contact positions must be within 1 px. At 16.8 ms, p95 frame intervals are approximately 60 FPS; finishing scenes around 33.3 ms are approximately 30 FPS. These results do not establish 60 FPS on the user's OBS host. Transport-only fallback was slower and could intentionally skip stale cosmetic hits; its measurements are saved separately.

The previous scheduler and current scheduler were compared deterministically using identical assets/timing metadata and generated 20 ms note bursts: 3 notes changed from 1 to 3 contacts; 8 notes from 2 to 4; 16 notes from 3 to 5. A 256-note stream kept exact HP while reducing maximum queued batches from 5 to 2. This comparison isolates the scheduler; it is not a physical-keyboard comparison.

Validation: 236 unit tests passed; 13 distinct targeted browser checks exercised contact/HP/frames, simulation isolation, Hanon at three speeds, seven recorded scenarios and capture/replay. Targeted retests followed choreography fixes. TypeScript, changed-file ESLint and production build passed. Intermediate failures exposed the old single-impact expectation, queue latency, and delayed-browser contact drift; these were corrected and retested. Final automated checks have no known failures.

Sampled video frames show distinct idle silhouettes, controlled contact overlap, matching shadows, readable localized effects, return to idle, and dedicated blue/red finishing effects. Existing four-pose artwork still makes some pose changes visible.

**Readiness:** implemented and ready for the user's live-play review; not yet cleared for multi-round expansion. Physical MIDI, real-session trace review and an OBS Studio recording remain outstanding.

## Files and setup

Modified: `battle-animation-director.ts`, `battle-animation-library.ts`, `battle-stage.tsx`, `boss-ui.tsx`, `game-client.ts`, `battle-choreography-preview.tsx`, existing combat tests and V3 documentation. Added: `battle-replay.ts`, `battle-replay-controls.tsx`, `scripts/replay-battle.ts`, replay tests, seven-scenario browser capture tests and this report. No database migration or OBS source change is required. Refresh the practice page and the existing `/obs/recording` Browser Source after deployment.
