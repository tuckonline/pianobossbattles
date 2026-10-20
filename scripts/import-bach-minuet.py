"""Photo-checked Minuet in G, BWV Anh. 114; quarter-note beat units.

The owner-supplied page is the authority for this edition's chords, voices and
fingerings. The 32 source bars are expanded A A B B for the linear MIDI engine.
"""
from pathlib import Path
import json
import xml.etree.ElementTree as E

ROOT = Path(__file__).resolve().parents[1]
TITLE = '1. Minuet in G major · BWV Anh. 114'

def n(pitch, beats=1, **marks):
    return dict(pitches=pitch.split() if pitch else [], beats=beats, **marks)

def bar(text):
    return [n(token.split(':')[0] if token.split(':')[0] != 'r' else None,
              float(token.split(':')[1]) if ':' in token else 1) for token in text.split()]

RIGHT = [bar(s) for s in [
    'D5 G4:.5 A4:.5 B4:.5 C5:.5', 'D5 G4 G4',
    'E5 A4:.5 B4:.5 C5:.5 D5:.5', 'E5 G4 G4',
    'C5 D5:.5 C5:.5 B4:.5 A4:.5', 'B4 C5:.5 B4:.5 A4:.5 G4:.5',
    'A4 B4:.5 C5:.5 D5:.5 B4:.5', 'G4:3',
    'D5 G4:.5 A4:.5 B4:.5 C5:.5', 'D5 G4 G4',
    'E5 A4:.5 B4:.5 C5:.5 D5:.5', 'E5 G4 G4',
    'C5 D5:.5 C5:.5 B4:.5 A4:.5', 'B4 C5:.5 B4:.5 A4:.5 G4:.5',
    'A4 B4:.5 A4:.5 G4:.5 F#4:.5', 'G4:3',
    'B5 G5:.5 A5:.5 B5:.5 G5:.5', 'A5 D5:.5 E5:.5 F#5:.5 D5:.5',
    'G5 E5:.5 F#5:.5 G5:.5 D5:.5', 'C#5 B4:.5 C#5:.5 A4',
    'A4:.5 B4:.5 C#5:.5 D5:.5 E5:.5 F#5:.5', 'G5 F#5 E5',
    'F#5 A4 C#5', 'D5:3', 'D5 G4:.5 F#4:.5 G4',
    'E5 G4:.5 F#4:.5 G4', 'D5 C5 B4',
    'A4:.5 G4:.5 F#4:.5 G4:.5 A4', 'D4:.5 E4:.5 F#4:.5 G4:.5 A4:.5 B4:.5',
    'C5 B4 A4', 'B4:.5 D5:.5 G4 F#4', 'G4:3',
]]
RIGHT[7].insert(0, n('A4', 0, grace=.25))
RIGHT[31] = [n('B3 D4 G4', 3)]
LEFT = [bar(s) for s in [
    'G3:2 A3', 'B3:3', 'C4:3', 'B3:3', 'A3:3', 'G3:3',
    'D4 B3 G3', 'D4 D3:.5 C4:.5 B3:.5 A3:.5', 'B3:2 A3', 'G3 B3 G3',
    'C4:3', 'B3 D4:.5 C4:.5 B3:.5 A3:.5', 'A3:2 G3', 'A3:2 B3',
    'C4 D4 D3', 'G3:2 G2', 'G3:3', 'F#3:3', 'E3 G3 E3', 'A3:2 A2',
    'A3:3', 'B3 D4 C#4', 'D4 F#3 A3', 'D4 D3 C4', 'B3:2 B3',
    'C4:2 C4', 'B3 A3 G3', 'C4:2 r', 'D3:3', 'G3 A3 G3',
    'A3 D3 F#3', 'G3 B2 G2',
]]
LEFT[0][0]['pitches'] = ['G3', 'B3', 'D4']
# Independent upper LH voice: do not shorten the held lower voice.
EXTRA_LEFT = {25: bar('r D4:2'), 26: bar('r E4:2'), 29: bar('r r G3')}

def finger(staff, measure, index, digit):
    staff[measure-1][index]['finger'] = digit

for m,i,f in [(1,0,5),(3,0,3),(5,0,4),(7,0,2),(7,1,1),(9,0,5),
              (11,0,3),(13,0,4),(15,4,2),(16,0,1),(17,0,5),(18,0,4),
              (19,0,4),(19,4,1),(20,0,3),(21,3,1),(25,2,2),(25,3,1),
              (27,0,5),(28,2,2),(28,3,3),(29,3,1),(31,2,1),(31,3,2)]:
    finger(RIGHT,m,i,f)
