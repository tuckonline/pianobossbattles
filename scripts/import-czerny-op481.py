from pathlib import Path
import json,xml.etree.ElementTree as E,shutil
root=Path(__file__).resolve().parents[1]
source='https://pianoexercises.org/exercises/czerny/czerny-50-practice-pieces-for-beginners-op-481.pdf'
out=root/'hosted/public/scores/czerny-op481';out.mkdir(parents=True,exist_ok=True)
steps={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
def el(parent,name,text=None,**attrs):
 node=E.SubElement(parent,name,attrs)
 if text is not None:node.text=str(text)
 return node
library=[]
for piece in json.loads((root/'source-scores/czerny-op481/transcription.json').read_text(encoding='utf-8')):
 n=piece['number'];xml=E.Element('score-partwise',version='4.0')
 el(el(xml,'work'),'work-title',f'Czerny Op. 481 - No. {n}')
 el(el(xml,'identification'),'creator','Carl Czerny',type='composer')
 partdef=el(el(xml,'part-list'),'score-part',id='P1');el(partdef,'part-name','Piano')
 part=el(xml,'part',id='P1');events=[];barindex=0;printed=[]
 for start,end in piece['sections']:
  for repeat in range(2):
   for original in range(start,end):
    printed.append(original+1);m=el(part,'measure',number=str(barindex+1))
    if barindex%4==0:el(m,'print',**{'new-system':'yes'})
    if barindex==0:
     attr=el(m,'attributes');el(attr,'divisions',4);el(el(attr,'key'),'fifths',0)
     time=el(attr,'time');el(time,'beats',4);el(time,'beat-type',4);el(attr,'staves',2)
     for staff in (1,2):
      c=el(attr,'clef',number=str(staff));el(c,'sign','G');el(c,'line',2)
     el(el(el(m,'direction',placement='above'),'direction-type'),'words',piece['tempo'])
    for staff,hand in [(1,'right'),(2,'left')]:
     if staff==2:el(el(m,'backup'),'duration',16)
     beat=0
     for token in piece[hand][original].split():
      vals=token.split(':');pitches=vals[0].split('+');beats=int(vals[1]);fingers=vals[2].split('+') if len(vals)>2 else []
      for i,pitch in enumerate(pitches):
       node=el(m,'note')
       if i:el(node,'chord')
       pn=el(node,'pitch');el(pn,'step',pitch[0]);el(pn,'octave',pitch[1])
       el(node,'duration',beats*4);el(node,'voice',staff);el(node,'type',{1:'quarter',2:'half',4:'whole'}[beats]);el(node,'staff',staff)
       if i<len(fingers) and fingers[i]!='-':el(el(el(node,'notations'),'technical'),'fingering',fingers[i],placement='above' if staff==1 else 'below')
       events.append(dict(pitch=(int(pitch[1])+1)*12+steps[pitch[0]],beat=barindex*4+beat,beats=beats,hand=hand))
      beat+=beats
     assert beat==4,(n,original+1,hand,beat)
    barindex+=1
 el(el(m,'barline',location='right'),'bar-style','light-heavy')
 E.indent(xml)
 (out/f'{n:02}.musicxml').write_text('<?xml version="1.0" encoding="utf-8"?>\n'+E.tostring(xml,encoding='unicode'),encoding='utf-8')
 library.append(dict(number=6000+n,title=f'Czerny Op. 481 · No. {n}',collection='czerny-op481',sourcePage=2,sourceUrl=source,beatsPerMeasure=4,durationBeats=barindex*4,measuresPerSystem=4,right=[[] for _ in printed],left=[[] for _ in printed],polyphony=sorted(events,key=lambda x:(x['beat'],x['pitch'],x['hand'])),notationUrl=f'/scores/czerny-op481/{n:02}.musicxml'))
(root/'hosted/data/czerny-op481.json').write_text(json.dumps(library,separators=(',',':'),ensure_ascii=False),encoding='utf-8')
quote=lambda x:"'"+x.replace("'","''")+"'"
sql=[]
for ex in library:
 vals=[str(ex['number']),quote(ex['collection']),str(ex['number']-6000),quote(ex['title']),quote(source),'2',quote(json.dumps(ex,separators=(',',':'),ensure_ascii=False))]
 sql.append('INSERT INTO practice_exercises (number,collection,source_number,title,source_url,source_page,definition) VALUES ('+','.join(vals)+');')
(root/'drizzle/0009_czerny_op481_selection.sql').write_text('-- Manually checked Op. 481 selection: original Nos. 1 and 2.\n'+'\n--> statement-breakpoint\n'.join(sql)+'\n',encoding='utf-8')
print([(e['number'],len(e['right']),len(e['polyphony'])) for e in library])
