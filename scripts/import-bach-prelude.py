"""BWV 924: 18 measures transcribed from four owner-provided score images.
Main-note practice: ornaments stay engraved but do not create extra MIDI targets.
"""
from pathlib import Path
import json
import xml.etree.ElementTree as E
ROOT=Path(__file__).resolve().parents[1]
TITLE='Prelude in C major · BWV 924'
def n(pitches,beats=.25,**marks):
    return dict(pitches=[] if pitches in ('r','s') else pitches.split('+'),beats=beats,hidden=pitches=='s',**marks)
def line(text):
    return [n(t.split(':')[0],float(t.split(':')[1]) if ':' in t else .25) for t in text.split()]
RIGHT=[line(s) for s in [
'r G4 C5 E5 r G4 C5 E5 r G4 C5 D5 r B4 D5 G5',
'r A4 D5 G5 r A4 D5 F5 r A4 D5 E5 r C5 E5 A5',
'r B4 E5 A5 r B4 E5 G5 r C5 E5 F5 r G4 D5 F5',
'r G4 D5 E5 r G4 C5 E5 r A4 C5 D5 r E4 B4 D5',
'r E4 B4 C5 r E4 A4 C5 r F4 A4 Bb4 r C4 G4 Bb4',
'r C4 G4 A4 r C4 F4 A4 r D4 F4 B4 r E4 G4 C5',
'r D4 G4 C5 r D4 G4 B4 r C4 G4 B4 r C4 F#4 A4',
'r B3 D4 A4 r B3 D4 G4 r A3 C4 G4 r A3 C4 F4',
'B3+D4+F4:1 r:1 s:2',
's:1 F4 G4 B4 D5 B4 G4 B4 D5 F5 G5 B5 F5',
'E5 C6 G5 F5 E5 C6 G5 E5 D5 C6 F5 E5 D5 B5 F5 D5',
'C5 B5 E5 D5 C5 A5 E5 C5 B4 A5 D5 C5 B4 G5 D5 B4',
'A4 G5 C5 B4 A4 F#5 C5 A4 B4 F5 D5 B4 C5 F5 D5 B4',
'G4 E5 C5 B4 A4 E5 C5 A4 F#4 D5 B4 A4 G4 D5 B4 G4',
'E4 C5 A4 G4 F#4 C5 A4 F#4 D4 C5 B4 A4 B4 G4 C5 F4',
'G4 E4 F4 D5 C5 B4 A4 G4 F5 D5 Eb5 C5 F#4 Eb5 D5 C5',
'B4 D5 B4 G4 Ab4 F4 G4 D4 Eb4 F#4 A4 C5 r C5:.5 B4',
'E4+G4+C5:4',
]]
LEFT=[line(s) for s in [
'C3:1 E3:1 G3:1 G2:1', 'D3:1 F3:1 A3:1 A2:1',
'E3:1 E4:1 A3:1 B3:1', 'C4:1 E3:1 F#3:1 G#3:1',
'A3:1 C3:1 D3:1 E3:1', 'F3:1 E3:1 D3:1 C3:1',
'G3:1 G2:1 G3:1 G2:1', 'G3:1 G2:1 G3:1 G2:1',
'G3:1 r:1 r G2 B2 D3 F3 G3 B3 D4',
'B3 G3 B3 D4 s:3',
*['G2+G3:4']*7, 'C2+C3:4',
]]
EXTRA={17:line('s:3 D4:.5 F4:.5')}
# The printed thumb/4 handoffs and opposing beams place RH on the bass
# staff in bar 9 and on the first sixteenth of 10; LH answers on both staves.
for item in LEFT[8][6:]:item['hand']='right'
LEFT[9][0]['hand']='right'
for item in RIGHT[9][6:9]:item['hand']='left'
for m in range(11,18):
    LEFT[m-1][0]['ties']=(['stop'] if m>11 else [])+(['start'] if m<17 else [])
RIGHT[8][0]['arpeggiate']=True
RIGHT[17][0]['fermata']=True
LEFT[17][0]['fermata']=True
# The first sixteenth of bar 10 and the ninth RH sixteenth are separately flagged.
RIGHT[9][5]['unbeam']=True
LEFT[9][0]['unbeam']=True
# Explicit naturals printed after an accidental in the previous bar.
for m,i in [(6,11),(8,15),(16,2),(17,5),(17,10),(18,0)]:RIGHT[m-1][i]['accidental']='natural'
def fingers(staff,entries):
    for m,i,digit in entries:staff[m-1][i]['finger']=str(digit)
