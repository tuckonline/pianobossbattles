import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import data from '../hosted/data/repertoire.json';
import {assessPractice,noteGroups,soundingNotes,type Exercise} from '../hosted/sight-library';
import {importMusicXml} from '../src/domains/notation/musicxml';

const ex=data.find(e=>e.number===7004)! as Exercise;
const xml=readFileSync('hosted/public/scores/repertoire/pop-goes-the-weasel.musicxml','utf8');
const printed=importMusicXml(xml);

it('preserves the photographed melody, quarter rests and 16 full 3/4 bars',()=>{
  expect(printed.meter).toEqual({numerator:3,denominator:4});
  expect(printed.measures.map(m=>m.startTick/480)).toEqual(Array.from({length:16},(_,i)=>i*3));
  expect(ex.durationBeats).toBe(48);
  expect(ex.tempoBpm).toBe(60);
  expect(soundingNotes(ex,'right').map(n=>[n.beat,n.pitch,n.beats])).toEqual([
    [0,60,1],[2,60,1],[3,62,1],[5,62,1],[6,64,1],[7,67,1],[8,64,1],[9,60,1],
    [12,60,1],[14,60,1],[15,62,1],[17,62,1],[18,64,3],[21,60,1],
    [24,60,1],[26,60,1],[27,62,1],[29,62,1],[30,64,1],[31,67,1],[32,64,1],[33,60,1],
    [39,62,2],[41,65,1],[42,64,3],[45,60,1],
  ]);
});

it('holds LH ties across barlines without reattacks and assigns the treble Pop chord to LH',()=>{
  for(const beat of [6,18,30,42]) {
    expect(soundingNotes(ex,'left').filter(n=>n.beat===beat).map(n=>[n.pitch,n.beats]))
      .toEqual([[48,4],[52,4],[55,4]]);
    expect(soundingNotes(ex,'left').some(n=>n.beat===beat+3)).toBe(false);
  }
  expect(noteGroups(ex,'left').find(n=>n.beat===36)?.pitches).toEqual([68,69]);
  expect(noteGroups(ex,'right').some(n=>n.beat===36)).toBe(false);
  expect(printed.notes.filter(n=>n.measure===13).map(n=>n.midiPitch)).toEqual([68,69]);
  expect(xml).toContain('LH over');
  expect(xml.match(/<fingering /g)).toHaveLength(11);
  // Compare each engraved note with its corresponding sounding interval, including tie ends.
  for(const n of printed.notes) {
    expect(soundingNotes(ex).some(s=>s.pitch===n.midiPitch&&s.beat<=n.onsetTick/480&&s.beat+s.beats>=(n.onsetTick+n.durationTicks)/480)).toBe(true);
  }
});

it('grades all hand modes, rejects an incomplete sequence and records wrong notes',()=>{
  for(const hand of ['right','left','both'] as const) {
    const notes=noteGroups(ex,hand).flatMap(g=>g.pitches);
    expect(assessPractice(ex,hand,notes)).toMatchObject({complete:true,accuracy:100,mistakes:0});
    expect(assessPractice(ex,hand,notes.slice(0,-1)).complete).toBe(false);
    expect(assessPractice(ex,hand,[127,...notes]).mistakes).toBe(1);
  }
});
