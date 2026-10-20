# Czerny Op. 599 practice edition

The collection contains numbered exercises 1–100. The authoritative printed
reference is the owner's [Peters/Ruthardt PDF](https://pianoexercises.org/exercises/czerny/czerny-practical-exercises-for-beginners-op-599.pdf),
stored at `hosted/public/scores/czerny-op599.pdf` and linked to each study's page.

Electronic transcription sources:

- Exercises 1–10: complete MusicXML transcriptions from
  [Franz Dorfer](https://www.franzdorfer.com/czerny-erster-lehrmeister/no-10),
  e.g. `https://www.franzdorfer.com/N3/10%20Erster%20Lehrmeister-Czerny.musicxml`.
  Original MusicXML files are retained here with their embedded credits.
- Exercises 11–100: hand-separated study MIDI from
  [Corso di Piano, level 13](https://www.corsodipiano.altervista.org/Files/13/CzernyOp599Lv13.html)
  and [level 14](https://www.corsodipiano.altervista.org/Files/14/CzernyOp599Lv14.html).
  Lossless note events, track assignments, meters and keys extracted with
  `@tonejs/midi` are stored in `midi-study-events.json.gz`.
  Files 1–10 from that source were incomplete and are not used.

This is a **practice transcription**, not a facsimile or a claim of editorial
equivalence to the PDF. Repeats are unfolded, ornaments are written out on a
quantized rhythmic grid, and MIDI articulation gaps are restored to nominal
note values. Printed fingering, slurs, dynamics and performance directions
should be read in the linked original. The app states this distinction.
No. 43's omitted RH note-offs are capped at the next melodic entry;
No. 72's two recorded fermata pauses are removed from the metrical timeline.
Repeated attacks on a held pitch end the preceding physical note.

`scripts/import-czerny.py` requires Python and music21 10.5.0. It exports
MusicXML and derives scoring/playback events from that exported notation,
merging ties and deduplicating unisons. The generated JSON, MusicXML and D1
seed are checked in. Do not rerun it over a published migration: subsequent
content corrections require a new update migration. Random MusicXML element
IDs and encoding dates can differ between regenerations.

Checks cover all 100 IDs, both hands, MIDI/notation pitch and onset agreement,
duration bounds, complete/incomplete practice attempts, D1 retrieval and
scoring, and browser rendering/timed practice. These checks do not replace a
note-by-note editorial comparison of all 100 studies against the PDF.
