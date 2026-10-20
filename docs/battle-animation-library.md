# V3 update

The current director uses contact-timed choreography and bounded rapid-note combinations. See [Cinematic combat V3](battle-v3.md) for the current timings, validation and integration map; the library/asset details below describe the original foundation.

# Canonical battle characters and animation library

The first canonical matchup is **Piano Blade Warrior** versus **Crimson Musical Colossus**. These original raster assets were generated from the written character brief; the referenced selected concept images were not included in the attachment. Both characters share the same dark, outlined fighting-game style, with cyan blades versus crimson muscle and black armor. No franchise characters are used.

## Shipped library

Each character has two transparent 1024×1536 PNG atlases. Each atlas contains four columns and eight rows: 32 full-body keyframes, one four-frame motion per row. That gives **16 authored motion strips per character, 128 keyframes total**. The registry contains **19 playable clips per character** (38 total), including additional low-HP, retreat and counter sequences assembled from those keyframes.

Per character: two idles, three light attacks, two heavy attacks, three hit reactions (including low-HP recovery), two defenses, two movements, one counter, two victories and two defeats. These are an initial keyframe library, not the full future target of 20+ uniquely authored attacks per character. Higher-frame-count replacements use the same contracts.

Atlas A rows: breathing idle, horizontal cut/claw, thrust/maul, overhead heavy attack, chest hit, crossed guard, flourish/chest-pound victory, kneeling defeat.

Atlas B rows: tension idle, rising cut/backhand, cross slash/shockwave, shoulder hit, sidestep/armored defense, forward movement, kneeling salute/dominant roar, fall-and-brace/heavy collapse.

## Separation of responsibilities

- `boss-battle.ts`: authoritative evaluated-note HP and outcomes. Unchanged by this feature.
- `battle-animation-library.ts`: canonical character metadata, typed asset definitions, registry and weighted selector. Stable clip IDs, categories, durations, weights, cooldowns, tags and eligibility conditions.
- `battle-animation-director.ts`: read-only snapshot-to-animation choreography. Approved pitches select consistent attacks; completed chords select heavier strikes. Older snapshots without note annotations retain combo-based heavy attacks. Low boss HP enables heavier retaliation. A defense recovery may follow an actual hit; it never blocks damage. Counter animations are flourishes, not extra attacks or rewards.
- `battle-animation-player.tsx`: cached asset loading, alpha-masked source extraction and canvas playback. Sprite sheets, frame sequences and parented 2D bitmap rigs have working adapters. Future Spine/Lottie/video runtimes require an adapter, not changes to combat rules.
- `battle-layout.ts` and `battle-stage.tsx`: normalized visual zones, measured artwork envelopes, responsive sizing, bounded attack/recoil movement and predictable depth ordering. They have no collision/damage authority.
- `boss-ui.tsx`: existing OBS battle panel, immediate HP display, optional sound and presentation lifecycle.
- `battle-animation-preview.tsx`: local visual-only gallery inside Progression & recording controls. It has no game-client or mutation API dependency.
- `battle-finisher.tsx`: bounded, presentation-only blue/red flame endings on the defeated character. Live knockouts play once for 3.4 seconds; restored results do not replay them. Reduced motion displays a still aura.

The selector filters by character, category, cooldown, combo, HP, rage, battle state and event type; then performs weighted random selection. It avoids immediately repeating a clip when eligible alternatives exist and lowers weights for recently used clips. If nothing qualifies, the director uses an idle or basic attack rather than violating conditions.

The director keeps one pending cue: rapid chords/passages coalesce without a growing backlog. Mistake reactions take precedence over routine queued attacks; terminal outcomes interrupt immediately. It never creates note evaluations. Reconnects establish a baseline and do not replay old hits. Pauses freeze playback and shift the clock on resume. Stale queued cues expire. Abandonment uses a neutral pose, not a fake knockout. Loaded terminal states show the final frame without replaying the finish.

