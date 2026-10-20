# Cinematic combat V3

This is the original V3 implementation record. The current choreography and verification checkpoint is [Sprint A/B review](combat-choreography-review.md).

## Audit and integration map

The published site uses React/Vite with a Cloudflare Worker and existing D1 persistence. `game-core.ts` emits evaluator-approved musical results. `boss-battle.ts` consumes unique scored occurrences, applies damage immediately and closes a knockout battle. Pitch-only practice does not manufacture timed misses; a missed event is supported only when explicitly supplied by the evaluator.

`battle-animation-player.tsx` draws the existing four PNG atlases on reused canvases. Each main action has four distinct key poses; `battle-art-bounds.json` provides measured alpha crops. `battle-animation-library.ts` already had weighted selection, cooldowns, conditions and replaceable sprite/frame/rig adapters. `battle-stage.tsx` already moved fighters and ground shadows with shared WAAPI tracks and kept their idle alpha bounds separate. `boss-ui.tsx` receives the existing direct OBS snapshots, falling back to the existing cloud transport. Neither OBS nor these animation components award damage, XP or achievements.

Before V3, both characters, the impact and HP bar changed at attack start. The registry had no contact timestamps. A new note could interrupt before the weapon landed, while a knockout immediately replaced the attack with victory/defeat poses. One pending priority cue could also lose the order of mixed correct/incorrect events in a coalesced snapshot.

## Pass 1: contact and timing

Attack metadata identifies the ordered contact frame, contact time, recovery, hit-stop, recoil strength and normalized weapon/target anchors. Hero strikes use a fast 64 ms approach; ordinary boss attacks use 96 ms and a heavier easing/recovery profile (scaled by playback speed). Heavy attacks have separate timings. The renderer maps its actual contact pose to that timestamp and holds it during hit-stop. Movement reaches the same configured anchor, while the defender begins the first recoil pose and visible HP changes at contact. Shadows share the fighter's exact movement clock.

These are authored anchors for four-pose artwork, not a skeletal interpolation system or physical collision detection. The existing extended sword/claw poses and collapse poses were inspected and reused. No additional images were generated. Unsupported/custom clips can use the registry's existing light-attack/idle fallback; missing artwork retains the existing idle fallback.

The website's plain HP readout stays authoritative and immediate. Only the OBS battle's displayed HP transition waits for contact. Damage is applied before an animation is queued. Hit-stop affects combat playback alone; it does not stop MIDI, audio, score highlighting, XP or combo evaluation.

## Pass 2: rapid-note combinations

The reducer appends presentation metadata after accepted evaluations to a 32-entry chronological journal, including incorrect and missed events. This journal is optional for compatibility with an already-open older publisher. It is transmitted in the existing snapshot, without a new listener, service or database table.

`BattleAnimationDirector` starts the first attack immediately, groups same-side arrivals in a configurable 125 ms window and never restarts a wind-up as more notes arrive. Notes arriving after contact form the next combination. The next strike can begin after contact, hit-stop and a short follow-through rather than waiting for the entire return-to-idle clip. It begins at the actor's current displayed location. The hit count is based on accepted occurrences; adjacent notes do not become a fabricated chord. Written chords retain their pitch-specific arcs and stronger effects.

The queue is capped at six batches. Exceptional overload can skip old presentation batches; chronological HP endpoints reconcile all actual damage, and stale visuals older than 650 ms do not replay. This is visual coalescing, not damage loss. Pauses shift the shared clock. Disconnect/reload restores authoritative state without replaying historical attacks or endings.

## Pass 3: cinematic polish

Pitch signatures remain, with weighted alternatives to prevent three identical poses when an eligible alternative exists. Visual tiers at 10/25/50/100/200 notes add variety, occasional stronger attacks, blue energy and higher-tier combinations. All tiers retain one damage per correctly evaluated note. Damage-taking reactions recover directly; no post-hit block implies that real damage was negated.

Impact sparks, cyan/red accents and chord trails are local to the arena. Combat-effects intensity is configurable in the existing controls. Reduced motion suppresses movement/trails and uses static contained feedback. A knockout cancels pending ordinary visuals, plays a final attack, shows contact/recoil with a brief 85 ms combat-only hold, then plays the dedicated collapse/victory poses and the existing blue/red flames. Outcome text appears after impact. The end pose stays stable; reconnect does not replay the sequence.

## Animation laboratory

Open `/student/practice?battleDebug=1`, then **Progression & recording controls → Character animation library**. The opt-in laboratory previews strikes, missed-note reactions, 3/8/16-note combinations, streams, combo tiers, finishes, speed, anchors and reset/pause. It uses isolated local state and imports no progression/persistence/MIDI/OBS-publisher hook. Debug controls do not render in OBS. The ordinary individual clip gallery remains available.

## Validation

Timing tests exercise immediate authoritative damage, delayed visible HP, exact contact frame selection, visual hit-stop, pause/restart, ordered mixed evaluations, complete/incomplete chords, bounded long streams, knockout sequence and reload behavior. Existing scoring, multi-loop battles, achievements, layout, alpha cropping, shadows, transport and asset-fallback checks remain regression coverage.

Local two-browser Hanon runs use simulated Web MIDI through the existing evaluator at 60, 120 and 240 BPM equivalent sixteenths, two hands, 64 groups per run. These are animation load tests, not physical MIDI verification or musical tempo grading. Screenshots and browser video captures of the OBS route are stored under `work/` outside the source repository. Actual OBS frame pacing remains dependent on its host and connection.

Final checks: all 217 unit tests passed; TypeScript and the production build passed. Targeted browser checks passed for the animation laboratory, real-time contact, both endings, moving shadows, all supported arena sizes, chord upgrades, MIDI damage, four multi-loop configurations, direct OBS transport and all three Hanon speeds. The Hanon runs retained all 128 scored notes per run, with at most two pending visual batches. Local p95 frame intervals varied from about 17 to 33 ms under test load; 60 FPS is a target, not a verified guarantee on the user's OBS host. Separate-browser attack onset measured 9–22 ms in the existing local latency test; contact intentionally follows the attack's authored wind-up.

## Changed files

- Core presentation: `battle-animation-director.ts`, `battle-animation-library.ts`, new `battle-timeline.ts`, `battle-layout.ts`, `battle-stage.tsx`, `battle-animation-player.tsx`.
- Existing evaluator/OBS bridge: `boss-battle.ts` and `boss-schema.ts` add the bounded accepted-event journal without changing damage rules.
- UI/settings: `boss-ui.tsx`, `boss.css`, `boss-config.ts`, `game-ui.tsx`, `battle-animation-preview.tsx`, new `battle-choreography-preview.tsx`.
- Coverage: new `tests/battle-choreography.test.ts` and `tests/e2e-sites/battle-v3.spec.ts`; existing battle animation, note attack, battle reducer and cinematic tests updated for contact-timed presentation.

Remaining art limit: each source action still has four authored key poses. The new timeline synchronizes those poses, movement and effects; it cannot create additional hand-drawn in-between frames. The debug readout shows the current phase, time until contact and queued batches without adding per-frame React updates.

No migration, manual database setup, new sprites or new OBS URL is required. Refresh the practice page and OBS score Browser Source after publication so both use the new event journal.
