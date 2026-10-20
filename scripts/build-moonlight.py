"""Build a beginner learning path from the exact CC0 edition supplied by the user.

Source: 23PowerZ/Moonlight_Urtext, exported with MuseScore Studio 4.6.5.
Only the first 69 measures are music; later measures illustrate the commentary.
All time calculations use integer ticks (60 per quarter) until JSON output.
"""
import copy
import json
from fractions import Fraction
from pathlib import Path
import re
import xml.etree.ElementTree as E

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT/'scripts/sources/moonlight/urtext-export.musicxml'
PDF = '/scores/moonlight/Moonlight_Urtext.pdf'
DIV = 60
STEPS = dict(C=0,D=2,E=4,F=5,G=7,A=9,B=11)

def el(parent, tag, text=None, **attrs):
    node = E.SubElement(parent,tag,attrs)
    if text is not None: node.text = str(text)
    return node

def pitch_value(note):
    p = note.find('pitch')
    return (int(p.findtext('octave'))+1)*12 + STEPS[p.findtext('step')] + int(p.findtext('alter','0'))

def entries(measures):
    rows = []
    for i,m in enumerate(measures):
        cursor, previous, extent = 0,0,0
        for n in m:
            if n.tag in ('backup','forward'):
                cursor += int(n.findtext('duration')) * (-1 if n.tag=='backup' else 1)
            elif n.tag=='note':
                duration = int(n.findtext('duration','0'))
                beat = previous if n.find('chord') is not None else cursor
                if n.find('pitch') is not None:
                    voice = int(n.findtext('voice','1'))
                    rows.append(dict(node=n, tick=i*240+beat, duration=duration,
                        pitch=pitch_value(n), hand='left' if voice >= 5 else 'right', voice=voice,
                        start=any(t.get('type')=='start' for t in n.findall('tie')),
                        stop=any(t.get('type')=='stop' for t in n.findall('tie'))))
                previous = beat
                if n.find('chord') is None: cursor += duration
                extent=max(extent,beat+duration)
        assert extent==240, (m.get('number'),extent)
    return sorted(rows,key=lambda r:(r['tick'],r['pitch'],r['voice']))

def normalized_source(start,end):
    original = E.parse(SOURCE).getroot().find('part').findall('measure')
    measures = copy.deepcopy(original[start-1:end])
    for i,m in enumerate(measures):
        m.attrib={'number':str(start+i)}
        # Let the responsive renderer lay out systems, not the printed page's geometry.
        for parent in list(m.iter()):
            for child in list(parent):
                if child.tag in ('print','sound'):
                    parent.remove(child)
            for key in list(parent.attrib):
                if key.startswith(('default-','relative-','bezier-')) or key in ('width','font-size'):
                    del parent.attrib[key]
        # Long front-matter directions are available in the PDF and course notes.
        # Omit the editor's font-specific bracket glyphs around a supplied rest;
        # its rest and duration remain intact in the responsive practice score.
        for direction in list(m.findall('direction')):
            words=direction.findall('./direction-type/words')
            if any((w.text or '').startswith('Si deve suonare tutto') or '\ue26c' in (w.text or '') for w in words):
                m.remove(direction)
        if i==0:
            for a in list(m.findall('attributes')): m.remove(a)
            m.insert(0,copy.deepcopy(original[0].find('attributes')))
        if i and i%3==0: m.insert(0,E.Element('print',{'new-system':'yes'}))
        # Keep the original notes/voices; explicitly label their playing hand even
        # where the editor beams the RH accompaniment across the bass staff.
        for n in m.findall('note'):
            n.set('data-pianopath-hand','left' if int(n.findtext('voice','1'))>=5 else 'right')
        # Excerpts keep source bar numbers. Ties cut by a boundary become fresh attacks.
    rows=entries(measures)
    kept_starts,kept_stops=set(),set()
    pending={}
    for r in rows:
        key=(r['hand'],r['pitch'])
        prior=pending.get(key)
        if r['stop'] and prior and prior['tick']+prior['duration']==r['tick']:
            kept_starts.add(id(prior['node']));kept_stops.add(id(r['node']))
        if r['start']: pending[key]=r
        else: pending.pop(key,None)
    for r in rows:
        n=r['node']
        for parent in [n,*n.findall('notations')]:
            for t in list(parent):
                if t.tag in ('tie','tied') and id(n) not in (kept_starts if t.get('type')=='start' else kept_stops): parent.remove(t)
    # A slur/wedge begun outside a fragment must not create a dangling connector.
    for tag in ('slur','wedge'):
        open_items={};paired=set()
        for m in measures:
            for item in m.iter(tag):
                key=item.get('number','1')
                if item.get('type') in ('start','crescendo','diminuendo'): open_items[key]=item
                elif item.get('type')=='stop' and key in open_items:
                    paired.update((id(open_items.pop(key)),id(item)))
        for m in measures:
            for parent in m.iter():
                for child in list(parent):
                    if child.tag==tag and id(child) not in paired: parent.remove(child)
    return measures