Canvas frames update outside React; notation is never rerendered by animation ticks. Transform accents stay inside the existing narrow battle column. Reduced-motion mode shows still poses; hidden tabs stop requesting animation frames. A failed asset falls back to the character's idle sheet, then a small name label if that also fails. HP and outcome rendering are independent of both failures.

## Adding or replacing clips

### Alpha bounds and existing asset limitations

The original atlases are retained unchanged. Their illustrations are not perfectly registered to the nominal 256×192 cells: some weapons cross a column boundary and some rows drift vertically. `scripts/measure-battle-art.py` measures the complete opaque silhouettes across each sheet, grows them into their translucent fringes, and records frame bounds plus compact row-span masks in `hosted/battle-art-bounds.json`. This prevents neighboring heads, sword tips or clothing from leaking into a displayed frame. Source SHA-256 hashes are verified in tests. Run `python scripts/measure-battle-art.py` (Pillow required) after changing the four canonical sheets, then inspect the rendered gallery and battle captures. The script fails rather than guessing if it cannot identify 32 separate character cores.

The renderer preloads/caches masked source canvases once, uses one union envelope per clip to prevent per-frame resizing jitter, and preserves aspect ratio. Geometry comes from visible artwork rather than transparent image dimensions. New unmeasured atlases continue to use their declared regular grid, so replacement assets can use different dimensions without this analysis script.

These remain illustrated keyframes, not newly authored compact idle sprites or skeletal animation. The existing restrained idle strips are used for the best compatible presentation; wide dynamic poses are reserved for action clips. There is no new character design, image-generation dependency, or physical collision simulation.

Add images under `hosted/public/battle/`, then register a definition in `battle-animation-library.ts`. Keep the character's facing direction and cell baseline consistent. Example:

```ts
registerBattleAnimation({
  id: "hero_attack_light_slash_04",
  characterId: "piano_blade_warrior",
  category: "lightAttack",
  label: "Reverse diagonal cut",
  asset: { type: "spriteSheet", path: "/battle/warrior-next.png",
    columns: 8, rows: 4, frames: [8,9,10,11,12,13,14,15] },
  durationMs: 240, weight: 2, cooldownMs: 500, priority: 30,
  tags: ["blade"], conditions: { minCombo: 5 },
});
```

A `frameSequence` supplies ordered `paths`. A `rigged` asset supplies a logical width/height and layers with image paths, dimensions, pivot, optional parent ID and pose keyframes (x, y, rotation, scale and opacity). Rigs interpolate transforms. No database migration is needed for clips.

Legacy `beginner_pianist` / `training_dummy` saved settings normalize to the canonical pair on read. Difficulty, enabled state, sound preferences, HP rules and progress remain intact. The current boss still requires every scored note, with one HP damage per correct note.

## Verification

Unit tests cover registry geometry and coverage, weighted/anti-repeat selection, cooldowns and conditions, legacy settings, all three playback adapters, burst coalescing, mistake priority, milestone/heavy selection, pause, reconnect, restart, terminal poses, asset failures and read-only combat state.

Browser tests cover the full preview gallery, persisted progress before/after previews, failed-art fallback, varied live OBS attacks, heavy combo events, score DOM stability, reduced motion, held outcomes and multiple OBS sizes. Existing MIDI battle and direct-score transport tests remain regression coverage.

Release verification: 49 targeted unit tests and seven browser scenarios passed, with TypeScript checking and production build. The direct score regression still measured 10–17ms in the local separate-browser test with delayed cloud writes. No new database migration or OBS source is required.

After deployment refresh the practice page and OBS score Browser Source once so both load the new character schema and artwork. Existing URLs and OBS source dimensions remain valid.

## Key and chord attacks

`assessPractice` annotates each evaluation with its pitch, written note-group ID, group size and completion state. `evaluateGame` forwards that metadata. The existing battle reducer records a small presentation history only after accepting a unique correct scored occurrence. There is no additional MIDI subscription and no change to pitch-only grading, XP, HP, difficulty, loops or completion.

