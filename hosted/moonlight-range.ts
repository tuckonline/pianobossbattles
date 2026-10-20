import {XMLBuilder, XMLParser} from 'fast-xml-parser';
import {importMusicXml} from '../src/domains/notation/musicxml';
import {moonlightLibrary, type MoonlightLesson} from './moonlight-library';

export type MoonlightRange = readonly [number, number];
export const MOONLIGHT_MEASURES = 69;
// Stable, reserved IDs keep range attempts in the existing attempt table without
// awarding completion of lesson 33 or adding thousands of catalogue exercises.
const RANGE_ID_BASE = 100000;
const full = moonlightLibrary[moonlightLibrary.length - 1];
type XmlNode = { [tag: string]: XmlNode[] | Record<string, string> | string | number };
const children = (node: XmlNode, tag: string) => (node[tag] ?? []) as XmlNode[];
const attr = (node: XmlNode, key: string) => (node[':@'] as Record<string,string> | undefined)?.[`@_${key}`];
const value = (nodes: XmlNode[], tag: string) => children(nodes.find(n=>tag in n) ?? {},tag)[0]?.['#text'];
const builder = new XMLBuilder({preserveOrder:true,ignoreAttributes:false});
let source: XmlNode[] | undefined;
const cache = new Map<number,MoonlightLesson>();

export function validateMoonlightRange(start:number,end:number): void {
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end>MOONLIGHT_MEASURES||start>end)
    throw new Error('Choose whole measure numbers from 1 to 69, with the end at or after the start.');
}

function excerptXml(start:number,end:number,title:string) {
  source ??= new XMLParser({preserveOrder:true,ignoreAttributes:false}).parse(full.notationXml!) as XmlNode[];
  const root=structuredClone(source);
  const score=children(root.find(n=>'score-partwise' in n)!,'score-partwise');
  const part=score.find(n=>'part' in n)!;
  const original=children(part,'part').filter(n=>'measure' in n);
  const measures=original.slice(start-1,end);
  part.part=measures;
  const work=score.find(n=>'work' in n)!;
  work.work=[{'work-title':[{'#text':title}]}];
  if(start>1) children(measures[0],'measure').unshift(structuredClone(children(original[0],'measure').find(n=>'attributes' in n)!));
  // Responsive layout decides line breaks. The source measure numbers stay intact.
  for(const m of measures) m.measure=children(m,'measure').filter(n=>!('print' in n));

  const pitched=measures.flatMap(m=>children(m,'measure').filter(n=>'note' in n && children(n,'note').some(c=>'pitch' in c)));
  const imported=importMusicXml(builder.build(root));
  const rows=pitched.map((node,i)=>({node,...imported.notes[i]})).sort((a,b)=>a.onsetTick-b.onsetTick);
  const open=new Map<string,typeof rows[number]>(), keepStart=new Set<XmlNode>(), keepStop=new Set<XmlNode>();
  for(const row of rows) {
    const notes=children(row.node,'note');
    const key=`${attr(row.node,'data-pianopath-hand')}:${row.midiPitch}`;
    const prior=open.get(key);
    if(notes.some(n=>'tie' in n&&attr(n,'type')==='stop') && prior && prior.onsetTick+prior.durationTicks===row.onsetTick) {
      keepStart.add(prior.node);keepStop.add(row.node);
    }
    if(notes.some(n=>'tie' in n&&attr(n,'type')==='start')) open.set(key,row);
    else open.delete(key);
  }
  for(const row of rows) {
    const keep=(n:XmlNode)=>!('tie' in n||'tied' in n)||(attr(n,'type')==='start'?keepStart:keepStop).has(row.node);
    row.node.note=children(row.node,'note').filter(keep);
    const notations=children(row.node,'note').find(n=>'notations' in n);
    if(notations) notations.notations=children(notations,'notations').filter(keep);
  }
  // A newly attacked note at the cut may have inherited an accidental through
  // a tie. Make that pitch visible now that its preceding measure is absent.
  const accidentalState=new Map<string,number>();
  for(const row of rows) {
    const notes=children(row.node,'note'), pitch=children(notes.find(n=>'pitch' in n)!,'pitch');
    const step=String(value(pitch,'step')), alteration=Number(value(pitch,'alter')??0);
    const key=`${row.measure}:${value(notes,'staff')}:${step}:${value(pitch,'octave')}`;
    const previous=accidentalState.get(key)??('CDFG'.includes(step)?1:0);
    if(!keepStop.has(row.node)&&alteration!==previous&&!notes.some(n=>'accidental' in n)) {
      let index=notes.findIndex(n=>'type' in n)+1;
      while(notes[index]&&'dot' in notes[index]) index++;
      notes.splice(index,0,{accidental:[{'#text':({'-2':'flat-flat','-1':'flat',0:'natural',1:'sharp',2:'double-sharp'} as Record<number,string>)[alteration]}]});
    }
    accidentalState.set(key,alteration);
  }
  // Remove phrasing connectors whose other end lies outside the excerpt.
  for(const tag of ['slur','wedge']) {
    const pending=new Map<string,XmlNode>(), paired=new Set<XmlNode>();
    const visit=(nodes:XmlNode[],fn:(n:XmlNode)=>void)=>{
      for(const n of nodes) {if(tag in n) fn(n);for(const [key,list] of Object.entries(n)) if(key!==':@'&&Array.isArray(list))visit(list,fn);}
    };
    visit(measures,n=>{
      const id=attr(n,'number')??'1', type=attr(n,'type');
      if(['start','crescendo','diminuendo'].includes(type??'')) pending.set(id,n);
      else if(type==='stop'&&pending.has(id)) {paired.add(pending.get(id)!);paired.add(n);pending.delete(id);}
    });
    const prune=(nodes:XmlNode[]):XmlNode[]=>nodes.filter(n=>!(tag in n)||paired.has(n)).map(n=>{
      for(const [key,list] of Object.entries(n)) if(key!==':@'&&Array.isArray(list)) n[key]=prune(list);
      return n;
    });
    prune(measures);
  }
  return builder.build(root) as string;
}

