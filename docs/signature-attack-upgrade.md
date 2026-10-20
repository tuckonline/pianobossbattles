# Signature attack upgrade

## Scope and asset audit

This update changes the presentation of **Azure Blade Rush** and **Crimson Crushing Strike**. The evaluator, combat reducer, damage, HP rules, XP, achievements, notation renderer, OBS layout and database are unchanged. No migration or new OBS source is required.

The existing canvas player uses four 4-by-8 PNG atlases, with cleaned alpha bounds from the existing asset manifest. All atlas rows were already assigned to animations. There were no unused intermediate drawings. The upgrade reuses 11 distinct hero poses and six boss poses; it does not add newly illustrated frames, duplicated filler frames or a replacement renderer. Existing preload/cache behavior loads the required atlases before combat.

The most important art correction is the hero's final contact: atlas B frame 9 contains the crossed blades. Frame 10, used previously, is the downward follow-through. The boss's existing crush drawing has a low slam arc, so its contact is calibrated to the hero's lower guard rather than pretending it depicts a new torso-level punch.

## Choreography and timing

| Segment | Pose starts, ms | Contact | Hit-stop | Reaction |
| --- | --- | --- | --- | --- |
| Azure opening | 0, 65, 155, 210 | 155 ms | 20 ms | Shoulder stagger, light displacement |
| Azure reverse | 0, 75, 125 | 75 ms | 24 ms | Chest recoil, medium displacement |
| Azure cross | 0, 95, 175, 245 | 95 ms | 65 ms | Later chest-recoil pose, strong displacement |
| Crimson crush | 0, 80, 150, 250, 345, 420 | 250 ms | 85 ms | Sharp hero pose break and heavy knockback |

Timings above are relative to each segment at normal speed. The hero lowers into a ready pose, advances, makes three distinct contacts and returns through the existing recovery poses. The final contact has a larger local cross effect and more than twice the reverse hit's recoil strength. The boss braces before a deliberate approach, then follows through and returns more slowly. Shadows follow the same movement timeline as their fighter.

Registry metadata now includes explicit pose start times and a choreography descriptor: phase, anticipation, brace, follow-through, reaction clip, reaction start pose, reaction duration and impact strength. Validation checks pose ordering and exact contact-pose alignment. Existing contact anchors, selection weight, priority and cooldown fields remain in use.

One delivered contact clock controls the illustrated contact pose, movement hold, local effect, defender reaction and displayed HP endpoint. Authoritative damage has already been resolved by the existing evaluator/reducer; animation timers cannot award damage or scored notes. Late browser callbacks retime the presentation clocks together. Signature effects mount on delivered contact rather than starting from an independent CSS delay.

Recoil uses the intersection of the available attack poses' reachable visual bounds. This prevents a first strike from staggering the defender just beyond the next pose's reach at the shorter OBS height. It is a placement constraint, not physical collision detection, and does not resize the fighters.

## Triggers and rapid passages

Azure requires a combo of at least 25 and at least three already-approved notes, with a six-second cooldown. It may combine the immediately adjacent pending hero batch to support two-hand exercises, but cannot cross a mistake or invent another note. Its three contacts partition the approved damage and preserve the final authoritative HP endpoint.

During a dense passage, an older eligible batch uses the same poses 20% faster. The scheduler checks that the full signature can fit its existing freshness budget, including the configured animation speed. Stale presentation work is discarded or reconciled using authoritative HP as before; the queue remains bounded.

Crimson's major punish is eligible on every fourth mistake, with a 6.5-second cooldown. Other mistakes keep ordinary attacks. A terminal hit during either signature retains that attack's identity before the existing victory/defeat presentation. Reconnects restore state without replaying stale attacks.

## Verification and limitations

Unit coverage includes exact approved damage per contact, distinct reactions, actual contact-frame selection, three playback speeds, cooldowns, rapid two-hand passages, counterattacks during a signature, lethal fourth mistakes and reset cleanup. Browser coverage uses synthetic inputs through the existing evaluator and production direct OBS transport, with a guard that fails if the OBS route requests MIDI access.

