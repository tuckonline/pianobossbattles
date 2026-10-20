# Czerny Op. 481 - checked selection

Included: original Nos. 1 (Lento) and 2 (Andantino), PDF page 2.
Source: https://pianoexercises.org/exercises/czerny/czerny-50-practice-pieces-for-beginners-op-481.pdf

The owner authorized skipping uncertain pieces and omitting uncertain fingerings.
These two pieces were read manually at enlarged resolution, then compared with
independent OMR output. The unchecked OMR output is not the imported edition.
Corrections include No.1 bar 24's missing LH C4 and bar 28's reversed RH chord
order, and No.2's spurious dotted notes, extra chord tones and missing notes.

`transcription.json` records all original bars, chord tones, durations and the
printed fingering digits read confidently. Pitches use scientific pitch notation;
the original uses treble clefs on both staves. A missing digit stays missing.
Repeats are unfolded: No.1 bars 1-16 twice, then 17-32 twice; No.2 bars 1-8 twice,
then 9-16 twice. The interactive score has 64 and 32 measures respectively.
Fingerings are repeated along with the printed measures. Slurs/dynamics are
available in the linked original PDF; the interactive edition prioritizes notes,
rhythm and fingering. Nos.3-50 are not imported or counted toward progress.

Run `python scripts/import-czerny-op481.py` to regenerate the XML and event data.
The script's seed migration is immutable after publication; future corrections
must use a new migration. Tests compare XML pitches/onsets/durations to the MIDI
practice data and check all printed bars sum to four beats per staff.