export function moonlightRange(start:number,end:number):MoonlightLesson {
  validateMoonlightRange(start,end);
  if(start===1&&end===MOONLIGHT_MEASURES) return full;
  const number=RANGE_ID_BASE+start*100+end;
  const saved=cache.get(number);if(saved) return saved;
  const title=`Moonlight Sonata · ${start===end?`measure ${start}`:`measures ${start}–${end}`}`;
  const firstBeat=(start-1)*4, lastBeat=end*4;
  const exercise:MoonlightLesson={...full,number,title,courseStage:'Custom passage',sourceMeasures:[start,end],
    right:full.right.slice(start-1,end),left:full.left.slice(start-1,end),durationBeats:lastBeat-firstBeat,
    polyphony:full.polyphony!.filter(n=>n.beat<lastBeat&&n.beat+n.beats>firstBeat).map(n=>({...n,
      beat:Math.max(firstBeat,n.beat)-firstBeat,beats:Math.min(lastBeat,n.beat+n.beats)-Math.max(firstBeat,n.beat)})),
    notationXml:excerptXml(start,end,title),
    description:'A custom passage from the original first movement. Printed measure numbers match your PDF.',
    learningFocus:`Practice ${start===end?`measure ${start}`:`measures ${start}–${end}`} at your own pace.`,
    practiceTip:'Notes tied into the first measure are played once at the start. Ties inside the passage continue without another key press. Results are saved for this range, separately from the learning path.',
    sourceUrl:`/scores/moonlight/Moonlight_Urtext.pdf#page=${start<=15?4:start<=33?5:start<=51?6:7}`,
  };
  if(cache.size>=8) cache.delete(cache.keys().next().value!);
  cache.set(number,exercise);return exercise;
}

export function moonlightRangeByNumber(number:number):MoonlightLesson|undefined {
  const encoded=number-RANGE_ID_BASE,start=Math.floor(encoded/100),end=encoded%100;
  if(!Number.isInteger(number)||start<1||end<start||end>MOONLIGHT_MEASURES||start===1&&end===69) return undefined;
  return moonlightRange(start,end);
}
