# Battle audio repair

The approved [Sonniss production integration](battle-audio-sonniss.md) now
replaces normal synthetic effects with preloaded samples. The synthesis described
below remains the loading/failure fallback and the unchanged TIME OUT cue. This
document records the original repair; use the newer guide for current mixing.

## Root cause

The controls persisted correctly, but playback was incomplete:

- The arena's old helper created a Web Audio context after an impact, outside a user gesture. If suspended, it requested resume, discarded the cue and swallowed errors.
- The normal practice interface did not mount that arena/audio path. Its checkbox and Start button therefore did not reliably unlock or play battle sounds.
- Only short generic sine tones existed. There were no sword whooshes, distinct heavy/Combo Power effects, or connected cinematic audio callbacks. The hidden cinematic `audioEnabled` default also remained false.
- The old helper capped gain at 0.08 even though the volume slider allowed 0.2, and closed its shared context whenever any arena unmounted.

## Implementation

`hosted/battle-audio.ts` is the shared sound engine. It creates short synthesized samples in memory, with no downloaded audio assets. Nine sounds cover hero/boss swings, sword contact, damage, heavy impact, Combo Power, Victory, Defeat and TIME OUT. A compressed master bus, four-voice limit and ordinary-cue cooldowns keep effects secondary to the piano. Heavy attacks and results can replace older ordinary effects.

`battle-presentation-hook.ts` extracts the existing arena clock without changing its scheduling. `battle-audio-cues.ts` maps that clock's swing/contact identities to sound. The practice browser uses the same presentation director as a silent observer of evaluated battle state; it does not subscribe to MIDI or calculate damage. The recording arena uses its existing director. No audio call waits in the MIDI evaluation path.

The cinematic renderer's existing impact/result callbacks now reach the audio engine. Restored terminal scenes do not play audio, and held scenes have no repeating audio timer. Recording receipts use session storage so a silent preview cannot consume another recording window's cinematic entrance. Each viewer still restores terminal snapshots directly to holding after reconnect. Artwork, CSS, choreography, durations and musical/battle rules are unchanged.

Audio is explicitly routed to **Practice browser** or **OBS Browser Source** in saved settings. Practice is the migration default. Existing 0–0.2 gain values are preserved; the slider presents that conservative range as 0–100%. No database migration is required; the setting is normalized in the existing JSON settings schema.

Only the unified `/obs/recording` source can claim OBS audio. Ordinary browser previews and legacy overlay routes stay silent. OBS is detected using its `window.obsstudio` binding. `?battleAudio=1` explicitly opts a normal browser into the recording-audio path for testing; it does not bypass autoplay. A Web Lock permits only one audio owner per player within a browser profile. Selecting the output prevents practice/OBS duplication across their separate browser profiles. Run only one OBS profile/instance with battle sound enabled: browser-local ownership cannot arbitrate two independent OBS processes.

Settings show the local context state, unlock state, enabled flag, master volume, played/coalesced counts, active voices, last cue/decision, asset status and errors. OBS sends read-only audio status back through the **existing score data channel** once a second. There is no parallel socket service. If that direct connection is unavailable, settings explicitly say OBS audio status is unavailable; cloud score fallback remains independent.

## Local verification

From the project directory:

```powershell
node hosted/build.mjs
npm run dev:sites
```

Use the existing local sign-in/test identity workflow at `http://127.0.0.1:8787`; do not disable authentication. The normal practice page is `/student/practice`, and the unified source is `/obs/recording`.

Open **Progression & recording controls**:

1. Enable Boss Battle Mode and **Battle sounds (optional)**. Set Battle volume to about 40% initially.
2. Choose **Practice browser**. Click each button under **Battle sound output & diagnostics**. Hero and boss tests include swing and contact; heavy, Victory, Defeat and TIME OUT have separate tests. Tests only audition sounds; they do not change gameplay or rewards.
3. Confirm `AudioContext: running`, `Unlocked: yes`, and increasing played counts. Test volume at 0%, 40% and 100%, then uncheck Battle sounds. Zero/disabled must stay silent; muting also stops active sounds.
   If counts advance but nothing is audible, check Chrome/Edge's tab or site mute, the Windows volume mixer and the selected speakers/headphones. Web Audio cannot inspect operating-system or OBS mixer muting.
