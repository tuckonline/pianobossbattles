# Boss Battle V7 — contact and movement polish

## Audit and scope

The existing React/Vite OBS view receives the normal evaluator's battle snapshots. `battle-animation-director.ts` batches those accepted events and schedules presentation; `battle-animation-player.tsx` draws the cached, alpha-cleaned PNG frames. `battle-layout.ts` solves visual weapon contact and bounds, while `battle-stage.tsx` runs compositor movement and ground-shadow tracks. The existing practice animation laboratory provides isolated and synthetic evaluator previews.

V6 had four presentation limitations: a generic small torso box could accept vertically separated bodies that still read as overlapping; recoil was limited to the intersection of every possible future weapon's reach; Azure's opening and final reaction reused the same illustrated row; and the pose bridge overlaid the old drawing over a fully opaque new drawing. These could be improved without changing the evaluator or generating another atlas.

The battle remains 22% wide, the score 78%, with the same character scale and neutral placement. No scoring, damage, XP, combo, achievement, transport, persistence or multi-round rules changed. There are no new dependencies or database migrations.

## Implementation

- Hero contacts use expanded pose-specific torso bounds and lateral separation, preventing a nominal vertical gap from allowing the hero to cover the boss's torso. The solver retains normalized weapon tips, target regions, mirroring, arena containment and lunge limits.
- Target regions include the exposed left armor edge. Small absolute bracing steps move the boss toward the central exchange area during approach. They are bounded offsets from guard, not incremental movement that drifts after many notes. Both fighters solve against the same planned endpoint.
- Recoil can use the available arena. The next approach resolves its own reach instead of constraining every reaction to all future attacks. Shadows share the same translation clock.
- `battle-motion-profile.ts` configures light/medium/heavy hit-stop and separate movement curves. Piano Blade accelerates and settles quickly; Crimson Colossus has a later recoil peak and longer weighted recovery. Combo pressure increases small reactions modestly and remains capped below a heavy reaction.
- Azure retains three approved-note contacts, with horizontal/reverse/cross trajectories, light/medium/heavy reaction weights and distinct reaction drawings. The heavy reaction reuses canonical boss B17/B18 bracing drawings, followed by B19 recovery, rather than repeating the opening shoulder-hit row.
- Boss contacts use the outer claw edges and lateral torso clearance. A small bounded hero guard step makes those anchors reachable at both 750- and 1080-pixel recording heights. Crimson Crushing Strike now makes its 250 ms contact on A14 (claws down), after A13's raised-claw wind-up. Its strong hero recoil, controlled hit-stop and longer follow-through/recovery retain the original damage values.
- Ordinary sword accents now follow the authored weapon origin and tip rather than covering the entire actor. The cross finisher adds one brief localized crimson/white armor burst. Effects remain bounded and respect disabled-effects/reduced-motion settings.
- Short premultiplied canvas crossfades replace stacked opaque figures. Impact frames stay immediate, and held defenders do not restart a pose blend. The bridge canvas backing store is reused; debug DOM lookup happens once per action rather than on every drawn frame.
- Developer overlays add current sprite frame/progress, desired body gap, planned contact error and measured compositor contact distance. OBS contains no debug controls or overlays.

## Artwork limits and production specification

No new images are shipped. Canonical contact and boss reaction drawings were inspected. The previous generated bridge-pose candidates failed cell registration; this pass uses the existing consistent artwork and improves timing, movement and blending. These are discrete illustrated key poses, not skeletal animation or newly drawn in-between frames.

For a future small art pass, preserve the canonical face, hair/horns, armor, weapons, clothing, palette, lighting, camera and proportions. Supply isolated transparent cells with the same foot/torso registration, no clipped weapon/cape tips, and independent validated atlas cells:

1. Piano Blade: A8/A4 preparation → A5 horizontal contact, with planted leading foot and torso rotation.
2. Piano Blade: B16/B4 → B5 reverse contact, with opposite weight transfer and cloak follow-through.
3. Piano Blade: B10/B11 → B0 guard, with blades lowering and momentum settling.
4. Crimson Colossus: A21 brace → A12 raised-claw preparation, with shoulder rotation rather than another static hold.
5. Crimson Colossus: B17/B18 braced stagger → B19 guard, with weight returning over the rear foot.

