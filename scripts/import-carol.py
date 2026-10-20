from pathlib import Path
import xml.etree.ElementTree as E,json
root=Path(__file__).resolve().parents[1];bars={}
for page,offset,scale in [(1,0,1),(2,95,2)]:
 r=E.parse(root/f'source-scores/carol/omr-page{page}.musicxml')
 for i,m in enumerate(r.findall('.//part/measure'),1):
  tokens=[]
  for n in m.findall('note'):
   p=n.find('pitch');pitch='R' if p is None else p.findtext('step')+({'-1':'b','1':'#'}.get(p.findtext('alter'),''))+p.findtext('octave')
   dur=int(n.findtext('duration'))/scale
   tokens.append(f'{pitch}:{dur:g}')
  bars[offset+i]=' '.join(tokens)
# All durations in eighth-note units. These explicit corrections were checked
# against both original screenshots, including rest-only bars and naturals.
for n,s in list(bars.items()):
 if s.startswith('R:') and len(s.split())==1:bars[n]='R:6'
fix={2:'R:2 Eb4:1 D4:1 C4:1 D4:1',3:'Eb4:1 R:1 Eb4:1 D4:1 C4:1 D4:1',4:'Eb4:1 R:1 C4:1 D4:1 Eb4:1 R:1',6:'Ab4:1 R:1 C4:1 R:1 Ab4:1 R:1',7:'C4:1 R:1 Ab4:1 R:1 Bb4:1 Ab4:1',8:'G4:1 R:1 G3:1 R:1 F4:1 Eb4:1',13:'Ab4:1 R:1 C4:1 R:1 Ab4:1 G4:1',14:'F4:1 R:1 C4:1 R:1 G4:1 Ab4:1',59:'G3:1 A3:1 B3:1 C4:1 D4:1 Eb4:1',66:'G4:3 R:1 R:2',73:'D4:3 B3:3',128:'G4:3 R:1 R:2',129:'G4:1 F4:1 Eb4:1 D4:1 C4:2',131:'D4:1 Bb3:1 Bb4:1 Ab4:1 G4:1 F4:1',132:'G4:1 Bb3:1 G4:1 Ab4:1 G4:2',133:'Eb4:1 D4:1 C4:1 D4:1 Eb4:2',135:'D4:1 C4:1 B3:1 C4:1 D4:1 F4:1',163:'R:1 R:1 Eb4:1 D4:1 C4:1 D4:1',164:'Eb4:1 R:1 Eb4:1 D4:1 C4:1 D4:1',165:'Eb4:1 R:1 C4:1 D4:1 Eb4:1 R:1',177:'E4:6~',178:'E4:6~',179:'E4:6'}
bars.update(fix)
for dest,src in {10:3,11:4,119:59,145:129,147:131,148:132,149:133,151:135,153:129,155:131,156:132,157:133,159:135,167:6,168:7,169:8,171:3,172:3,173:4}.items():bars[dest]=bars[src]
assert len(bars)==183
(root/'source-scores/carol/transcription.json').write_text(json.dumps(bars,indent=2),encoding='utf-8')
def el(p,t,v=None,**a):
 n=E.SubElement(p,t,a)
 if v is not None:n.text=str(v)
 return n
xml=E.Element('score-partwise',version='4.0');el(el(xml,'work'),'work-title','Carol of the Bells');pd=el(el(xml,'part-list'),'score-part',id='P1');el(pd,'part-name','Melody');part=el(xml,'part',id='P1');events=[];tied=None
for number,bar in bars.items():
 m=el(part,'measure',number=str(number))
 if number==1:
  a=el(m,'attributes');el(a,'divisions',2);el(el(a,'key'),'fifths',-3);t=el(a,'time');el(t,'beats',3);el(t,'beat-type',4);c=el(a,'clef');el(c,'sign','G');el(c,'line',2)
 tick=0;accidentals={};beamOpen=False;tokens=bar.split()
 for index,token in enumerate(tokens):
  pitch,length=token.split(':');tie=length.endswith('~');dur=int(float(length.rstrip('~')));n=el(m,'note');start=(number-1)*3+tick/2;tick+=dur
  if pitch=='R':
   el(n,'rest',**({'measure':'yes'} if dur==6 else {}));el(n,'duration',dur);el(n,'voice',1)
   if dur!=6:el(n,'type',{1:'eighth',2:'quarter'}[dur])
   continue
  step=pitch[0];octave=int(pitch[-1]);alter=1 if '#' in pitch else -1 if 'b' in pitch else 0;pn=el(n,'pitch');el(pn,'step',step)
  if alter:el(pn,'alter',alter)
  el(pn,'octave',octave);el(n,'duration',dur)
  midi=(octave+1)*12+dict(C=0,D=2,E=4,F=5,G=7,A=9,B=11)[step]+alter
  stop=tied is not None
  if stop:
   assert tied['pitch']==midi and abs(tied['beat']+tied['beats']-start)<1e-8
   tied['beats']+=dur/2;el(n,'tie',type='stop')
  else:
   event=dict(pitch=midi,beat=start,beats=dur/2,hand='right');events.append(event)
  if tie:el(n,'tie',type='start')
  el(n,'voice',1);el(n,'type',{1:'eighth',2:'quarter',3:'quarter',4:'half',6:'half'}[dur])
  if dur in (3,6):el(n,'dot')
  expected=accidentals.get((step,octave),-1 if step in 'BEA' else 0)
  if alter!=expected and not stop:el(n,'accidental',{-1:'flat',0:'natural',1:'sharp'}[alter])
  accidentals[(step,octave)]=alter
  if beamOpen:
   el(n,'beam','end',number='1');beamOpen=False
  elif dur==1 and (tick-1)%2==0 and index+1<len(tokens) and not tokens[index+1].startswith('R:') and tokens[index+1].split(':')[1]=='1':
   el(n,'beam','begin',number='1');beamOpen=True
  if tie or stop:
   ns=el(n,'notations')
   if stop:el(ns,'tied',type='stop')
   if tie:el(ns,'tied',type='start')
  tied=(tied if stop else event) if tie else None
 assert tick==6,(number,tick,bar)
assert tied is None
el(el(m,'barline',location='right'),'bar-style','light-heavy');E.indent(xml)
(root/'hosted/public/scores/repertoire/carol-of-the-bells.musicxml').write_text(E.tostring(xml,encoding='unicode'),encoding='utf-8')
ex=dict(number=7003,title='Carol of the Bells',collection='repertoire',singleHand='right',description='Single-staff melody transcribed from your two uploaded pages. Three beats per measure. Rests and the tied ending are preserved. No tempo is printed; choose a comfortable BPM.',sourceUrl='/scores/repertoire/carol-page1.png',sourcePage=1,tempoBpm=60,beatsPerMeasure=3,durationBeats=549,measuresPerSystem=6,right=[[] for _ in bars],left=[[] for _ in bars],polyphony=events,notationUrl='/scores/repertoire/carol-of-the-bells.musicxml')
p=root/'hosted/data/repertoire.json';data=json.loads(p.read_text(encoding='utf-8'));data=[e for e in data if e['number']!=7003]+[ex];p.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
q=lambda s:"'"+s.replace("'","''")+"'"
(root/'drizzle/0013_carol_of_the_bells.sql').write_text('INSERT INTO practice_exercises (number,collection,source_number,title,source_url,source_page,definition) VALUES (7003,\'repertoire\',3,'+q(ex['title'])+','+q(ex['sourceUrl'])+',1,'+q(json.dumps(ex,ensure_ascii=False))+');\n',encoding='utf-8')
print('183 measures;',len(events),'notes; last onset',events[-1])
