"""Standard technique and original application studies for Foundations Nos. 13–24.

The notation and MIDI are compiled from the same authored notes. These are not
transcriptions of named composers' works or an examination syllabus.
"""
import json
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
compiler = runpy.run_path(str(Path(__file__).with_name('build-classical-additions.py')))
make, compile_piece = compiler['make'], compiler['compile_piece']


def pattern(pitches, fingers, durations, meter=4):
    """Split a fully fingered phrase at barlines, without changing note values."""
    bars, tokens, beat = [], [], 0
    assert len(pitches) == len(fingers) == len(durations)
    for pitch, finger, duration in zip(pitches, fingers, durations):
        tokens.append(f'{pitch}:{duration}:{finger}')
        beat += duration
        assert beat <= meter
        if beat == meter:
            bars.append(' '.join(tokens)); tokens, beat = [], 0
    assert not tokens
    return '|'.join(bars)


def technique(piece, stage='Bridge · Scales', **options):
    return dict(piece, composer='Traditional piano technique',
                arrangement='Standard technical pattern, organized and fingered for PianoPath; not a transcription from a specific edition.',
                difficulty=stage, **options)


def scale(number, title, right, left, rf, lf, tip, **options):
    def line(names, fingers):
        notes = names.split(); fingering = list(fingers)
        # One octave up and back, without repeating the turning note.
        return pattern(notes + notes[-2::-1], fingering + fingering[-2::-1], [1]*14 + [2])
    return technique(make(number, title, line(right, rf), line(left, lf),
        'One-octave scale, thumb passage and even quarter-note timing.',
        tip + ' Begin hands separately at your own pace, then combine. The final tonic lasts two beats. Keep the thumb relaxed; speed comes after evenness.',
        'A standard one-octave piano scale, ascending and descending in parallel motion.', tempo=60), **options)


PIECES = [
    scale(13, 'C Major — One Octave', 'C4 D4 E4 F4 G4 A4 B4 C5', 'C3 D3 E3 F3 G3 A3 B3 C4',
        '12312345', '54321321', 'RH: pass the thumb under after E; LH: cross finger 3 over after G on the ascent.'),
    scale(14, 'G Major — One Sharp', 'G4 A4 B4 C5 D5 E5 F#5 G5', 'G3 A3 B3 C4 D4 E4 F#4 G4',
        '12312345', '54321321', 'Every F is F-sharp. Use the same finger pattern as C major, starting on G.', fifths=1),
    scale(15, 'F Major — One Flat', 'F4 G4 A4 Bb4 C5 D5 E5 F5', 'F3 G3 A3 Bb3 C4 D4 E4 F4',
        '12341234', '54321321', 'Every B is B-flat. RH uses finger 4 on B-flat, then the thumb on C; the top F uses finger 4.', fifths=-1),
    scale(16, 'A Harmonic Minor', 'A3 B3 C4 D4 E4 F4 G#4 A4', 'A2 B2 C3 D3 E3 F3 G#3 A3',
        '12312345', '54321321', 'Raise G to G-sharp in both directions. Give the larger F–G-sharp step time without twisting the wrist.', mode='minor'),
]

PIECES.append(technique(make(17, 'C Major — Contrary Motion',
    pattern('C4 D4 E4 F4 G4 A4 B4 C5 B4 A4 G4 F4 E4 D4 C4'.split(), '123123454321321', [1]*14+[2]),
    pattern('C3 B2 A2 G2 F2 E2 D2 C2 D2 E2 F2 G2 A2 B2 C3'.split(), '123123454321321', [1]*14+[2]),
    'Coordinating mirrored thumb passages while the hands travel apart and return.',
    'Start with both thumbs on C, one octave apart. Both hands use 1–2–3–1–2–3–4–5 while moving apart, then reverse. Start slowly at your own pace.',
    'A standard contrary-motion scale drill in C major.'), stage='Developing · Technique'))

PIECES.append(technique(make(18, 'C Major — Triad Inversions',
    'C4+E4+G4:2:1+3+5 E4+G4+C5:2:1+2+5|G4+C5+E5:2:1+3+5 C5+E5+G5:2:1+3+5|G4+C5+E5:2:1+3+5 E4+G4+C5:2:1+2+5|C4+E4+G4:4:1+3+5',
    'C3+E3+G3:2:5+3+1 E3+G3+C4:2:5+3+1|G3+C4+E4:2:5+2+1 C4+E4+G4:2:5+3+1|G3+C4+E4:2:5+2+1 E3+G3+C4:2:5+3+1|C3+E3+G3:4:5+3+1',
    'Recognizing root position, first inversion and second inversion; coordinated three-note chords.',
    'Practise each hand alone first. Lift and move the whole hand to each chord; do not hold the previous shape. Use the printed fingers and play all three notes together at your own pace.',
    'The C-major triad in each inversion, rising through one octave and returning.'), stage='Developing · Technique'))

