# Targeted pose-continuity changes

The complete registry still contains 96 clips: 35 Piano Blade, 29 Crimson Colossus and 32 Grinwick. Eight existing clip IDs were refined. Five additional transparent atlases contain 11 accepted new drawings together with unchanged original key drawings. The new atlas PNGs total 3,067,553 bytes. No original atlas was overwritten, no clip ID was removed, and no sound asset, evaluator, MIDI rule, HP rule or combat priority changed.

These are meaningful improvements to limited-pose illustration sequences. They are not a claim that all discontinuities in the 96-clip registry have been solved. The separate registry audit and asset-gap report cover the unchanged clips.

## Authored sequences

All times below are pose start times on the unpaused clip clock, in milliseconds. Runtime hit-stop and existing speed/chain scaling still apply. “Original” refers to the approved A/B atlases.

| Exact ID | Original → revised poses | Revised starts | Duration before → after | Contact preserved |
| --- | --- | --- | --- | --- |
| `hero_attack_light_slash_01` | A4 → new bent-elbow swing → A5 → A6 → new recovery bend → new recovery lowering → A7 | 0, 28, 64, 98, 130, 170, 210 | 200 → 260 | Original A5 at 64 ms; ordered index 1 → 2 |
| `hero_attack_light_lunge_01` | A8 → new tucked-hand approach → A9 → A10 → new upright recovery → A11 | 0, 28, 64, 112, 165, 215 | 240 → 260 | Original A9 at 64 ms; index 1 → 2 |
| `hero_attack_light_rising_01` | B4 → new crouched bent-elbow preparation → B5 → B6 → new descending-elbow recovery → B7 | 0, 28, 64, 108, 155, 215 | 220 → 260 | Original B5 at 64 ms; index 1 → 2 |
| `boss_attack_heavy_arc_01` | A12 → new descending arms → A14 → new weighted recovery → A15 | 0, 75, 120, 235, 305 | 360 → 360 | Original A14 at 120 ms; index 2 |
| `grinwick_attack_light_lunge_01` | A8 → new tucked launch → A9 → new feet-down landing → A10 → A11 | 0, 46, 96, 139, 178, 214 | 240 → 240 | Original A9 at 96 ms; index 1 → 2 |
| `grinwick_attack_heavy_arc_01` | Same coherent pounce sequence | 0, 58, 120, 192, 257, 317 | 360 → 360 | Original A9 at 120 ms; index 1 → 2 |
| `grinwick_hit_reaction_02` | B5, B4, B6, B7 → B5, B6, B7 | Existing progress-based playback; three evenly divided poses | 260 → 260 | No attack contact |
| `grinwick_hit_reaction_low_hp_03` | B6, B4, B6, B7 → B6, B4, B7 | Existing progress-based playback; three evenly divided poses | 300 → 300 | No attack contact |

The horizontal cut changes from four to seven poses. The original leap from a rearward sword arm to full forward extension now passes through a bent elbow and sword hand near the chest. Two real recovery drawings bridge the former sudden return from forward follow-through to guard. The 60 ms added to its total duration is visual recovery; its 64 ms contact, 12 ms hit-stop, 110 ms recovery metadata and existing queue/chaining threshold are unchanged. Immediate judged-note feedback and authoritative damage do not wait for that longer drawing sequence.

Lunge and rising receive similar targeted approach/recovery bridges. A proposed near-contact horizontal drawing and two proposed hero approach drawings were rejected: their anatomy or almost-complete extension did not provide the needed transition. The final rising approach uses a separate generated low-crouch drawing with its elbow bent near the chest.

The Colossus's old A13 showed a floor burst while its arms remained overhead. The revised ordinary two-arm crush replaces that incompatible drawing with a real downward-arm pose and adds a partial rise after contact. The original A14 impact art and its contact geometry remain exact. This does not silently change the separate Crimson Crushing Strike signature; that signature's remaining art problem is recorded in the audit.

Grinwick's pounce now passes through knees tucked under the body on launch and feet directed downward on landing. The same atlas serves its light and heavy variants without introducing another clip. Its two reaction fixes remove a visible neutral/crouch bounce; their duration and progress-based entry remain intact, including the director's existing chained-reaction behavior.

## Registration and preserved contacts

Piano Blade's added atlases use a 432 × 264 canvas around the same 211 × 188 anatomical window. Original pixels are translated into this padded canvas through the original approved alpha masks and foot offsets. They are not regenerated, stretched or independently fitted to each drawing's overall sword/cape bounds. New drawings use measured fixed scale and baseline placement.

The Colossus atlas preserves its original crop by translating both artwork and crop origin down 20 pixels. Grinwick retains its 512 × 512 cells and existing 312 × 300 anatomical registration. All original contact drawings and weapon/target coordinates remain unchanged. Changes to ordered impact indexes simply identify the same contact drawing after insertion.

The optional `posePhases` labels extend the existing registry for inspection; they do not create an alternative state machine. The existing `poseTimesMs` mechanism already supports the required timing. No generic pose crossfade was introduced. The accompanying shared-player change removes the existing inter-clip crossfade so inspection and gameplay do not mask drawing discontinuity with ghosting.

## Reproducible visual evidence

