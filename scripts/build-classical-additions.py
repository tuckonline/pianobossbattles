"""Compile original Classical Foundations Nos. 7–12 into notation and MIDI events.

This is authored music, not an import/transcription. Pitch tokens are scientific
pitch:quarter-note beats:optional fingering. + joins simultaneous chord tones.
One source feeds both the printed score and grading so chords/dots stay in sync.
"""
import json
import re
from pathlib import Path
import xml.etree.ElementTree as E

ROOT = Path(__file__).resolve().parents[1]
STEPS = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}

def el(parent, tag, text=None, **attrs):
    node = E.SubElement(parent, tag, attrs)
    if text is not None:
        node.text = str(text)
    return node

def make(number, title, right, left, focus, tip, description, meter=4, tempo=60):
    return dict(number=number, title=title, right=right.split('|'), left=left.split('|'),
                focus=focus, tip=tip, description=description, meter=meter, tempo=tempo)

PIECES = [
    make(7, 'Left-Hand Lantern',
        'E4:4:3|D4:4:2|E4:2 G4:2:5|E4:4|G4:2 E4:2|F4:2:4 D4:2|D4:2 E4:1 D4:1|C4:4:1',
        'C3:1:5 D3:1:4 E3:1:3 G3:1:1|F3:1:2 E3:1 D3:1 F3:1|E3:1 D3:1 C3:1 E3:1|G3:2 C3:2|E3:1 G3:1 F3:1 E3:1|D3:1 F3:1 E3:1 D3:1|C3:1 E3:1 G3:1 D3:1|C3:4',
        'A clear left-hand melody beneath sustained right-hand notes.',
        'Use C–G five-finger positions. Practise the left hand alone, then make it a little louder than the held right hand.',
        'A Baroque-inspired role reversal: the bass carries the moving phrase.'),
    make(8, 'Mirror Steps',
        'C4:1:1 D4:1 E4:1 F4:1|G4:1:5 F4:1 E4:1 D4:1|C4:1 E4:1 D4:1 F4:1|E4:2 C4:2|E4:1 F4:1 G4:1 E4:1|F4:1 E4:1 D4:1 F4:1|E4:1 D4:1 C4:1 D4:1|C4:4',
        'G3:1:1 F3:1:2 E3:1:3 D3:1:4|C3:1:5 D3:1 E3:1 F3:1|G3:1 E3:1 F3:1 D3:1|E3:2 C3:2|E3:1 D3:1 C3:1 E3:1|D3:1 E3:1 F3:1 D3:1|E3:1 F3:1 G3:1 G3:1|C3:4',
        'Contrary motion, coordinated attacks and independent finger directions.',
        'When the right hand rises, the left often falls. Keep both hands in C position; practise one bar at a time without rushing.',
        'An original finger study inspired by Schmitt, with opposing melodic shapes.'),
    make(9, 'Music-Box Waltz',
        'E4:1.5:3 F4:0.5 G4:1:5|F4:1 E4:1 C4:1:1|D4:1 E4:1 F4:1|G4:2 D4:1|E4:1.5 F4:0.5 G4:1|F4:1 D4:1 E4:1|D4:1 E4:1 D4:1|C4:3',
        'C3:1:5 E3+G3:1:3+1 E3+G3:1|C3:1 E3+G3:1 E3+G3:1|G3:1:1 D3+F3:1:4+2 D3+F3:1|G3:1 D3+F3:1 D3+F3:1|C3:1 E3+G3:1 E3+G3:1|F3:1:2 C3+E3:1:5+3 C3+E3:1|G3:1 D3+F3:1 D3+F3:1|C3+E3:3:5+3',
        'Bass-and-chord accompaniment, two-note chords and dotted rhythm.',
        'Count 1-and-2-and-3-and. A dotted quarter lasts 1½ beats. Play both notes of each chord together and keep beats 2 and 3 light.',
        'A gentle Classical-style waltz with a small, repeating accompaniment.', meter=3),
    make(10, 'Quiet Chapel',
        'C4+E4:2:1+3 E4+G4:2:3+5|D4+F4:2:2+4 C4+E4:2:1+3|D4+F4:2 E4+G4:2|C4+E4:4|E4+G4:2 C4+E4:2|D4+F4:2 C4+E4:2|D4+F4:2 D4:2:2|C4+E4:4:1+3',
        'C3:4:5|F3:2:2 C3:2|G3:4:1|C3:4|C3:2 E3:2:3|F3:2 C3:2|G3:4|C3:4',
        'Balanced right-hand thirds over a calm bass.',
        'Play RH C–E with 1–3, D–F with 2–4 and E–G with 3–5. Sound each pair together, release without tension, and count every long note.',
        'An original chorale-like miniature inspired by the clear harmony of Bach teaching pieces.'),
    make(11, 'A Small Autumn Echo',
        'A3:1:1 C4:1:3 E4:1:5 C4:1|D4:1:4 C4:1 B3:1:2 A3:1|B3:1 C4:1 D4:1 B3:1|C4:2 A3:2|C4:1 E4:1 D4:1 C4:1|B3:1 D4:1 C4:1 B3:1|B3:2 A3:1 B3:1|A3:4',
        'A2:4:5|D3:4:2|E3:4:1|A2:4:5|A2:2 C3:2:3|D3:2 B2:2:4|E3:4:1|A2:4:5',
        'A-minor five-finger position and expressive four-bar phrases.',
        'Before starting, move both hands to A–B–C–D–E: RH 1–5, LH 5–1. All notes are white keys. Let the second phrase answer the first.',
        'A quiet minor-key miniature with a folk-like, Classical character.'),
    make(12, 'Courtyard Rondo',
        'C4:1:1 E4:0.5:3 F4:0.5 G4:1:5 E4:1|F4:1 D4:1 E4:1 C4:1|D4:0.5 E4:0.5 F4:1 E4:1 D4:1|C4:4|E4:2 G4:1 E4:1|F4:2 D4:1 F4:1|G4:1 F4:1 E4:1 D4:1|G4:2 D4:2|C4:1 E4:0.5 F4:0.5 G4:1 E4:1|F4:1 D4:1 E4:1 C4:1|D4:0.5 E4:0.5 F4:1 E4:1 D4:1|C4:4|E4:0.5 F4:0.5 G4:0.5 E4:0.5 F4:1 D4:1|E4:1 C4:1 D4:1 F4:1|E4:1 D4:0.5 C4:0.5 D4:2|C4:4',
        'C3:2:5 E3+G3:2:3+1|F3:2:2 C3+E3:2:5+3|G3:2:1 D3+F3:2:4+2|C3+E3:4:5+3|C3:1 E3:1 G3:1 E3:1|D3:1 F3:1 D3:1 F3:1|E3:1 D3:1 G3:2|G3:4|C3:2 E3+G3:2|F3:2 C3+E3:2|G3:2 D3+F3:2|C3+E3:4|C3:2 E3+G3:2|F3:2 D3+F3:2|G3:2 D3+F3:2|C3+E3:4',
        'A returning theme, mixed rhythms and chord coordination across a longer piece.',
        'Learn four bars at a time. Bars 9–12 bring back the opening theme. Keep the bass quiet and wait for the full value of long notes.',
        'A 16-bar Classical-style rondo combining the skills of the earlier studies.'),
]

