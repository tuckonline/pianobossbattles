"""Create the complete, both-hands MIDI practice edition. Run from workspace root."""
import sys, json, gzip, math, re
import xml.etree.ElementTree as ET
from pathlib import Path
from fractions import Fraction
sys.path.insert(0, 'work/musicdeps')
from music21 import stream, note, chord, meter, key, clef, metadata, layout, converter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'hosted/public/scores/burgmuller-op100'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = 'https://pianoexercises.org/exercises/burgmuller/burgmuller-25-easy-and-progressive-studies-op-100.pdf'
TITLES = ['La candeur','Arabesque','Pastorale','Petite réunion','Innocence','Progrès','Courant limpide','La gracieuse','La chasse','Tendre fleur','La bergeronnette','Adieu','Consolation','La styrienne','Ballade','Douce plainte','Babillarde','Inquiétude','Ave Maria','Tarentelle','Harmonie des anges','Barcarolle','Retour',"L’hirondelle",'La chevaleresque']
PAGES = [4,5,6,7,8,9,10,11,12,14,15,16,18,20,22,24,25,26,27,28,30,32,34,36,38]
KEYS = ['C','a','G','C','F','C','G','F','C','D','C','a','C','G','c','d','F','e','A','d','G','A-','E-','G','C']
data = json.loads(gzip.decompress((ROOT/'source-scores/burgmuller/study-events.json.gz').read_bytes()))
library = []
for d in data:
    n = d['n']
    num, den = d['ts'][1]['timeSignature']
    bar = Fraction(num*4, den)
    raw = [x for t in d['tracks'] for x in t['notes']]
    # The source has one empty 4/4 setup bar. Preserve pickup alignment.
    origin = Fraction(4) if min(x['beat'] for x in raw) >= 4 else Fraction(4)-bar
    sounds = []
    for x in raw:
        onset = Fraction(x['beat']).limit_denominator(1920)-origin
        length = Fraction(x['beats']).limit_denominator(1920)
        assert onset >= 0 and length > 0
        sounds.append((onset, length, x['pitch']))
    total = math.ceil(max(o+l for o,l,p in sounds)/bar)*bar
    score = stream.Score()
    score.metadata = metadata.Metadata(title=f'Burgmüller Op. 100 · No. {n} — {TITLES[n-1]}',composer='Friedrich Burgmüller')
    # Register assignment is engraving only, never represented as hand separation.
    for upper in [True,False]:
        part = stream.PartStaff(id='upper' if upper else 'lower')
        part.partName = 'Piano' if upper else ''
        part.insert(0, clef.TrebleClef() if upper else clef.BassClef())
        part.insert(0,meter.TimeSignature(f'{num}/{den}'))
        signature = key.Key(KEYS[n-1])
        part.insert(0,signature)
        grouped = {}
        for onset,length,pitch in sounds:
            if (pitch>=60) != upper: continue
            grouped.setdefault((onset,length),set()).add(pitch)
        voices,ends = [],[]
        for (onset,length),pitches in sorted(grouped.items()):
            index = next((i for i,end in enumerate(ends) if end<=onset),len(voices))
            if index==len(voices): voices.append(stream.Voice(id=index+1));ends.append(Fraction(0))
            obj = chord.Chord(sorted(pitches)) if len(pitches)>1 else note.Note(next(iter(pitches)))
            for p in obj.pitches:
                if p.accidental and signature.sharps<0 and p.accidental.alter>0: p.getEnharmonic(inPlace=True)
            obj.duration.quarterLength=length
            voices[index].insert(onset,obj);ends[index]=onset+length
        if not voices: voices=[stream.Voice(id=1)]
        for voice in voices:
            voice.makeRests(inPlace=True,fillGaps=True,timeRangeFromBarDuration=False,refStreamOrTimeRange=[0,total])
            part.insert(0,voice)
        score.insert(0,part)
    score.insert(0,layout.StaffGroup(score.parts,name='Piano',symbol='brace',barTogether=True))
    score.makeNotation(inPlace=True)
    for part in score.parts:
        for i,m in enumerate(part.getElementsByClass(stream.Measure)):
            if i and i%4==0: m.insert(0,layout.SystemLayout(isNew=True))
    path = OUT/f'{n:02}.musicxml'
    score.write('musicxml',fp=path)
    xml=re.sub(r'<!DOCTYPE[^>]*>','',path.read_text(encoding='utf8'))
    root = ET.fromstring(xml)
    key_alters = {p.step: int(p.accidental.alter) for p in key.Key(KEYS[n-1]).alteredPitches}
    for measure in root.findall('./part/measure'):
        pitches_by_voice = {(a.findtext('staff','1'),a.findtext('voice','0')) for a in measure.findall('note') if a.find('pitch') is not None}
        accidentals = {}
        for a in measure.findall('note'):
            staff = a.findtext('staff','1')
            voice = a.find('voice')
            original_voice = a.findtext('voice','0')
            if voice is not None: voice.text = str(int(original_voice)+1+(0 if staff=='1' else 10))
            if a.find('rest') is not None and (staff,original_voice) not in pitches_by_voice and any(s==staff for s,v in pitches_by_voice):
                a.set('print-object','no')
            pitch = a.find('pitch')
            if pitch is not None:
                step=pitch.findtext('step');octave=pitch.findtext('octave');alter=int(pitch.findtext('alter','0'))
                ident=(staff,step,octave)
                previous=accidentals.get(ident,key_alters.get(step,0))
                accidental=a.find('accidental')
                if previous==alter and accidental is not None: a.remove(accidental)
                accidentals[ident]=alter
    ET.indent(root)
    path.write_text('<?xml version="1.0" encoding="utf-8"?>\n'+ET.tostring(root,encoding='unicode'),encoding='utf8')
    # Sound and scoring preserve every source attack and held duration.
    # Written ties may split a source note across several measures.
    events = [dict(pitch=p,beat=round(float(o),7),beats=round(float(l),7),hand='right' if p>=60 else 'left') for o,l,p in sounds]
    events.sort(key=lambda x:(x['beat'],x['pitch']))
    bars=int(total/bar)
    library.append(dict(number=5000+n,title=f'{n}. {TITLES[n-1]}',collection='burgmuller-op100',composer='Friedrich Burgmüller',sourcePage=PAGES[n-1],sourceUrl=SOURCE,beatsPerMeasure=float(bar),durationBeats=float(total),measuresPerSystem=4,right=[[] for _ in range(bars)],left=[[] for _ in range(bars)],polyphony=events,notationUrl=f'/scores/burgmuller-op100/{n:02}.musicxml',bothHandsOnly=True))
    print(n,bars,len(events),flush=True)
(ROOT/'hosted/data/burgmuller-op100.json').write_text(json.dumps(library,ensure_ascii=False,separators=(',',':')),encoding='utf8')

# Reapply the source-edition annotations whenever the practice score is rebuilt.
import runpy
runpy.run_path(str(ROOT/'scripts/apply-burgmuller-fingerings.py'), run_name='__main__')
