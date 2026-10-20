# Beginner Pieces

Ten repertoire pieces requested by the site owner, stored as D1 practice
definitions numbered 4001–4010. The collection supports either hand or both,
timed MIDI practice, listening, note hints and saved attempts.

Mary Had a Little Lamb, Hot Cross Buns, Frère Jacques, Twinkle Twinkle Little
Star, When the Saints Go Marching In and Au Clair de la Lune use familiar
traditional melodies. Ode to Joy adapts Beethoven's public-domain theme;
Jingle Bells adapts Pierpont's public-domain chorus with simplified rhythm.
These eight are new PianoPath beginner arrangements in C major with simple
bass accompaniment, not reproductions of a particular published arrangement.
The C major five-finger song is an original eight-measure study using only
C, D, E, F and G in each hand's register.

Reinagle's Allegro in C Major, Op. 1 No. 4 was transcribed visually from the
[Maldito Piano reference score](https://malditopiano.com/wp-content/uploads/2020/09/24_Piezas_Breves_y_Faciles.n4_Alexander_Reinagle..pdf).
The original 16 measures retain their pitches, octaves and rhythms. Both
section repeats and the D.C. al Fine are written out as A–A–B–B–A (40 measures)
for continuous practice. The engraving is newly generated; the reference
edition's fingering and other editorial layout are not copied. The app links
to the reference and explains the unfolded form.

`scripts/seed-beginner.py` (music21 10.5) contains the readable note patterns,
learning goals and tips. It checks each hand's measure duration and generates
the MusicXML, JSON and pending migration. Published migration 0006 must remain
immutable; future corrections require a new migration. MusicXML element IDs
and encoding dates can change on regeneration.

Tests compare every MIDI pitch, onset and duration with the displayed XML,
verify incomplete/completed attempts, the five-note restriction and Reinagle
form, test D1 retrieval/scoring, and render all ten pieces in a browser. The
browser test also plays Hot Cross Buns with the simulator at a typed BPM and
checks that its saved result remains after reloading.