fingers(RIGHT,[(1,1,1),(1,2,2),(1,3,4),(1,11,3),(1,13,1),
(2,1,1),(2,2,2),(2,3,5),(2,7,4),(2,11,3),(2,13,1),(2,14,2),(2,15,5),
(3,1,1),(3,2,2),(3,3,5),(3,6,2),(3,9,1),(3,10,2),(3,14,3),
(4,6,2),(4,9,1),(4,10,2),(6,2,3),(7,10,3),(7,15,4),(8,7,4),(8,11,4),
(10,1,1),(10,6,4),(10,9,1),(10,10,3),(10,11,5),(10,12,2),
(11,2,3),(11,7,2),(11,10,3),(11,15,2),(12,2,3),(12,7,2),(12,14,2),
(13,2,3),(13,5,5),(13,7,1),(13,8,2),(13,9,5),(13,10,3),(13,15,2),
(14,1,5),(14,2,3),(14,7,2),(14,8,1),(14,14,3),(14,15,2),
(15,1,5),(15,2,4),(15,12,3),(15,14,5),(15,15,1),
(16,0,4),(16,1,2),(16,2,1),(16,11,1),(16,12,4),(17,1,5),(17,5,4),(17,13,4)])
fingers(LEFT,[(1,0,5),(1,2,'1 2 1'),(2,1,3),(3,0,'2–5'),(3,2,3),(4,1,4),(9,3,4),(9,6,1),(10,1,4)])
EXTRA[17][1]['finger']='1';EXTRA[17][2]['finger']='2'
# MusicXML mordent has the vertical stroke; inverted-mordent has no stroke.
for m,i in [(1,2),(2,0),(2,2),(3,1),(7,0),(7,2),(8,0),(8,2),(9,0)]:
    LEFT[m-1][i]['ornament']=('mordent',{})
for m,i,approach in [(3,3,'below'),(4,3,'above'),(5,3,'below')]:
    LEFT[m-1][i]['ornament']=('mordent',{'long':'yes','approach':approach})
LEFT[5][2]['ornament']=('inverted-mordent',{})
RIGHT[14][10]['ornament']=('inverted-mordent',{})
RIGHT[14][10]['finger']='3 2'

def el(parent,tag,value=None,**attrs):
    child=E.SubElement(parent,tag,attrs)
    if value is not None:child.text=str(value)
    return child
STEPS=dict(C=0,D=2,E=4,F=5,G=7,A=9,B=11)
def midi(p):return (int(p[-1])+1)*12+STEPS[p[0]]+('#' in p)-('b' in p)
xml=E.Element('score-partwise',version='4.0')
el(el(xml,'work'),'work-title',TITLE)
el(el(xml,'identification'),'creator','Johann Sebastian Bach',type='composer')
pdef=el(el(xml,'part-list'),'score-part',id='P1');el(pdef,'part-name','Piano')
part=el(xml,'part',id='P1');events=[];ties={}
for index in range(18):
    measure=el(part,'measure',number=str(index+1))
    if index in [2,4,6,9,11,13,15]:el(measure,'print',**{'new-system':'yes'})
    if index==0:
        a=el(measure,'attributes');el(a,'divisions',4);el(el(a,'key'),'fifths',0)
        t=el(a,'time',symbol='common');el(t,'beats',4);el(t,'beat-type',4);el(a,'staves',2)
        for staff,sign,line_no in [(1,'G',2),(2,'F',4)]:
            c=el(a,'clef',number=str(staff));el(c,'sign',sign);el(c,'line',line_no)
        d=el(measure,'direction',placement='above');met=el(el(d,'direction-type'),'metronome')
        el(met,'beat-unit','quarter');el(met,'per-minute',69);el(d,'staff',1)
    streams=[(1,1,RIGHT[index]),(2,2,LEFT[index])]
    if index+1 in EXTRA:streams.append((1,3,EXTRA[index+1]))
    accidentals={}
    for stream,(staff,voice,notes) in enumerate(streams):
        if stream:el(el(measure,'backup'),'duration',16)
        beat=0
        for i,item in enumerate(notes):
            duration=item['beats'];start=index*4+beat
            if item['hidden']:
                f=el(measure,'forward');el(f,'duration',int(duration*4));el(f,'voice',voice);el(f,'staff',staff)
                beat+=duration;continue
            for chord,pitch in enumerate(item['pitches'] or [None]):
                hand=item.get('hand','right' if staff==1 else 'left')
                node=el(measure,'note',**{'data-pianopath-hand':hand})
                if chord:el(node,'chord')
                if pitch:
                    p=el(node,'pitch');el(p,'step',pitch[0]);alter=('#' in pitch)-('b' in pitch)
                    if alter:el(p,'alter',alter)
                    el(p,'octave',pitch[-1])
                else:el(node,'rest')
                el(node,'duration',int(duration*4))
                for tie in item.get('ties',[]):el(node,'tie',type=tie)
                el(node,'voice',voice);el(node,'type',{.25:'16th',.5:'eighth',1:'quarter',4:'whole'}[duration])
                if pitch:
                    key=(staff,pitch[0],pitch[-1]);previous=accidentals.get(key,0)
                    if alter!=previous or (item.get('accidental') and not chord):
                        el(node,'accidental',{-1:'flat',0:'natural',1:'sharp'}[alter])
                    accidentals[key]=alter
                if index in [8,9] and pitch:el(node,'stem','up' if hand=='right' else 'down')
                elif index==16 and staff==1 and pitch:el(node,'stem','down' if voice==3 else 'up')
                el(node,'staff',staff)
                # Four-sixteenth beat groups; rest breaks beams. Extra bar-17
                # voice retains its own two-eighth beam and downward stems.
                if index==16 and voice==1 and beat>=3.25 and pitch:
                    el(node,'beam','begin' if beat==3.25 else 'end',number='1')
                    if duration==.25:el(node,'beam','backward hook',number='2')
                elif pitch and duration in [.25,.5] and not item.get('unbeam'):
                    prev=i>0 and notes[i-1]['pitches'] and notes[i-1]['beats']==duration and not notes[i-1].get('unbeam') and int((beat-duration)+1e-6)==int(beat)
                    following=i+1<len(notes) and notes[i+1]['pitches'] and notes[i+1]['beats']==duration and not notes[i+1].get('unbeam') and int(beat+duration)==int(beat)
                    if prev or following:
                        for level in range(1,3 if duration==.25 else 2):el(node,'beam','continue' if prev and following else 'end' if prev else 'begin',number=str(level))
                if pitch:
                    if any(item.get(k) for k in ['finger','ties','ornament','fermata','arpeggiate']):
                        marks=el(node,'notations')
                        for tie in item.get('ties',[]):el(marks,'tied',type=tie)
                        if item.get('fermata') and not chord:el(marks,'fermata')
                        if item.get('arpeggiate'):el(marks,'arpeggiate')
                        if item.get('ornament') and not chord:
                            name,attrs=item['ornament'];el(el(marks,'ornaments'),name,**attrs)
                        if item.get('finger') and not chord:el(el(marks,'technical'),'fingering',item['finger'],placement='above' if hand=='right' else 'below')
                    key=(hand,midi(pitch))
                    if 'stop' in item.get('ties',[]):
                        event=ties.pop(key);assert event['beat']+event['beats']==start;event['beats']+=duration
                    else:
                        event=dict(pitch=midi(pitch),beat=start,beats=duration,hand=hand);events.append(event)
                    if 'start' in item.get('ties',[]):ties[key]=event
            beat+=duration
        assert beat==4,(index+1,voice,beat)
