# Unified OBS recording view

Use `https://pianopath-studio.rosy-knoll-9766.chatgpt.site/obs/recording` as one Browser Source. Start at **1920 × 750**, positioned at the top of a 1920 × 1080 OBS canvas. Place the separate physical keyboard camera in the remaining 330 pixels. The website requests no camera or microphone access.

The Browser Source width and height are the configuration: change them in OBS whenever the camera needs more or less space. The page fills that viewport, recalculates notation fitting from its content rectangle, and needs no height query parameter or source-code change. Resize the source itself rather than stretching a previously rendered 750px image in OBS. Sign in through OBS Interact if prompted, and keep the normal practice page open as the publisher.

The existing full-width banner contains the exercise title, large gradient XP bar, level, combo, session/lifetime best, accuracy and exercise PB. The score occupies the remainder. Boss Mode reserves the existing 16.5% left column, with the same sprite renderer, contact director and battle results. OFF removes the column completely. Notification graphics and fades use the existing celebration engine; one queue displays achievements, records, level-ups and repeatable note streaks over the banner without obscuring notation. Achievement display receipts survive reload within this view and never award rewards. The existing session-summary outro remains available.

## Integration

- `hosted/obs.tsx`: one existing `OverlayReceiver`, EventSource/fallback and direct peer connection serve the entire composition. The banner is extracted into a shared presentational component. The unified route uses full cloud responses for authoritative saved XP and PBs; peer snapshots carry live notes, combo and battle state. It does not mount the practice interface, connect MIDI, publish snapshots or process rewards.
- `hosted/obs-score.tsx`: adds an embedded mode. The existing `NotationViewer` fits to the actual middle rectangle in both Boss modes, including the banner offset. Exercise changes load notation once; note feedback does not re-engrave it.
- `hosted/obs.css`: scopes the responsive recording grid, banner, score and notification placement to the new route. No keyboard-camera spacer or fixed recording height.
- `hosted/obs-direct.ts`: an exercise/hand change clears obsolete exercise-specific PBs while the corresponding server response catches up. Peer messages still cannot supply lifetime XP or saved records.
- `hosted/app.tsx`, `hosted/obs-links.tsx`, `hosted/game-ui.tsx`: route registration and links/setup guidance on the practice interface.

`/obs`, `/student/obs`, `/obs/score`, `/obs/celebrations` and `/obs/streaks` remain available. The old OBS scene can remain intact while testing the unified source in a different scene. Avoid stacking the old banner/score/notifications over the new composition in the same final scene. No database migration or scoring change is involved.

## Verification

Browser coverage in `tests/e2e-sites/obs-recording.spec.ts` checks five score types, Boss ON/OFF, 1920×750, 1920×600 and 1280×720, centered ink, character bounds, no document scrollbars, unchanged SVG nodes, actual simulated Web MIDI in a separate publisher browser, saved XP/PB synchronization, reconnect after reload/publisher close, victory/defeat, one live-state stream, no MIDI/media acquisition, and no reward/publisher writes from the recording view. It also tests repeatable fading streaks and persistent achievement receipts without awarding progress.

Rapid Hanon validation runs 64 two-handed groups (128 scored notes) at 240 BPM equivalent sixteenths through the existing evaluator. The view targets 60 FPS using existing canvas/WAAPI and event-driven state updates; actual OBS frame pacing depends on host load and the browser connection. Saved statistics follow the authoritative cloud confirmation cadence; direct live notes and combat do not wait for that persistence round trip. The existing cloud fallback remains active if the local peer connection is unavailable.

## V4 layout refinement

The recording banner uses a 112px desktop height and 34/42/24 title/progression/statistics grid proportions, after padding and gutters. At 1920px the title has 629px of usable width (previously 428px), the XP track is 777px wide and 8px high, the title is 30px, level 22px and combo 32px. Titles truncate within their column. Below 1400px proportions adapt; below 1000px the banner stacks into a 180px layout. Overall recording height still follows the actual Browser Source viewport.

Idle/active filler labels and duplicate battle branding are omitted in this route. Paused/completed attempts and battle outcomes retain status text. The existing live snapshot does not expose a distinct MIDI-disconnected flag, so the presentation does not invent one or add a device listener.

One-, two- and three-system scores use measured ink centers at 50%, 32/68%, and 22/50/78% of the score panel. A uniform scale is bounded by edge padding, inter-system separation and a maximum 10% increase over the existing fitting scale. Four or more systems retain natural pair spacing and existing score following. Geometry/content changes trigger fitting; note updates never re-engrave or reposition the short-score systems. The legacy score route retains its original fitting.

The recording-only battle configuration reclaims the duplicate branding/status space for the arena. Piano Blade's alpha envelope grows 12% against the existing scale basis while the boss retains that basis. At very narrow arena widths the growth is limited to about 10.4% to keep both unchanged weapon/target anchors reachable without clipping. Existing normalized idle zones, sprite atlas, animation director, shadows, combat rules and panel width remain in use.

V4 coverage includes all 227 unit tests, TypeScript and production build checks, the four unified recording browser scenarios, legacy banner/score/cinematic checks, and a dedicated three-system/long-title/resize scenario at 1920×750, 1920×600, 1280×720, 960×650 and 650×600. Before/after reference screenshots are saved as `work/v4-{before,after}-{short-off-idle,short-on-idle,long-off-active,long-on-active,two-off-idle}.png` relative to the workspace. No data migration or OBS URL change is needed; refresh the existing Browser Source after deployment.

## Full notation containment

Broadcast fitting measures the painted primitives of each complete system in local SVG coordinates, including note glyphs, both staves, braces, beams, ledger lines, fingerings, articulations, slurs, ties and stroke extents. The bounds are cached and transformed into screen coordinates for uniform width/height containment. Consecutive long-score frames use the union of both systems, including their overhangs. Centers are computed only after that fit.

Verovio's nested SVG viewport must have `overflow: visible`: it establishes engraving coordinates, but its original paper height is no longer a valid clip after adaptive row placement. Only the outer white score region contains the presentation. This fixes the Schmitt Exercise 1 lower-staff cutoff even when the reported system bounding rectangle previously appeared to fit.

Safety padding defaults to 24px on every side. Developers may override `--score-padding-top`, `--score-padding-bottom`, `--score-padding-left` and `--score-padding-right` on `.sight-score` (pixel values). The same configuration is exposed as `broadcastPadding` in `broadcast-layout.ts`. Viewport changes and final font metrics trigger a refit; MIDI feedback does not remeasure the notation primitives.

For local debugging, open `/obs/recording?scoreDebug=1` on localhost. Blue outlines show the available region, gold outlines the padded region, green outlines final scaled ink, and red indicates overflow. The readout includes initial measured bounds, final bounds, padding, scale and overflow. This diagnostic is disabled on non-local hosts and disappears when the query parameter is removed.

`score-containment.spec.ts` tests Schmitt Exercise 1 at 1920px widths and 440/600/750/1000px heights with Boss Mode ON/OFF, plus a narrower viewport, refresh, other score types, long-score following, custom padding and the legacy score route. It compares rendered score pixels with an explicitly unclipped rendering, because SVG bounding rectangles alone do not reveal clipped content. Reintroducing the original nested viewport clipping deliberately produces different pixels, verifying that the regression check catches the reported bug.
