"""Generate the beginner arrangements and pending D1 migration (music21 10.5)."""
import sys, json, re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT.parents[1]/'work/musicdeps'))
from music21 import stream, note, meter, key, clef, metadata, layout, bar

OUT=ROOT/'hosted/public/scores/beginner'
OUT.mkdir(parents=True,exist_ok=True)
items=[]
def add(title,composer,difficulty,why,focus,tip,right,left,beats=4,arrangement='PianoPath beginner arrangement · melody with simple bass notes',source=None):
    items.append(dict(title=title,composer=composer,difficulty=difficulty,description=why,learningFocus=focus,practiceTip=tip,arrangement=arrangement,rightPattern=right,leftPattern=left,beatsPerMeasure=beats,sourceUrl=source))

add('Mary Had a Little Lamb','Traditional','Start here',
    'A familiar melody using a small group of adjacent keys.',
    'Right-hand note reading, even rhythm and simple phrasing.',
    'Start with the right hand at 60 BPM. Add the left-hand bass notes when the melody feels comfortable.',
    'E4 D4 C4 D4|E4 E4 E4:2|D4 D4 D4:2|E4 G4 G4:2|E4 D4 C4 D4|E4 E4 E4 E4|D4 D4 E4 D4|C4:4',
    'C3:4|C3:4|G3:4|C3:4|C3:4|C3:4|G3:4|C3:4')
add('Ode to Joy','Ludwig van Beethoven · theme from Symphony No. 9','Start here',
    'A clear melody with repeated phrases.',
    'Stepwise motion, repetition and musical shaping.',
    'Notice the dotted rhythm at phrase endings. Keep the repeated notes even and relax at each cadence.',
    'E4 E4 F4 G4|G4 F4 E4 D4|C4 C4 D4 E4|E4:1.5 D4:0.5 D4:2|E4 E4 F4 G4|G4 F4 E4 D4|C4 C4 D4 E4|D4:1.5 C4:0.5 C4:2|D4 D4 E4 C4|D4 E4:0.5 F4:0.5 E4 C4|D4 E4:0.5 F4:0.5 E4 D4|C4 D4 G3:2|E4 E4 F4 G4|G4 F4 E4 D4|C4 C4 D4 E4|D4:1.5 C4:0.5 C4:2',
    'C3:4|G3:4|C3:4|G3:4|C3:4|G3:4|C3:2 G3:2|C3:4|G3:4|C3:4|G3:4|G3:4|C3:4|G3:4|C3:2 G3:2|C3:4')
add('Hot Cross Buns','Traditional','Start here',
    'A very short tune with just three melody notes.',
    'Finding E–D–C, counting and playing steadily.',
    'Use right-hand fingers 3–2–1 on E–D–C. Count all four beats of each long C.',
    'E4:2 D4:2|C4:4|E4:2 D4:2|C4:4|C4 C4 C4 C4|D4 D4 D4 D4|E4:2 D4:2|C4:4',
    'G3:4|C3:4|G3:4|C3:4|C3:4|G3:4|G3:4|C3:4')
add('Frère Jacques','Traditional French round','Start here',
    'Symmetrical phrases make the melody easy to remember.',
    'Five-finger position, repeated phrases and coordinating two hands.',
    'Play each repeated phrase the same way. Slow down the eighth notes before adding the left hand.',
    'C4 D4 E4 C4|C4 D4 E4 C4|E4 F4 G4:2|E4 F4 G4:2|G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4 C4|G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4 C4|C4 G3 C4:2|C4 G3 C4:2',
    'C3:4|C3:4|C3:4|C3:4|C3:4|C3:4|C3:1 G3:1 C3:2|C3:1 G3:1 C3:2')
add('Twinkle, Twinkle, Little Star','Traditional · Ah! vous dirai-je, maman','Start here',
    'A familiar tune makes melodic intervals easy to hear.',
    'Melodic intervals, phrase repetition and adding a bass accompaniment.',
    'Look ahead for the opening jump from C to G. Let every two-measure phrase feel connected.',
    'C4 C4 G4 G4|A4 A4 G4:2|F4 F4 E4 E4|D4 D4 C4:2|G4 G4 F4 F4|E4 E4 D4:2|G4 G4 F4 F4|E4 E4 D4:2|C4 C4 G4 G4|A4 A4 G4:2|F4 F4 E4 E4|D4 D4 C4:2',
    'C3:4|F3:2 C3:2|F3:2 C3:2|G3:2 C3:2|C3:2 F3:2|C3:2 G3:2|C3:2 F3:2|C3:2 G3:2|C3:4|F3:2 C3:2|F3:2 C3:2|G3:2 C3:2')
