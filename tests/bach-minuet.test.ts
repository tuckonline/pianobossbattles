import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import data from '../hosted/data/bach.json';
import {assessPractice,noteGroups,soundingNotes,type Exercise} from '../hosted/sight-library';
import {importMusicXml} from '../src/domains/notation/musicxml';

const ex=data[0] as Exercise;
const xml=readFileSync('hosted/public/scores/bach/minuet-in-g.musicxml','utf8');
const score=importMusicXml(xml);
const handBar=(bar:number,hand:'left'|'right')=>soundingNotes(ex,hand)
  .filter(n=>n.beat>=(bar-1)*3&&n.beat<bar*3)
  .map(n=>[n.pitch,n.beat-(bar-1)*3,n.beats]);

it('preserves the photograph’s melody, accidental changes and final chord',()=>{
  const firstSection=[
    [74,67,69,71,72],[74,67,67],[76,69,71,72,74],[76,67,67],
    [72,74,72,71,69],[71,72,71,69,67],[69,71,72,74,71],[69,67],
    [74,67,69,71,72],[74,67,67],[76,69,71,72,74],[76,67,67],
    [72,74,72,71,69],[71,72,71,69,67],[69,71,69,67,66],[67],
  ];
  const secondSection=[
    [83,79,81,83,79],[81,74,76,78,74],[79,76,78,79,74],
    [73,71,73,69],[69,71,73,74,76,78],[79,78,76],[78,69,73],[74],
    [74,67,66,67],[76,67,66,67],[74,72,71],[69,67,66,67,69],
    [62,64,66,67,69,71],[72,71,69],[71,74,67,66],[59,62,67],
  ];
  for(const [i,pitches] of [...firstSection,...firstSection,...secondSection,...secondSection].entries())
    expect(handBar(i+1,'right').map(n=>n[0]),`performed bar ${i+1}`).toEqual(pitches);
  // Printed C-natural in source m24, following the preceding C-sharps.
  expect(handBar(40,'left')).toEqual([[62,0,1],[50,1,1],[60,2,1]]);
});

it('keeps 3/4, both repeats, the source fingerings and independent LH voices',()=>{
  expect(score.meter).toEqual({numerator:3,denominator:4});
  expect(score.key.fifths).toBe(1);
  expect(ex.durationBeats).toBe(192);
  expect(ex.tempoBpm).toBe(66);
  expect(score.measures.map(m=>m.startTick/480)).toEqual(Array.from({length:64},(_,i)=>i*3));
  expect(handBar(1,'left')).toEqual([[55,0,2],[59,0,2],[62,0,2],[57,2,1]]);
  expect(handBar(7,'left').map(n=>n[0])).toEqual([62,59,55]);
  expect(handBar(8,'left').map(n=>n[0])).toEqual([62,50,60,59,57]);
  expect(handBar(41,'left')).toEqual([[59,0,2],[62,1,2],[59,2,1]]);
  expect(handBar(42,'left')).toEqual([[60,0,2],[64,1,2],[60,2,1]]);
  expect(handBar(45,'left')).toEqual([[50,0,3],[55,2,1]]);
  expect(xml.match(/<fingering /g)).toHaveLength(92);
  expect(xml.match(/<accidental>sharp<\/accidental>/g)).toHaveLength(8);
  expect(xml.match(/<beam number="1">begin<\/beam>/g)?.length).toBe(44);
  for(const first of [1,33]) for(let i=0;i<16;i++) for(const hand of ['left','right'] as const)
    expect(handBar(first+i,hand)).toEqual(handBar(first+i+16,hand));
});

it('delays a principal chord equally after an explicitly timed grace note',()=>{
  const parsed=importMusicXml(`<score-partwise><part id="P1"><measure number="1"><attributes><divisions>4</divisions></attributes>
    <note><grace steal-time-following="25"/><pitch><step>D</step><octave>4</octave></pitch><voice>1</voice><type>eighth</type></note>
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
    <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
    <note><rest/><duration>8</duration></note></measure><measure number="2"><note><pitch><step>G</step><octave>4</octave></pitch><duration>12</duration></note></measure></part></score-partwise>`);
  expect(parsed.notes.map(n=>[n.midiPitch,n.onsetTick,n.durationTicks])).toEqual([
    [62,0,120],[60,120,360],[64,120,360],[67,1440,1440],
  ]);
});

it('aligns every engraved note with MIDI, including the grace note without moving LH or the barline',()=>{
  expect(handBar(8,'right')).toEqual([[69,0,.25],[67,.25,2.75]]);
  const printed=score.notes.map(n=>[n.midiPitch,n.onsetTick/480,n.durationTicks/480]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
  expect(printed).toEqual(soundingNotes(ex).map(n=>[n.pitch,n.beat,n.beats]));
  // At 60 quarter-note BPM, the eighth notes are half a second.
  expect(handBar(1,'right').map(n=>n[2]*60000/60)).toEqual([1000,500,500,500,500]);
});

it('grades all hand modes, rejects incomplete performances and counts wrong notes',()=>{
  for(const hand of ['right','left','both'] as const) {
    const notes=noteGroups(ex,hand).flatMap(g=>g.pitches);
    expect(assessPractice(ex,hand,notes)).toMatchObject({complete:true,accuracy:100,mistakes:0});
    expect(assessPractice(ex,hand,notes.slice(0,-1)).complete).toBe(false);
    expect(assessPractice(ex,hand,[127,...notes]).mistakes).toBe(1);
  }
});