4. Start MIDI practice using the existing Start button. Correct evaluated notes produce hero attacks; mistakes produce the boss/damage sound. Play a rapid two-handed passage and confirm score/HP continue to advance normally.
5. Wait for **All progress saved**, refresh, and confirm the audio preference and volume remain. Start/Test supplies a fresh gesture if the browser requires one.

## OBS check still required on the user's installation

Automated browser tests do not prove that the user's OBS mixer, monitoring device or recording track receives audio. Verify these steps in actual OBS before relying on combat sound in a recording:

1. In website settings, choose **OBS Browser Source**. Use the existing unified recording URL as one Browser Source, 1920×750 or your configured recording height. Keep the physical keyboard camera as its separate source.
2. Open that Browser Source's Properties and enable **Control audio via OBS**. Unmute its Audio Mixer channel. In Advanced Audio Properties, select the intended recording/stream tracks. Choose **Monitor and Output** if you also want to hear it locally, or **Monitor Off** if it should only reach the output. Check OBS's monitoring device if monitoring is silent.
3. Avoid capturing the same monitored effects again with Desktop Audio. The website's practice output is already silent when OBS output is selected. Local **Test Battle Sound** buttons are explicitly an audition in the practice browser, not an OBS mixer test.
4. If settings report a suspended/blocked OBS context, right-click the source, choose **Interact**, and click inside the white score area. No security setting or autoplay policy needs to be weakened. Start a new phrase after unlocking: old blocked effects are deliberately discarded.
5. Play correct notes, incorrect notes, a larger chord and a rapid Hanon passage. Check the OBS mixer meter and listen to a short recorded clip. Check a heavy boss attack and a Combo Power attack; their impacts should be stronger than ordinary notes.
6. Finish a battle in Victory, lose in Defeat, and let Time Attack expire. Each should have a distinct once-only sound, followed by a silent held result. Refresh the Browser Source while holding: the final image should return without replaying audio or rewards.
7. With practice and recording both open, confirm one effect per visual contact, with no echo. Test a second source in the same OBS profile: only one may own audio. Close the owner to check takeover, then return to one source for the actual scene.
8. Confirm Battle sounds OFF and volume 0% mute OBS as well. On a slow fallback connection, settings/audio changes may arrive with the next synchronized snapshot.

Official references: [Chrome Web Audio autoplay](https://developer.chrome.com/blog/web-audio-autoplay), [OBS Browser Source](https://obsproject.com/kb/browser-source), [OBS audio mixer](https://obsproject.com/kb/audio-mixer-guide), [OBS browser bindings](https://github.com/obsproject/obs-browser).

## Automated coverage

`tests/battle-audio.test.ts` checks synthesis, bounds, deduplication, gain, muting, blocked autoplay, stale cue rejection, voice limits, priority, exact contact timestamps, outcome suppression and legacy-setting normalization.

`tests/e2e-sites/battle-audio.spec.ts` uses actual installed Chrome and Edge Web Audio with observed buffer playback and nonzero signal energy. It checks all diagnostic sounds, volume/mute persistence, MIDI-driven effects, separate practice/recording browser profiles, duplicate recording windows, contact timing, held results/reconnect, strict Chrome gesture requirements, and rapid two-handed Hanon. The strict-policy test tightens autoplay policy; it does not disable restrictions.

Verified locally:

- **369 unit/database/network tests passed** across 48 files, including 21 new battle-audio tests.
- **27 targeted browser regressions passed** (7.7 minutes), covering audio, cinematic cancellation/holding, reconnects, exact original cinematic screenshots, multi-loop timers, score mounting and OBS ON/OFF layouts.
- TypeScript: passed. Changed-file lint: zero errors; the pre-existing `sight-reading.tsx` effect-dependency warning remains.
- Production build: passed. No combat-rule, evaluator, XP or database-schema changes.

After the final audio-only refinement (suppress covered arena cues and identify all heavy boss contacts), **all seven audio browser cases passed again** against the rebuilt release bundle (1.2 minutes). Native OBS mixer/audio-device verification remains manual as described above. The historical full browser suite was not rerun; the results above refer to the relevant regression set.