PIECES.append(technique(make(19, 'C Major — One-Octave Arpeggio',
    pattern('C4 E4 G4 C5 G4 E4 C4 C4 E4 G4 C5 G4 E4 C4 C4'.split(), '123532112353211', [1]*6+[2]+[0.5]*6+[1,4]),
    pattern('C3 E3 G3 C4 G3 E3 C3 C3 E3 G3 C4 G3 E3 C3 C3'.split(), '532123553212355', [1]*6+[2]+[0.5]*6+[1,4]),
    'Broken triads, octave movement and the difference between quarter and eighth notes.',
    'RH uses 1–2–3–5 upward; LH uses 5–3–2–1. Move the forearm along the keyboard instead of stretching. The third bar divides each beat in two with eighth notes.',
    'A standard C-major arpeggio in quarters, then eighths, with a held tonic ending.'), stage='Developing · Technique'))

PIECES.append(technique(make(20, 'Cadence Workshop — I, IV, V, I',
    'C4+E4+G4:4:1+3+5|C4+F4+A4:4:1+3+5|B3+D4+G4:4:1+2+5|C4+E4+G4:4:1+3+5|C4+E4+G4:2:1+3+5 C4+F4+A4:2:1+3+5|B3+D4+G4:2:1+2+5 C4+E4+G4:2:1+3+5|C4+F4+A4:2:1+3+5 B3+D4+G4:2:1+2+5|C4+E4+G4:4:1+3+5',
    'C3:4:1|F2:4:5|G2:4:5|C3:4:1|C3:2:1 F2:2:5|G2:2:5 C3:2:1|F2:2:5 G2:2:5|C3:4:1',
    'Common Classical harmony, smooth chord changes and bass repositioning.',
    'Learn each chord shape before connecting them. Release and reposition the LH between F and G; finger 5 on each is intentional. Keep the bass softer than the upper chord. Start slowly at your own pace.',
    'The familiar tonic–subdominant–dominant–tonic cadence, first slowly and then in half notes.'), stage='Developing · Technique'))


def alberti(low, middle, high):
    return ' '.join([f'{low}:0.5:5', f'{high}:0.5:1', f'{middle}:0.5:3', f'{high}:0.5:1']*2)


PIECES.append(dict(make(21, 'Alberti Morning',
    'E4:2:3 G4:1:5 E4:1:3|F4:1:4 E4:1:3 D4:1:2 C4:1:1|D4:2:2 G4:1:5 F4:1:4|E4:2:3 C4:2:1|E4:1:1 G4:1:3 C5:1:5 G4:1:3|A4:2:4 F4:1:2 E4:1:1|D4:1:2 F4:1:4 E4:1:3 D4:1:2|C4:4:1',
    '|'.join([alberti('C3','E3','G3'), alberti('F2','A2','C3'), alberti('G2','B2','D3'), alberti('C3','E3','G3'),
              alberti('C3','E3','G3'), alberti('F2','A2','C3'), alberti('G2','B2','D3'), 'C3+E3+G3:4:5+3+1']),
    'A singing melody above an even low–high–middle–high accompaniment.',
    'First loop one LH bar quietly. At bar 5 move the RH thumb to E; at bar 7 move back to C position. Count eight equal subdivisions per bar when listening. No pedal is needed.',
    'An original Classical-style miniature applying the Alberti bass used in sonatinas.'), difficulty='Early intermediate'))

PIECES.append(dict(make(22, 'Garden Waltz in F',
    'A4:1:3 C5:1:5 Bb4:1:4|A4:2:3 F4:1:1|G4:1:2 Bb4:1:4 A4:1:3|G4:3:2|A4:1.5:3 Bb4:0.5:4 C5:1:5|Bb4:1:4 A4:1:3 F4:1:1|G4:1:2 A4:1:3 G4:1:2|F4:3:1',
    'F2:1:5 A2+C3:1:3+1 A2+C3:1:3+1|F2:1:5 A2+C3:1:3+1 A2+C3:1:3+1|Bb2:1:5 D3+F3:1:3+1 D3+F3:1:3+1|C3:1:5 E3+G3:1:3+1 E3+G3:1:3+1|F2:1:5 A2+C3:1:3+1 A2+C3:1:3+1|Bb2:1:5 D3+F3:1:3+1 D3+F3:1:3+1|C3:1:5 E3+G3:1:3+1 E3+G3:1:3+1|F2+A2+C3:3:5+3+1',
    'Reading B-flat, dotted rhythm and bass-and-chord accompaniment in new positions.',
    'RH stays over F–G–A–B-flat–C with fingers 1–5. Move the LH as a relaxed unit between F, B-flat and C positions. Count 1-and-2-and-3-and; begin slowly.',
    'An original waltz in F major with a light accompaniment and two answering phrases.', meter=3), difficulty='Early intermediate', fifths=-1))