Do not duplicate or transform a cell and call it a new illustrated frame. Check alpha bounds, body scale and contact anchors after importing any future drawing.

## Verification

Tests and visual captures are recorded under `work/v7-review/`. V6 captures under `work/v6-review/` provide the comparison baseline. Browser scenarios use synthetic inputs through the existing evaluator and direct OBS transport, including rapid Hanon, Schmitt, intentional mistakes, signatures, endings, continuation and reconnect. Physical MIDI and the user's OBS application are not available to this test harness; a live hardware recording check remains pending.

- Unit suite: **272 tests passed across 42 files**.
- TypeScript and lint of all changed TypeScript/TSX files passed; production build passed.
- Repository-wide lint remains blocked by **11 pre-existing errors** in unchanged preview, score-size and test files (plus nine warnings). These files were checked against V6 and were not modified by V7.

- All **23 browser regression cases passed**, including the neutral-layout case rerun after increasing its cold artwork-loading allowance from 5 to 15 seconds. These cover real-time contact, Hanon at 60/120/240 BPM, Boss Mode on/off, score containment, notifications, XP/PBs, reconnect, multi-round continuation, victory and defeat. Inputs are synthetic, not physical hardware.
- Isolated **1920×1080 rapid Hanon benchmark without video/DOM tracing**: 128 evaluated notes and 128 damage events, 20 grouped visual contacts, maximum queue 3 (limit 6), no pending events after settling. Frame p95 **16.7 ms**, worst frame **16.8 ms**; sampled contact error below **0.014 px** and maximum contact-timer lag **9 ms**. Visual contact latency averaged 348 ms, maximum 589 ms during the grouped rapid stream; authoritative damage is applied immediately. These are local browser measurements, not a guarantee for OBS or a network connection.
- Video-instrumented runs were slower (typically 33.4 ms p95), so they are used for visual inspection, not presented as the unrecorded performance benchmark.
- Four additional **1920×750** checks passed: hero signature, boss signature, alternating attacks across rounds, and an ending followed by continuation. Sampled contact errors remained below 0.006 px with no scrollbars.

### Visual comparison and captures

The 1920×1080 recordings in `work/v7-review/verified-1080/` include both signature attacks, both endings, rapid Hanon/Schmitt, alternating mistakes and round transitions. Decoded contact sheets were inspected against `work/v6-review/hero-signature-verified-1080-decoded.png` and the previous boss-contact captures:

- `hero-signature-verified-1080-decoded.png`: preparation/approach at 5.7–5.8 s, first contact at 5.9 s, reverse at 6.1 s, cross at 6.3–6.4 s, stagger/recovery at 6.5–6.8 s. The torso stays to the boss's left, the boss steps into the central exchange, and the final braced stagger is visibly different from the earlier reactions.
- `boss-signature-verified-1080-decoded.png`: ordinary claw contact at 8.1–8.2 s, Crushing Strike preparation at 9.1–9.2 s, claws-down contact and hero recoil at 9.3–9.5 s, return at 9.6–9.8 s. Moving the anchor off the body center removes the earlier merged-torso composition.
- The original discrete key poses still show changes in illustrated silhouette; timing and short blends improve transitions but cannot replace the missing in-between artwork listed above.

Existing `/obs/recording` sources load this version after refresh; no OBS dimensions or camera changes are required.

## Changed files

Created `hosted/battle-motion-profile.ts`, `tests/battle-v7.test.ts`, and this report. Modified `hosted/battle-animation-director.ts`, `hosted/battle-animation-library.ts`, `hosted/battle-animation-player.tsx`, `hosted/battle-layout.ts`, `hosted/battle-stage.tsx`, `hosted/boss.css`, `tests/battle-contact-v6.test.ts`, `tests/battle-layout.test.ts`, and `tests/e2e-sites/battle-cinematic.spec.ts`. The geometry tests now exercise the actual bounded recoil → guard → contact sequence; the neutral-layout browser test freezes the idle clock while comparing canvas alpha bounds across sizes.
