# PianoPath gamification implementation

## Integration map

The hosted site uses React 19, Vite and a Cloudflare Worker/D1 backend. ChatGPT identity is resolved by the existing service. The older Next app remains in the repository but is not the deployed frontend.

- `hosted/sight-reading.tsx`: existing MIDI subscription, start/stop/reset/completion and continuous passes; adds game checkpoints and pause/resume. No second MIDI listener.
- `hosted/sight-library.ts`: `assessPractice` still makes every musical decision. Its new evaluation trace identifies each expected group/pitch/ordinal occurrence. Correct chord members count individually in MIDI arrival order; wrong pitches do not advance the expected group. Ties and closing-note loop behavior remain unchanged.
- `hosted/game-core.ts`: versioned event replay, combos, exact accuracy tiers, level curve, eleven achievement definitions and bounded celebration queue.
- `hosted/game-service.ts`, `game-settings.ts`: server validation, authoritative re-evaluation, comparable PBs, reward transactions, settings and summaries.
- `hosted/game-client.ts`: transient live state, per-tab persistent checkpoint outbox, recovery, preview isolation and one-second saves.
- `hosted/game-ui.tsx`, `game.css`: HUD, settings, queued celebrations, optional sounds, previews, achievement replay and session outro.
- `hosted/service.ts`: authenticated commands for synchronization, reading progress, settings and ending sessions.
- `hosted/obs.tsx`, `obs-state.ts`, `obs-service.ts`: reuse existing snapshots and SSE/polling. OBS reads authoritative XP/records and never awards rewards. Normal banner height stays 100px at desktop sizes. Celebrations use the separate transparent OBS source described below.
- `hosted/db/schema.ts`, `drizzle/0019_gamification.sql`, `drizzle/meta/_journal.json`: persistence declarations and migration.

## Rules and persistence

Curve/rules version 1 starts at level 1, with threshold `100*(L-1)^2`. Unsupported stored versions require an explicit migration; do not silently change v1's interpretation. Correct evaluated occurrences earn 2 XP. Completed passes earn 30, with exactly one accuracy bonus (20/40/75), qualifying accuracy PB 50, first completion of the calendar day 50, and unique achievement rewards. The first comparable result establishes a PB baseline, rather than earning a PB bonus. Each continuous pass has a distinct attempt ID.

Accuracy uses the exact ratio `correct / (correct + incorrect key presses)`. The existing rounded accuracy display is retained. PB equivalence includes exercise ID, hand mode, closing-note configuration, evaluator version and a SHA-256 hash of the exercise definition. Old attempts lack that fingerprint, so no historic XP backfill or unverifiable legacy PB comparison is performed. Existing attempt history and collection mastery remain intact.

Migration 0019 adds eight tables: `game_players`, `game_sessions`, `game_attempts`, `game_xp_ledger`, `game_unlocks`, `game_combo_records`, `game_days`, `game_events`. Game attempts are reward checkpoints with immutable pitch-prefix receipts; existing `sight_attempts` remains the musical practice/history infrastructure. Composite unique keys protect reward IDs, achievements and events. A player revision guard and the existing D1 atomic batch mechanism serialize awards and total updates, with bounded conflict retries. Indexes cover session summaries and qualifying PB lookup. No daily cap is imposed.

Daily boundaries use the configurable IANA practice timezone (default America/Los_Angeles). A valid practice day requires at least one approved note; the daily XP reward requires a completed pass. Session summaries aggregate saved checkpoints, including legitimate partial practice, and exclude paused time reported by the client. XP and achievements survive refreshes and OBS reconnects; presentation queues do not control persistence.

## Controls

Open **Progression & recording controls** on Practice or Sight Reading. XP/combo visibility, notifications, intensity, duration, accent brightness, compact/expanded banner, sounds, per-event mutes, volume and timezone are configurable. Sounds default off with conservative volume. Recording mode hides the editing panel behind its small reopening control.

Preview and replay buttons only change transient visuals. They never invoke reward writes. End recording session finalizes active attempts as abandoned and shows the session outro. Starting the next attempt dismisses it. Normal notes only pulse the combo; milestones, records, unlocks and level-ups use the prioritized queue. CSS transforms/opacity drive animations, and reduced-motion preferences are respected outside explicit recording celebrations. The removed reactive score frame is not reinstated.

## Verification