def serialize(title,measures):
    root=E.Element('score-partwise',version='4.0')
    el(el(root,'work'),'work-title',title)
    sp=el(el(root,'part-list'),'score-part',id='P1');el(sp,'part-name','Piano')
    part=el(root,'part',id='P1')
    for m in measures: part.append(m)
    # Strip indentation left by the export to keep the built-in catalogue small.
    for n in root.iter():
        if n.text is not None and not n.text.strip(): n.text=None
        n.tail=None
    return '<?xml version="1.0" encoding="UTF-8"?>'+E.tostring(root,encoding='unicode')

def compile_lesson(number,title,measures,stage,focus,tip,description,tempo=40,source_range=None):
    rows=entries(measures)
    sounds=[];active={}
    for r in rows:
        key=(r['hand'],r['pitch'])
        prior=active.get(key)
        if r['stop'] and prior and prior['tick']+prior['duration']==r['tick']:
            prior['duration']+=r['duration']
        else:
            prior={k:r[k] for k in ('hand','pitch','tick','duration')};sounds.append(prior)
        if r['start']: active[key]=prior
        else: active.pop(key,None)
    # Unison voices share one physical key attack; preserve the longest sounding value.
    unique={}
    for r in sounds:
        key=(r['tick'],r['pitch'],r['hand'])
        if key not in unique or r['duration']>unique[key]['duration']: unique[key]=r
    sounds=sorted(unique.values(),key=lambda n:(n['tick'],n['pitch']))
    assert sounds and all(r['duration']>0 for r in sounds)
    length=len(measures)*4
    assert all(r['tick']+r['duration']<=length*DIV for r in sounds)
    summary={h:[[] for _ in measures] for h in ('right','left')}
    for r in rows:
        summary[r['hand']][r['tick']//240].append(dict(pitch=r['pitch'],beats=r['duration']/DIV,tie=r['start']))
    name=f'{number}. {title}'
    return dict(number=9000+number,title=name,collection='moonlight',courseStage=stage,
        difficulty='Beginner preparation' if stage=='Prepare' else 'Building toward the original' if stage!='Finale' else 'Full original movement',
        composer='Ludwig van Beethoven' if source_range else 'PianoPath preparatory study',
        arrangement='Reddit Urtext Edition (2026), CC0. Practice engraving adapted from the matching digital source.' if source_range else 'Original preparatory exercise; not an excerpt from Beethoven.',
        description=description,learningFocus=focus,practiceTip=tip,tempoBpm=tempo,beatsPerMeasure=4,measuresPerSystem=3,
        sourceUrl=PDF+'#page='+str(4 if not source_range or source_range[0]<=15 else 5 if source_range[0]<=33 else 6 if source_range[0]<=51 else 7),
        sourceMeasures=source_range,**summary,durationBeats=length,
        polyphony=[dict(pitch=n['pitch'],hand=n['hand'],beat=n['tick']/DIV,beats=n['duration']/DIV) for n in sounds],
        notationXml=serialize(name,measures))

def make_study(voices):
    count=len(next(iter(voices.values())))
    assert all(len(v)==count for v in voices.values())
    measures=[]
    for i in range(count):
        m=E.Element('measure',number=str(i+1));measures.append(m)
        if i==0:
            a=el(m,'attributes');el(a,'divisions',DIV)
            key=el(a,'key');el(key,'fifths',4);el(key,'mode','minor')
            time=el(a,'time');el(time,'beats',4);el(time,'beat-type',4);el(a,'staves',2)
            for staff,sign,line in [(1,'G',2),(2,'F',4)]:
                c=el(a,'clef',number=str(staff));el(c,'sign',sign);el(c,'line',line)
        for vi,(voice,bars) in enumerate(voices.items()):
            if vi: el(el(m,'backup'),'duration',240)
            cursor=Fraction(0);staff=2 if voice>=5 else 1
            for token in bars[i].split():
                fields=token.split(':');names=fields[0].split('+');beats=Fraction(fields[1]);fingers=fields[2].split('+') if len(fields)>2 else []
                triplet=beats==Fraction(1,3)
                for ci,name in enumerate(names):
                    n=el(m,'note',**{'data-pianopath-hand':'left' if staff==2 else 'right'})
                    if ci: el(n,'chord')
                    if name=='r':el(n,'rest')
                    else:
                        match=re.fullmatch(r'([A-G])(##|#|b)?([0-8])',name);assert match,name
                        step,acc,octave=match.groups();alt={'#':1,'##':2,'b':-1,None:0}[acc]
                        p=el(n,'pitch');el(p,'step',step)
                        if alt:el(p,'alter',alt)
                        el(p,'octave',octave)
                    el(n,'duration',int(beats*DIV));el(n,'voice',voice)
                    el(n,'type',{Fraction(1,3):'eighth',Fraction(1,4):'16th',Fraction(3,4):'eighth',Fraction(1):'quarter',Fraction(2):'half',Fraction(3):'half',Fraction(4):'whole'}[beats])
                    if beats in (Fraction(3,4),Fraction(3)):el(n,'dot')
                    if triplet:
                        tm=el(n,'time-modification');el(tm,'actual-notes',3);el(tm,'normal-notes',2)
                    if voice==1 and 2 in voices:el(n,'stem','up')
                    elif voice==2:el(n,'stem','down')
                    el(n,'staff',staff)
                    if triplet:
                        phase=int(cursor*3)%3
                        el(n,'beam',['begin','continue','end'][phase],number='1')
                    if triplet or ci<len(fingers):
                        no=el(n,'notations')
                        if triplet and phase in (0,2):el(no,'tuplet',type='start' if phase==0 else 'stop',bracket='no')
                        if ci<len(fingers):el(el(no,'technical'),'fingering',fingers[ci],placement='above' if staff==1 else 'below')
                cursor+=beats
            assert cursor==4,(i,voice,cursor)
    # MusicXML pitch/alter controls sound, while accidental controls the printed
    # glyph. Supply both when departing from C-sharp minor or a prior accidental.
    # Walk all voices in onset order; accidental state is per staff and octave
    # and resets at each barline.
    key_alterations = dict(C=1,D=1,F=1,G=1)
    for m in measures:
        alterations = {}
        for row in entries([m]):
            n = row['node']
            step = n.findtext('pitch/step')
            key = (n.findtext('staff'),step,n.findtext('pitch/octave'))
            alteration = int(n.findtext('pitch/alter','0'))
            if alteration != alterations.get(key,key_alterations.get(step,0)):
                accidental = E.Element('accidental')
                accidental.text = {-1:'flat',0:'natural',1:'sharp',2:'double-sharp'}[alteration]
                index = list(n).index(n.find('type'))+1
                while index < len(n) and n[index].tag == 'dot': index += 1
                n.insert(index,accidental)
            alterations[key] = alteration
    el(el(measures[-1],'barline',location='right'),'bar-style','light-heavy')
    return measures

def trips(names='G#3 C#4 E4',fingers='1 2 4'):
    return ' '.join(f'{n}:1/3:{f}' for _ in range(4) for n,f in zip(names.split(),fingers.split()))

def build():
    lessons=[]
    def prep(title,voices,focus,tip):
        lessons.append(compile_lesson(len(lessons)+1,title,make_study(voices),'Prepare',focus,tip,
            'A focused preparation for Moonlight Sonata, before tackling the original score.'))
    prep('Find C-sharp minor',{
        1:['C#4:1:1 D#4:1:2 E4:1:3 F#4:1:4','G#4:1:5 F#4:1:4 E4:1:3 D#4:1:2','C#4:1:1 E4:1:3 G#4:1:5 E4:1:3','C#4:4:1'],
        5:['C#3:4:1','G#2:4:5','C#3:4:1','C#3:4:1']},
        'Recognize C-sharp, D-sharp, F-sharp and G-sharp in the four-sharp key signature.',
        'Start at 40 BPM. Locate the black keys before playing, then practise RH, LH and both. Move on when you can find the notes without searching.')
    prep('Shape the broken chord',{
        1:['G#3:1:1 C#4:1:2 E4:1:4 C#4:1:2']*4,5:['C#3:4:1']*4},
        'Prepare the opening G-sharp–C-sharp–E shape in slow quarter notes.',
        'Use RH 1–2–4 as a starting fingering. Let the forearm follow the notes; do not hold a rigid stretch. Keep the LH C-sharp quiet. Start at 40 BPM.')
    prep('Three even notes per beat',{1:[trips()]*4,5:['C#3:4:1']*4},
        'Maintain a steady triplet accompaniment without accents.',
        'Count ONE-trip-let, TWO-trip-let, THREE-trip-let, FOUR-trip-let. The three eighth notes share ONE quarter-note beat: at 60 BPM each lasts 1/3 second. Begin at 30–40 BPM.')
    prep('Quiet bass octaves',{
        1:['E4:4:3']*4,5:['C#2+C#3:4:5+1','B1+B2:4:5+1','A1+A2:4:5+1','G#1+G#2:4:5+1']},
        'Find a relaxed octave and move the whole hand between bass positions.',
        'Practise LH alone at 30–40 BPM. Release before each change and move the forearm; never force the span. Return to single bass notes in step 2 if octaves are not yet comfortable.')
    prep('Let the melody sing',{
        1:['G#4:4:5']*4,2:[trips(fingers='1 2 3')]*4,5:['C#3:4:1']*4},
        'Hold the upper melody while the inner triplets remain soft and even.',
        'Use finger 5 for the sustained G-sharp and 1–2–3 for the triplets below. Practise RH alone first at 30 BPM. Listen for a singing top note; the app grades pitches, not voicing or how softly you play.')
    prep('Dotted melody against triplets',{
        1:['r:3 G#4:3/4:5 G#4:1/4:5','G#4:3:5 G#4:3/4:5 G#4:1/4:5']*2,
        2:[trips(fingers='1 2 3')]*4,5:['C#3:4:1']*4},
        'Place a dotted eighth and sixteenth over an unchanged triplet pulse.',
        'The short melody note arrives after the third triplet note, not together with it. Clap the melody, then use Listen at 30 BPM and copy it. The last beat divides into 3/4 + 1/4 for the melody but 1/3 + 1/3 + 1/3 below.')
    prep('Read the chromatic colors',{
        1:['D#4:1:1 E4:1:2 E#4:1:3 F#4:1:4','F#4:1:1 F##4:1:2 G#4:1:3 A4:1:4','B3:1:1 B#3:1:2 C#4:1:3 D#4:1:4','E4:1:3 D#4:1:2 C#4:2:1'],
        5:['C#3:4:1']*4},
        'Recognize the raised notes used in the middle of the movement.',
        'The opening RH notes are D-sharp4, E4, E-sharp4 (the F4 key), and F-sharp4. Later, F-double-sharp4 uses G4 and B-sharp3 uses C4. Read the accidental before finding the key; note hints name the physical key. Reset the RH position at each bar and play at your own pace.')
    reduced=normalized_source(1,4)
    for m in reduced:
        # Drop upper chord tones only in the explicitly labelled bass reduction.
        for n in list(m.findall('note')):
            if int(n.findtext('voice','1'))>=5 and n.find('chord') is not None:m.remove(n)
    lessons.append(compile_lesson(8,'Opening with single bass notes',reduced,'Prepare',
        'Combine the exact opening RH with a simplified one-note bass.',
        'Start at 30–40 BPM. Practise each hand, then combine without pausing at barlines. This is a bass reduction; step 9 restores the original octaves.',
        'Preparation based on original measures 1–4; only the upper tones of LH chords are omitted.',source_range=[1,4]))
    sections=[
        (1,4,'The introduction','Keep the triplets even through the bass changes. Play without pedal first; then use light, clean pedal changes by ear.'),
        (5,6,'The melody enters','Learn the RH melody by ear, then keep it louder than the triplets. The lower notes beamed into the bass staff still belong to the RH accompaniment.'),
        (7,9,'Finish the first phrase','Hold the upper melody while moving the bass. A slur is phrasing, not a tie: repeated untied pitches need another press.'),
        (10,14,'The answering phrase','Notice the natural signs. Separate the melody from the inner accompaniment and connect the phrase to its cadence.'),
        (15,18,'Changing harmonies','Learn each broken-chord shape slowly. Keep the bass changes and small swells controlled.'),
        (19,22,'Lead into the next idea','Read the changing accidentals before starting. Give the long melody notes their full value while the triplets continue.'),
        (23,27,'A new color','Practise the bass chords separately, then keep the upper voice clear through the harmonic changes.'),
        (28,31,'Begin the middle section','Watch the rests and cross-staff writing. Follow the continuous moving line rather than treating every staff change as a hand change.'),
        (32,33,'Rising arpeggios','Work one beat at a time and move the forearm along the keyboard. Use 30 BPM until the positions feel secure.'),
        (34,35,'Chromatic ascent','Name the sharps, naturals and double sharps before playing. This is one of the harder passages; stay slow and avoid fixed stretches.'),
        (36,37,'Turn and descend','Practise the top turning point and the hand movement downward separately. Tied notes continue without another press.'),
        (38,41,'Prepare the return','Keep the sustained bass and softer inner line distinct. Connect the final bar to the returning theme.'),
        (42,45,'The theme returns','Compare this with measures 5–8, but read the actual notes here; the accompaniment and harmony are not identical.'),
        (46,50,'The returning phrase','Keep the melody above the flowing inner notes. Practise the bass changes separately before adding the RH.'),
        (51,55,'The long phrase','Use a consistent pulse through the swells. Listen to the phrase shape instead of accenting each triplet group.'),
        (56,59,'Toward the coda','Follow the exact bass notes and accidentals. Make the quieter return deliberate, without slowing unintentionally.'),
        (60,63,'The coda begins','The dotted melody moves into the bass. Let the LH sing while the RH arpeggios remain lighter.'),
        (64,67,'The final descent','Practise the descending turns and rests carefully. Keep the line continuous as it crosses between the staves.'),
        (68,69,'The final chords','Place each chord quietly and together. The app uses the written duration; the final fermata can be longer in your own performance.'),
    ]
    for start,end,title,tip in sections:
        lessons.append(compile_lesson(len(lessons)+1,f'{title} · mm. {start}–{end}',normalized_source(start,end),'Short passages',
            f'Original measures {start}–{end}, with the original pitches and rhythms.',
            tip+' Begin at 30–40 quarter-note BPM. Practise hands separately, then together; aim for three comfortable, accurate runs before connecting it to its neighbors.',
            'A short passage from the supplied first-movement edition. Source measure numbers are retained on the score.',source_range=[start,end]))
    for start,end,title in [(1,14,'Opening statement'),(15,27,'Develop the theme'),(28,41,'The middle section'),(42,59,'The return'),(60,69,'The complete coda')]:
        lessons.append(compile_lesson(len(lessons)+1,f'{title} · mm. {start}–{end}',normalized_source(start,end),'Connect',
            'Join the short passages without losing the pulse at their boundaries.',
            'Use a tempo at which you can finish without tension. Practise the last bar of one phrase with the first bar of the next. Raise the tempo only after three clean, comfortable runs, keeping the melody clear and the pedal clean.',
            f'An extended original passage covering measures {start}–{end}.',tempo=48,source_range=[start,end]))
    lessons.append(compile_lesson(33,'Moonlight Sonata · Complete first movement',normalized_source(1,69),'Finale',
        'Perform all 69 measures with a steady pulse, a singing melody and controlled accompaniment.',
        'Begin at your secure practice tempo. This edition’s playback reference is quarter note = 64 (half note = 32 in cut time), not a required starting speed. Use the PDF for phrasing and pedal interpretation. MIDI results measure note accuracy, not musical expression, pedal quality or reliable note-hold technique.',
        'The complete Adagio sostenuto from the supplied PDF, in the original C-sharp minor: all 69 measures, not an easy arrangement.',tempo=64,source_range=[1,69]))
    assert len(lessons)==33
    out=ROOT/'hosted/data/moonlight.json'
    out.write_text(json.dumps(lessons,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(f'Built {len(lessons)} Moonlight lessons; finale has {len(lessons[-1]["polyphony"])} attacks and {lessons[-1]["durationBeats"]} quarter-note beats.')

if __name__=='__main__':build()
