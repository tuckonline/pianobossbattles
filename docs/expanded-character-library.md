# Expanded character library

This expansion adds **48 genuinely new illustrated frames**, packed into three transparent atlases, and **32 new registered clips**: 13 Piano Blade, 9 Crimson Colossus, and 10 Grinwick. Clips deliberately reuse coherent pose sequences; 32 clips does not mean 32 independently drawn animations. The approved original atlases and fullscreen cinematic artwork remain intact.

New artwork was generated with the built-in imagegen tool using each character's approved A atlas as its identity reference. The first hero generation was rejected for crowded gutters; the accepted replacement has sixteen isolated figures. Connected-alpha extraction separates complete figures across uneven generated grid boundaries. Packing preserves a single per-character scale and baseline, includes transparent weapon overscan, and records measured alpha bounds and masks in `hosted/battle-art-bounds.json`. No new pose is manufactured by rotating or stretching an old sprite.

| Atlas | New frames | Dimensions | PNG bytes |
| --- | ---: | --- | ---: |
| `/battle/expanded/hero.png` | 16 | 1536 × 1280 | 1,087,314 |
| `/battle/expanded/boss.png` | 16 | 1536 × 1280 | 1,268,300 |
| `/battle/expanded/grinwick.png` | 16 | 2048 × 2048 | 3,167,428 |

The new hero atlas uses the same 211 × 188 anatomical registration dimensions as the original hero, with a different source-pixel origin. Poses that crouch or kneel remain shorter. All atlas frames have transparent margins on every edge. A shared fixed canvas accommodates raised swords and claws without changing body scale. Existing canvas preparation and rim caches handle these sheets.

## Behavior coverage

| Character | Requested behavior | Implementation |
| --- | --- | --- |
| Piano Blade | Three regular sword variations | Deterministic rotation: approved horizontal cut, new quick dash, approved rising cut. Repeated piano pitches still rotate. |
| Piano Blade | Dual-sword finishers, spinning slash, final strike | Approved cross finisher plus new spinning finisher and salute-to-final-strike sequence. Existing Azure three-contact showcase remains available. |
| Piano Blade | Guard, successful block, light/heavy damage | Existing crossed-blade guard/block and recoil retained; new frustrated and exhausted recovery reactions supplement them. |
| Piano Blade | Ready, surprised, nervous, frustrated, determined, smirk | New drawn face/body frames. New surprised-to-nervous pressure sequence includes real eye/mouth changes and drawn sweat. |
| Piano Blade | Combo celebration, low-health resolve | New short sword salute after a settled 25-note milestone; new low-health resolve idle. Both yield immediately to combat. |
| Piano Blade | Victory variations, tired victory, defeated kneel | New salute and exhausted victory, bowed kneel. Actor-level result variants supplement existing poses. Approved fullscreen scenes remain unchanged. |
| Crimson Colossus | Three regular heavy claw movements | Existing swipe and lunge plus new wide weighted sweep. Technical category remains `lightAttack` for ordinary boss attacks. |
| Crimson Colossus | Overhead smash, body slam, threatening wind-up | Approved overhead/crushing signature retained; new compressed lunge-to-ground-contact slam sequence added. |
| Crimson Colossus | Stagger, angry recoil, enraged stance | Existing recoil plus new stunned stagger, furious long-combo reaction, and low-health stance. |
| Crimson Colossus | Laughter, claw flex, chest beating, impatience | New closed/open-mouth laughter and chest-beating drawings, integrated into idle and pressure. Existing subtle breathing/guard sequences retained. |
| Crimson Colossus | Defeat, victory, desperate attack, collapse | New dramatic collapse and raised-claw victory. Existing heavy retaliation at low HP and crushing signature remain. |
| Grinwick | Three fast regular attacks, hop, spin | Approved swipe plus new hopping uppercut and spinning double-claw slash. |
| Grinwick | Pounce, frenzy, fake-out, recovery | Approved pounce, multi-pose frenzy, crouch/evade and spring-back sequences retained; new spin recovery supplements them. |
| Grinwick | Knockback, frantic low-health attack | Existing elastic knockback plus new wide-eyed stagger, tantrum reaction and last-stand slash. |
| Grinwick | Laugh, applause, pointing, foot tap, ear movement | Approved visible-mouth cackle and ear/guard drawings retained; new applause, point and impatient foot-up poses added. |
| Grinwick | Surprise, tantrum, low-HP panic, smug grin | New full-body facial drawings. Pressure stage three uses mocking applause at normal HP; panic requires boss HP ≤25%. Grinning poses finish the new attacks. |
| Grinwick | Dizzy defeat, backward tumble, victory dance, last stand | New dizzy-to-backward-tumble sequence and furious low-health pose; approved mocking dance retained, new applause victory added. |

