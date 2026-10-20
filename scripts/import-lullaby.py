from pathlib import Path
import xml.etree.ElementTree as E,json,copy
root=Path(__file__).resolve().parents[1]
r=E.parse(root/'source-scores/repertoire/lullaby-omr.musicxml').getroot()
def el(p,t,v=None,**a):
 n=E.SubElement(p,t,a)
 if v is not None:n.text=str(v)
 return n
out=E.Element('score-partwise',version='4.0');title="Zelda's Lullaby — The Legend of Zelda: Ocarina of Time"
el(el(out,'work'),'work-title',title);ident=el(out,'identification');el(ident,'creator','Koji Kondo',type='composer');el(ident,'creator','Torby Brand',type='arranger')
pd=el(el(out,'part-list'),'score-part',id='P1');el(pd,'part-name','Piano');part=el(out,'part',id='P1');events=[];active={}
for original in r.findall('./part/measure'):
 num=int(original.get('number'));m=el(part,'measure',number=str(num))
 if num==1:
  a=el(m,'attributes');el(a,'divisions',4);el(el(a,'key'),'fifths',0);t=el(a,'time');el(t,'beats',3);el(t,'beat-type',4);el(a,'staves',2)
  for s,sign,line in [(1,'G',2),(2,'F',4)]:c=el(a,'clef',number=str(s));el(c,'sign',sign);el(c,'line',line)
  d=el(m,'direction');met=el(el(d,'direction-type'),'metronome');el(met,'beat-unit','quarter');el(met,'per-minute',104);el(d,'sound',tempo='104')
 if num==22:el(el(el(m,'direction',placement='above'),'direction-type'),'words','rit.')
 if num==24:
  d=el(m,'direction',placement='above');el(el(d,'direction-type'),'octave-shift',type='down',size='8',number='1');el(d,'staff',1)
 for s in (1,2):
  if s==2:el(el(m,'backup'),'duration',12)
  tick=0;prev=0
  for orig in original.findall('note'):
   if orig.findtext('staff','1')!=str(s):continue
   n=copy.deepcopy(orig);n.attrib.clear()
   for stem in n.findall('stem'):stem.attrib.clear()
   if n.find('chord') is not None:
    for b in list(n.findall('beam')):n.remove(b)
   for ns in n.findall('notations'):
    for a in list(ns.findall('articulations')):ns.remove(a)
   n.find('voice').text=str(s)
   # Recognition assigned the printed 8va to the wrong staff. Apply it only
   # to the right hand, including the final dotted half inside the bracket.
   if num>=24 and s==1:
    octave=n.find('pitch/octave');octave.text=str(int(octave.text)+1)
   dur=int(n.findtext('duration'));onset=prev if n.find('chord') is not None else tick
   if n.find('chord') is None:tick+=dur
   prev=onset;m.append(n);p=n.find('pitch')
   if p is None:continue
   pitch=(int(p.findtext('octave'))+1)*12+dict(C=0,D=2,E=4,F=5,G=7,A=9,B=11)[p.findtext('step')]+int(p.findtext('alter','0'))
   start=(num-1)*12+onset;key=(s,pitch);types=[t.get('type') for t in n.findall('tie')]
   if 'stop' in types:
    assert key in active and active[key]['end']==start,('tie',num,key)
    active[key]['beats']+=dur/4;active[key]['end']+=dur
    if 'start' not in types:del active[key]
   else:
    e=dict(pitch=pitch,beat=start/4,beats=dur/4,hand='right' if s==1 else 'left',end=start+dur);events.append(e)
    if 'start' in types:active[key]=e
  assert tick==12,(num,s,tick)
assert not active
# Stop the octave bracket at the final right-hand note, as in the PDF.
d=el(m,'direction',placement='above');el(el(d,'direction-type'),'octave-shift',type='stop',size='8',number='1');el(d,'staff',1)
el(el(m,'barline',location='right'),'bar-style','light-heavy')
E.indent(out);(root/'hosted/public/scores/repertoire/zeldas-lullaby.musicxml').write_text(E.tostring(out,encoding='unicode'),encoding='utf-8')
for e in events:del e['end']
ex=dict(number=7002,title=title,collection='repertoire',composer='Koji Kondo',arrangement='Torby Brand',difficulty='Easy',sourceUrl='/scores/repertoire/zeldas-lullaby.pdf',sourcePage=1,beatsPerMeasure=3,durationBeats=75,measuresPerSystem=4,right=[[] for _ in range(25)],left=[[] for _ in range(25)],polyphony=sorted(events,key=lambda n:(n['beat'],n['pitch'])),notationUrl='/scores/repertoire/zeldas-lullaby.musicxml')
(root/'hosted/data/repertoire.json').write_text(json.dumps([ex],ensure_ascii=False),encoding='utf-8')
q=lambda s:"'"+s.replace("'","''")+"'"
archive="UPDATE practice_exercises SET collection='repertoire-archived',definition=json_set(definition,'$.collection','repertoire-archived') WHERE number=7001;\n--> statement-breakpoint\n"
(root/'drizzle/0011_replace_repertoire_lullaby.sql').write_text(archive+'INSERT INTO practice_exercises (number,collection,source_number,title,source_url,source_page,definition) VALUES (7002,\'repertoire\',2,'+q(title)+','+q(ex['sourceUrl'])+',1,'+q(json.dumps(ex,ensure_ascii=False))+');\n',encoding='utf-8')
print('25 measures,',len(events),'sounding notes; octave-up ending:',[n['pitch'] for n in events if n['hand']=='right' and n['beat']>=69])