`battle-note-attacks.ts` maps the twelve pitch classes to existing slash, rising-cut and lunge poses with distinct slash angles. Octaves adjust the angle, giving each of the 88 piano keys a stable signature. These are variations of the original artwork, not 88 new sprite sheets. Two-note chords use the overhead crescent; three or more notes use the cross-blade strike. More distinct correct keys add layered arcs, a larger impact ring and stronger bounded movement, with visual strength capped at six keys to keep the score clear. The small chord label reports the actual distinct-key count. Damage remains one HP per correctly evaluated note.

Only tones from the same written score group played within a configurable 120 ms window combine into a chord flourish. The window affects animation alone: slowly played or incomplete chords still earn their normal scoring, XP and damage. An intervening mistake, pause or new loop breaks visual assembly. Repeated pitches and rapidly played adjacent score entries cannot fabricate a larger chord. Chord cues carry their accepted-note damage count; duplicate events cannot add cues or damage.

Snapshots carry at most eight recent visual cues through the existing direct/cloud OBS transport. The director keeps only one pending action, favors complete chords over routine notes, prioritizes mistakes, expires stale cues and never replays historical hits on reconnect. During rapid passages the strongest recent chord is shown without queuing every keystroke. The first approved chord tone starts an attack immediately; completion within the grouping window upgrades that strike. The upgrade's damage caption includes only the additional approved tones, so the first hit is not displayed twice. HP and notation remain independent of presentation.

Ground shadows remain below both characters but share the fighter's exact transform keyframes and animation clock. They follow lunges, recoil, pauses, interrupted attacks and return-to-idle motion, and reset together. Slash effects use opacity/transforms and disappear with the action; reduced-motion mode suppresses them. No migration, new OBS URL or additional assets are required.

The live HTTP publisher now reserves `keepalive` for the final page-exit snapshot and drains response bodies. Ordinary frames no longer consume the browser's shared keepalive byte allowance, which could stall cloud updates during rapid multi-loop runs with the larger cue payloads. Direct score transport is unchanged.

Key/chord release verification: 86 targeted unit tests and 10 browser scenarios pass, together with type checking and the production build. Coverage includes all 88 key signatures, incomplete/rolled chords, individual unison occurrences, duplicate events, wrong keys/pedal/releases, full MIDI battles, four multi-loop/save-mode combinations, shadow transforms, recoil/return, multiple OBS sizes, unchanged notation DOM, and no progress changes from visual fixtures. Single-note and 2/3/4/5-note attack captures were inspected. Direct MIDI-to-score paint measured 10–18 ms in the isolated local separate-browser test with delayed cloud writes; actual OBS latency depends on its connection and host.

## Input response

Fresh evaluated snapshots now advance the director immediately before paint. A single timer handles the next meaningful transition, replacing the 40 ms polling loop. Input interrupts decorative idle/defense poses immediately. Distinct rapid attacks coalesce for at most 75 ms from the current strike's start, instead of waiting for its complete 200–550 ms clip; completed chord upgrades and newly triggered mistake reactions can interrupt immediately. Movement still starts from the current on-screen position and returns smoothly. The grouping window recognizes chords but never delays their first response.

Prepared playback assets are shared across preloading and attacks. Warm strikes draw their cached first frame before paint, and the battle reuses each fighter's canvas rather than allocating a new canvas every action. The separate animation gallery retains its replay behavior. Failed assets, reduced motion, pauses and restored outcomes retain their existing fallback behavior.

The isolated two-browser timing scenario delays cloud writes by 900 ms and measures the next painted frame after evaluated MIDI input. Before this change, eight attack samples took 26–293 ms while score highlights took 8–29 ms. With this change repeated runs measured 8–27 ms for both. These are local measurements with an established direct connection, not a guarantee for every OBS/network setup. The regression threshold is 100 ms for those attack samples, and it also verifies reuse of the fighter canvas. No scoring, HP, XP, database, transport or OBS source configuration changes are required.

Latency release verification: 64 targeted unit tests and nine browser scenarios passed, including a final rerun of the three timing/key/chord scenarios after refining the chord damage caption. TypeScript checking and the production build passed. Existing OBS URLs and source sizes are unchanged.
