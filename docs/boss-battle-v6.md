# Boss Battle V6 — contact, choreography and 22/78 layout

## Integration audit

The hosted app uses React/Vite, Cloudflare Workers, the existing evaluator and OBS direct transport. `battle-animation-player.tsx` paints cached alpha-cleaned sprite cells into canvas; `battle-animation-library.ts` selects the authored frames; `battle-animation-director.ts` schedules presentation against authoritative battle snapshots. `battle-stage.tsx` supplies compositor movement and shadows. `battle-layout.ts` owns visual placement. No MIDI, damage, XP, combo, persistence or multi-round rules were replaced.

Previously, the stage aligned one weapon point with a fixed target deep inside the opponent. It had no body-separation constraint. Each signature segment also used a different union crop, causing visible scale changes. An old 16–18% clamp in `obs-score.tsx` prevented wider configured panels.

## Changes

- Boss ON uses 22% of content width; notation uses 78%. OFF remains full width. Browser Source height stays responsive. Existing OBS routes remain available.
- The wider arena retains the preceding 16.5% character-size basis, with the existing 12% hero enlargement. At 1080p the released width clamp allows under 2% additional hero height; the boss retains its scale. The extra width is available for movement and separation.
- Every attack has a weapon origin, blade contact, target region, lunge limit and tolerance. Hero contacts include main-body bounds and preferred separation. Coordinates refer to the contained visible artwork, including alpha cropping, with mirrored-coordinate support.
- A bounded visual solver selects contact points on shoulder, upper torso, arm or lower torso regions. It avoids torso overlap while preserving the full artwork. This is presentation geometry, not physical collision or a source of damage.
- A returning opponent recovers toward guard only as far as needed during an incoming attack's windup. Both fighters share that endpoint. Contact delivery explicitly aligns both compositor tracks before recoil starts.
- Ground shadows follow translation on a separate background layer. Attack/recoil layering returns to normal afterward.
- Azure has separately scheduled horizontal, reverse and crossed-blade contacts. Reactions change direction and strength. The first two effect accents are short; the final hit retains stronger hit-stop and stagger.
- Signature segments share one containing registration window, avoiding crop-driven size changes. Existing guarded preparation and recovery drawings bridge the segments. Short canvas blends soften transitions, but contact frames paint immediately without blending.
- Dense streams use a faster presentation variant and the existing bounded queue/freshness budget. Azure requires at least three already-approved hits; its contacts partition that existing damage. No extra evaluations or rewards are generated.
- Developer practice previews show body bounds, weapon origin/contact, target endpoint, approach line, separation/error, contact frame/time and phase. These controls and overlays are absent from production OBS routes.

## Artwork decision and production specification

The canonical four A/B atlases were inspected. All rows have assigned roles. Two transparent image-generation candidates were produced using the built-in image tool and the canonical Piano Blade B sheet. Neither met equal-cell registration and separation requirements: neighboring cape/blade extents intruded across the intended cell boundaries. They were not added to the production sprite library.

This release therefore reuses existing illustrations and improves registration, timing, transforms and blending. It does **not** claim newly illustrated intermediate frames in production.

Three drawings remain for a future targeted asset pass:

| Pose | Intended drawing | Integration point |
| --- | --- | --- |
| A | End of forward dash; leading leg planted, torso turning, forward blade entering a horizontal cut, trailing blade retained | Between A8/A4 preparation and A5 contact |
| B | Opposite torso rotation, weight transfer, naturally repositioned arms/blades and following cloak | Between B16/B4 preparation and B5 reverse contact |
| C | Crossed blades completing follow-through, stance balancing, cloak settling into guard | Between B10 follow-through and B11/B0 recovery |

Keep the canonical face, spiky hair, navy cloak, black armor, ivory piano-key tabs, buckles, boots, blade proportions, shading and perspective. Deliver one isolated transparent frame per drawing initially; then pack a validated atlas with independent equal cells. No figure, weapon glow or cape may cross a cell boundary. Register the feet and torso scale against the canonical source before assigning normalized anchors. Preserve full weapon bounds. Do not stretch figures to fill a cell. Review at native OBS size before replacing existing poses.

Candidate images are retained outside the deployed site in `work/v6-art-candidates/`. The first prompt requested exactly these three bridging poses in a transparent equal-cell strip while locking character identity; the revision requested identical poses with 10% transparent gutters and no overlapping cell content. Both used built-in image generation, not a CLI/API fallback.

## Verification

Regression coverage includes target-region contact and body separation, normalized mirroring, maximum lunge, common sprite registration, counterattack recovery, exact evaluated damage, duplicate events, pause/reset, signature interruptions, multi-round transitions and reconnect restoration. Browser captures exercise isolated Azure, boss attacks, dense Hanon/Schmitt, mixed counters, victory and defeat. Separate recording checks cover Boss ON/OFF, responsive heights, full notation containment, XP/achievement synchronization and no secondary MIDI listener.

Review artifacts and measured contact/frame timing are retained under `work/v6-review/`. The test input is synthetic MIDI/evaluator replay in Chromium; it is not a physical-piano or OBS application measurement. Video capture itself runs at approximately 30 FPS; unrecorded browser performance is measured separately.

Final results: 266 unit tests across 41 files passed. Browser checks passed for the cinematic layout, contact clocks, Hanon at 60/120/240 BPM, all nine replay scenarios and settings, recording synchronization, Boss ON/OFF and notation containment. The final 1920×750 isolated signature, rapid signature and mixed-counter replays also passed. At 1920×1080, rapid Hanon, Schmitt and mixed counters measured maximum actual contact error below 0.014 px, with no negative planned hero/defender body gap. At 1920×750, the unrecorded rapid signature replay measured a 16.8 ms 95th-percentile frame interval (approximately 60 FPS), at most three queued batches, and exact final HP for all 128 evaluated events. The longest scheduled visual contact latency was 611 ms, within the existing 650 ms presentation budget; this is choreography latency, not a claim of zero-delay MIDI response. No leftover queue remained after the passage.

Visual review includes idle, each signature contact, recoil, recovery, counters and endings through decoded capture sequences. This does not replace a final physical-piano/OBS recording check on the user's computer. The three missing illustrated bridge poses listed above remain an explicit artwork limitation.

No database migration, new runtime dependency or manual data conversion is required. Existing `/obs/recording` Browser Sources receive the update after refresh.

TypeScript checking, ESLint on all changed TypeScript files, the production build and `git diff --check` passed. The existing large Verovio/browser bundle remains a build-size warning; no new runtime packages were added.
