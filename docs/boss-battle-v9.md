# Boss Battle V9 — three modes and Combo Power

## Integration audit

The hosted app is React/Vite with a Cloudflare Worker and D1. `sight-reading.tsx` owns the existing Web MIDI input. `assessPractice` in `sight-library.ts` matches the pending expected pitches; a wrong pitch never advances. `evaluateGame` creates deterministic, individually identified note results. `GameClient` consumes those results for practice, progression and combat. OBS routes only receive snapshots through the existing direct transport and authenticated HTTP fallback. They never start MIDI or award progression.

The shared notation model stores quarter-note beats: `ScoreNote.beats`, polyphonic onset/duration, and `Exercise.durationBeats`. Ties retain their durations; imported repeats are already expanded. Schmitt loop passes omit the final cadence except on the final pass. There was no user-selectable practice BPM or authoritative battle countdown. The existing Listen demonstration uses a fixed piece-reference BPM. V9 adds one target-BPM control for timed battles, without altering the Listen reference recording.

Existing combat was `boss-battle.ts`, settings were `boss-config.ts` / `game-settings.ts`, and animation scheduling was `battle-animation-director.ts`. V5 multi-round continuation was still present. V9 intentionally migrates that preference to false and removes its control/continuation behavior. One fight spans the selected run and loops, with no revival after a loss.

## Rules and persistence

- `battle-modes.ts`: data-driven Survival, Time Attack and Ultimate Boss rules, musical duration, countdown preparation, enrage thresholds.
- `boss-battle.ts`: same HP reducer, stable note IDs and expected-occurrence deduplication. Survival retains one damage per correct note, existing boss HP, and all six difficulty presets. Time Attack mistakes deal zero HP damage. Ultimate Boss uses shields and ceiling-rounded enrage damage (1 / 1.25 / 1.5).
- `game-core.ts`: the existing combo replay now exposes per-event combo values. Shields consume those exact values; they do not maintain a second set of streak rules. A run starting with a carried streak requires ten new consecutive correct notes before its first shield. Inventory resets only on a new run, and carries across the run’s selected loops.
- `game-client.ts`: sole timer owner, driven by `performance.now()`. Clock starts on first uniquely accepted scored evaluation, pauses with practice, and carries across loops. An evaluation at or after the deadline loses; only an evaluation delivered before it can win. Timeout is processed before note damage and ends once. A 200 ms wakeup samples elapsed time; it does not count ticks. Delayed callbacks cannot extend the deadline.
- Rules (mode, base damage, HP, BPM, allowance, explicit limit, power threshold/adaptation) freeze at run start. Changes save for the next manually started run. Turning Boss Mode off cancels the current battle as before.
- Existing D1 settings JSON stores the new configuration. Defaults migrate legacy rows on read; no new database table or SQL migration is required. Existing XP/reward persistence is unchanged. OBS reconnects restore snapshots, not old animation queues.

## Combo Power and presentation

Every unique correct occurrence charges one power. At the threshold, its ordinary one-damage strike may use the existing Azure cross-signature animation and cyan accent. It never creates an additional scoring event, damage, or XP. Wrong notes retain charge. Threshold defaults to 100; optional short-run adaptation uses the smaller of that threshold or ceil(60% of scored notes), minimum one, frozen at start and displayed in both HUDs.

The existing bounded six-batch animation queue still drops stale visuals and preserves authoritative endpoints. Terminal outcomes override specials. A regression check now covers HP reconciliation when an entire coalesced animation journal is already stale. Shield hits use the existing guard clip and a blue fracture effect. Enrage announces only on the phase transition; reconnecting does not replay it.

`battle-mode-ui.tsx`, `practice-battle-status.tsx` and `boss-ui.tsx` provide the controls, countdown, shields and power meter. Time Attack omits player HP. The countdown turns amber below 20% and red below 10%. No warning sound was added. HUD rows fit within the previous bands. Battle width remains 22%, score width 78%; character registrations, assets, attack timing and notation fitting remain unchanged.

## Limits

The current exercise model supports one fixed quarter-note target BPM. It does not model expressive rubato or in-score tempo maps. Imported expanded repeats, rests, subdivisions and ties use their existing stored durations. Polyphonic material without an explicit complete duration is blocked from a timed start until an explicit seconds limit is supplied; note counts are never substituted for duration. An explicit limit also allows custom pacing.

Combat remains owned by the active practice browser, consistent with the existing architecture; it is not a server adjudicated competition. OBS can reconnect, but closing the practice browser abandons its active attempt rather than resuming a paused fight after reboot. Earned XP and achievements retain their existing durable recovery. Browser verification uses synthetic Web MIDI/evaluator input, not a physical piano or the OBS desktop application.

## Verification

- Unit tests: 304 passed across 44 files, including deadline ties, monotonic pauses/throttling, shield reset/cap/absorption, phase damage, power deduplication, and terminal priority.
- Browser scenarios: 27 passed (17 existing boss/loop/recording/score scenarios, four V9 cases, and six signature/Hanon/legacy-settings cases). The two regressions discovered in the existing suite were repaired and their cases rerun successfully.
- Production build and TypeScript check passed. Lint on changed TypeScript files has zero errors and one pre-existing hook dependency warning. Full-repository lint still reports 11 pre-existing errors and nine warnings (preview clock rendering, score sizing, and older test typing); these are outside this change.
- All modes captured and checked at 1920×750 and 1920×1080: 22/78 split, complete visible score bounds, fitting HUD rows, no page scrollbars, no OBS MIDI initialization, persisted settings/XP, and read-only reconnect restoration. Boss Mode OFF retains the full-width score.
- Three gameplay recordings plus six screenshots are in the workspace's `work/v9-review/` directory. `combat/` includes synthetic evaluator traces, contact snapshots, and measured JSON reports.
- Rapid Hanon capture: 128 evaluated notes, maximum queue four (limit six), 95th-percentile frame interval 16.8 ms, maximum contact scheduling lag 7 ms. Dense inputs intentionally coalesce/drop stale visuals; authoritative HP ends at the exact evaluated value. This is local browser evidence, not a promise of the same FPS on every OBS setup.

## Using V9

Open Practice → Progression & recording controls → Boss Battle Mode. Choose the game mode, difficulty, and (for timed modes) target BPM and allowance. Leave explicit time limit at zero for automatic musical timing. Combo Power defaults to 100 with short-run adaptation enabled. Start a new run to apply pending rules. Refresh the existing OBS Browser Source after publication; its URL and dimensions are unchanged.


## Legacy-profile blank-page repair

The initial V9 release validated settings when saved, but `readGame` still shallow-merged old database JSON. Existing nested boss configurations therefore reached the controls without `gameMode`, causing a `timed` lookup exception after the first profile response. Fresh-account tests did not reproduce this path.

The server now normalizes nested settings on read and sync. Every client game-state response is normalized too, covering initialization, recovery, refresh and session end during mixed-version deployments. This supplies missing defaults without changing stored XP, achievements, records, difficulty or other valid preferences. No reset or SQL data migration is needed.

A D1 regression inserts an actual pre-V9 settings row directly, checks its upgrade and verifies progress and stored preferences remain intact. A browser regression forces pre-V9 API responses through practice load, reload and profile navigation and requires zero page errors. Focused unit/database tests, all V9 browser modes, TypeScript and the production build are checked for the repair.
