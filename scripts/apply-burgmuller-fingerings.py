"""Apply manually checked Peters/Ruthardt fingerings without changing music."""
import json
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def apply_fingerings():
    annotations = json.loads((ROOT / 'source-scores/burgmuller/fingerings.json').read_text())
    total = 0
    for study in range(1, 26):
        path = ROOT / f'hosted/public/scores/burgmuller-op100/{study:02}.musicxml'
        tree = ET.parse(path)
        root = tree.getroot()
        # Idempotent: this collection had no other technical fingerings.
        for technical in root.findall('.//technical'):
            for fingering in technical.findall('fingering'):
                technical.remove(fingering)
        lookup = {}
        divisions = 1
        for measure in root.findall('./part/measure'):
            number = int(measure.get('number'))
            cursor = 0
            last_onset = 0
            for element in measure:
                if element.tag == 'attributes':
                    divisions = int(element.findtext('divisions', str(divisions)))
                elif element.tag in ('backup', 'forward'):
                    cursor += int(element.findtext('duration')) * (-1 if element.tag == 'backup' else 1)
                elif element.tag == 'note':
                    onset = last_onset if element.find('chord') is not None else cursor
                    pitch = element.find('pitch')
                    if pitch is not None and not any(t.get('type') == 'stop' for t in element.findall('tie')):
                        midi = 12 * (int(pitch.findtext('octave')) + 1) + {'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}[pitch.findtext('step')] + int(pitch.findtext('alter', '0'))
                        lookup.setdefault((number, midi), []).append((onset / divisions, element))
                    if element.find('chord') is None:
                        last_onset = onset
                        cursor += int(element.findtext('duration', '0'))
        for annotation in (a for a in annotations if a['study'] == study):
            matches = [note for beat, note in lookup.get((annotation['measure'], annotation['pitch']), []) if abs(beat - annotation['beat']) < .001]
            assert len(matches) == 1, (annotation, len(matches))
            note = matches[0]
            notations = note.find('notations')
            if notations is None: notations = ET.SubElement(note, 'notations')
            technical = notations.find('technical')
            if technical is None: technical = ET.SubElement(notations, 'technical')
            left = annotation['hand'] == 'left'
            upper = note.findtext('staff', '1') == '1'
            # The imported practice score groups by register. Explicitly identify
            # fingerings belonging to the opposite hand on a displayed staff.
            label = ('LH ' if left else 'RH ') if left == upper else ''
            fingering = ET.SubElement(technical, 'fingering', {'placement': 'below' if left else 'above'})
            fingering.text = label + str(annotation['finger'])
            total += 1
        ET.indent(root)
        path.write_text('<?xml version="1.0" encoding="utf-8"?>\n' + ET.tostring(root, encoding='unicode'), encoding='utf8')
    return total

if __name__ == '__main__':
    print(f'Applied {apply_fingerings()} source fingerings.')
