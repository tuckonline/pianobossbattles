# Scoring

Profiles have nonnegative weights for pitch, rhythm, duration, continuity, chord timing, velocity and pedal; onset/chord tolerances; passing score; minimum tempo; and target tempo. At least one dimension is required. Author UI exposes enabled dimensions and Beginner/Moderate/Strict timing presets. Disabled dimensions contribute zero weight.

The baseline scorer pairs matching pitches one-to-one using nearest relative onset, compares durations and velocities, penalizes missing/extra notes, evaluates chord spread and sustain event timing, then computes a weighted score. Leading silence is aligned to the first played note. Target/attempt tempo scales expected timing. An empty performance cannot pass. Minimum tempo is enforced even when pitch is the only dimension.

Server submission looks up the expected recording and profile from the student's pinned course version. It never accepts a browser-computed score. Raw normalized events, analysis, tempo, mode and algorithm version are retained for future reanalysis. These events remain client-originated performance evidence, not tamper-proof examination evidence.

This is a tested baseline matcher, not a final pedagogical assessment algorithm. Repeated-note alignment is greedy; tempo drift, ornamentation and expressive timing need a sequence aligner. Problem measures currently assume four beats per measure. Learn mode guides and waits visually; completion still uses the configured scoring profile. Practice provides tempo, metronome and whole-recording looping. Hand selection is a playback register filter, not inferred fingering or authoritative hand assignment.
