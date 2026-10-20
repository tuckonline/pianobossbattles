# Boss Battle V8 — Piano Blade scale registration

## Audit

The hero uses two existing 1024 × 1536 PNG atlases, with 256 × 192 nominal cells and measured per-frame alpha masks. The cleaned bounds can extend beyond a cell because swords and capes cross those nominal grid lines. No source artwork was changed.

The V7 renderer contained each clip's alpha union inside the same idle-sized actor rectangle. That union includes weapons, trails and clothing, so it was not an anatomical measurement. The canonical idle union is 211 × 188 source pixels. Azure's shared union was 311 × 215: its width fit reduced the hero to 211/311 = 67.85% of the idle source-pixel scale. The ordinary lunge union is 330 pixels wide, giving approximately 63.94%. Light slash, heavy attacks, alternative idle and recovery also had differing unions. Existing stage movement only translates the character; there was no attack-specific CSS shrink multiplier to remove.

The inspected source poses have comparable heads, torso lengths and limb widths at one source-pixel scale. Their total heights differ naturally when crouching, leaning or kneeling. Source alpha audit: `work/v8-review/source-pose-audit.png`.

## Change

`battle-sprite-registration.ts` defines one canonical hero reference (x 9, y 4, width 211, height 188), a separate overscan canvas (-72, -40, 432 × 264), and measured foot contact lines for the existing frames. Every hero state uses that same source-pixel-to-world scale. Sword trails get canvas space rather than making the person smaller. There is no additional finisher growth.

The canvas has a constant 1080 × 660 raster store (2.5 raster pixels per source pixel). Its CSS size and offset place the reference rectangle exactly over the original actor rectangle. Source masks, proportions, transparency and weapon tips are retained. Ground offsets translate only; crouched drawings remain shorter instead of being enlarged to standing height. All inspected frame bounds fit inside this backing store. Mirror origin is the registered body center, not the center of the larger canvas.

Existing authored weapon origins, contact points and body boxes are remapped from their old contained coordinates into registered body coordinates, including the foot offset. The contact solver still chooses reachable points in the boss's existing target regions and enforces lateral body separation. A sword may extend beyond the logical idle rectangle. Arena clamping therefore uses the body for registered attacks, rather than using transparent/cape space as the character boundary. The outer battle panel still isolates decorative overscan from the score; it is not expanded.

Linked attacks start from their actual current transform. They no longer snap back to an idle-rectangle clamp between slashes. The same translation timeline continues to drive the ground shadow, now centered at the registered foot line. Existing pose blends and exact impact frames are retained.

The 22% battle / 78% notation split, idle character dimensions, atlas files, attack durations, pose times, contact times, hit-stop, recovery durations, MIDI evaluator, damage, HP, XP and live transport remain unchanged. There are no migrations or new dependencies.

## Verification and captures

The pose study captures the actual recording route at 1920 × 750, freezes the scene at a common guard origin, then draws each selected frame through the production loader. It is a pose comparison, not a recording of simulated combat. Full viewport images are in `work/v8-review/poses/`: idle, anticipation, first slash, reverse slash, Azure finisher, recovery, plus dash and ordinary light slash. `side-by-side.png` crops the same arena from the first six captures. `registration-measurements.json` records identical 1.22472 CSS pixels per source pixel in all eight poses, with the common ground line at y 395.25. Head/torso proportions stay consistent; crouching changes silhouette height, not whole-body scale.

Separate evaluator-driven browser tests exercise actual approach, contact, recoil, recovery, rapid Hanon/Schmitt, intentional mistakes, signatures, victory/defeat, round continuation and reconnect. These use synthetic evaluated input, not physical MIDI or the user's OBS process.

- **277 unit tests passed across 43 files.**
- **24 browser regression cases passed**, plus **three additional 1920 × 1080 checks** (hero signature, boss signature and rapid signature Hanon). This includes Boss Mode ON/OFF, full score containment, 60/120/240 BPM Hanon, transport/reconnect, HP, XP/PBs, notifications and session continuation.
- One older HTTP-fallback test initially raced its new-attempt publication and terminal update. It now waits for the new authoritative HP/status before completing the battle; the focused rerun passed. This was a test synchronization correction, with no runtime state change.
- TypeScript, lint of every changed TypeScript/TSX file, and the production build passed. The repository's previously documented lint errors in unrelated files remain outside this change.
- Isolated 1920 × 1080 rapid Hanon benchmark (no video or DOM tracing): **128 evaluated notes / 128 damage events**, 20 grouped visual contacts, maximum queue 3, no pending hits after settling. Frame p95 and worst frame were **16.8 ms**; sampled weapon contact error stayed below **0.015 px**. Existing grouped-contact latency averaged 326 ms, maximum 574 ms; authoritative damage remains immediate. These local browser measurements do not guarantee the user's OBS/hardware performance.
- Video captures under `work/v8-review/verified-750/` were also inspected. Video instrumentation was typically 33.4 ms p95, so those captures are visual evidence rather than the performance benchmark.

## Files

Created `hosted/battle-sprite-registration.ts`, `tests/battle-v8.test.ts`, `tests/e2e-sites/battle-v8.spec.ts`, and this report. Updated `hosted/battle-animation-library.ts`, `hosted/battle-animation-player.tsx`, `hosted/battle-layout.ts`, `hosted/battle-stage.tsx`, `hosted/boss.css`, `tests/battle-layout.test.ts`, `tests/e2e-sites/battle-cinematic.spec.ts`, and `tests/e2e-sites/battle-v3.spec.ts`.

The existing `/obs/recording` URL loads the fix after a Browser Source refresh. No OBS layout or camera changes are required.