for m,i,f in [(7,1,3),(8,2,1),(10,0,4),(11,0,1),(12,0,2),(12,4,4),
              (13,0,1),(13,1,3),(14,0,2),(14,1,1),(15,0,2),(16,0,1),
              (22,0,3),(23,1,4),(23,2,2),(24,2,1),(25,0,3),(26,0,2),
              (27,0,3),(31,0,1),(32,1,2)]:
    finger(LEFT,m,i,f)
EXTRA_LEFT[29][2]['finger'] = 3

def slur(staff, start, end):
    staff[start[0]-1][start[1]]['slur'] = 'start'
    staff[end[0]-1][end[1]]['slur'] = 'stop'

for start,end in [((1,0),(2,0)),((3,0),(4,0)),((5,0),(8,1)),
                  ((9,0),(10,0)),((11,0),(12,0)),((13,0),(16,0)),
                  ((17,0),(18,4)),((19,0),(20,3)),((21,0),(22,0)),
                  ((25,0),(25,3)),((26,0),(26,3)),((27,0),(28,4)),
                  ((29,0),(30,0)),((31,0),(31,2))]:
    slur(RIGHT,start,end)
slur(LEFT,(24,0),(24,2)); slur(LEFT,(31,0),(31,1))
for staff,measures in [(RIGHT,[2,4,10,12,22,23,30]),(LEFT,[22,23,30,32])]:
    for m in measures:
        for item in staff[m-1]: item['staccato'] = True
for staff in [RIGHT,LEFT]:
    for item in staff[30][-2:]: item['staccato'] = True

def el(parent, tag, value=None, **attrs):
    child = E.SubElement(parent, tag, attrs)
    if value is not None: child.text = str(value)
    return child

def midi(pitch):
    return (int(pitch[-1])+1)*12 + dict(C=0,D=2,E=4,F=5,G=7,A=9,B=11)[pitch[0]] + ('#' in pitch)

xml = E.Element('score-partwise', version='4.0')
el(el(xml,'work'),'work-title',TITLE)
el(el(xml,'identification'),'creator','Christian Petzold · Anna Magdalena Bach notebook',type='composer')
part_def = el(el(xml,'part-list'),'score-part',id='P1'); el(part_def,'part-name','Piano')
part = el(xml,'part',id='P1')
events = []
ORDER = list(range(1,17))*2 + list(range(17,33))*2

def direction(measure, tag, value=None, placement='above', offset=0, **attrs):
    d = el(measure,'direction',placement=placement)
    inner = el(el(d,'direction-type'),tag,value,**attrs)
    if offset: el(d,'offset',int(offset*12))
    el(d,'staff',1)
    return inner

