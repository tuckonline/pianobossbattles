# Approved preview and adjustable battle sizing release

Owner explicitly requested production publication on 2026-10-21.
Promote the approved public UI from development commit 529776e, preserving
production save recovery and excluding unrelated Creator Studio changes.

Setup opens Preview Battle without creating an attempt. Start Battle inside the
same mounted arena authorizes music and starts the existing countdown. The one
layout default is 40% arena / 60% music below the HUD. A pre-start slider permits
30–70% arena, persists locally per player, and resets to 40%. Selection is locked
through play, pause/resume and held results. Shorter arenas use closer idle
framing with existing scale/contact/foot rules. OBS/Shorts are unchanged.
No gameplay, database, DNS, authentication settings or SMTP changes.

Checks: 491 unit/database/network tests, TypeScript, changed-file lint, packaged
build and credential scan passed. Focused browser checks run on the exact
release checkout, covering sizing at three viewports, notation containment,
contact, held results, local persistence/reset, inert previews, scoring/loops,
pause/resume and save-session recovery. These use simulated MIDI fixtures.

Rollback: b6ba6b74-7727-4912-9493-f1e4ce0228d0 (e499e13).
Use the existing guarded production helper and production runtime bindings.
