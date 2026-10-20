# Approved Sonniss combat audio

The 2026-10-19 selection export approves 24 event/source choices and rejects 12.
Only approved choices are used. `tests/fixtures/sonniss-approvals.json` freezes
their decisions and source checksums; `hosted/battle-samples.json` records source
names, original and output SHA256, source start, duration, gain and measurements.
The original 347-file library remains outside this repository, untouched.

## Production edits and mix

24 event-specific mono 48 kHz / 16-bit WAV edits occupy about 1.15 MB. Routine
swings and contacts last 0.20–0.40 seconds; heavy/power cues last up to 0.70s;
result layers last up to 1.45s. Impacts begin at the detected attack with 3ms
preroll. Source pitch and combat timeline timings are unchanged. Edits use a
75 Hz high-pass, 10.5 kHz low-pass, short edge fades, a maximum +6 dB adjustment,
and an RMS ceiling of -22 dBFS. Routine/voice peak ceiling is -9 dBFS;
heavy/result ceiling is -6 dBFS. No long multi-hit reel ships in full.

The existing master defaults to 0.08 (40% on the UI slider), maximum 0.2.
Short swings and contacts rotate between approved variants. Optional damage
voices are at 38% layer gain, orc effort 35%, final growl 45%. During gameplay,
vocal accents are at least 900ms apart. Ordinary swings are at least 110ms apart,
contacts 90ms, and power/heavy impacts 180ms. At most four voices can sound;
ordinary effects leave a slot for important cues. The compressed master bus,
mute, volume, gesture unlock and exclusive Practice/OBS ownership remain intact.

These conservative absolute levels cannot guarantee balance against every
physical piano/audio interface. Start at 40% Battle volume and check an actual
OBS recording with your piano; lower effects if they mask soft playing.

## Integration and reliability

`battle-sample-plan.ts` defines variations and sparse vocal layers. The existing
`battle-audio.ts` preloads/decodes once per context after its normal unlock path.
No network/decode work is awaited by MIDI or contact playback. Missing/loading
samples use a quieter version of the existing synthesized fallback, with names
and load counts visible only in settings diagnostics. A later gesture/test may
retry failures; old cues never replay when assets finish loading. Diagnostic
tests may wait for loading, then demonstrate swing followed by contact.

Victory uses the approved positive shimmer; Defeat uses fire with a quieter
monster growl. Azure power attacks rotate the approved sword/ice treatments.
TIME OUT keeps its original synthesized cue. No evaluator, damage, HP, XP,
animation timing, cinematic lifecycle, score layout or OBS geometry changes.
The existing source-output selection prevents Practice/OBS doubling; legacy
overlays and silent previews remain silent.

## License and approval record

Source: Sonniss GDC 2026 Game Audio Bundle, included four-page
`License - GDC Game Audio.pdf` (SHA256
`8a26e0113e8b00a4dc953a2d568d326bc780ebd792165f9bb604cb26010dee27`).
The identical license was read in all five bundles. It permits royalty-free
personal/commercial project use, modification and synchronization without
attribution, while copyright stays with the owners. It prohibits claiming
authorship, selling the recordings standalone, and using them to develop/train/
enhance AI technology without permission. These are locally processed approved
game assets, not a standalone sound-library offering or AI-training dataset.
Full originals, rejected sounds and audition-library files are not deployed.

## Verification and OBS field check

Automated checks cover approval provenance, checksums, PCM bounds, sample
loading/failure, deduplication, volume/mute, priorities, vocal spacing, rapid
two-handed evaluation, contact timestamps, Chrome/Edge decoding, output ownership
and held/reconnected cinematics. See the current delivery report for results.

2026-10-19 verification: 400 tests across 52 unit/integration files passed;
32 browser regression checks passed, followed by all 10 audio checks on the
final production build (33 distinct browser cases). TypeScript, changed-file
lint and production build passed. Rapid two-handed Hanon passed at 35ms and
90ms group spacing without lost evaluated notes or post-warmup audio requests.
Four identical simultaneous heavy impacts measured peak 0.248 / RMS 0.0235 at
default volume, and peak 0.540 / RMS 0.0544 at maximum volume in Chromium's
offline mixer. These measurements verify headroom, not balance against a live
piano. Native OBS mixer/device verification remains a manual field check.

In OBS use one unified `/obs/recording` or `/obs/shorts` Browser Source. Choose
OBS in the site's Battle audio output setting, enable **Control audio via OBS**,
unmute its mixer channel and assign the recording track. If gesture-blocked,
use Interact and click once. Avoid also capturing monitored effects through
Desktop Audio. Record a soft phrase and rapid Hanon at 40%, then adjust Battle
volume. Browser tests cannot verify your OBS mixer/device or physical piano mix.