PIECES.append(dict(make(23, 'Two-Voice Conversation',
    'C4:0.5:1 D4:0.5:2 E4:0.5:3 F4:0.5:4 G4:1:5 E4:1:3|F4:2:4 E4:2:3|D4:0.5:2 E4:0.5:3 F4:0.5:4 G4:0.5:5 F4:1:4 D4:1:2|E4:2:3 C4:2:1|G4:1:5 E4:1:3 F4:1:4 D4:1:2|E4:0.5:3 F4:0.5:4 G4:0.5:5 E4:0.5:3 D4:1:2 C4:1:1|D4:1:2 G4:1:5 F4:1:4 D4:1:2|C4:4:1',
    'C3:2:5 E3:2:3|C3:0.5:5 D3:0.5:4 E3:0.5:3 F3:0.5:2 G3:1:1 E3:1:3|G3:2:1 F3:2:2|C3:1:5 E3:1:3 G3:1:1 E3:1:3|E3:0.5:3 F3:0.5:2 G3:0.5:1 E3:0.5:3 D3:1:4 F3:1:2|C3:1:5 E3:1:3 G3:1:1 E3:1:3|G3:0.5:1 F3:0.5:2 E3:0.5:3 D3:0.5:4 G3:2:1|C3:4:5',
    'Two independent voices, imitation and passing a melodic idea between the hands.',
    'Learn each voice alone, then listen for the moving voice while holding the slower notes. Both hands stay in C–G positions. Listen for an even pulse and avoid accents when the hands change roles.',
    'An original Baroque-inspired two-voice study using imitation, not a transcription of a Bach work.'), difficulty='Early intermediate'))

PIECES.append(dict(make(24, 'Little Sonatina in C',
    'C4:1:1 E4:1:2 G4:2:4|A4:1:5 G4:1:4 E4:1:2 C4:1:1|D4:0.5:1 E4:0.5:2 F4:0.5:3 G4:0.5:4 A4:1:5 F4:1:3|G4:4:4|G4:1:1 B4:1:3 D5:2:5|C5:1:4 B4:1:3 A4:1:2 G4:1:1|A4:0.5:2 B4:0.5:3 C5:0.5:4 A4:0.5:2 B4:1:3 F#4:1:1|G4:4:2|C4:1:1 E4:1:2 G4:2:4|A4:1:5 G4:1:4 E4:1:2 C4:1:1|D4:0.5:1 E4:0.5:2 F4:0.5:3 G4:0.5:4 A4:1:5 F4:1:3|G4:2:4 E4:1:2 C4:1:1|F4:1:1 A4:1:3 C5:1:5 A4:1:3|G4:0.5:1 A4:0.5:2 B4:0.5:3 C5:0.5:4 D5:1:5 B4:1:3|C5:1:5 G4:1:3 E4:1:2 D4:1:1|C4+E4+G4:4:1+3+5',
    '|'.join([alberti('C3','E3','G3'), alberti('C3','E3','G3'), alberti('G2','B2','D3'), 'C3:2:5 E3+G3:2:3+1',
              alberti('G2','B2','D3'), alberti('G2','B2','D3'), alberti('D3','F#3','A3'), 'G2+B2+D3:4:5+3+1',
              alberti('C3','E3','G3'), alberti('C3','E3','G3'), alberti('G2','B2','D3'), 'C3:2:5 E3+G3:2:3+1',
              alberti('F2','A2','C3'), alberti('G2','B2','D3'), 'C3:2:5 G2:2:5', 'C3:4:1']),
    'A 16-bar musical study combining position shifts, broken-chord accompaniment and a brief move toward G major.',
    'Work in four-bar sections at your own pace. The RH changes position at bars 3, 5, 9, 11, 13 and 14; follow the printed fingers. Bar 7 has F-sharps in both hands. Lift and reset for the final chord. Aim for an even, quiet bass beneath the melody.',
    'An original Classical-style sonatina miniature: an opening theme, a contrasting phrase in G, a return and a closing cadence.'), difficulty='Early intermediate'))

if __name__ == '__main__':
    library = [compile_piece(piece) for piece in PIECES]
    (ROOT/'hosted/data/classical-bridge.json').write_text(json.dumps(library, ensure_ascii=False, separators=(',',':')), encoding='utf-8')
    print(f"Built {len(library)} bridge studies: {sum(len(p['right']) for p in library)} measures.")