Validation completed: **258 unit tests across 40 files**, **21 distinct targeted browser scenarios**, and the focused 750-pixel capture/1080-pixel stress reruns passed. TypeScript, changed-file ESLint and the production build passed. The existing browser regressions cover Boss Mode ON/OFF, saved progression/settings, one read-only MIDI receiver, direct transport/reconnection, unchanged XP and achievements, Hanon at 60/120/240 BPM and full grand-staff containment including Schmitt exercise 1.

Rendered output was captured and inspected frame by frame for both attacks, including anticipation, contact, recoil and return. Review artifacts are retained in `../../work/signature-review/`, outside the deployment. Isolated signatures at 1920×1080 aligned measured contact anchors within 0.02 px. Ordinary attacks chained against a moving opponent can retain a bounded offset below 3 px in the tall, narrow arena; preventing artwork clipping takes precedence over moving the fighter beyond the panel.

Without video encoding or full DOM tracing, the measured 95th-percentile frame interval was approximately 16.7–16.8 ms in the isolated 1080 tests. Video capture and instrumented two-browser regressions sometimes measured 33.4 ms. These are local Chromium measurements, not a guarantee of the user's OBS/GPU performance. A physical piano and the running OBS application were not available to this test harness.

Final isolated 1920×1080 measurements:

| Scenario | Approved events | Maximum queued batches | Maximum contact latency | Frame interval p95 |
| --- | ---: | ---: | ---: | ---: |
| Hero signature | 3 | 2 | 455 ms | 16.7 ms |
| Boss signature | 4 | 1 | 260 ms | 16.7 ms |
| Fast two-hand Hanon with signature | 128 | 3 | 629 ms | 16.8 ms |
| Multi-round Hanon | 124 | 3 | 556 ms | 16.8 ms |
| Multi-round Schmitt | 67 | 3 | 598 ms | 16.7 ms |
| Mixed notes and mistakes | 75 | 2 | 554 ms | 16.8 ms |

Contact latency includes transport, batching, authored wind-up and earlier contacts in the combination; it is not evaluator latency. The fastest stream reconciled 22 stale cosmetic swings while preserving all 128 evaluated damage events and exact final HP. No score scrollbars were detected. Signatures in mixed passages stayed within 0.32 px of their planned anchors in these runs. The final 750-pixel rapid-Hanon capture kept signature anchors within 0.02 px and measured a 16.7 ms frame interval at the 95th percentile.

The current drawings still limit smooth torso rotation and bespoke attack-specific recoveries, particularly the six-pose boss sequence. A future art pass should add genuine intermediate anticipation, weight-shift, contact and recovery drawings with matching anatomy/perspective. Adding duplicated still frames would not solve that limitation.

## Files

- `hosted/battle-animation-library.ts`: selected poses, anchors and timing/reaction metadata.
- `hosted/battle-timeline.ts`: authored key-pose timing synchronized to contact and hit-stop.
- `hosted/battle-animation-director.ts`: staged reactions, approved-damage partitioning, trigger freshness and terminal transitions.
- `hosted/battle-stage.tsx`: anticipation/brace/follow-through transforms, matching shadows, contact effects and reachable recoil endpoints.
- `hosted/battle-layout.ts`: common reachable recoil bounds across attack poses.
- `hosted/boss.css`: brief localized signature effects, with reduced-motion and effects-off handling.
- `tests/battle-signatures.test.ts`: signature logic and timing regression tests.
- `tests/battle-layout.test.ts`: recoil reachability across the whole attack registry at both arena heights.
- `tests/e2e-sites/battle-v5.spec.ts`: rendered contact, rapid passage and terminal-case checks at configurable viewport heights.

After deployment, refresh the practice page and OBS Browser Source once to load the updated animation bundle. No settings or stored progress need to be reset.