add('Jingle Bells — simplified','James Lord Pierpont','Early beginner',
    'The familiar chorus has clear, recurring note groups.',
    'Reading small note groups and maintaining a pulse.',
    'This is a simplified chorus. Keep the repeated E notes light and count through the long notes.',
    'E4 E4 E4:2|E4 E4 E4:2|E4 G4 C4 D4|E4:4|F4 F4 F4 F4|F4 E4 E4 E4|E4 D4 D4 E4|D4:2 G4:2|E4 E4 E4:2|E4 E4 E4:2|E4 G4 C4 D4|E4:4|F4 F4 F4 F4|F4 E4 E4 E4|G4 G4 F4 D4|C4:4',
    'C3:4|C3:4|C3:4|C3:4|F3:4|C3:4|G3:4|G3:4|C3:4|C3:4|C3:4|C3:4|F3:4|C3:4|G3:4|C3:4',
    arrangement='PianoPath simplified chorus · even-note melody with bass accompaniment')
add('When the Saints Go Marching In','Traditional','Early beginner',
    'A strong beat supports a predictable melody.',
    'Rhythmic consistency, rests and simple accompaniment.',
    'Listen to the pickup before starting. Keep counting through the rests; the left hand supplies the steady foundation.',
    'R C4 E4 F4|G4:3 R|R C4 E4 F4|G4:3 R|R C4 E4 F4|G4:2 E4:2|C4:2 E4:2|D4:3 R|E4 E4 D4 C4|C4:2 E4:2|G4:2 G4 F4|E4:3 R|F4:2 G4:2|E4:2 C4:2|D4:4|C4:4',
    'R:4|C3:4|C3:4|C3:4|C3:4|C3:4|C3:4|G3:4|C3:4|C3:4|C3:4|C3:4|F3:4|C3:4|G3:4|C3:4')
add('Au Clair de la Lune','Traditional French song','Early beginner',
    'A slow, lyrical melody encourages a singing tone.',
    'Legato touch and shaping a melody.',
    'Connect the melody gently and avoid rushing the half notes. Practise the middle phrase separately before playing the whole song.',
    'C4 C4 C4 D4|E4:2 D4:2|C4 E4 D4 D4|C4:4|C4 C4 C4 D4|E4:2 D4:2|C4 E4 D4 D4|C4:4|D4 D4 D4 D4|A3:2 A3:2|D4 C4 B3 A3|G3:4|C4 C4 C4 D4|E4:2 D4:2|C4 E4 D4 D4|C4:4',
    'C3:4|C3:2 G3:2|C3:2 G3:2|C3:4|C3:4|C3:2 G3:2|C3:2 G3:2|C3:4|G3:4|F3:4|G3:4|G3:4|C3:4|C3:2 G3:2|C3:2 G3:2|C3:4')
add('C major five-finger song','PianoPath · original study','Start here',
    'An original study built entirely from C–D–E–F–G.',
    'Keyboard geography and hand control.',
    'Place each hand over C–D–E–F–G. Keep the hands relaxed and use one finger per key.',
    'C4 D4 E4 F4|G4:2 E4:2|F4 E4 D4 C4|D4:4|E4 F4 G4 E4|D4 E4 F4 D4|C4 E4 D4 D4|C4:4',
    'C3:4|C3:4|F3:4|G3:4|C3:4|G3:4|C3:2 G3:2|C3:4',arrangement='Original PianoPath five-finger study')

