import {expect,it} from 'vitest';
import {XMLParser} from 'fast-xml-parser';
import {moonlightRange,moonlightRangeByNumber} from '../hosted/moonlight-range';
import {moonlightLibrary} from '../hosted/moonlight-library';
import {assessPractice,noteGroups,soundingNotes} from '../hosted/sight-library';
import {importMusicXml} from '../src/domains/notation/musicxml';
import {collectionProgress,deriveProgress} from '../hosted/collection-progress';

const full=moonlightLibrary.at(-1)!;
const source=importMusicXml(full.notationXml!);
const signature=(notes:{midiPitch:number;onsetTick:number;durationTicks:number;voice:string}[])=>notes.map(n=>[n.midiPitch,n.onsetTick,n.durationTicks,n.voice].join(':')).sort();

it('preserves every written pitch, rhythm, voice and original bar number in selected ranges',()=>{
  for(const [start,end] of [[1,3],[17,25],[5,6],[64,69]]) {
    const range=moonlightRange(start,end),score=importMusicXml(range.notationXml!);
    expect(range.sourceMeasures).toEqual([start,end]);
    expect(range.durationBeats).toBe((end-start+1)*4);
    expect(score.key.fifths).toBe(4);
    expect(score.meter).toEqual({numerator:2,denominator:2});
    expect(signature(score.notes)).toEqual(signature(source.notes.filter(n=>n.measure>=start&&n.measure<=end).map(n=>({...n,onsetTick:n.onsetTick-(start-1)*1920}))));
    const xml=new XMLParser({ignoreAttributes:false}).parse(range.notationXml!)['score-partwise'];
    expect(xml.part.measure.map((m:{'@_number':string})=>Number(m['@_number']))).toEqual(Array.from({length:end-start+1},(_,i)=>start+i));
  }
});

it('supports every single measure with clipped held notes and complete grading in each hand',()=>{
  for(let measure=1;measure<=69;measure++) {
    const range=moonlightRange(measure,measure);
    const score=importMusicXml(range.notationXml!);
    expect(score.measures).toHaveLength(1);
    type PrintedNote={pitch?:unknown;tie?:{'@_type':string}|{'@_type':string}[];'@_data-pianopath-hand':string};
    const printed=(new XMLParser({ignoreAttributes:false}).parse(range.notationXml!)['score-partwise'].part.measure.note as PrintedNote[]).filter(n=>n.pitch);
    const attacks=printed.flatMap((note,i)=>{
      const ties=Array.isArray(note.tie)?note.tie:note.tie?[note.tie]:[];
      const n=score.notes[i];
      return ties.some(t=>t['@_type']==='stop')?[]:[`${n.onsetTick}:${n.midiPitch}:${note['@_data-pianopath-hand']}`];
    });
    expect(soundingNotes(range).map(n=>`${Math.round(n.beat*480)}:${n.pitch}:${n.hand}`).sort()).toEqual([...new Set(attacks)].sort());
    for(const hand of ['right','left','both'] as const) {
      const groups=noteGroups(range,hand);
      expect(groups.length).toBeGreaterThan(0);
      expect(groups[0].beat).toBeGreaterThanOrEqual(0);
      const pitches=groups.flatMap(g=>g.pitches);
      expect(assessPractice(range,hand,pitches)).toMatchObject({complete:true,accuracy:100});
      for(const n of soundingNotes(range,hand)) {
        expect(n.beats).toBeGreaterThan(1e-6);
        expect(n.beat+n.beats).toBeLessThanOrEqual(4+1e-8);
      }
    }
    // Every tie left in the excerpt has a start and a stop inside it.
    const ties=[...range.notationXml!.matchAll(/<tie type="(start|stop)"/g)].map(m=>m[1]);
    expect(ties.filter(t=>t==='start')).toHaveLength(ties.filter(t=>t==='stop').length);
  }
});

it('re-attacks tied notes at a cut, but keeps ties within a longer passage',()=>{
  const held=full.polyphony!.find(n=>n.beat+n.beats>(Math.floor(n.beat/4)+1)*4)!;
  expect(held).toBeDefined();
  const measure=Math.floor(held.beat/4)+2;
  const single=moonlightRange(measure,measure);
  expect(noteGroups(single,held.hand)[0].pitches).toContain(held.pitch);
  const paired=moonlightRange(measure-1,measure);
  expect(paired.notationXml).toContain('<tie type="start"');
  expect(paired.notationXml).toContain('<tie type="stop"');
  expect(noteGroups(paired,held.hand).find(g=>g.beat===4)?.pitches??[]).not.toContain(held.pitch);
});

it('validates boundaries and keeps partial results out of the 33-step progress',()=>{
  for(const range of [[0,3],[3,2],[1,70],[1.5,3],[NaN,3]]) expect(()=>moonlightRange(...range as [number,number])).toThrow();
  const range=moonlightRange(17,25);
  expect(moonlightRangeByNumber(range.number)?.sourceMeasures).toEqual([17,25]);
  for(const n of [1,9007,100000,100169,101070,106970,1000000,NaN]) expect(moonlightRangeByNumber(n)).toBeUndefined();
  expect(moonlightRange(1,69)).toBe(full);
  const progress=deriveProgress([{exerciseNumber:range.number,hand:'both',accuracy:100,createdAt:new Date().toISOString()}]);
  expect(collectionProgress(moonlightLibrary,progress)).toMatchObject({learning:0,mastered:0,notStarted:33});
});
