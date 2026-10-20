# V11 manual verification

Preserved baseline: **314 tests passed across 42 suites.** The follow-up combined unit/database/network run passed **344 tests across 46 suites**. TypeScript, production build and changed-file lint pass (one existing lint warning). The original three browser failures are resolved; the full historical suite is not claimed clean. See `boss-battle-v11.md` for the root causes, current test results and release limitations. The earlier approval-capacity blocker cleared without changing security settings.

## Run locally

In PowerShell, from the existing project:

```powershell
Set-Location 'C:\Users\aaron\Documents\Codex\2026-09-18\what-are-the-most-popular-online\outputs\pianopath'
npm run build
node node_modules/wrangler/bin/wrangler.js d1 migrations apply pianopath-local --local --config dist/server/wrangler.json --persist-to .wrangler/state
node node_modules/wrangler/bin/wrangler.js dev --config dist/server/wrangler.json --port 8787 --ip 127.0.0.1 --persist-to .wrangler/state --var PIANOPATH_OWNER_EMAIL:local@pianopath.test
```

Reuse an existing project server on port 8787 instead of starting another. Dependencies are already installed. In a second terminal, from the same folder:

```powershell
node hosted/preview.mjs
```

Open **http://127.0.0.1:3001/student/practice**. The existing loopback-only proxy supplies the development identity; port 8787 alone may redirect an ordinary browser to sign-in. Keep both servers local. This uses local data, not live progress. Stop owned servers with Ctrl+C afterward. The separate Next.js `npm run dev` application is not this hosted preview.

## Preview Victory, Defeat and TIME OUT

Open **http://127.0.0.1:3001/student/practice?cinematicPreview=1**. Expand **Progression & recording controls → Developer cinematic preview · no rewards**.

- Click **Preview victory**, **Preview defeat**, or **Preview timeout**. Use **Cancel cinematic preview** between them.
- Let each finish, then wait 30 seconds: its final composition/title should remain.
- Inspect victory contact, recoil, collapse and the hero's final pose using **Half speed**, **Skip to impact**, **Skip to results**, or the timeline slider.
- TIME OUT should retain its red background, white title and existing entrance.

These previews do not award progress or broadcast a result to OBS. Use an actual local practice battle for refresh/synchronization checks.

## Test exercise loops

Open **http://127.0.0.1:3001/student/sight-read**, select **Hannah Smith Part 1 · Exercise 1**, and enable **Boss Battle Mode**. This is the exercise used by the automated loop tests. Test both **Time Attack** and **Ultimate Boss**:

| Practice loops | Explicit limit: 10 seconds per loop |
| --- | --- |
| 1 | 00:10 |
| 2 | 00:20 |
| 3 | 00:30 |
| 5 | 00:50 |

Check the countdown and boss HP before starting. With explicit limit **0**, keep BPM/allowance fixed and verify automatic duration scales with loops, allowing one second for rounding. Use a generous limit for complete multi-loop play.

Connect the piano and start practice. Time starts on the first evaluated note. HP/time continue across loops without resetting or pausing. Explicit pause freezes time; resume continues it. BPM/manual-limit changes during a run apply to the next run. Repeat with **Continuous** checked and unchecked. Schmitt omits the closing cadence on intermediate passes, so repeated passes intentionally differ from multiplying a complete single-pass score.

## Verify an OBS refresh

Create a temporary Browser Source: **http://127.0.0.1:3001/obs/recording**, **1920 × 750**. Keep the practice page and servers open; leave the physical camera separate. Enable **OBS cinematics**.

- Victory: complete all selected loops with HP/time remaining.
- Defeat: choose Survival, hardest difficulty (30 HP per mistake), start, and play a wrong evaluated note.
- TIME OUT: choose Time Attack, one loop and a short explicit limit; play one evaluated note, then wait.

After each result holds, use the Browser Source's **Refresh cache of current page** action. The final scene should return directly without replaying the entrance/strike or awarding rewards. Focus changes and additional MIDI activity must not dismiss it. Repeat at a source height of 1080.

Restart, start a new attempt, select another exercise, disable Boss Mode, or press **Dismiss result in recording view**: the latest score state should reappear.

## Check notification priority and duplicates

Use the unified recording source alone; hide separately added legacy achievement/streak sources for this check.

1. Earn an achievement at victory in local practice. No achievement card or compact battle-result message should cover the active/held cinematic.
2. Wait 30 seconds and refresh OBS. Neither the result animation nor the reward should repeat. Compare XP/unlocked achievements before and after refresh.
3. In a separate run without refreshing, dismiss the held result or restart the same exercise. Deferred notifications may resume once. Switching exercise/session clears stale visual notifications, while earned progress stays saved.
4. Disable cinematics and trigger a new result: the compact result should remain available as a fallback.

Record pass/fail, exercise, mode, loops and source dimensions. Browser assertion failures are separate from the earlier infrastructure limitation. Review results before publishing; a deployment-success claim also requires live-site verification.
