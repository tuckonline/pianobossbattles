# Bach collection — Minuet in G major, BWV Anh. 114

First entry: 10001. The supplied page (printed page 6, headed “1. Minuet”) is
retained at `hosted/public/scores/bach/minuet-in-g-source.png`. It is the
transcription authority; another edition has not been substituted.

The collection is named Bach as requested. Composer credit is Christian Petzold;
the work appears in the Anna Magdalena Bach notebook. Attribution reference:
https://www.bachvereniging.nl/en/bwv/bwv-114-115-anhang

`scripts/import-bach-minuet.py` contains the auditable 32-bar transcription.
It generates MusicXML, the database catalogue definition, and additive migration
0016. Both repeated sections are written out as A A B B (64 performed measures,
192 quarter-note beats), with section labels, so MIDI practice and Listen share
one continuous sequence. Existing attempts are untouched.

Edition-specific checks:

- Opening LH G3/B3/D4 half-note chord; beat-three A3.
- Source m7 LH D4/B3/G3; m8 D4 then D3/C4/B3/A3.
- Source m8 RH A4 grace note preceding G4. The printed grace is retained. For
  deterministic beginner playback it borrows a sixteenth (0.25 quarter beats)
  from the principal dotted half. The principal lasts 2.75 beats; LH and the
  next barline are unchanged. This is an explicit playback interpretation.
- Source m20–23 C-sharps; m24 LH C-natural.
- Source m25 and m26 sustain B3 and C4 respectively while an upper LH voice
  enters on D4 and E4. Source m29 sustains D3 below the beat-three G3.
- Source m31 ends RH F-sharp4. Final RH chord B3/D4/G4, with LH G3/B2/G2.
- 46 confidently legible printed fingerings, each rendered twice through the
  written-out repeats. No additional fingerings have been invented.
- Printed phrasing, staccato, dynamics and hairpins remain visible. These
  expressive markings do not change the grading engine's selected pulse.
- Source tempo: dotted half = 66 (198 quarter-note BPM). Initial practice speed
  is deliberately 66 quarter-note BPM, explained in the exercise description.

Unit tests check melody, voices, timing, repeat order, score/MIDI agreement and
grading for both hands and separate hands. Browser QA checks collection loading,
engraving, playback, a completed practice and persisted collection progress.
