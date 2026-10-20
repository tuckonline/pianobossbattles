"""Photo-checked 16-bar repertoire import. Durations are quarter-note beats."""
from pathlib import Path
import json
import xml.etree.ElementTree as E

ROOT = Path(__file__).resolve().parents[1]
TITLE = "Pop! Goes the Weasel"

def note(pitches, beats=1, **marks):
    return dict(pitches=pitches.split() if pitches else [], beats=beats, **marks)

def melody_pair(pitch, finger=None):
    return [note(pitch, staccato=True, fingers=[finger] if finger else []), note(None), note(pitch, staccato=True)]

def short_chord(pitches, fingers=None):
    return [note(pitches, staccato=True, fingers=fingers or []), note(None), note(None)]

def held_chord():
    return [note('C3 E3 G3', 3, tie='start')]

def release_chord(return_g=False, finger=None):
    return [note('C3 E3 G3', tie='stop'), note(None),
            note('G3', staccato=True, fingers=[finger] if finger else []) if return_g else note(None)]

# Every printed rest is explicit. Slurs are phrasing; only LH chord arcs are ties.
RIGHT = [
    melody_pair('C4', 1),
    [note('D4', staccato=True), note(None), note('D4', slur='start')],
    [note('E4'), note('G4'), note('E4')],
    [note('C4', slur='stop'), note(None), note(None)],
    melody_pair('C4', 1),
    [note('D4', staccato=True), note(None), note('D4', slur='start')],
    [note('E4', 3)],
    [note('C4', slur='stop'), note(None), note(None)],
    melody_pair('C4'),
    [note('D4', staccato=True), note(None), note('D4', slur='start')],
    [note('E4'), note('G4'), note('E4')],
    [note('C4', slur='stop'), note(None), note(None)],
    # The photo's G-sharp/A cluster is played by LH above RH, on the treble staff.
    [note('G#4 A4', hand='left', staccato=True, fingers=[2, 1]), note(None), note(None)],
    [note('D4', 2, fingers=[2], slur='start'), note('F4')],
    [note('E4', 3)],
    [note('C4', slur='stop'), note(None), note(None)],
]
LEFT = [
    short_chord('C3 E3 G3', [5, 3, 1]), short_chord('F3 G3', [2, 1]), held_chord(), release_chord(True, 1),
    short_chord('C3 E3 G3'), short_chord('F3 G3'), held_chord(), release_chord(True),
    short_chord('C3 E3 G3'), short_chord('F3 G3'), held_chord(), release_chord(),
    [note(None, 3)], [note(None, 3)], held_chord(), release_chord(),
]

def el(parent, tag, value=None, **attrs):
    child = E.SubElement(parent, tag, attrs)
    if value is not None:
        child.text = str(value)
    return child

def midi(pitch):
    return (int(pitch[-1]) + 1) * 12 + dict(C=0, D=2, E=4, F=5, G=7, A=9, B=11)[pitch[0]] + ('#' in pitch)

