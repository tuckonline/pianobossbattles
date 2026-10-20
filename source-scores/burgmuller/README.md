# Burgmüller Op. 100 — both-hands practice transcription

All 25 numbered studies are included. The owner's printed reference is
https://pianoexercises.org/exercises/burgmuller/burgmuller-25-easy-and-progressive-studies-op-100.pdf
and is retained at `hosted/public/scores/burgmuller-op100.pdf`.

Playback/scoring source: the complete study MIDI collection at
https://www.corsodipiano.altervista.org/Files/22/BurgmuellerOp100.html
(individual files `BurgmullerOp100/burgmuller_op100_N.mid`).
`study-events.json.gz` retains lossless pitches, tick-derived onsets/durations,
meters and track metadata extracted with @tonejs/midi. Original performances
are not audio recordings; these are sequenced study files.

The MIDI merges both hands. Accordingly this collection supports **both hands
only**: it does not invent authoritative hand assignments. Engraving allocates
notes below middle C to the lower staff and the remainder to the upper staff;
these register labels are internal display metadata, not a claim about hands.
The UI explicitly explains this and links each original PDF page. Printed
fingering from this Peters edition (edited by Adolf Ruthardt) is transcribed
in `fingerings.json` and attached to the matching MusicXML note attacks.
Unmarked notes remain unmarked; fingerings are not generated from pitch.
Repeated passages carry the original markings into each written-out repeat.
RH numbers appear above and LH numbers below. Where the register-based staff
differs from the printed hand, an explicit `LH` or `RH` prefix identifies it.
This does not change the existing playback, scoring, or hand-isolation support.
Full hand assignments, articulation, dynamics and editorial phrasing remain
available in the PDF. The generated score is a practice transcription, not a
facsimile or a claim of note-for-note editorial equivalence.

Repeated passages and played ornaments follow the MIDI, written out on a
continuous timeline. Note lengths retain the MIDI's articulation. Its empty
setup bar is removed; pickups are padded with rests to preserve measure timing.
Tempo remains quarter-note BPM, also in compound meters.

Regenerate with `scripts/import-burgmuller.py` from the workspace root, using
music21 in `work/musicdeps`. JSON and MusicXML are versioned static repertoire,
loaded by the existing authenticated practice service; attempts remain in D1.
No existing repertoire rows or published migrations are modified.

`scripts/transcribe-burgmuller-fingerings.py` records the manually read source
markings as study, expanded measure, quarter-note beat, MIDI pitch, hand, and
finger (1–5). It validates every annotation against the existing practice
timeline before rebuilding `fingerings.json`. Run
`scripts/apply-burgmuller-fingerings.py` to apply only the fingering annotations;
the full import also runs this step. No external Python packages are needed
for either fingering script. `scripts/check-burgmuller.mjs` verifies that all
25 rendered scores retain every note, measure, and fingering.