## Director and priority

`hosted/battle-animation-expansion.ts` contains the new registry definitions and per-impact measured weapon anchors. `battle-animation-library.ts` registers the expansion through the existing registry.

Ordinary attack identity is derived from the accepted per-side note/mistake ordinal. Reconnecting viewers do not restart the rotation or replay preceding notes. The director derives ordinals from the existing counters and event journal, including batched snapshots. Presentation randomness is seeded by attempt; attack selection rolls use attempt and event revision, so unrelated idle choices do not consume the attack roll. Selector history resets for a new attempt. Consecutive identical attacks are avoided when an eligible alternative exists.

A 12-note combo milestone allows an occasional heavy finisher. Written chords, bounded continuous combinations, signature milestones and terminal finishers preserve their existing presentation rules. Under a dense stream, the director can combine several accepted events into one visual contact; the authoritative reducer has already evaluated and damaged once for **every** correct note. No evaluator, MIDI, XP, HP or difficulty code was changed.

Terminal outcomes retain highest priority, followed by attacks/reactions, countdown, existing hesitation cues and idle. New celebrations start only after an action has settled and there is no pending attack. Incoming notes immediately supersede them. Hesitation thresholds and sound cooldowns are unchanged.

Individual viewers can skip stale visual contacts after a transport stall under the existing freshness budget. They then reconcile to authoritative HP rather than replaying old attacks. Presentation at different wall-clock positions is not expected to be frame-identical.

## Contact and sound

New contact times are explicitly tied to the corresponding authored pose index. Weapon tips/claw edges are measured in each packed atlas's fixed body coordinate space. The hop targets upper torso; the downward slam retains a lower-body target. Hit-stop uses the existing combat clock.

**No sound files were added.** The existing approved sword/claw/impact/guard/vocal pools, contact-driven sound dispatch, voice limits and audience-only routing are reused. New boss signature captions use the selected clip's label, including “Goblin Frenzy” for Grinwick.

## Review artifacts and verification

The task's `work/expanded-sprites/` directory contains:

- `manifest.json`: source generation filenames, new-frame count, normalized bounds and asset byte counts.
- `hero-contact-sheet.png`, `boss-contact-sheet.png`, `grinwick-contact-sheet.png`: extracted drawings on a contrasting background.
- `hero-expanded.gif`, `boss-expanded.gif`, `grinwick-expanded.gif`: slow inspection reels of actual new drawings; these are not native OBS recordings.
- `browser/`: horizontal/vertical layout screenshots, expression previews and contact measurements.
- `pack.mjs`, `previews.mjs`: reproducible packing and inspection-reel scripts for the generated source files.

Validation passed: the full unit suite (57 files, 429 tests), TypeScript, changed-file ESLint, production build, and 14 unique browser scenarios across the focused runs. Browser coverage includes all 32 expanded preview clips, original animation preview/OBS behavior, pressure cancellation and quiet practice, Grinwick audience sound/result/reconnect checks, seven Exercise Chain scenarios, and two paired-layout contact scenarios. The final sweep-clearance adjustment also passed the 27 focused expansion/layout/registration unit tests.

Focused browser contact captures freeze the JavaScript clock and separately scrub the native compositor to the authored contact instant. The 24 captures check actual transformed DOM weapon/target anchors within 3 pixels, independently of the solver's planned error; their measurements accompany the screenshots. The Colossus sweep meets the inner torso to keep its trailing foot inside the narrow horizontal arena without reducing body scale. Grinwick's measured idle browser frame intervals were 16.7 ms median and 16.7 ms p95.

Native OBS/Aitum recordings and subjective sound listening remain unverified. These are discrete illustrated key-pose animations, with the existing compositor providing smooth movement; they are not 60 unique drawings per second. The new PNGs add approximately 5.52 MB to the asset set. Browser frame-timing measurements describe the tested headless Chromium session, not a guarantee of native OBS performance.