xml = E.Element('score-partwise', version='4.0')
el(el(xml, 'work'), 'work-title', TITLE)
el(el(xml, 'identification'), 'creator', 'Traditional', type='composer')
part_def = el(el(xml, 'part-list'), 'score-part', id='P1')
el(part_def, 'part-name', 'Piano')
part = el(xml, 'part', id='P1')
events, ties = [], {}
for index, (upper, lower) in enumerate(zip(RIGHT, LEFT)):
    measure = el(part, 'measure', number=str(index + 1))
    if index in (4, 8, 12):
        el(measure, 'print', **{'new-system': 'yes'})
    if index == 0:
        attributes = el(measure, 'attributes')
        el(attributes, 'divisions', 1)
        el(el(attributes, 'key'), 'fifths', 0)
        time = el(attributes, 'time'); el(time, 'beats', 3); el(time, 'beat-type', 4)
        el(attributes, 'staves', 2)
        for staff, sign, line in [(1, 'G', 2), (2, 'F', 4)]:
            clef = el(attributes, 'clef', number=str(staff)); el(clef, 'sign', sign); el(clef, 'line', line)
        direction = el(measure, 'direction', placement='above')
        el(el(direction, 'direction-type'), 'words', 'Lively')
        el(direction, 'staff', 1)
    if index in (0, 12):
        direction = el(measure, 'direction', placement='below')
        el(el(el(direction, 'direction-type'), 'dynamics'), 'p' if index == 0 else 'f')
        el(direction, 'staff', 1)
    if index == 12:
        direction = el(measure, 'direction', placement='above')
        el(el(direction, 'direction-type'), 'words', 'LH over')
        el(direction, 'staff', 1)
    for staff, bar in [(1, upper), (2, lower)]:
        if staff == 2:
            el(el(measure, 'backup'), 'duration', 3)
        beat = 0
        for item in bar:
            duration, pitches = item['beats'], item['pitches']
            hand = item.get('hand', 'right' if staff == 1 else 'left')
            start = index * 3 + beat
            for chord_index, pitch in enumerate(pitches or [None]):
                n = el(measure, 'note', **{'data-pianopath-hand': hand})
                if chord_index:
                    el(n, 'chord')
                if pitch:
                    p = el(n, 'pitch'); el(p, 'step', pitch[0])
                    if '#' in pitch: el(p, 'alter', 1)
                    el(p, 'octave', pitch[-1])
                else:
                    el(n, 'rest', **({'measure': 'yes'} if duration == 3 else {}))
                el(n, 'duration', duration)
                if item.get('tie'): el(n, 'tie', type=item['tie'])
                el(n, 'voice', staff)
                if pitch or duration != 3:
                    el(n, 'type', 'quarter' if duration == 1 else 'half')
                    if duration == 3: el(n, 'dot')
                if pitch and '#' in pitch: el(n, 'accidental', 'sharp')
                if pitch: el(n, 'stem', 'down' if staff == 2 or index == 12 else 'up')
                el(n, 'staff', staff)
                if not pitch: continue
                finger = (item.get('fingers', []) + [None] * len(pitches))[chord_index]
                if any([item.get('tie'), item.get('slur'), item.get('staccato'), finger]):
                    marks = el(n, 'notations')
                    if item.get('tie'): el(marks, 'tied', type=item['tie'])
                    if item.get('slur'): el(marks, 'slur', type=item['slur'], number='1', placement='above')
                    if item.get('staccato') and chord_index == 0: el(el(marks, 'articulations'), 'staccato')
                    if finger:
                        el(el(marks, 'technical'), 'fingering', finger, placement='above' if hand == 'right' else 'below')
                key = (hand, midi(pitch))
                if item.get('tie') == 'stop':
                    event = ties.pop(key)
                    assert event['beat'] + event['beats'] == start
                    event['beats'] += duration
                else:
                    event = dict(pitch=midi(pitch), beat=start, beats=duration, hand=hand)
                    events.append(event)
                    if item.get('tie') == 'start': ties[key] = event
            beat += duration
        assert beat == 3, (index + 1, staff, beat)
assert not ties
el(el(measure, 'barline', location='right'), 'bar-style', 'light-heavy')
E.indent(xml)
(ROOT/'hosted/public/scores/repertoire/pop-goes-the-weasel.musicxml').write_text(E.tostring(xml, encoding='unicode'), encoding='utf-8')
exercise = dict(
    number=7004, title=TITLE, collection='repertoire', composer='Traditional', difficulty='Beginner',
    description='Your photographed 16-measure arrangement in 3/4. Preserve the rests and hold tied left-hand chords without striking them again. In measure 13, cross the left hand over to play G-sharp4 and A4 together (fingers 2 and 1). Printed fingerings, phrasing, staccatos and dynamics are shown. The source says Lively without a numerical tempo; start at 60 BPM and adjust comfortably. BPM counts quarter notes.',
    sourceUrl='/scores/repertoire/pop-goes-the-weasel-source.jpg', sourcePage=1,
    tempoBpm=60, beatsPerMeasure=3, durationBeats=48, measuresPerSystem=4,
    right=[[] for _ in RIGHT], left=[[] for _ in LEFT],
    polyphony=sorted(events, key=lambda n: (n['beat'], n['pitch'])),
    notationUrl='/scores/repertoire/pop-goes-the-weasel.musicxml',
)
path = ROOT/'hosted/data/repertoire.json'
data = json.loads(path.read_text(encoding='utf-8'))
data = [e for e in data if e['number'] != 7004] + [exercise]
path.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
quote = lambda value: "'" + value.replace("'", "''") + "'"
(ROOT/'drizzle/0015_pop_goes_the_weasel.sql').write_text(
    'INSERT INTO practice_exercises (number,collection,source_number,title,source_url,source_page,definition) VALUES (7004,\'repertoire\',4,' +
    ','.join([quote(TITLE), quote(exercise['sourceUrl']), '1', quote(json.dumps(exercise, ensure_ascii=False))]) + ');\n', encoding='utf-8')
print(f"{len(RIGHT)} measures; {len(events)} sounding notes; 48 quarter-note beats")
