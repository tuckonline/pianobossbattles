import {expect,it} from 'vitest';
import data from '../source-scores/repertoire/title-theme-events.json';
import {noteGroups,assessPractice,soundingNotes,type Exercise} from '../hosted/sight-library';
const ex=data[0] as Exercise;
it('grades the entire 49-bar piece in each hand mode',()=>{
 expect(ex.right).toHaveLength(49);expect(ex.durationBeats).toBe(196);
 for(const hand of ['right','left','both'] as const){
  const played=noteGroups(ex,hand).flatMap(g=>g.pitches);
  expect(assessPractice(ex,hand,played)).toMatchObject({complete:true,accuracy:100});
  expect(assessPractice(ex,hand,played.slice(0,-1)).complete).toBe(false);
  expect(assessPractice(ex,hand,[1,1,1,1,1,1,1,1,1,1,...played]).accuracy).toBeLessThan(100);
 }
});
it('preserves triplets, rests, missing whole notes and final ties',()=>{
 const notes=soundingNotes(ex);
 expect(notes.find(n=>n.hand==='left'&&n.beat===0)).toMatchObject({pitch:41,beats:4});
 expect(notes.filter(n=>n.hand==='right'&&n.beat===2/3)).toHaveLength(4);
 expect(notes.find(n=>n.pitch===83&&n.beat===44)).toMatchObject({beats:4});
 expect(notes.filter(n=>n.beat===192)).toHaveLength(0);
 expect(notes.filter(n=>n.hand==='right'&&n.beat>188&&n.beat<189)).toHaveLength(5);
 expect(notes.some(n=>n.beats===1/3)).toBe(true);
 expect(Math.max(...notes.map(n=>n.beat+n.beats))).toBe(196);
});

