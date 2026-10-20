# V13 Shorts display

Use the existing `/obs/shorts` Browser Source at **1080 × 1920**. The camera
remains a separate OBS source in the transparent band at y=1248, height=480 by
default. Refresh the source after updating. No new OBS URL is needed.

In Practice → **Shorts recording & highlights → Shorts Display**, or the
Shorts Studio's **Shorts Display** section:

- Character Scale: 110% default, 80–140% in 5% steps.
- Notation Scale: 125% requested by default, 90–160% in 5% steps.
- Notation View: Automatic, Current measure, or Current + next measure.
- Advanced safe margins and individual/full resets are available.

Settings use the existing profile preference persistence and overlay transport.
The embedded preview is silent and read-only. Open a practice exercise to see
it. The effective fitted notation percentage appears below the controls; full
notation visibility takes precedence over the requested scale. At high scale,
characters are constrained to their visible idle zones without changing their
relative proportions or foot anchors. Cinematics have independent framing.

## Presentation changes

The automatic hook header and export captions are removed. Gameplay facts,
exercise name, musical position, HP, timer, power, combo and accuracy remain.
The temporary user-requested SYNC marker remains for video alignment. Older
session caption flags cannot re-enable captions in newly generated export kits;
text already baked into an old video cannot be removed by the exporter.

Victory, Defeat and TIME OUT fill the battle-plus-notation region, leaving the
camera band clear. Each has one result title. Canonical assets, timings,
holding/dismissal/reconnect rules and horizontal cinematic definitions are
unchanged. Score DOM remains mounted beneath the scene; achievements retain
the existing deferred presentation policy.

The shared Combo Power meter now belongs under player HP (or player identity
in Time Attack), followed by shields in Ultimate Boss. Its thickness is about
65% of player HP. Horizontal arena height and character scaling are preserved;
the meter's former footer allocation moves to the player header.

## Implementation boundaries

- `shorts-display.ts`, `shorts-layout.ts`: validated preferences and portrait layout.
- `shorts-display-ui.tsx`: saved controls and silent live preview.
- `shorts-view.tsx`, `shorts.css`: clean portrait composition and cinematic staging.
- `portrait-layout.ts`, `broadcast-layout.ts`: cached full-ink measure windows,
  contain fitting, stable per-measure updates, effective scale reporting.
- `battle-layout.ts`: optional bounded proportional scale with stable foot anchors;
  absent in the horizontal configuration. Existing contact solver is reused.
- `boss-ui.tsx`, `boss.css`: one player-owned power meter and shield grouping.
- `game-client.ts`: display-only settings save path, without battle reconfiguration.
- `obs.tsx`: isolated, silent settings preview receipt/audio behavior.
- `shorts-ui.tsx`: clean review/export plans and controls.

No database migration is necessary: nested preferences live in the existing
settings JSON. Defaults upgrade existing profiles on read. No MIDI scoring,
damage, difficulty, power charging, rewards, cinematic timing, or capture event
rules were changed.

## Verification

Local verification on 2026-10-19: 394 unit/database/network tests across 51
files, 30 distinct browser checks, and both FFmpeg export checks passed.
TypeScript, changed-file lint, production build, and whitespace checks passed.
The final compact-HUD regression covers all three modes at portrait 1080×1920
and horizontal 1920×1080 and 1920×750. Portrait signature and rapid Hanon videos
were captured and inspected. The original horizontal result visual comparisons
also pass, including held scenes after 24 hours.

Logs, screenshots, and combat clips are retained in `../../work/v13`.

Automated coverage includes bounds at minimum/default/maximum scales, apparent
proportions and foot anchoring, weapon contact, active-measure following without
re-engraving, cross-tab preference persistence, single thinner power meters in
all modes, clean exports from legacy edits, canonical held/reconnected results,
and real evaluator-driven MIDI playback through the existing test harness.
Portrait Hanon/signature runs use synthetic inputs through the production
evaluator and direct transport; their measured JSON and screenshots are browser
evidence, not a native OBS hardware test.

For the final hardware check, record a short portrait OBS take with your actual
piano/camera. Try the default controls, a large two-measure window, rapid Hanon,
both signature attacks, then each ending. Confirm camera placement, mobile
readability and sound balance. The website does not capture the camera or
control OBS. Native OBS 60 FPS and physical piano latency require this field
check; they cannot be inferred from headless-browser timing.
