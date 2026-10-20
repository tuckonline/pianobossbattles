# Bach Prelude in C major, BWV 924

Imported from the owner's four unique uploaded screenshots, in order: measures 1–4, 5–9 (with ornament explanations), 10–13, and 14–18. The duplicate image of measures 5–9 is excluded. The original edition attribution remains on source image 2.

The owner selected main written notes first. MIDI grading and Listen therefore use the unornamented main-note text. Ornament symbols remain in the interactive notation, and all four original images are linked from Repertoire and About this piece. Ornament embellishments should be omitted during graded practice; they are not additional grading targets.

Permanent exercise ID: 7005, collection: repertoire. There are 18 bars in common time, 72 quarter-note beats, with the printed Listen speed of quarter note = 69. Graded practice remains pitch-only. The final fermata is displayed; Listen gives the last whole note its written four beats.

The importer explicitly preserves:
- Sixteenth rests before the arpeggio groups in bars 1–8.
- The alternating hands in bars 9–10: RH plays the thumb-led groups even on the bass staff; LH plays the groups beginning with finger 4 even on the treble staff.
- The tied LH G2/G3 octave from bar 11 through bar 17 as two 28-beat sounding notes, without reattacks.
- Independent RH voices on the final beat of bar 17.
- The final C2/C3 bass octave and E4/G4/C5 RH chord.
- The B-flat carried through the final group of bar 5, printed accidentals, clear fingerings, mordent markings, the bar-9 arpeggiation sign and final fermatas.

`python scripts/import-bach-prelude.py` regenerates the MusicXML, exercise definition and migration 0017. One authored source generates notation and MIDI events. Unit tests independently import the resulting score and check note/onset/duration agreement, specific photographed pitch sequences, ties, rests and all hand modes. The browser test verifies the complete score, four source assets, MIDI input, saved progress, Listen duration and OBS results.

MusicXML ornament encoding follows the [W3C reference](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/inverted-mordent/): the inverted-mordent is the sign without a vertical stroke; compound approaches are retained via the long/approach attributes. This spelling differs from some modern ornament naming conventions.