def compile_piece(piece):
    meter = piece['meter']
    assert len(piece['right']) == len(piece['left'])
    score = E.Element('score-partwise', version='4.0')
    title = f"{piece['number']}. {piece['title']}"
    el(el(score, 'work'), 'work-title', title)
    definition = el(el(score, 'part-list'), 'score-part', id='P1')
    el(definition, 'part-name', 'Piano')
    part = el(score, 'part', id='P1')
    events, hands = [], {'right': [], 'left': []}
    for index in range(len(piece['right'])):
        measure = el(part, 'measure', number=str(index + 1))
        if index and index % 4 == 0:
            el(measure, 'print', **{'new-system': 'yes'})
        if index == 0:
            attributes = el(measure, 'attributes')
            el(attributes, 'divisions', 4)
            key = el(attributes, 'key'); el(key, 'fifths', piece.get('fifths', 0))
            el(key, 'mode', piece.get('mode', 'minor' if piece['number'] == 11 else 'major'))
            time = el(attributes, 'time'); el(time, 'beats', meter); el(time, 'beat-type', 4)
            el(attributes, 'staves', 2)
            for staff, sign, line in [(1, 'G', 2), (2, 'F', 4)]:
                clef = el(attributes, 'clef', number=str(staff)); el(clef, 'sign', sign); el(clef, 'line', line)
        for staff, hand in [(1, 'right'), (2, 'left')]:
            if staff == 2:
                el(el(measure, 'backup'), 'duration', meter * 4)
            beat, summary = 0, []
            fifths = piece.get('fifths', 0)
            key_alters = {step: (1 if fifths > 0 else -1) for step in ('FCGDAEB' if fifths > 0 else 'BEADGCF')[:abs(fifths)]}
            accidental_state = {}
            tokens = piece[hand][index].split()
            for token_index, token in enumerate(tokens):
                fields = token.split(':'); pitches = fields[0].split('+'); beats = float(fields[1])
                fingers = fields[2].split('+') if len(fields) > 2 else []
                if pitches == ['R']:
                    node = el(measure, 'note'); el(node, 'rest')
                    el(node, 'duration', int(beats*4)); el(node, 'voice', staff)
                    el(node, 'type', {0.5:'eighth', 1:'quarter', 1.5:'quarter', 2:'half', 3:'half', 4:'whole'}[beats])
                    if beats in (1.5, 3): el(node, 'dot')
                    el(node, 'staff', staff)
                    # Summary retains the silent duration; polyphony alone feeds
                    # MIDI grading and Listen, so rests never become key presses.
                    summary.append(dict(pitch=0, beats=beats, tie=False))
                    beat += beats
                    continue
                for chord_index, name in enumerate(pitches):
                    match = re.fullmatch(r'([A-G])([#b]?)([0-8])', name)
                    assert match, name
                    step, accidental, octave = match.groups()
                    alter = {'': 0, '#': 1, 'b': -1}[accidental]
                    midi = (int(octave) + 1) * 12 + STEPS[step] + alter
                    finger = int(fingers[chord_index]) if chord_index < len(fingers) else None
                    assert finger is None or 1 <= finger <= 5, (name, finger)
                    events.append(dict(pitch=midi, beat=index*meter+beat, beats=beats, hand=hand))
                    node = el(measure, 'note')
                    if chord_index: el(node, 'chord')
                    pitch = el(node, 'pitch'); el(pitch, 'step', step)
                    if alter: el(pitch, 'alter', alter)
                    el(pitch, 'octave', octave)
                    el(node, 'duration', int(beats*4)); el(node, 'voice', staff)
                    el(node, 'type', {0.5:'eighth', 1:'quarter', 1.5:'quarter', 2:'half', 3:'half', 4:'whole'}[beats])
                    if beats in (1.5, 3): el(node, 'dot')
                    if alter != accidental_state.get((step, octave), key_alters.get(step, 0)):
                        el(node, 'accidental', {-1: 'flat', 0: 'natural', 1: 'sharp'}[alter])
                    accidental_state[(step, octave)] = alter
                    el(node, 'staff', staff)
                    if beats == 0.5 and not chord_index:
                        previous = token_index > 0 and not tokens[token_index-1].startswith('R:') and float(tokens[token_index-1].split(':')[1]) == 0.5 and int((beat-0.5)/2) == int(beat/2)
                        following = token_index+1 < len(tokens) and not tokens[token_index+1].startswith('R:') and float(tokens[token_index+1].split(':')[1]) == 0.5 and int((beat+0.5)/2) == int(beat/2)
                        if previous or following: el(node, 'beam', 'continue' if previous and following else 'end' if previous else 'begin', number='1')
                    if finger:
                        el(el(el(node, 'notations'), 'technical'), 'fingering', finger, placement='above' if hand == 'right' else 'below')
                    if chord_index == 0:
                        summary.append(dict(pitch=midi, beats=beats, tie=False, **({'finger':finger} if finger else {})))
                beat += beats
            assert beat == meter, (piece['number'], index+1, hand, beat)
            hands[hand].append(summary)
    el(el(measure, 'barline', location='right'), 'bar-style', 'light-heavy')
    return dict(number=8000+piece['number'], title=title, collection='classical-foundations',
                composer=piece.get('composer', 'PianoPath original study'),
                arrangement=piece.get('arrangement', 'Original music composed for this beginner collection.'),
                difficulty=piece.get('difficulty', 'Next step'), description=piece['description'], learningFocus=piece['focus'], practiceTip=piece['tip'],
                tempoBpm=piece['tempo'], beatsPerMeasure=meter, measuresPerSystem=4, **hands,
                durationBeats=len(piece['right'])*meter, polyphony=sorted(events, key=lambda n:(n['beat'],n['pitch'])),
                notationXml='<?xml version="1.0" encoding="UTF-8"?>'+E.tostring(score, encoding='unicode'))

if __name__ == '__main__':
    library = [compile_piece(p) for p in PIECES]
    (ROOT/'hosted/data/classical-additions.json').write_text(json.dumps(library, ensure_ascii=False, separators=(',',':')), encoding='utf-8')
    print(f"Built {len(library)} original studies: {sum(len(p['right']) for p in library)} measures.")
