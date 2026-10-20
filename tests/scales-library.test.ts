import {expect,it} from 'vitest';
import {scalesLibrary} from '../hosted/scales-library';
import {musicXml,soundingNotes,noteGroups,assessPractice} from '../hosted/sight-library';
import {importMusicXml} from '../src/domains/notation/musicxml';

it('provides eight complete C-major studies with matching score and MIDI',()=>{
  expect(scalesLibrary.map(e=>e.number)).toEqual([11001,11002,11003,11004,11005,11006,11007,11008]);
  for(const e of scalesLibrary){
    for(const bars of [e.right,e.left]) for(const bar of bars){
      expect(bar.reduce((s,n)=>s+n.beats,0)).toBe(4);
      for(const n of bar){expect([0,2,4,5,7,9,11]).toContain(n.pitch%12);expect(n.finger).toBeGreaterThanOrEqual(1);expect(n.finger).toBeLessThanOrEqual(5);}
    }
    const rows=(a:number[][])=>a.sort((x,y)=>x[0]-y[0]||x[1]-y[1]);
    expect(rows(importMusicXml(musicXml(e)).notes.map(n=>[n.onsetTick,n.midiPitch,n.durationTicks])))
      .toEqual(rows(soundingNotes(e).map(n=>[n.beat*480,n.pitch,n.beats*480])));
    for(const hand of ['right','left','both'] as const){
      const notes=noteGroups(e,hand).flatMap(g=>g.pitches);
      expect(assessPractice(e,hand,notes)).toMatchObject({complete:true,accuracy:100});
      expect(assessPractice(e,hand,[61,...notes])).toMatchObject({complete:true,mistakes:1});
      expect(assessPractice(e,hand,notes.slice(0,-1)).complete).toBe(false);
    }
  }
});
it('uses standard octave fingering, contrary motion and two-octave crossings',()=>{
  const ascent=scalesLibrary[3];
  expect(ascent.right.flat().map(n=>n.pitch)).toEqual([60,62,64,65,67,69,71,72]);
  expect(ascent.right.flat().map(n=>n.finger)).toEqual([1,2,3,1,2,3,4,5]);
  expect(ascent.left.flat().map(n=>n.finger)).toEqual([5,4,3,2,1,3,2,1]);
  expect(scalesLibrary[6].left.flat().map(n=>n.pitch)).toEqual([48,47,45,43,41,40,38,36,38,40,41,43,45,47,48]);
  const extension=scalesLibrary[7];
  expect(extension.right.flat()).toHaveLength(29);
  expect(extension.right.flat()[14].pitch).toBe(84);
  expect(extension.right.flat()[7]).toMatchObject({pitch:72,finger:1});
  expect(extension.left.flat()[8]).toMatchObject({pitch:62,finger:4});
});
