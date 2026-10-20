# Moonlight Sonata learning path

The finale is the complete first movement (Adagio sostenuto, 69 measures) in the original key, not a beginner arrangement or the entire three-movement sonata.

## Source and provenance

- User's PDF: https://dn710401.ca.archive.org/0/items/moonlight-urtext/Moonlight_Urtext.pdf
- Matching editor source: https://github.com/23PowerZ/Moonlight_Urtext
- The editor releases this edition under CC0; see `LICENSE`.
- The repository PDF and the supplied archive PDF have identical SHA-256: `3cb9235f82908935552d223f60003be8dc5fb1bff45ded54e030d1320c4b914a`.
- `Moonlight_Urtext.mscz` SHA-256: `4146b76ec996e1ca5c4d12ec9305c524449ff171bd05ef1215f7105bd7c30f55`.
- `urtext-export.musicxml` was exported from that source using MuseScore Studio 4.6.5: `MuseScore4.exe -o source.musicxml Moonlight_Urtext.mscz`.

The PDF's actual score occupies PDF pages 4–7. The digital source includes later editorial examples: only the first 69 measures belong to the movement. These examples are deliberately excluded from the finale.

## Generation

Run `python scripts/build-moonlight.py` to regenerate `hosted/data/moonlight.json`.

The 33 lessons contain seven original preparatory drills, an explicitly labeled bass reduction of measures 1–4, nineteen original-score passages covering all 69 measures, five joined sections, and the complete original movement. Original drills have suggested fingerings. The source edition has no printed fingerings, so its excerpts do not invent any.

The generator preserves original pitches, voice onsets, durations, rests, accidentals, and internal ties. It reflows systems, removes source page coordinates, and labels playing hand independently of engraving staff: voices 1/2 are RH; voices 5/6 are LH. Excerpt boundaries turn incoming ties into fresh attacks and truncate outgoing ties. Orphan slurs and wedges are removed. Long introductory text remains available in the linked PDF and course notes; the editor's font-specific brackets around an added rest are omitted, with the rest unchanged.

The MIDI timeline merges tied continuations and simultaneous same-hand unison heads into a single physical key attack. The finale has 1,182 printed noteheads and 1,144 graded attacks. A quarter note is one app beat; triplet eighths last 1/3 beat. The source's quarter-note playback reference of 64 corresponds to half note = 32 in its cut-time signature. This is not presented as a prescribed Beethoven metronome marking. The written final fermata has a fixed playback duration; expressive extensions, voicing and pedal are not graded.

All lessons reuse existing attempt storage, hand selection, MIDI grading, Listen, score following, collection progress, keyboard shortcuts, and OBS state. No additional progress counters or database schema are introduced.

## Validation

- Unit comparisons check all original passage and finale pitches, printed timing, and voices against the unmodified MusicXML export.
- Every lesson is checked for valid duration and complete grading in RH, LH and both-hands modes.
- Browser tests render every lesson, verify cross-staff RH feedback, triplet timing at 60 BPM, result saving, persisted progress and separate-context OBS updates.

Physical MIDI hardware was not used in automated verification; browser input tests exercise the shared simulated-note input pipeline.
