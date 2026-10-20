# Original cinematic presentation with the V11 lifecycle

Victory and Defeat use the verified pre-V11 presentation from Git commit `6e8a8c6842b19be96ae950840eeef4a9c7922a21`. The functional baseline is V11 commit `539c89796543a91834941cb97b73fd86830ed838`.

## Scope and provenance

- `hosted/cinematic-presentation.ts` separates the original artwork registry, titles and timing boundaries from the persistent controller. Victory's result begins at 2300 ms again, with its original 4800 ms total timeline. Defeat remains 4100 ms; TIME OUT remains 3100 ms.
- `hosted/battle-cinematic-ui.tsx` restores the original Victory image composition and shared original motion formulas. The newer victory-only coordinate overrides, pose crossfade and crimson release effect were removed. Defeat already used the original poses and choreography; it is retained and compared against the exact historical renderer.
- `hosted/battle-cinematic.css` is the original stylesheet, byte-identical after normalizing line endings, plus V11's existing `will-change: auto` optimization during holding. Typography, colors, gradients, staging and effects are unchanged from that original stylesheet.
- The four original illustrations remain byte-identical to their Git blobs. The V11-only `hero-victory.png` and result-only `cinematic-choreography.ts` were removed. No gameplay atlas, normal attack choreography or battle layout was modified.

The original automatic exit is deliberately **not** restored. V11 retains the final pre-exit composition indefinitely, stops animation work at holding, and uses the existing dismissal and reconnect controller. The controller below the extracted visual definitions is unchanged.

## Preserved behavior

New exercise, explicit restart, new attempt, Boss OFF, cinematic OFF and manual dismissal clear the held result. Ordinary MIDI, elapsed time, focus changes and new achievements do not. Score components stay mounted and evaluation continues beneath the overlay. OBS reconnect restores the final held scene without replaying its animation or rewards.

Compact result notifications remain suppressed while a cinematic is active or held, and remain available when cinematics are disabled. The V11 achievement queue policy is unchanged: defer while the cinematic is visible; resume on dismissal/new attempt in the same exercise; discard stale cosmetic notifications after changing exercise/session. Earned rewards remain persisted.

Time Attack/Ultimate Boss loop timing, battle difficulty, HP, MIDI scoring, XP, progression and achievements are unchanged. No database migration, OBS URL change or settings migration is required.

## Verification method

`tests/cinematic-presentation.test.ts` checks the four original artwork Git hashes, the original stylesheet hash, titles and every timeline boundary. It replaces the four tests for the intentionally removed V11 victory choreography with eight original-presentation assertions. All other V11 timer/lifecycle tests remain intact.

`tests/e2e-sites/cinematic-original-presentation.spec.ts` compiles an independent renderer directly from the pinned Git commits and compares PNG output at an identical 1920 × 634 content viewport (the area below the 116 px banner in the 1920 × 750 recording view). Victory and Defeat compare against pre-V11; TIME OUT compares against unchanged V11. It checks entering, action, impact, result and final frames, then the held state at 24 hours. For the historical V10 held reference only, the test adds V11's compositor-idle hint so GPU rasterization is equivalent; no layout or visual definition is changed. Equality remains exact, with no pixel tolerance.

The existing integration suites exercise all three results in the actual practice and OBS interfaces: dismissal controls, ordinary MIDI, retained score DOM identity, refresh, no duplicate rewards, notification deferral and compact fallbacks. Loop tests cover 1–5 selected loops and continuous/non-continuous Time Attack and Ultimate Boss runs.

Workspace evidence is saved under `work/cinematic-restore/` (original/restored frame pairs), `work/v11-review/` (current full-view screenshots and normal-speed clips), and `work/cinematic-restore-browser/` (browser failure traces when applicable). These are local verification artifacts, not public application routes.

This focused restoration does not claim to repair the previously documented unrelated historical browser-suite failures. See `boss-battle-v11.md` for that earlier full-suite report. Physical MIDI hardware and OBS/CEF remain user-side checks; automated browser tests use local Chromium and the existing MIDI simulator.

## Verification results — October 18, 2026

- Unit/database/network suite: **348 passed across 47 files**, including the existing 30 database/network checks.
- Relevant browser regression: **20 unique tests passed**. The first run passed 19; one matrix test was interrupted by a local `ECONNRESET` while posting an OBS snapshot. That complete test passed unchanged on its isolated rerun (1.7 minutes). No assertions or runtime security settings were relaxed.
- All three exact Git-renderer screenshot comparisons passed, including held final frames at 24 hours. TIME OUT matched V11 at all six sampled times and in holding.
- Real practice dismissal, the 15-case result/dismissal matrix, ordinary MIDI beneath results, score DOM preservation, deferred achievements, compact-result fallback, reconnect without duplicate rewards, and loop timing all passed.
- Rapid two-handed Hanon at 240 BPM passed: observed maximum pending animation batches 4, 95th-percentile frame interval about 16.8 ms. This is a local Chromium sample, not a hardware/CEF performance guarantee.
- TypeScript, changed-file ESLint, `git diff --check`, and production build passed. The build retains the existing Verovio browser-externalization notice.
- Logs: workspace `work/cinematic-restore-unit.log`, `work/cinematic-restore-browser.log`, and `work/cinematic-restore-matrix-retry.log`.

## After publication

Refresh the practice page and the existing `/obs/recording` OBS Browser Source. To inspect the artwork without changing progress, open `/student/practice?cinematicPreview=1`, expand **Progression & recording controls → Developer cinematic preview · no rewards**, and use the Victory, Defeat and TIME OUT preview buttons. Cancel the preview to return to the current score.
