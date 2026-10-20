"""Build a reproducible practice edition from the downloaded public study files.
Install music21 into work/musicdeps before running from the workspace root.
"""
import sys, json, math, re, copy, shutil, gzip
from pathlib import Path
from fractions import Fraction
sys.path.insert(0, 'work/musicdeps')
from music21 import converter, stream, note, chord, meter, key, clef, metadata, layout

ROOT=Path(__file__).resolve().parents[1]
SOURCES=ROOT/'source-scores/czerny'
OUT=ROOT/'hosted/public/scores/czerny-op599'
OUT.mkdir(parents=True,exist_ok=True)
SOURCE='https://pianoexercises.org/exercises/czerny/czerny-practical-exercises-for-beginners-op-599.pdf'
pages={3:[1,2],4:[3,4,5],5:[6,7,8,9,10],6:[11,12],7:[13,14],8:[15,16],9:[17],10:[18],11:[19,20],12:[21,22,23],13:[24,25],14:[26,27,28],15:[29],16:[30,31],17:[32,33],18:[34,35,36],19:[37,38],20:[39,40],21:[41,42],22:[43,44],23:[45],24:[46,47],25:[48,49],26:[50,51],27:[52,53,54],28:[55,56],29:[57],30:[58,59],31:[60],32:[61],33:[62],34:[63,64],35:[65],36:[66,67],37:[68],38:[69,70],39:[71],40:[72,73],41:[74,75],42:[76,77],43:[78,79],44:[80],45:[81],46:[82,83],47:[84],48:[85,86],49:[87],50:[88,89],51:[90,91],52:[92,93],53:[94,95],54:[96,97],55:[98],56:[99,100]}
page_for={n:p for p,ns in pages.items() for n in ns}
data=json.loads(gzip.decompress((SOURCES/'midi-study-events.json.gz').read_bytes()))

def grid(x):
    # Regular binary rhythm and triplets; very short performed ornaments use
    # 64th-note or triplet-32nd spacing in this explicit practice edition.
    candidates=[Fraction(round(x*d),d) for d in (16,12)]
    return min(candidates,key=lambda f:abs(float(f)-x))

values=sorted(set(Fraction(v,d) for d in (1,2,4,8,16,3,6,12) for v in (1,2,3,4,6,8)))
def duration(x):
    # These teaching MIDIs mix 90% articulation and two-tick note-off gaps.
    # Restore notated lengths instead of engraving those gaps as tiny rests.
    best=min(values,key=lambda v:min(abs(x-float(v)*.9),abs(x-(float(v)-2/480))))
    err=min(abs(x-float(best)*.9),abs(x-(float(best)-2/480)))
    return best if err<.003 else max(Fraction(1,16),grid(x))

def midi_score(n):
    d=data[n-1]; num,den=d['ts'][0]['time']; measure=Fraction(num*4,den)
    s=stream.Score()
    for ti,t in enumerate(d['tracks']):
        p=stream.PartStaff(id='RH' if ti==0 else 'LH')
        p.partName='Piano' if ti==0 else 'Left hand'
        p.insert(0,clef.TrebleClef() if ti==0 else clef.BassClef())
        p.insert(0,meter.TimeSignature(f'{num}/{den}'))
        k=d['keys'][0] if d['keys'] else {'key':'C','scale':'major'}
        signature=key.Key(k['key'].replace('b','-'),k['scale'])
        p.insert(0,signature)
        merged={}
        for a in t['notes']:
            beat=a['beat']
            if n==72:
                # Two recorded fermata pauses are not extra metrical beats.
                beat-= (53/30 if beat>=16.7666 else 0)+(53/30 if beat>=43.0333 else 0)
            onset=grid(beat); dur=duration(a['beats'])
            ident=(onset,a['pitch'])
            merged[ident]=max(merged.get(ident,0),dur)
        # A physical key cannot continue a previous attack after being struck
        # again. The source also omits several RH note-offs in No. 43; its
        # single melodic/chordal voice ends at the following entry in the PDF.
        for (onset,pitch),dur in list(merged.items()):
            later=[o for (o,p) in merged if o>onset and (p==pitch or (n==43 and ti==0))]
            if later: merged[(onset,pitch)]=min(dur,min(later)-onset)
        grouped={}
        for (onset,pitch),dur in merged.items():
            grouped.setdefault((onset,dur),[]).append(pitch)
        # Independent voices retain held bass tones under moving accompaniment.
        voices=[]; ends=[]
        for (onset,dur),pitches in sorted(grouped.items()):
            index=next((i for i,e in enumerate(ends) if e<=onset),len(voices))
            if index==len(voices): voices.append(stream.Voice(id=index+1));ends.append(Fraction(0))
            obj=chord.Chord(pitches) if len(pitches)>1 else note.Note(pitches[0])
            for pitch in obj.pitches:
                if pitch.accidental and ((signature.sharps<0 and pitch.accidental.alter>0) or (signature.sharps>0 and pitch.accidental.alter<0)):
                    pitch.getEnharmonic(inPlace=True)
            obj.duration.quarterLength=dur
            voices[index].insert(onset,obj);ends[index]=onset+dur
        total=math.ceil(max(ends)/measure)*measure
        for v in voices:
            v.makeRests(inPlace=True,fillGaps=True,timeRangeFromBarDuration=False,refStreamOrTimeRange=[0,total])
            p.insert(0,v)
        s.insert(0,p)
    s.insert(0,layout.StaffGroup(s.parts,name='Piano',symbol='brace',barTogether=True))
    s.makeNotation(inPlace=True)
    return s