for index, source_bar in enumerate(ORDER):
    measure = el(part,'measure',number=str(index+1))
    if index and index%4==0: el(measure,'print',**{'new-system':'yes'})
    if index==0:
        a=el(measure,'attributes');el(a,'divisions',12);el(el(a,'key'),'fifths',1)
        t=el(a,'time');el(t,'beats',3);el(t,'beat-type',4);el(a,'staves',2)
        for staff,sign,line in [(1,'G',2),(2,'F',4)]:
            c=el(a,'clef',number=str(staff));el(c,'sign',sign);el(c,'line',line)
        met=direction(measure,'metronome');el(met,'beat-unit','half');el(met,'beat-unit-dot');el(met,'per-minute',66)
    if index in [0,16,32,48]:
        direction(measure,'words',('Allegretto · ' if index==0 else '')+f"Section {'A' if source_bar==1 else 'B'} · {'first' if index in [0,32] else 'second'} time")
    if source_bar in [1,17,25]:
        el(direction(measure,'dynamics',placement='below'),'mf' if source_bar==17 else 'p')
    if source_bar in [21,23,29,31]:
        direction(measure,'wedge',placement='below',type='crescendo' if source_bar in [21,29] else 'diminuendo',number='1')
        direction(measure,'wedge',placement='below',offset=3,type='stop',number='1')
    streams=[(1,1,RIGHT[source_bar-1]),(2,2,LEFT[source_bar-1])]
    if source_bar in EXTRA_LEFT: streams.append((2,3,EXTRA_LEFT[source_bar]))
    printed_accidentals=set()
    for stream_index,(staff,voice,notes) in enumerate(streams):
        if stream_index:el(el(measure,'backup'),'duration',36)
        beat=0;delay=0
        beam_stem='down'
        for item_index,item in enumerate(notes):
            duration=item['beats'];grace=item.get('grace',0)
            beamed=duration==.5
            previous_eighth=item_index>0 and notes[item_index-1]['beats']==.5
            next_eighth=item_index+1<len(notes) and notes[item_index+1]['beats']==.5
            if beamed and not previous_eighth:
                beam_stem='up' if staff==1 and midi(item['pitches'][0])<=71 else 'down'
            onset=index*3+beat
            actual_onset=onset+delay
            actual_duration=duration-delay
            if grace: actual_onset=onset;actual_duration=grace
            for chord_index,pitch in enumerate(item['pitches'] or [None]):
                note=el(measure,'note')
                if grace:el(note,'grace',**{'steal-time-following':str(100*grace/3)})
                if chord_index:el(note,'chord')
                if pitch:
                    p=el(note,'pitch');el(p,'step',pitch[0])
                    if '#' in pitch:el(p,'alter',1)
                    el(p,'octave',pitch[-1])
                else:
                    rest=el(note,'rest')
                    if voice==3:
                        el(rest,'display-step','A' if source_bar in [25,26] else 'D');el(rest,'display-octave',4)
                if not grace:el(note,'duration',int(duration*12))
                el(note,'voice',voice)
                el(note,'type','eighth' if grace or duration==.5 else 'quarter' if duration==1 else 'half')
                if duration==3:el(note,'dot')
                if pitch and pitch.startswith('C#') and (staff,pitch) not in printed_accidentals:
                    el(note,'accidental','sharp');printed_accidentals.add((staff,pitch))
                if source_bar==24 and staff==2 and pitch=='C4':el(note,'accidental','natural')
                # Extra LH voice stems up; its sustained lower voice stems down.
                if source_bar in EXTRA_LEFT and staff==2:el(note,'stem','up' if voice==3 else 'down')
                elif beamed:el(note,'stem',beam_stem)
                el(note,'staff',staff)
                if beamed and (previous_eighth or next_eighth):
                    el(note,'beam','begin' if not previous_eighth else 'continue' if next_eighth else 'end',number='1')
                if pitch and (item.get('finger') or item.get('slur') or item.get('staccato')):
                    marks=el(note,'notations')
                    if item.get('slur'):el(marks,'slur',type=item['slur'],number=str(voice),placement='above')
                    if item.get('staccato'):el(el(marks,'articulations'),'staccato')
                    if item.get('finger'):el(el(marks,'technical'),'fingering',item['finger'],placement='above' if staff==1 else 'below')
                if pitch:events.append(dict(pitch=midi(pitch),beat=actual_onset,beats=actual_duration,hand='right' if staff==1 else 'left'))
            beat+=duration
            delay=grace
        assert beat==3,(source_bar,staff,beat)
    if index in [15,31,47,63]:el(el(measure,'barline',location='right'),'bar-style','light-heavy' if index==63 else 'light-light')

target=ROOT/'hosted/public/scores/bach';target.mkdir(parents=True,exist_ok=True)
E.indent(xml)
(target/'minuet-in-g.musicxml').write_text(E.tostring(xml,encoding='unicode'),encoding='utf-8')
exercise=dict(number=10001,title=TITLE,collection='bach',composer='Christian Petzold',
    difficulty='Late beginner',tempoBpm=66,beatsPerMeasure=3,durationBeats=192,measuresPerSystem=4,
    description='Minuet in G from the Anna Magdalena Bach notebook, BWV Anh. 114. Transcribed from your photograph with its printed fingerings, articulation and independent left-hand voices. Both 16-bar sections repeat: the 32 printed bars are written out as 64 practice measures (A A B B). The small A grace note in source bar 8 is realized as a short sixteenth before G, within the beat. Start hands separately at 66 quarter-note BPM. The printed dotted-half = 66 is a faster performance indication, equivalent to 198 quarter-note BPM; the practice tempo is deliberately slower.',
    learningFocus='Three-beat pulse, half-beats, phrasing and independent hands.',
    sourceUrl='/scores/bach/minuet-in-g-source.png',sourcePage=6,
    notationUrl='/scores/bach/minuet-in-g.musicxml',
    right=[[] for _ in ORDER],left=[[] for _ in ORDER],polyphony=sorted(events,key=lambda e:(e['beat'],e['pitch'])))
(ROOT/'hosted/data/bach.json').write_text(json.dumps([exercise],ensure_ascii=False),encoding='utf-8')
quote=lambda s:"'"+s.replace("'","''")+"'"
(ROOT/'drizzle/0016_bach_minuet.sql').write_text(
    "INSERT INTO practice_exercises (number,collection,source_number,title,source_url,source_page,definition) VALUES (10001,'bach',1,"+
    ','.join([quote(TITLE),quote(exercise['sourceUrl']),'6',quote(json.dumps(exercise,ensure_ascii=False))])+');\n',encoding='utf-8')
print(f'{len(ORDER)} played bars; {len(events)} sounding notes; 192 quarter-note beats')
