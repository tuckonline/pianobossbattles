# Shorts Mode (V12 capture workflow, V13 presentation)

## Architecture and scope

The deployed app is React 19/Vite (`hosted/app.tsx`) with a Cloudflare Worker,
account-scoped D1 persistence, R2 course uploads, and ChatGPT sign-in. The existing
`ObsOverlay` receiver combines direct authenticated RTC frames with the durable
SSE/HTTP fallback. `GameClient` receives the existing evaluator's results. No new
MIDI listener, scorer, combat engine, camera capture, WebSocket service, or cloud
encoder was added.

The Worker has no configured native FFmpeg runtime, media-processing service, or
access to local OBS files. Its [128 MB isolate limit](https://developers.cloudflare.com/workers/platform/limits/)
also makes native long-video processing a poor fit. V12 therefore implements the
brief's explicit import/local-export path. It does not control OBS recording.
Source video never leaves the user's computer. Metadata is not a reward source.

## Recording workflow

1. Create a separate 1080 × 1920, 60 FPS OBS scene. Add `/obs/shorts` as a Browser
   Source at those dimensions. Keep the existing horizontal scene unchanged.
   If using browser-source battle audio, enable **Control audio via OBS** and
   **Shutdown source when not visible** on alternate scene sources so only the
   active view owns battle audio. Preview-only browser tabs remain silent.
2. Put the physical keyboard camera underneath the browser source. The default
   transparent camera slot is x=0, y=1248, width=1080, height=480. The studio can
   generate a link with configurable `camera` and `battle` percentages. Camera
   y=(90-camera)% of viewport height. Do not crop or stretch the Browser Source.
3. Start OBS recording, then open **Shorts recording & highlights** on Practice
   and start capture. A requested SYNC label appears briefly at the top of the arena for 2.5 seconds.
4. Play normally. After the result cinematic finishes, show another sync marker,
   wait at least three seconds, then stop capture and OBS. Match the first frame
   of each label during review. Markers should enclose the full story/payoff.
5. If OBS recording pauses, pause capture too. Resume starts another segment.
   A practice pause does not imply a recording pause. If OBS reconnects while
   still recording, show a fresh marker and split capture if the footage has a
   discontinuity. A browser reload restores an interrupted capture; resume it
   explicitly, with new markers. Gaps are never silently bridged.
6. Open `/shorts`, choose the session, import the recording, match markers, save
   edits, preview suggestions, trim and approve a clip. Add editorial captions later in your video editor.
   OBS **File → Remux Recordings** makes an MKV browser-previewable as MP4 without
   changing its video/audio. Align and export against that same remuxed file.

## Presentation

`shorts-view.tsx` reuses the existing battle panel, alpha-bound contact geometry,
sprite director, audio output ownership, notation renderer, cinematic controller,
and celebration queue. Only portrait anchors and scoped CSS differ. The score
shows one or two complete measures with both staves and full measured ink bounds;
the practice score and horizontal OBS composition retain their existing behavior.
The transparent camera area is never used for captions or cinematics. There is
no duplicate compact result message. Existing held-result and receipt behavior
also applies in portrait mode. No new cinematic artwork or timing is introduced.

## Timeline and highlight rules

`shorts-recorder.ts` observes the existing GameClient boundary once. It captures
attempt changes, evaluated mistakes/streak crossings, power activations,
authoritative terminal results, and newly delivered server record/achievement/
level notifications. Cosmetic previews and already-held results are excluded.
Checkpoints summarize state at most every five seconds; no encoding occurs in
the MIDI loop. Monotonic `performance.now()` offsets drive each segment. Wall
clock timestamps are only recording labels and marker-display expiry.

Two measured anchors per segment map timeline time to video time. Extra anchors
must agree within 150 ms; clock rates outside 0.95–1.05 or out-of-range footage
are rejected. Every suggested interval stays inside its aligned segment and
includes its full payoff. The video offset is never assumed to be zero. Marker
matching accuracy and transport jitter still require visual review.

Rules are versioned/configurable in `shorts-core.ts`. Scores/reason codes are
deterministic; nearby suggestions in the same attempt are coalesced. Low-health
claims use actual HP, configured hit damage including enrage, and shields.
Time-based highlights use actual timer state. Comebacks require comparable
exercise/configuration evidence. A continuous interval is exported: there is no
splice that could present a failed take as a successful one. Default target is
30 seconds; short takes may produce shorter complete stories. Clips outside
markers or with missing payoff remain visible with a repair message.

## Persistence and data boundaries

Migration `0022_shorts_sessions.sql` adds an account/session primary key and an
owner/update-time index. `/api/shorts` uses existing authenticated identity and
same-origin POST validation, bounded schema/body validation, revision guards,
idempotent retry and account-isolated queries. It never writes game tables.
IndexedDB is the active local journal; a page-exit localStorage checkpoint
protects the most recent transition. Cloud writes are asynchronous/coalesced.
Only one same-profile practice tab can capture (Web Lock). After a stop, allow
**Cloud saved** before clearing browser storage. Downloadable timeline JSON is
an additional backup. Source video must be re-selected after page refresh.

Capture stops explicitly at its bounded metadata budget (3,000 events, ~1.2 MB
conservative UTF-16 estimate, or two hours), with a warning. Gameplay continues.
Start another recording when the limit is reached. Suggestions/review edits are
user-owned production metadata, not tamper-proof musical certification.

## Local export

An approved **Export MP4 locally** downloads a Python script with an embedded
validated clip plan. Install Python 3.10+ and a full FFmpeg build once, then run:

```powershell
python export-short-XXXXXXXX.py
# Or supply paths explicitly:
python export-short-XXXXXXXX.py --source "C:\Videos\recording.mp4" --ffmpeg "C:\ffmpeg\bin\ffmpeg.exe"
```

The script asks for the original recording if no path was supplied. It checks
source size/duration, portrait geometry, trim/payoff boundaries, and creates a
new output beside the source. Native FFmpeg generates 1080 × 1920 H.264/AAC MP4,
keeps source frame rate up to 60 FPS, uses contain scaling, and retains the first
recorded audio track without gain/normalization/mixing. It never overwrites
existing output/source files. Temporary encoding is isolated; failures report
the FFmpeg error. A JSON export report accompanies successful output. Re-import
the output in Studio to inspect it. No automatic YouTube publication occurs.

V13 exports clean gameplay without automatic hook/context captions, including
when reviewing an older session with saved caption flags. Already-baked OBS
graphics cannot be removed after recording. Likewise, piano/effects mixed into one audio track
cannot be separated after the fact; balance existing Battle volume first.

The current [YouTube limit](https://support.google.com/youtube/answer/15424877)
is three minutes for square/vertical Shorts, checked 2026-10-19. The UI exposes a
configurable maximum up to that verified limit. Review platform guidance before
raising the catalog limit in a future rules revision.

## Verification and remaining field checks

V12 verification: 390 unit/database/network tests, 22 relevant browser regression
checks (including four new Shorts checks), and two native FFmpeg export checks
passed. The four Shorts browser checks were rerun after the final adjustments.
TypeScript and the production build passed. Changed-file lint has no errors;
the existing unused `_notes` warning in `hosted/service.ts` remains unchanged.

Automated coverage includes deterministic highlights, evidence-based hooks,
deduplication, anchor offset/drift/discontinuity rejection, complete payoff,
authenticated D1 isolation/retry/stale-edit protection, real evaluated MIDI
capture, reload segmentation, portrait/mobile containment, held cinematic
restore, import/trim/approval/export-kit persistence, and horizontal regression.
`tests/fixtures/shorts-source.mp4` is an authored synthetic video/audio fixture,
not user footage. `tests/shorts_export_test.py` exercises actual FFmpeg when
`LPF_TEST_FFMPEG` is set. Manual media checks measured identical audio/visual
offset before/after trimming a synchronized pulse fixture (13.33 ms in both).

An existing real OBS MKV was inspected: 1920 × 1080, 60 FPS, audio present. The
exporter correctly rejects it as a horizontal source. **A complete new vertical
OBS recording with the physical camera and real piano has not yet been tested.**
Do not describe that final field check, or sustained native OBS 60 FPS, as passed.
Record a short new vertical session, align two markers, export it, inspect mobile
text/notation, check camera boundaries and lip/key-to-audio sync, and adjust OBS
mix levels. The software workflow is available without pretending that this
hardware-dependent acceptance check has happened.