- Full Vitest suite: 97 passing tests across 26 files.
- Playwright: 6 passing targeted scenarios covering gamification, scales, and Schmitt continuous/noncontinuous cadence behavior.
- Gamification browser scenarios cover live evaluated notes, release/pedal ignoring, pause/resume, mistakes, persistence, OBS reload, preview isolation, summary, refresh recovery, repeated passes and rapid two-handed reverse-arrival chords. A DOM identity assertion verifies the score SVG is not re-engraved for the rapid burst.
- Core/D1 tests cover unique note occurrences, duplicate events, wrong/missed note resets, deterministic mixed chords, restart, exact tiers, one-time completion/achievement rewards, level boundaries/multiple levels, qualifying PB conditions, timezone, all achievement categories, concurrent transaction retries, stale checkpoints, immutable input prefixes, abandonment, queue priorities/expiry, disconnect behavior and correction replay.
- TypeScript and production build pass. Targeted lint for the new gamification/OBS files passes.
- Full-repository lint remains blocked by 10 pre-existing `no-explicit-any` errors in score sizing and older tests, plus 7 existing warnings. No broad unrelated lint cleanup was performed.
- Two stale tests for previously deleted Czerny and Zelda catalog entries were updated to verify those removals remain intact.

## Explicit capability limits

The current evaluator is deliberately pitch-only: there is no timing window, timed miss classification, qualified tempo PB or retrospective correction emitter. Therefore **no tempo rewards or invented missed-note events are enabled**. The pure replay engine reconciles corrections and missed events in tests, but a future authoritative correction source will also require a transactional ledger-adjustment adapter before it can be enabled in production. Client attempts cannot rewrite previously accepted input.

The server verifies pitches against its own score and never trusts arbitrary XP totals. Browser-originated performance cannot cryptographically prove that a physical piano produced the notes; this is not a hardware-attested anti-cheat system. Active duration is client-derived and bounded, and does not earn XP. Recovery scans all journals belonging to the signed-in user on reopening a normal PianoPath page. Web Locks protect live writers; orphaned journals finalize interrupted attempts without completion bonuses and replay completed receipts idempotently. Concurrent tabs have separate outboxes, while all durable awards serialize per player.

Browser automation exercises the normal Web MIDI handler with a mock device. Native OBS capture, physical keyboard latency, audio mixing and real-device 30/60 FPS were not measured. Optional sounds may require OBS **Interact** to satisfy browser autoplay restrictions. No extra services or dependencies were added. Refresh the Practice page and OBS Browser Source after deployment; no other user setup is required.


## Long-term leveling revision (17 October 2026)

Curve v2 replaces fast v1 levels for current players while preserving every earned XP point, reward ledger row and permanent achievement. Migration `0020_long_term_levels.sql` marks players and open sessions as curve 2; closed sessions keep curve 1 so their original level summaries remain reproducible. All new player creation paths explicitly use curve 2. Reward amounts are unchanged. A recalculated displayed level can be lower; that is the requested rebalance, not lost XP.

| Milestone | Lifetime XP | Title |
| --- | ---: | --- |
| 5 | 15,000 | Apprentice |
| 10 | 100,000 | Developing Beginner |
| 25 | 501,250 | Advanced Beginner |
| 100 | 20,696,250 | Expert |

Every successive level costs strictly more XP than the previous level. Levels 2–5 cost 1,000 / 2,500 / 4,500 / 7,000 XP; 6–10 ramp from 10,000 to 24,000; 11–25 rise from 25,000 to 28,500; later costs accelerate quadratically. The design targets a few hours to level 5, several weeks to 10, and months to 25 for regular substantial daily sessions. Calendar estimates are tuning targets, not enforced timers: note volume, session length, accuracy and completion bonuses affect XP speed. Level 100 is the maximum displayed level; lifetime XP continues accumulating and the bar shows Expert / Max level.

The thresholds, old-version behavior, all 99 increasing costs, exact level boundaries, multi-level jumps, maximum-level display math, player migration and settings-first account creation are tested. The shared level helper updates Practice and OBS consistently.


## OBS graphics and separate celebration source (17 October 2026)

The main `/obs` banner now has a 12px cyan/blue/violet/gold XP bar and a wider XP column at desktop size. Its height, existing scores and music/camera boundaries remain unchanged. The Practice XP bar uses the same treatment.

Add `/obs/celebrations` as a separate OBS Browser Source, **250 × 250**, and position it beneath the main banner. Its document, canvas and background are transparent; it renders no celebration card while idle. There is no persistent icon or clickable gallery in this source. Each achievement has distinct vector artwork. View unlocked achievements in the practice page’s progression controls. Keep the source loaded while recording. Achievement, record, combo-milestone and level-up cards use the existing authenticated OBS transport and notification queue; no new reward processing or MIDI listeners are introduced. Cards fade/slide in, remain briefly (normally 2.5–4.5 seconds), then disappear. Existing intensity, duration, brightness, sound and reduced-motion settings apply.