library=[]
for n in range(1,101):
    s=converter.parse(SOURCES/f'{n:03}.musicxml').expandRepeats() if n<=10 else midi_score(n)
    s.metadata=metadata.Metadata(title=f'Czerny Op. 599 · No. {n}',composer='Carl Czerny')
    ts=s.parts[0].recurse().getElementsByClass(meter.TimeSignature).first()
    bpm=float(ts.barDuration.quarterLength)
    for part in s.parts:
        for i,m in enumerate(part.getElementsByClass(stream.Measure)):
            for obj in list(m.getElementsByClass(layout.SystemLayout))+list(m.getElementsByClass(layout.PageLayout)):
                m.remove(obj)
            m.number=i+1
            if i and i%4==0:m.insert(0,layout.SystemLayout(isNew=True))
    xmlpath=OUT/f'{n:03}.musicxml'
    s.write('musicxml',fp=xmlpath)
    xml=xmlpath.read_text(encoding='utf-8')
    xml=re.sub(r'<!DOCTYPE[^>]*>','',xml)
    xml=re.sub(r'<credit\b.*?</credit>','',xml,flags=re.S)
    xmlpath.write_text(xml,encoding='utf-8')
    # Use the exported score as the single source of truth for sound and scoring.
    parsed=converter.parse(xmlpath)
    sounds=[]
    for ti,p in enumerate(parsed.parts):
        for obj in p.stripTies().flatten().notes:
            if obj.duration.isGrace: continue
            for pitch in obj.pitches:
                sounds.append({'pitch':int(pitch.midi),'beat':round(float(obj.offset),7),'beats':round(float(obj.quarterLength),7),'hand':'right' if ti==0 else 'left'})
    # A unison shared by voices needs one physical key press.
    unique={}
    for obj in sounds:
        ident=(obj['hand'],obj['beat'],obj['pitch'])
        if ident not in unique or unique[ident]['beats']<obj['beats']:unique[ident]=obj
    sounds=sorted(unique.values(),key=lambda a:(a['beat'],a['pitch'],a['hand']))
    total=float(max(p.highestTime for p in parsed.parts))
    bars=round(total/bpm)
    ex={'number':3000+n,'title':f'Czerny Op. 599 · No. {n}','collection':'czerny-op599','sourcePage':page_for[n],'beatsPerMeasure':bpm,'durationBeats':total,'measuresPerSystem':4,'right':[[] for _ in range(bars)],'left':[[] for _ in range(bars)],'polyphony':sounds,'notationUrl':f'/scores/czerny-op599/{n:03}.musicxml'}
    assert sounds and all(a['beats']>0 and 21<=a['pitch']<=108 for a in sounds)
    assert set(a['hand'] for a in sounds)=={'right','left'}
    library.append(ex)
    print(n,bars,len(sounds),flush=True)

dest=ROOT/'hosted/data';dest.mkdir(exist_ok=True)
(dest/'czerny-op599.json').write_text(json.dumps(library,separators=(',',':'),ensure_ascii=False),encoding='utf-8')
quote=lambda x:"'"+x.replace("'","''")+"'"
stmts=[]
for ex in library:
    vals=[str(ex['number']),quote(ex['collection']),str(ex['number']-3000),quote(ex['title']),quote(SOURCE),str(ex['sourcePage']),quote(json.dumps(ex,separators=(',',':'),ensure_ascii=False))]
    stmts.append('INSERT INTO practice_exercises (number,collection,source_number,title,source_url,source_page,definition) VALUES ('+','.join(vals)+');')
(ROOT/'drizzle/0005_czerny_op599.sql').write_text('-- Czerny Op. 599: 100 numbered practice studies.\n'+'\n--> statement-breakpoint\n'.join(stmts)+'\n',encoding='utf-8')

