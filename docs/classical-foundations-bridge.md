# Classical Foundations: 48-step learning path

The collection now contains 48 exercises in eight stages of six. Twenty-four new original studies fill the gaps around the original 24. The sequence begins with two-note patterns and progresses to one-octave scales, chord shapes, independent voices and early intermediate miniatures.

## Curriculum

| Stage | Steps | Focus | Checkpoint |
| --- | --- | --- | --- |
| 1 | 1–6 | Two and three notes, five-finger position, steps, skips, rests, mirror motion | Find C–G comfortably and coordinate simple patterns without tension |
| 2 | 7–12 | Sustained bass, ties, left-hand melody, phrasing and dialogue | Keep the supporting hand quiet while the other moves |
| 3 | 13–18 | Three-beat bars, two-note chords and eighth-note pairs | Read the new rhythm and prepare each chord shape before playing |
| 4 | 19–24 | A-minor colour, waltz bass, dotted rhythm and a first rondo | Combine the prepared patterns and connect four-bar phrases |
| 5 | 25–30 | Short thumb passages, C major, F-sharp/G major, B-flat/F major | Recognize each black key and use the hand-specific crossings |
| 6 | 31–36 | Natural/harmonic minor, contrary motion, triads, inversions and cadences | Recognize chord shapes and the raised seventh in harmonic minor |
| 7 | 37–42 | Broken triads, arpeggios, quarter-note then eighth-note Alberti bass, waltz in F | Reposition the whole hand and keep accompaniment even and quiet |
| 8 | 43–48 | Answering voices, new positions in G, cadences, sonatina and Festival Rondo | Learn short sections, practise their joins, and connect a complete piece |

All pieces are original PianoPath studies or familiar technical patterns. They are not compositions attributed to Bach, Hanon, Schmitt or another named composer. Fingering is suggested for each pattern. Stages are local course milestones, not examination grades; reaching the final exercise is not a certification of playing level.

The Practice page shows the current focus, a practice tip and a stage checkpoint. The expandable path contains every lesson with its existing learning status and lets the player jump to any step. Nothing is locked: repeat earlier studies or practise either hand separately as needed. MIDI assesses pitches at the player's own pace. Listen demonstrates the written rhythm. Tone, phrasing and physical ease still require the player's listening and judgement.

The skill categories are informed by established piano curricula, including the [ABRSM 2025–2026 Piano syllabus](https://www.abrsm.org/sites/default/files/2024-06/Piano%202025%20%26%202026%20Prac%20syllabus%2020240524_access.pdf). This sequence is independently authored and is not an ABRSM syllabus reproduction.

## Identity and data

`number` is the permanent exercise ID; `step` is the displayed course position. Existing IDs 8001–8024 retain their music and saved history. New IDs are 8025–8048. Displayed titles and MusicXML work titles use the new 1–48 sequence. For example, ID 8001 remains Five-Finger Promenade but is now step 4; ID 8015 remains F Major and is now step 30.

`hosted/classical-library.ts` defines the eight ordered stages and constructs the complete library. No database migration or duplicate progress counters are needed. Existing attempt history, collection progress, hand selection, note-only grading, keyboard shortcuts and OBS publishing use the same permanent IDs. Schmitt and sight-reading loops are unaffected.

Sources:

- Original IDs 8001–8006: inline score data in `hosted/classical-library.ts`.
- IDs 8007–8012: `scripts/build-classical-additions.py` → `hosted/data/classical-additions.json`.
- IDs 8013–8024: `scripts/build-classical-bridge.py` → `hosted/data/classical-bridge.json`.
- IDs 8025–8048: `scripts/build-classical-depth.py` → `hosted/data/classical-depth.json`.

The shared compiler emits MusicXML, suggested fingering and sounded MIDI events from one authored source. Rest durations remain in the score and timing summaries, but are excluded from MIDI note targets. Each bar has the same complete duration in both hands. The existing bridge music is unchanged; obsolete tips about adjusting MIDI tempo have been updated to match note-only practice.

## Validation

Unit checks cover 48 unique permanent IDs, contiguous course steps, eight stages, prerequisite ordering, complete bars, independently imported MusicXML/MIDI pitch and duration parity, accidentals, rests, standard scale fingerings, triad tones, rondo form and successful/right-versus-wrong note grading for either hand and both hands.

Browser checks cover all 48 rendered scores and fingerings, desktop/mobile learning path, navigation across non-sequential permanent IDs, retained old attempt history, immediate mastery/progress updates after repeated attempts, rest handling, the complete finale through Web MIDI, Listen duration and the independent OBS title/results.
