"""24 original stepping stones for the 48-step Classical Foundations course.

IDs 8025–8048 are permanent history keys, not the displayed course positions.
One authored source produces MusicXML, fingering and sounded MIDI events.
"""
import json
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
helpers = runpy.run_path(str(Path(__file__).with_name('build-classical-bridge.py')))
make, compile_piece, pattern, alberti = [helpers[n] for n in ('make', 'compile_piece', 'pattern', 'alberti')]

def original(number, title, right, left, focus, tip, meter=4, **options):
    return dict(make(number, title, right, left, focus, tip,
        'An original PianoPath study that prepares one skill before its next musical application.', meter=meter), **options)

PIECES = [
    original(25, 'Two-Note Footsteps',
        'C4:2:1 D4:2:2|C4:2:1 D4:2:2|D4:2:2 C4:2:1|C4:4:1',
        'C3:2:5 D3:2:4|C3:2:5 D3:2:4|D3:2:4 C3:2:5|C3:4:5',
        'Find C and D in both hands; coordinate two notes at a time.',
        'Place RH 1–2 on C4–D4 and LH 5–4 on C3–D3. Start each pair together. Read ahead to the next note before moving.'),
    original(26, 'Three-Note Arch',
        'C4:1:1 D4:1:2 E4:2:3|E4:1:3 D4:1:2 C4:2:1|C4:1:1 E4:1:3 D4:2:2|C4:4:1',
        'C3:1:5 D3:1:4 E3:2:3|E3:1:3 D3:1:4 C3:2:5|C3:1:5 E3:1:3 D3:2:4|C3:4:5',
        'Read three adjacent notes and distinguish quarter notes from half notes.',
        'Keep C–D–E under RH 1–2–3 and LH 5–4–3. Hear the half notes as twice as long when listening; MIDI practice waits for your next correct note.'),
    original(27, 'Five-Note Ladder',
        'C4:2:1 D4:2:2|E4:2:3 F4:2:4|G4:2:5 F4:2:4|E4:2:3 D4:2:2|C4:4:1|C4:4:1',
        'C3:2:5 D3:2:4|E3:2:3 F3:2:2|G3:2:1 F3:2:2|E3:2:3 D3:2:4|C3:4:5|C3:4:5',
        'Use all five fingers without changing hand position.',
        'Set both hands over C–G. Walk up and back slowly. The two final C notes are separate attacks, not a tie.'),
    original(28, 'Skips Across the Garden',
        'C4:1:1 E4:1:3 G4:2:5|G4:1:5 E4:1:3 C4:2:1|D4:1:2 F4:1:4 E4:1:3 D4:1:2|C4:2:1 R:2',
        'C3:1:5 E3:1:3 G3:2:1|G3:1:1 E3:1:3 C3:2:5|D3:1:4 F3:1:2 E3:1:3 D3:1:4|C3:2:5 R:2',
        'Recognize thirds and finish a phrase with a rest.',
        'Look for line-to-line or space-to-space skips. Keep unused fingers relaxed. The final half rest is silence; release the C notes and listen for the breath.'),
    original(29, 'Melody over a Still C',
        'C4:1:1 D4:1:2 E4:2:3|F4:1:4 E4:1:3 D4:2:2|E4:1:3 D4:1:2 C4:1:1 D4:1:2|C4:4:1',
        'C3:4:5|C3:4:5|C3:4:5|C3:4:5',
        'Move the right hand while the left stays on one note.',
        'Learn the RH phrase first. Add one gentle LH C at the start of each bar. Each new bar starts a fresh C; the next study introduces ties across barlines.'),
    original(30, 'The Bass Takes a Turn',
        'E4:4:3|E4:4:3|D4:4:2|C4:4:1',
        'C3:1:5 D3:1:4 E3:2:3|E3:1:3 F3:1:2 G3:2:1|G3:1:1 F3:1:2 D3:1:4 G3:1:1|C3:4:5',
        'Give the moving line to the left hand while the right sustains.',
        'Practise the LH alone, then add one quiet RH note per bar. Listen to the moving bass as the melody.'),
    original(31, 'Minuet Steps',
        'E4:2:3 G4:1:5|F4:2:4 E4:1:3|D4:2:2 E4:1:3|C4:2:1 R:1',
        'C3:3:5|F3:3:2|G3:3:1|C3:2:5 R:1',
        'Read three beats in a bar with a simple sustained accompaniment.',
        'Count 1–2–3 gently. The dotted half notes fill all three beats. Leave the last beat of the final bar silent.', meter=3),
    original(32, 'Two Notes Together',
        'C4+E4:4:1+3|D4+F4:4:2+4|E4+G4:2:3+5 D4+F4:2:2+4|C4+E4:4:1+3',
        'C3:4:5|G3:4:1|C3:2:5 G3:2:1|C3:4:5',
        'Introduce right-hand two-note chords before moving between them more often.',
        'Place both RH fingers before playing. C–E uses 1–3, D–F 2–4, and E–G 3–5. Add the quiet bass after the chord shapes feel familiar.'),
    original(33, 'The Eighth-Note Gate',
        'C4:0.5:1 D4:0.5:2 E4:1:3 E4:2:3|D4:0.5:2 E4:0.5:3 F4:1:4 F4:2:4|E4:0.5:3 F4:0.5:4 G4:1:5 E4:2:3|D4:1:2 D4:1:2 C4:2:1',
        'C3:4:5|G3:4:1|C3:4:5|G3:2:1 C3:2:5',
        'Fit a pair of eighth notes into one beat before playing longer runs.',
        'Say “1-and, 2, 3–4.” Only the first beat of each opening bar divides in two. Keep the left hand still while the pair moves.'),
    original(34, 'Minor Mirror',
        'A3:1:1 B3:1:2 C4:1:3 D4:1:4|E4:1:5 D4:1:4 C4:1:3 B3:1:2|A3:1:1 C4:1:3 B3:1:2 D4:1:4|C4:2:3 A3:2:1',
        'E3:1:1 D3:1:2 C3:1:3 B2:1:4|A2:1:5 B2:1:4 C3:1:3 D3:1:2|E3:1:1 C3:1:3 D3:1:2 B2:1:4|A2:4:5',
        'Transfer familiar contrary motion into A-minor five-finger positions.',
        'Place both hands over A–E before starting. Keep the same finger shapes as the earlier C-position mirror study. All notes are white keys.', mode='minor'),
    original(35, 'Waltz Accompaniment Workshop',
        'E4:3:3|E4:3:3|D4:3:2|D4:3:2|E4:3:3|F4:3:4|D4:3:2|C4:3:1',
        'C3:1:5 E3+G3:1:3+1 E3+G3:1:3+1|C3:1:5 E3+G3:1:3+1 E3+G3:1:3+1|G3:1:1 D3+F3:1:4+2 D3+F3:1:4+2|G3:1:1 D3+F3:1:4+2 D3+F3:1:4+2|C3:1:5 E3+G3:1:3+1 E3+G3:1:3+1|F3:1:2 C3+F3:1:5+2 C3+F3:1:5+2|G3:1:1 D3+F3:1:4+2 D3+F3:1:4+2|C3+E3:3:5+3',
        'Practise bass–chord–chord while the melody remains still.',
        'Start with LH alone: a single bass on beat 1, then two lighter chords. Add one RH note per bar after the pattern is comfortable.', meter=3),
    original(36, 'Dotted Dance',
        'E4:1.5:3 F4:0.5:4 G4:2:5|F4:1.5:4 E4:0.5:3 D4:2:2|D4:1.5:2 E4:0.5:3 F4:1:4 D4:1:2|E4:2:3 C4:2:1',
        'C3:4:5|F3:4:2|G3:4:1|C3:4:5',
        'Hear the long–short dotted rhythm without a moving accompaniment.',
        'Count “1-and-2, and” across each dotted-quarter/eighth pair. The short note falls on the “and” after beat 2. Listen once, then practise the pitches freely.'),
    original(37, 'Thumb Bridge in C',
        'C4:1:1 D4:1:2 E4:1:3 F4:1:1|F4:1:1 E4:1:3 D4:1:2 C4:1:1|C4:1:1 D4:1:2 E4:1:3 F4:1:1|E4:1:3 D4:1:2 C4:2:1',
        'C3:1:5 D3:1:4 E3:1:3 F3:1:2|F3:1:2 E3:1:3 D3:1:4 C3:1:5|F3:1:2 G3:1:1 A3:1:3 G3:1:1|F3:1:2 E3:1:3 D3:1:4 C3:1:5',
        'Prepare the different thumb passages needed by each hand in a C-major scale.',
        'Learn hands separately. RH passes 1 under 3 from E to F; LH crosses 3 over 1 from G to A in bar 3. Move the hand with the thumb, without twisting.'),
    original(38, 'The F-Sharp Gateway',
        'D4:1:1 E4:1:2 F#4:1:3 G4:1:4|G4:1:4 F#4:1:3 E4:1:2 D4:1:1|D4:1:1 F#4:1:3 E4:1:2 F#4:1:3|G4:4:4',
        'G2:4:5|D3:4:1|D3:4:1|G2:4:5',
        'Read F-sharp in a key signature before learning the full G-major scale.',
        'RH rests over D–E–F-sharp–G with fingers 1–2–3–4. The key signature makes every F sharp. LH uses G2 and D3 only.', fifths=1),
    original(39, 'The B-Flat Corner',
        'F4:1:1 G4:1:2 A4:1:3 Bb4:1:4|C5:2:5 Bb4:1:4 A4:1:3|G4:1:2 Bb4:1:4 A4:1:3 G4:1:2|F4:4:1',
        'F3:1:5 G3:1:4 A3:1:3 Bb3:1:2|C4:2:1 Bb3:1:2 A3:1:3|G3:1:4 Bb3:1:2 A3:1:3 G3:1:4|F3:4:5',
        'Find B-flat in a five-finger F position before adding the scale crossing.',
        'This is a five-finger pattern: RH 1–5, LH 5–1 on F–G–A–B-flat–C. The following full scale changes the RH thumb placement after B-flat.', fifths=-1),
    original(40, 'A Natural Minor — One Octave',
        pattern('A3 B3 C4 D4 E4 F4 G4 A4 G4 F4 E4 D4 C4 B3 A3'.split(),'123123454321321',[1]*14+[2]),
        pattern('A2 B2 C3 D3 E3 F3 G3 A3 G3 F3 E3 D3 C3 B2 A2'.split(),'543213212312345',[1]*14+[2]),
        'Extend the A-minor five-finger position to a full octave on white keys.',
        'Practise each hand alone with the printed crossings. G is natural here. The following harmonic-minor study changes only G to G-sharp.', mode='minor'),
    original(41, 'Build a C-Major Triad',
        'C4:1:1 E4:1:3 G4:2:5|C4+E4+G4:4:1+3+5|C4:1:1 E4:1:3 G4:2:5|C4+E4+G4:4:1+3+5',
        'C3:1:5 E3:1:3 G3:2:1|C3+E3+G3:4:5+3+1|C3:1:5 E3:1:3 G3:2:1|C3+E3+G3:4:5+3+1',
        'Recognize three separate notes as one chord before learning inversions.',
        'Play C, E and G separately, then as one comfortable shape. Use RH 1–3–5 and LH 5–3–1. Place all fingers first; avoid pressing harder for the chord.'),
    original(42, 'Broken-Triad Steps',
        'C4:1:1 E4:1:3 G4:1:5 E4:1:3|C4:1:1 E4:1:3 G4:1:5 E4:1:3|F4:1:1 A4:1:3 C5:1:5 A4:1:3|F4:4:1|G4:1:1 B4:1:3 D5:1:5 B4:1:3|G4:4:1|C4:1:1 E4:1:3 G4:1:5 E4:1:3|C4:4:1',
        'C3:4:5|C3:4:5|F3:4:2|F3:4:2|G3:4:1|G3:4:1|C3:4:5|C3:4:5',
        'Move a familiar broken-chord shape before widening it to an octave.',
        'Lift and reposition RH 1–3–5 as a unit for C, F and G triads. Use the held notes to locate the next starting note; do not stretch between positions.'),
    original(43, 'Alberti in Slow Motion',
        'E4:4:3|E4:4:3|F4:4:4|F4:4:4|D4:4:2|D4:4:2|E4:4:3|C4:4:1',
        'C3:1:5 G3:1:1 E3:1:3 G3:1:1|C3:1:5 G3:1:1 E3:1:3 G3:1:1|F2:1:5 C3:1:1 A2:1:3 C3:1:1|F2:1:5 C3:1:1 A2:1:3 C3:1:1|G2:1:5 D3:1:1 B2:1:3 D3:1:1|G2:1:5 D3:1:1 B2:1:3 D3:1:1|C3:1:5 G3:1:1 E3:1:3 G3:1:1|C3+E3+G3:4:5+3+1',
        'Learn the low–high–middle–high pattern in quarter notes.',
        'Learn LH alone, saying “low, high, middle, high.” Move the whole hand when the chord changes. Add the held RH notes softly.'),
    original(44, 'Alberti Eighth-Note Bridge',
        'E4:4:3|G4:2:5 E4:2:3|F4:2:4 E4:1:3 D4:1:2|C4:4:1',
        '|'.join([alberti('C3','E3','G3')]*3+['C3+E3+G3:4:5+3+1']),
        'Keep an eighth-note Alberti pattern under a slowly changing melody.',
        'The LH stays on one C-major shape, so focus on keeping its eight notes light. Learn this coordination before adding chord changes in Alberti Morning.'),
    original(45, 'Answering Voices',
        'C4:1:1 D4:1:2 E4:2:3|G4:4:5|D4:1:2 E4:1:3 F4:2:4|G4:4:5|E4:1:3 F4:1:4 G4:2:5|R:2 E4:2:3|D4:1:2 E4:1:3 D4:2:2|C4:4:1',
        'C3:4:5|C3:1:5 D3:1:4 E3:2:3|G3:4:1|D3:1:4 E3:1:3 F3:2:2|C3:4:5|E3:1:3 F3:1:2 G3:2:1|G3:2:1 G3:2:1|C3:4:5',
        'Hear the same short idea answered by the other hand.',
        'Play each voice alone and notice where the other answers. In bar 6 the RH rests for two beats before joining. Keep the moving voice a little clearer.'),
    original(46, 'Traveller in G',
        'G4:1:1 A4:1:2 B4:2:3|D5:1:5 C5:1:4 B4:1:3 A4:1:2|G4:0.5:1 A4:0.5:2 B4:1:3 D5:1:5 B4:1:3|A4:2:2 G4:2:1|D4:1:1 E4:1:2 F#4:2:3|A4:1:5 G4:1:4 F#4:1:3 E4:1:2|D4:0.5:1 E4:0.5:2 F#4:1:3 A4:1:5 F#4:1:3|G4:4:4',
        'G2:2:5 B2+D3:2:3+1|C3:2:5 E3+G3:2:3+1|G2:2:5 B2+D3:2:3+1|D3:2:5 F#3+A3:2:3+1|D3:2:5 F#3+A3:2:3+1|C3:2:5 E3+G3:2:3+1|D3:2:5 F#3+A3:2:3+1|G2+B2+D3:4:5+3+1',
        'Connect two RH positions in G major over familiar bass-and-chord shapes.',
        'Bars 1–4 use RH G–D; move the thumb to D4 for bars 5–8. Every F is sharp in both hands. Prepare each LH shape before connecting the phrases.', fifths=1),
    original(47, 'Cadence and Return',
        'C4:1:1 E4:1:3 G4:2:5|F4:1:4 E4:1:3 D4:2:2|E4:1:3 F4:1:4 G4:1:5 D4:1:2|C4:4:1|G4:1:1 B4:1:3 D5:2:5|C5:1:4 B4:1:3 A4:2:2|A4:1:2 B4:1:3 A4:1:2 F#4:1:1|G4:4:2|C4:1:1 E4:1:3 G4:2:5|F4:1:4 E4:1:3 D4:2:2|E4:1:3 F4:1:4 G4:1:5 D4:1:2|C4:4:1|F4:1:1 A4:1:3 C5:1:5 A4:1:3|G4:1:1 B4:1:3 D5:1:5 B4:1:3|C5:1:5 G4:1:3 E4:1:2 D4:1:1|C4+E4+G4:4:1+3+5',
        'C3:2:5 E3+G3:2:3+1|F2:2:5 A2+C3:2:3+1|G2:2:5 B2+D3:2:3+1|C3:4:5|G2:2:5 B2+D3:2:3+1|C3:2:5 E3+G3:2:3+1|D3:2:5 F#3+A3:2:3+1|G2:4:5|C3:2:5 E3+G3:2:3+1|F2:2:5 A2+C3:2:3+1|G2:2:5 B2+D3:2:3+1|C3:4:5|F2:2:5 A2+C3:2:3+1|G2:2:5 B2+D3:2:3+1|C3:2:5 G2:2:5|C3:4:1',
        'Prepare a longer form and a brief move toward G before the sonatina.',
        'Learn four bars at a time. The middle phrase moves toward G and uses F-sharp in bar 7. The opening returns in bar 9. Read the new finger placement at every position change.'),
]

