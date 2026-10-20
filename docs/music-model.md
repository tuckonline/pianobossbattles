# Music and notation model

`MusicalScore` uses PPQ ticks, notes, measures, voices, chord groups, meter, key and tempo events. Notes retain pitch, spelling, timing, hand, voice and optional fingering/articulation/dynamic. Raw MIDI and SVG are not the canonical model.

`recordingToScore` converts paired millisecond notes to ticks using a declared recording tempo. Its replaceable Quantizer defaults to rounded exact ticks. It does not infer professional enharmonic spelling, notation voices, hand assignment or tuplets. Warnings remain with generated data.

The MusicXML adapter accepts uncompressed score-partwise documents up to 2 MB. It preserves note order and basic backup/forward/chord timing into a canonical score. Advanced tuplets, ties, changing signatures, tempo directions and part-aware voices need expansion and tests before high-fidelity transcription/scoring. Original MusicXML is rendered by mature Verovio, independently of this limited parser.

`NotationViewer` loads a MusicXML asset, validates input and renders paginated SVG. `ScoreCursor`/`MeasureHighlighter` add a highlight class by rendered element ID; automatic canonical-to-Verovio ID mapping is an extension seam. `AudioEngine` schedules oscillator note playback against AudioContext time and uses a look-ahead metronome scheduler. Audio is a functional synthesized tone, not a sampled piano soundfont. Sustain is captured and scored but not acoustically modeled in playback.
