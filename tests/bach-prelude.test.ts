import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import data from '../hosted/data/repertoire.json';
import {assessPractice,noteGroups,soundingNotes,type Exercise} from '../hosted/sight-library';
import {importMusicXml} from '../src/domains/notation/musicxml';
const ex=data.find(e=>e.number===7005)! as Exercise;
const xml=readFileSync('hosted/public/scores/repertoire/bach-prelude-bwv924.musicxml','utf8');
const score=importMusicXml(xml);
const pitches=(m:number,hand:'right'|'left')=>soundingNotes(ex,hand).filter(n=>n.beat>=(m-1)*4&&n.beat<m*4).map(n=>n.pitch);
it('contains exactly 18 complete bars and preserves main notes, rests and chromatic spelling',()=>{
  expect(ex.durationBeats).toBe(72);expect(ex.tempoBpm).toBe(69);
  expect(score.meter).toEqual({numerator:4,denominator:4});
  expect(score.measures.map(m=>m.startTick/480)).toEqual(Array.from({length:18},(_,i)=>i*4));
  expect(pitches(1,'right')).toEqual([67,72,76,67,72,76,67,72,74,71,74,79]);
  expect(pitches(2,'right')).toEqual([69,74,79,69,74,77,69,74,76,72,76,81]);
  expect(pitches(3,'left')).toEqual([52,64,57,59]);
  expect(pitches(4,'left')).toEqual([60,52,54,56]);
  expect(pitches(5,'right')).toContain(70); // B-flat, cancelled in bar 6.
  expect(pitches(5,'right').at(-1)).toBe(70); // Same-bar accidental still applies.
  expect(pitches(6,'right')).toContain(71);
  expect(pitches(7,'right')).toContain(66);expect(pitches(8,'right')).toContain(65);
  expect(pitches(11,'right')).toEqual([76,84,79,77,76,84,79,76,74,84,77,76,74,83,77,74]);
  expect(pitches(12,'right')).toEqual([72,83,76,74,72,81,76,72,71,81,74,72,71,79,74,71]);
  expect(pitches(16,'right')).toEqual([67,64,65,74,72,71,69,67,77,74,75,72,66,75,74,72]);
  expect(noteGroups(ex,'right').slice(0,4).map(g=>g.beat)).toEqual([.25,.5,.75,1.25]);
});
it('retains cross-hand passage, two RH voices, final chord and 28-beat tied G octave',()=>{
  expect(pitches(9,'left')).toEqual([55,43,47,50]);
  expect(pitches(9,'right')).toEqual([59,62,65,53,55,59,62]);
  expect(pitches(10,'left')).toEqual([55,59,62,67,71,74]);
  expect(pitches(10,'right')).toEqual([59,65,67,71,74,71,77,79,83,77]);
  expect(soundingNotes(ex,'right').find(n=>n.beat>=36)?.beat).toBe(36);
  expect(soundingNotes(ex,'left').filter(n=>n.beat>=40&&n.beat<68)).toEqual([
    {pitch:43,beat:40,beats:28,hand:'left'}, {pitch:55,beat:40,beats:28,hand:'left'},
  ]);
  expect(noteGroups(ex,'right').filter(g=>g.beat>=67&&g.beat<68)).toEqual([
    {beat:67,pitches:[62]}, {beat:67.25,pitches:[72]}, {beat:67.5,pitches:[65]}, {beat:67.75,pitches:[71]},
  ]);
  expect(noteGroups(ex,'both').at(-1)).toEqual({beat:68,pitches:[36,48,64,67,72]});
});
it('engraved notes and sounded main-note events agree, including tied intervals',()=>{
  const notes=soundingNotes(ex);
  for(const n of score.notes) expect(notes.some(s=>s.pitch===n.midiPitch&&s.beat<=n.onsetTick/480&&s.beat+s.beats>=(n.onsetTick+n.durationTicks)/480)).toBe(true);
  for(const n of notes) expect(score.notes.some(p=>p.midiPitch===n.pitch&&p.onsetTick/480===n.beat)).toBe(true);
  expect(xml.match(/<fingering /g)!.length).toBe(79);
  expect(xml).toContain('<mordent');expect(xml).toContain('<inverted-mordent');
  expect(xml).toContain('<fermata');expect(xml).toContain('<arpeggiate');
  for(const hand of ['right','left','both'] as const){
    const played=noteGroups(ex,hand).flatMap(g=>g.pitches);
    expect(assessPractice(ex,hand,played)).toMatchObject({complete:true,accuracy:100,mistakes:0});
    expect(assessPractice(ex,hand,played.slice(0,-1)).complete).toBe(false);
    expect(assessPractice(ex,hand,[127,...played]).mistakes).toBe(1);
  }
});

