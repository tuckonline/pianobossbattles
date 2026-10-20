from pathlib import Path
import xml.etree.ElementTree as E,json,copy
root=Path(__file__).resolve().parents[1]
r=E.parse(root/'source-scores/repertoire/zelda-omr.musicxml').getroot()
# OMR is a draft only. Corrections below are checked against the uploaded two-page PDF.
def el(p,t,v=None,**a):
 n=E.SubElement(p,t,a)
 if v is not None:n.text=str(v)
 return n
def chord(pitches,staff,duration=48,ties=()):
 result=[]
 for i,p in enumerate(pitches.split()):
  n=E.Element('note')
  if i:el(n,'chord')
  pn=el(n,'pitch');el(pn,'step',p[0]);alter=-1 if 'b' in p else 0
  if alter:el(pn,'alter',alter)
  el(pn,'octave',p[-1]);el(n,'duration',duration)
  for t in ties:el(n,'tie',type=t)
  el(n,'voice',staff);el(n,'type','whole')
  if alter:el(n,'accidental','flat')
  el(n,'staff',staff)
  if ties:
   ns=el(n,'notations')
   for t in ties:el(ns,'tied',type=t)
  result.append(n)
 return result
out=E.Element('score-partwise',version='4.0');el(el(out,'work'),'work-title','Title Theme — The Legend of Zelda: Ocarina of Time')
ident=el(out,'identification');el(ident,'creator','Koji Kondo',type='composer');el(ident,'creator','Torby Brand',type='arranger')
pd=el(el(out,'part-list'),'score-part',id='P1');el(pd,'part-name','Piano');part=el(out,'part',id='P1')
missing={1:(2,'F2'),2:(2,'C2'),12:(1,'B5'),32:(1,'E5 B5'),37:(2,'F2 C3 F3'),38:(2,'G2 D3 G3'),39:(2,'Ab2 Eb3 Ab3'),40:(2,'Bb2 F3 Bb3'),45:(2,'F2'),46:(2,'C2'),47:(2,'F2'),48:(2,'C2'),49:(1,'G3 B3 D4 E4 G4')}
events=[];active={};raw=[]
for original in r.findall('./part/measure'):
 num=int(original.get('number'));hands={s:[copy.deepcopy(n) for n in original.findall('note') if n.findtext('staff','1')==str(s)] for s in (1,2)}
 if num in missing:
  s,p=missing[num];hands[s]=chord(p,s,ties=('stop',) if num==49 else ('start',) if num==48 else ())
 if num==49:hands[2]=chord('C2',2,ties=('stop',))
 if num==17:
  for n in hands[1][3:]:
   n.find('duration').text='36'
   if n.find('dot') is None:el(n,'dot')
 if num in (42,44):
  for n in hands[2]:
   a=n.find('pitch/alter')
   if a is not None:n.find('pitch').remove(a)
 if num in (45,48):
  # All chord tones tie into the dotted half; final chord continues through bar 49.
  for n in hands[1]:
   if n.find('pitch') is None:continue
   if num==48 and n.findtext('duration')=='24':
    n.find('duration').text='36'
    if n.find('dot') is None:el(n,'dot')
   for t in list(n.findall('tie')):n.remove(t)
   ns=n.find('notations')
   if ns is None:ns=el(n,'notations')
   for t in list(ns.findall('tied')):ns.remove(t)
   types=['start'] if n.findtext('duration')=='4' else ['stop']+(['start'] if num==48 else [])
   for t in types:el(n,'tie',type=t);el(ns,'tied',type=t)
 m=el(part,'measure',number=str(num))
 if num==1:
  a=el(m,'attributes');el(a,'divisions',12);el(el(a,'key'),'fifths',0);time=el(a,'time');el(time,'beats',4);el(time,'beat-type',4);el(a,'staves',2)
  for s,sign,line in [(1,'G',2),(2,'F',4)]:c=el(a,'clef',number=str(s));el(c,'sign',sign);el(c,'line',line)
  d=el(m,'direction');met=el(el(d,'direction-type'),'metronome');el(met,'beat-unit','quarter');el(met,'per-minute',72);el(d,'sound',tempo='72')
 for s in (1,2):
  if s==2:el(el(m,'backup'),'duration',48)
  tick=0;prev=0
  for n in hands[s]:
   for attr in list(n.attrib):del n.attrib[attr]
   if n.find('chord') is not None:
    for b in list(n.findall('beam')):n.remove(b)
   for stem in n.findall('stem'):stem.attrib.clear()
   for ns in n.findall('notations'):
    for a in list(ns.findall('articulations')):ns.remove(a)
   # Retain score notation, but never import recognition-only staff key signatures or page positions.
   voice=n.find('voice')
   if voice is not None:voice.text=str(s)
   dur=int(n.findtext('duration'));onset=prev if n.find('chord') is not None else tick
   if n.find('chord') is None:tick+=dur
   prev=onset;m.append(n)
   p=n.find('pitch')
   if p is None:continue
   pitch=(int(p.findtext('octave'))+1)*12+dict(C=0,D=2,E=4,F=5,G=7,A=9,B=11)[p.findtext('step')]+int(p.findtext('alter','0'))
   start=(num-1)*48+onset;key=(s,pitch);types=[t.get('type') for t in n.findall('tie')]
   raw.append([start,pitch,dur,s])
   if 'stop' in types:
    assert key in active and active[key]['end']==start,('broken tie',num,key,start)
    active[key]['beats']+=dur/12;active[key]['end']+=dur
    if 'start' not in types:del active[key]
   else:
    e=dict(pitch=pitch,beat=start/12,beats=dur/12,hand='right' if s==1 else 'left',end=start+dur);events.append(e)
    if 'start' in types:active[key]=e
  assert tick==48,('bar duration',num,s,tick)
assert not active,active
el(el(m,'barline',location='right'),'bar-style','light-heavy')
E.indent(out);path=root/'hosted/public/scores/repertoire/zelda-title-theme.musicxml';path.write_text(E.tostring(out,encoding='unicode'),encoding='utf-8')
for e in events:del e['end']
ex=dict(number=7001,title='Title Theme — The Legend of Zelda: Ocarina of Time',collection='repertoire',composer='Koji Kondo',arrangement='Torby Brand',difficulty='Easy',sourceUrl='/scores/repertoire/zelda-ocarina-of-time-title-theme.pdf',sourcePage=1,beatsPerMeasure=4,durationBeats=196,measuresPerSystem=4,right=[[] for _ in range(49)],left=[[] for _ in range(49)],polyphony=sorted(events,key=lambda n:(n['beat'],n['pitch'])),notationUrl='/scores/repertoire/zelda-title-theme.musicxml')
(root/'hosted/data/repertoire.json').write_text(json.dumps([ex],ensure_ascii=False),encoding='utf-8')
q=lambda s:"'"+s.replace("'","''")+"'"
(root/'drizzle/0010_zelda_repertoire_midi.sql').write_text('INSERT INTO practice_exercises (number,collection,source_number,title,source_url,source_page,definition) VALUES (7001,\'repertoire\',1,'+q(ex['title'])+','+q(ex['sourceUrl'])+',1,'+q(json.dumps(ex,ensure_ascii=False))+');\n',encoding='utf-8')
print('49 measures verified; sounding events:',len(events))