# Finale: A (C major), B (G major), A, C (F-major colour), A', cadence.
theme = 'C4:1:1 E4:0.5:3 F4:0.5:4 G4:1:5 E4:1:3|F4:1:4 D4:1:2 E4:1:3 C4:1:1|D4:0.5:2 E4:0.5:3 F4:1:4 E4:1:3 D4:1:2|C4:4:1'
theme_bass = '|'.join([alberti('C3','E3','G3'),alberti('F2','A2','C3'),alberti('G2','B2','D3'),'C3:2:5 E3+G3:2:3+1'])
episode_g = 'G4:1:1 B4:1:3 D5:2:5|C5:1:4 B4:1:3 A4:1:2 G4:1:1|A4:0.5:2 B4:0.5:3 C5:0.5:4 A4:0.5:2 B4:1:3 F#4:1:1|G4:4:2'
g_bass = '|'.join([alberti('G2','B2','D3'),alberti('C3','E3','G3'),alberti('D3','F#3','A3'),'G2+B2+D3:4:5+3+1'])
episode_f = 'A4:1.5:3 Bb4:0.5:4 C5:2:5|Bb4:1:4 A4:1:3 G4:1:2 F4:1:1|G4:0.5:2 A4:0.5:3 Bb4:1:4 A4:1:3 G4:1:2|F4:4:1'
f_bass = 'F2:2:5 A2+C3:2:3+1|Bb2:2:5 D3+F3:2:3+1|C3:2:5 E3+G3:2:3+1|F2+A2+C3:4:5+3+1'
coda = 'F4:1:1 A4:1:3 C5:1:5 A4:1:3|G4:0.5:1 A4:0.5:2 B4:0.5:3 C5:0.5:4 D5:1:5 B4:1:3|C5:1:5 G4:1:3 E4:1:2 D4:1:1|C4+E4+G4:4:1+3+5'
coda_bass = '|'.join([alberti('F2','A2','C3'),alberti('G2','B2','D3'),'C3:2:5 G2:2:5','C3:4:1'])
PIECES.append(original(48, 'Festival Rondo', '|'.join([theme,episode_g,theme,episode_f,theme,coda]),
    '|'.join([theme_bass,g_bass,theme_bass,f_bass,theme_bass,coda_bass]),
    'Combine a returning theme, position shifts, two accompaniment styles and contrasting keys in a 24-bar finale.',
    'Learn each four-bar section first. The C-major theme returns at bars 9 and 17. Bar 7 uses F-sharp; bars 13–15 use B-flat. Keep the accompaniment quiet and practise the joins before a complete run.'))

if __name__ == '__main__':
    assert [p['number'] for p in PIECES] == list(range(25,49))
    library = [compile_piece(piece) for piece in PIECES]
    (ROOT/'hosted/data/classical-depth.json').write_text(json.dumps(library,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(f"Built {len(library)} original stepping stones: {sum(len(p['right']) for p in library)} measures.")