ar='C5 D5|F5:0.5 E5:0.5 D5:0.5 C5:0.5|D5 E5|F5:2|E5 G5|C5:0.5 D5:0.5 E5:0.5 F5:0.5|E5 D5|C5:2'
al='C4:2|C4:2|B3:2|B3:2|C4:2|A3:2|G3:2|C4:2'
br='G5 F5|F5:0.5 E5:0.5 D5:0.5 C5:0.5|G5 F5|F5:0.5 E5:0.5 D5:0.5 C5:0.5|G5 F5|F5:0.5 E5:0.5 D5:0.5 C5:0.5|F5 E5|E5 D5'
bl='B3:2|C4:2|B3:2|C4:2|B3:2|C4:2|B3 C4|G3:2'
add('Allegro in C Major, Op. 1 No. 4','Alexander Reinagle','Next step',
    'A short classical piece with balanced phrases.',
    'Reading, controlled articulation and simple formal structure.',
    'Learn the two eight-measure sections slowly. The score below unfolds the repeats and D.C. al Fine as A–A–B–B–A; finish after the final A.',
    '|'.join([ar,ar,br,br,ar]),'|'.join([al,al,bl,bl,al]),2,
    arrangement='Original pitches and rhythms · repeats and D.C. al Fine written out',
    source='https://malditopiano.com/wp-content/uploads/2020/09/24_Piezas_Breves_y_Faciles.n4_Alexander_Reinagle..pdf')

library=[]
for i,item in enumerate(items,1):
    s=stream.Score();s.metadata=metadata.Metadata(title=item['title'],composer=item['composer'])
    sounds=[];arrays={}
    for hand in ('right','left'):
        p=stream.PartStaff(id=hand);p.partName='Piano' if hand=='right' else 'Left hand'
        p.insert(0,clef.TrebleClef() if hand=='right' else clef.BassClef())
        p.insert(0,meter.TimeSignature(f"{item['beatsPerMeasure']}/4"));p.insert(0,key.Key('C'))
        arrays[hand]=[]
        for j,pattern in enumerate(item[hand+'Pattern'].split('|')):
            m=stream.Measure(number=j+1);local=0;bar_notes=[]
            if j and j%4==0:m.insert(0,layout.SystemLayout(isNew=True))
            for token in pattern.split():
                parts=token.split(':');beats=float(parts[1]) if len(parts)>1 else 1
                obj=note.Rest() if parts[0]=='R' else note.Note(parts[0])
                obj.duration.quarterLength=beats;m.append(obj)
                if obj.isNote:
                    pitch=int(obj.pitch.midi)
                    sounds.append(dict(pitch=pitch,beat=j*item['beatsPerMeasure']+local,beats=beats,hand=hand))
                    bar_notes.append(dict(pitch=pitch,beats=beats,tie=False))
                local+=beats
            assert local==item['beatsPerMeasure'],(item['title'],hand,j,local)
            arrays[hand].append(bar_notes);p.append(m)
        p.getElementsByClass(stream.Measure)[-1].rightBarline=bar.Barline('final')
        s.insert(0,p)
    assert len(arrays['right'])==len(arrays['left'])
    s.insert(0,layout.StaffGroup(s.parts,name='Piano',symbol='brace',barTogether=True))
    xmlpath=OUT/f'{i:02}.musicxml';s.write('musicxml',fp=xmlpath)
    xml=re.sub(r'<!DOCTYPE[^>]*>','',xmlpath.read_text(encoding='utf8'))
    xmlpath.write_text(xml,encoding='utf8')
    ex={k:v for k,v in item.items() if not k.endswith('Pattern') and v is not None}
    ex.update(number=4000+i,collection='beginner-pieces',right=arrays['right'],left=arrays['left'],polyphony=sorted(sounds,key=lambda n:(n['beat'],n['pitch'])),durationBeats=len(arrays['right'])*item['beatsPerMeasure'],notationUrl=f'/scores/beginner/{i:02}.musicxml')
    library.append(ex)

(ROOT/'hosted/data/beginner-pieces.json').write_text(json.dumps(library,ensure_ascii=False,separators=(',',':')),encoding='utf8')
q=lambda x:"'"+x.replace("'","''")+"'"
stmts=[]
for e in library:
    source=e.get('sourceUrl','https://pianopath-studio.rosy-knoll-9766.chatgpt.site/student/practice?collection=beginner')
    values=[str(e['number']),q(e['collection']),str(e['number']-4000),q(e['title']),q(source),'1',q(json.dumps(e,ensure_ascii=False,separators=(',',':')))]
    stmts.append('INSERT INTO practice_exercises (number,collection,source_number,title,source_url,source_page,definition) VALUES ('+','.join(values)+');')
(ROOT/'drizzle/0006_beginner_pieces.sql').write_text('-- Ten beginner repertoire pieces.\n'+'\n--> statement-breakpoint\n'.join(stmts)+'\n',encoding='utf8')
print('Generated 10 beginner pieces, MusicXML scores and D1 migration.')