assert not ties
el(el(measure,'barline',location='right'),'bar-style','light-heavy')
target=ROOT/'hosted/public/scores/repertoire';target.mkdir(parents=True,exist_ok=True)
E.indent(xml);(target/'bach-prelude-bwv924.musicxml').write_text(E.tostring(xml,encoding='unicode'),encoding='utf-8')
exercise=dict(number=7005,title=TITLE,collection='repertoire',composer='Johann Sebastian Bach',
    description='All 18 measures from your four unique score images. Main-note practice edition: the ornament symbols are retained for reference, but MIDI grading and Listen use the main written notes only. Omit ornament embellishments during graded practice. In measures 9–10 the hands alternate across the staves: the thumb-led groups belong to RH, and the groups beginning with finger 4 belong to LH. Hand selection and note hints follow these handoffs. Hold the tied left-hand G octave from measure 11 through measure 17 without re-striking it. Measure 17 has two independent right-hand voices. Printed fingerings are included where clear; the original images include the ornament explanations. Play at your own pace; Listen uses the printed quarter note = 69.',
    sourceUrl='/scores/repertoire/bach-prelude-bwv924-source-1.png',sourcePage=1,
    notationUrl='/scores/repertoire/bach-prelude-bwv924.musicxml',tempoBpm=69,beatsPerMeasure=4,durationBeats=72,measuresPerSystem=2,
    right=[[] for _ in RIGHT],left=[[] for _ in LEFT],polyphony=sorted(events,key=lambda e:(e['beat'],e['pitch'])))
path=ROOT/'hosted/data/repertoire.json';data=json.loads(path.read_text(encoding='utf-8'))
path.write_text(json.dumps([e for e in data if e['number']!=7005]+[exercise],ensure_ascii=False),encoding='utf-8')
q=lambda s:"'"+s.replace("'","''")+"'"
(ROOT/'drizzle/0017_bach_prelude_bwv924.sql').write_text("INSERT INTO practice_exercises (number,collection,source_number,title,source_url,source_page,definition) VALUES (7005,'repertoire',5,"+','.join([q(TITLE),q(exercise['sourceUrl']),'1',q(json.dumps(exercise,ensure_ascii=False))])+');\n',encoding='utf-8')
print(f'18 measures; {len(events)} sounded main notes; 72 quarter-note beats')
