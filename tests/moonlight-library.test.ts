import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {moonlightLibrary} from '../hosted/moonlight-library';
import {assessPractice,noteGroups,soundingNotes} from '../hosted/sight-library';
import {importMusicXml} from '../src/domains/notation/musicxml';
import {XMLParser} from 'fast-xml-parser';

const source=importMusicXml(readFileSync(new URL('../scripts/sources/moonlight/urtext-export.musicxml',import.meta.url),'utf8').replace(/<!DOCTYPE[^>]*>/g,''));
const compare=(notes:{midiPitch:number;onsetTick:number;durationTicks:number;voice:string}[],offset=0)=>notes.map(n=>[n.midiPitch,n.onsetTick-offset,n.durationTicks,n.voice].join(':')).sort();

it('prints the chromatic accidentals that distinguish exercise 7 MIDI targets',()=>{
  const lesson=moonlightLibrary.find(e=>e.number===9007)!;
  type StudyNote={staff:number;pitch:{step:string;alter?:number;octave:number};accidental?:string};
  const measures=new XMLParser().parse(lesson.notationXml!)['score-partwise'].part.measure as {note:StudyNote[]}[];
  const right=measures.flatMap(m=>m.note.filter(n=>n.staff===1));
  expect(right.filter(n=>n.accidental).map(n=>[n.pitch.step,n.pitch.alter,n.pitch.octave,n.accidental]))
    .toEqual([['E',1,4,'sharp'],['F',2,4,'double-sharp'],['B',1,3,'sharp']]);
  const expected=[63,64,65,66,66,67,68,69,59,60,61,63,64,63,61];
  expect(importMusicXml(lesson.notationXml!).notes.filter(n=>n.voice==='1').map(n=>n.midiPitch)).toEqual(expected);
  expect(noteGroups(lesson,'right').flatMap(g=>g.pitches)).toEqual(expected);
});

it('ends in the exact 69-measure original movement, excluding commentary examples',()=>{
  const full=moonlightLibrary.at(-1)!;
  expect(full.number).toBe(9033);
  expect(full.sourceMeasures).toEqual([1,69]);
  expect(full.durationBeats).toBe(276);
  const printed=importMusicXml(full.notationXml!);
  expect(printed.measures).toHaveLength(69);
  expect(printed.meter).toEqual({numerator:2,denominator:2});
  expect(compare(printed.notes)).toEqual(compare(source.notes.filter(n=>n.measure<=69)));
  expect(printed.notes).toHaveLength(1182);
  expect(full.polyphony).toHaveLength(1144); // tied continuations and unison heads do not need extra attacks
  expect(noteGroups(full,'both')[0].pitches).toEqual([37,49,56]);
  expect(noteGroups(full,'both').at(-1)?.pitches).toEqual([37,44,49,52,56,61]);
});

it('covers every original measure in short passages and preserves excerpt pitches and timing',()=>{
  expect(moonlightLibrary.map(e=>e.number)).toEqual(Array.from({length:33},(_,i)=>9001+i));
  const passages=moonlightLibrary.filter(e=>e.courseStage==='Short passages');
  expect(passages.flatMap(e=>Array.from({length:e.sourceMeasures![1]-e.sourceMeasures![0]+1},(_,i)=>i+e.sourceMeasures![0])))
    .toEqual(Array.from({length:69},(_,i)=>i+1));
  for(const e of moonlightLibrary.filter(e=>e.courseStage==='Short passages'||e.courseStage==='Connect')) {
    const [start,end]=e.sourceMeasures!;
    const score=importMusicXml(e.notationXml!);
    expect(compare(score.notes)).toEqual(compare(source.notes.filter(n=>n.measure>=start&&n.measure<=end),(start-1)*1920));
    expect(score.measures).toHaveLength(end-start+1);
    expect(e.notationXml).toContain(`number="${start}"`);
  }
});

it('uses real triplet timing and keeps dotted melody onsets separate',()=>{
  const full=moonlightLibrary.at(-1)!;
  const first=soundingNotes(full,'right').slice(0,3);
  expect(first.map(n=>n.pitch)).toEqual([56,61,64]);
  expect(first.map(n=>n.beat)).toEqual([0,1/3,2/3]);
  expect(first.every(n=>n.beats===1/3)).toBe(true);
  expect(soundingNotes(full,'right').filter(n=>n.pitch===68&&n.beat>=19&&n.beat<20).map(n=>[n.beat,n.beats]))
    .toEqual([[19,0.75],[19.75,0.25]]);
  expect(full.notationXml).toContain('data-pianopath-hand="right"');
  expect(soundingNotes(full,'right').find(n=>n.beat===16&&n.pitch===52)).toBeDefined(); // RH printed in bass staff
});

it('grades every lesson in all hand modes with no duplicate key attacks or overrun',()=>{
  for(const e of moonlightLibrary) {
    expect(e.right.length).toBe(e.left.length);
    expect(e.durationBeats).toBe(e.right.length*4);
    for(const n of soundingNotes(e)) {
      expect(n.beats).toBeGreaterThan(0);
      expect(n.beat+n.beats).toBeLessThanOrEqual(e.durationBeats!+1e-8);
    }
    for(const hand of ['right','left','both'] as const) {
      const groups=noteGroups(e,hand);
      expect(groups.length).toBeGreaterThan(0);
      for(const group of groups) expect(new Set(group.pitches).size).toBe(group.pitches.length);
      const played=groups.flatMap(g=>g.pitches);
      expect(assessPractice(e,hand,played)).toMatchObject({complete:true,accuracy:100,mistakes:0});
      expect(assessPractice(e,hand,[127,...played])).toMatchObject({complete:true,mistakes:1});
    }
  }
});