The main banner no longer duplicates these cards by default. `/obs?celebrations=inline` retains the previous inline presentation for a single-source setup. Existing session summaries remain on `/obs`.

Open **Progression & recording controls** for direct links and the existing preview buttons. Preview cards are clearly labeled and do not change persistent data. If prompted, use OBS Interact to sign in with the same account as Practice. Browser autoplay can require interaction for optional sound; sounds remain off by default.

Verification: four gamification browser scenarios pass, including transparent idle state, preview appearance/disappearance, correct source dimensions, no reward from preview, real MIDI-triggered milestones, main-banner XP, refresh recovery and rapid two-handed input. Type checking, production build and targeted lint pass. No database migration is required for this visual update.

The standalone source uses the existing OBS SSE/poll transport. No database migration is needed.

## Score-only OBS source

Use `/obs/score` as a separate **Browser Source**, initially 1920 × 700 (adjust the source dimensions to the score area in your scene). Replace/hide the old practice-page window capture. Keep the practice page open and signed into the same account. The source contains only notation: navigation, keyboard hints, history, controls and gamification panels are never mounted here. Browser scrolling on the practice page cannot affect this document. Score titles are suppressed in both practice notation and the score-only source; the main live banner retains the selected exercise title. Main banner and celebrations remain separate sources.

The existing `/api/obs` snapshot now includes optional score display settings, active measure/beat and compact evaluator feedback. Score-only clients resolve the exercise from the existing authenticated catalog once per selection, including stored MusicXML, Hannah Smith, Hanon and Moonlight custom ranges. The notation renderer and score-follow hook are reused with the source's whole viewport as the safe area. No independent MIDI listener, scoring, reward writes, schema migration or WebSocket is added. Refreshes and reconnections restore the last published score. If the practice page closes, the last score stays displayed until another selection is published. Sync uses the existing 100 ms publisher / 500 ms OBS poll cadence, so highlights can trail the practice page slightly.


## Progress protection and profile (October 2026)

- `/student/profile` shows the Sites-authenticated account, cloud XP/level, lifetime combo, and all locked/unlocked achievements. No separate password is stored.
- A save indicator on normal workspace pages shows checking, saving, confirmed, or an actionable sync/storage error. It is not rendered in any OBS-only route. “All progress saved” refers to confirmed gamification progress, not pending uploads or unrelated site forms.
- Every evaluated update synchronously writes a version-2 localStorage journal, including the latest checkpoint. Each document owns a random journal ID and holds a browser Web Lock for its lifetime. Browser termination releases the lock; recovery does not depend on sessionStorage or restoring the old tab. Existing array-format outboxes are accepted.
- Recovery scans only the authenticated user's key prefix. It persists finalized receipts before sending, holds the orphan's lock through acknowledgments, and removes each receipt only after server success. Live tabs cannot be finalized by other tabs. Account identity is validated server-side on new replay requests. Existing unique ledger/unlock constraints and transaction guards remain authoritative.
- Unsynced checkpoints retry every second; orphan scans run every ~2 seconds and retry on connection restoration. Storage errors and malformed journals remain visible and malformed data is retained. Browser persistent-storage permission is requested when available. A close warning is used only if pending data lacks a local recovery copy.
- `gameBackup` exports all eight gamification tables in one authenticated, read-only D1 batch. The profile download adds local journals. An offline download is explicitly labeled a recovery file, not a complete backup. Backups are for support-assisted recovery; there is no client XP import endpoint. No database migration or destructive data reset is required.
- Limits: a hard power failure before browser disk flush, clearing browser storage, private browsing, browser corruption, or device loss can destroy unsynced copies. Confirmed server progress is independent of those copies. Use the same browser profile to recover unsent practice, or the same ChatGPT account on another device for cloud-confirmed progress. Web Locks are required for safe orphan recovery; unsupported browsers show a warning. Pages must reopen online to fetch the site/authenticate and sync. A live combo is not resumed after a crash; note XP and earned records are recovered. Old pre-update tabs should be refreshed when installing this release.
- Verification: unit tests cover legacy journals, monotonic recovery receipts, completed/partial handling, corrupt data, database export isolation and account-switch rejection. Browser tests cover fresh-context recovery without sessionStorage, offline completed/partial practice, two-tab ownership, lost acknowledgments, backup downloads, retained corrupt journals, and OBS regressions.