`work/continuity-reference/` contains:

- `before-renderer.js` and `before-clip.json`: immutable renderer bundle and original reference definition captured before runtime edits.
- `before-100pct.gif`, `before-50pct.gif`, `after-100pct.gif`, `after-50pct.gif`: normal/half-speed pose playback.
- `comparison-100pct.gif`, `comparison-50pct.gif`: matched framing and anatomical scale, rendered through the actual `BattleAnimationPlayer` and its timeline. Twenty-millisecond sampling avoids sub-20 ms GIF delays being clamped by browsers.
- `after-poses.png`, `lunge-after-poses.png`, `rising-after-poses.png`, `crush-after-poses.png`, `pounce-after-poses.png`: complete rendered pose strips.
- `asset-manifest.json`, `sources/`, `generation-briefs.md`: accepted/rejected source records, hashes, generation provenance and saved source artwork.
- `pack-reference.mjs`, `pack-extra.mjs`, `pack-bosses.mjs`: deterministic extraction, connected-component isolation, scaling, baseline placement, atlas/mask packing.
- `capture.mjs` and `compare.mjs`: actual-renderer capture and comparison assembly. Run from the task workspace root. The baseline capture reuses its immutable bundle rather than rebuilding it from modified source.

The GIF comparisons deliberately isolate internal drawing continuity without adding world-space interpolation. They are sampled game-renderer images, not native OBS recordings. The integrated browser exercise recordings separately test live director transitions at single, moderate and fast event rates.

## Validation and remaining limits

The full 435-test unit suite, TypeScript, changed-file lint and production build passed. The new continuity tests exercise the authoritative reducer with single, moderate and fast correct-note input, verify immediate HP reduction for every accepted note, bounded visual work, unique delivered contacts and eventual HP reconciliation. Reference hit-stop tests hold the exact authored contact drawing. Browser/OBS-layout results are reported with the final task verification.

All eight changes are best described as targeted improvements to discrete key-pose animation. The horizontal cut has demonstrably clearer arm travel and recovery, but its first rearward-to-bent-arm transition still covers substantial movement. Colossus's overhead-to-chest descent remains sparsely drawn. Grinwick's new poses clarify launch and landing, but face/cape detail changes and the large extended contact pose remain visible at half speed. The remaining gaps require additional compatible artwork, not longer holds or crossfades.

The normal hero cycle is horizontal cut, quick dash and rising slash. The lunge remains an available fallback/preview attack. Quick dash was inspected but left unchanged: inserting the new lunge drawings would mix incompatible expanded-atlas stance, anatomy and registration. Azure signature linking, other heavy attacks, several knockback transitions and the audit's other flagged clips remain explicit asset work. No new penalties or artificial input delays were added to conceal those limitations.

## Final browser verification

Ten targeted browser checks passed: all 96 clips in the inspector, expanded asset loading, horizontal/vertical contact geometry for both bosses, existing animation and scale checks, and single/moderate/fast Hanon streams. The contact capture test now waits for the delivered contact phase rather than a stale render-time `contactInMs` diagnostic; it additionally asserts the actual canvas frame equals the authored impact frame. Both boss/layout contact checks passed again after strengthening this assertion. No runtime timing change was needed.

The fast stream evaluated 128 notes and applied 128 damage events, with maximum visual queue 4 (limit 6). Median frame interval was 16.7 ms; p95 was 33.3 ms during the fast recorded run and 16.8 ms in the moderate run. This demonstrates bounded work, not a guarantee of uninterrupted 60 FPS on every machine. Visual batching latency reached 573 ms in the fast stream; authoritative evaluation and damage remained immediate. These were synthetic evaluated Hanon notes in Chromium with the production transport/renderer, not physical MIDI or native OBS measurements.

Horizontal/vertical contact screenshots and JSON measurements are saved under `work/expanded-sprites/browser/`. Stream WebM recordings, frame metrics and screenshots are under `work/continuity-reference/browser/`. The original source baseline is commit `7bde1d321519d1fb503cc8419dfdd0ce360e5009`.

## Registry audit summary

Labels can overlap. A = acceptable/intentionally unchanged, B = timing, C = missing intermediate artwork, D = incompatible reuse, E = entry/exit mismatch. The audit describes the original registry; the eight refinements above do not imply every flagged issue is resolved.

| Character | Clips | A | B | C | D | E |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Piano Blade | 35 | 6 | 1 | 27 | 2 | 3 |
| Crimson Colossus | 29 | 10 | 1 | 17 | 3 | 2 |
| Grinwick | 32 | 6 | 1 | 23 | 6 | 0 |

All 96 definitions and their ordered source drawings were assessed. Not every clip was captured inside a full battle; the inspector steps through all 96 and the integrated screenshots/streams cover representative attacks. See `animation-continuity-audit.json` for per-ID findings, nominal pose timing, reuse, runtime conditions and actionable missing-art specifications. The 22 A-rated clips were intentionally left unchanged.

The debug-only inspector is available through the existing character preview with `?battleDebug=1`. It uses the same canvas renderer and supports frame stepping, pause, looping, 1×/0.5×/0.25× speed, phase/contact readouts and same-character follow-up transitions without changing gameplay state.
