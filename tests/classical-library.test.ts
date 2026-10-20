import { expect, it } from "vitest";
import { classicalLibrary, classicalStages } from "../hosted/classical-library";
import { assessPractice, musicXml, noteGroups, soundingNotes } from "../hosted/sight-library";
import { importMusicXml } from "../src/domains/notation/musicxml";

const study=(number:number)=>classicalLibrary.find(e=>e.number===number)!;
it("provides 48 complete studies with matching notation, rests and MIDI timing", () => {
  expect(classicalLibrary.map(e => e.number).sort((a,b)=>a-b)).toEqual(Array.from({length:48},(_,i)=>8001+i));
  for (const e of classicalLibrary) {
    if(e.number<=8024) expect(e.right).toHaveLength([8012,8024].includes(e.number) ? 16 : e.number >= 8013 && e.number <= 8019 ? 4 : 8);
    expect(e.right.length).toBeGreaterThanOrEqual(4);
    expect(e.left).toHaveLength(e.right.length);
    for (const hand of ["right", "left"] as const) {
      expect(e[hand][0][0].finger).toBeGreaterThan(0);
      for (const bar of e[hand]) expect(bar.reduce((s,n) => s+n.beats,0)).toBe(e.beatsPerMeasure);
      // The A-minor study uses A–E positions; all others stay in C–G.
      if (e.number <= 8012) {
        const low = e.number === 8011 ? (hand === "right" ? 57 : 45) : (hand === "right" ? 60 : 48);
        expect(soundingNotes(e,hand).every(n => n.pitch >= low && n.pitch <= low+7)).toBe(true);
      }
      expect(soundingNotes(e,hand).every(n=>n.pitch >= 36 && n.pitch <= 79 && n.beats>0)).toBe(true);
    }
    const imported = importMusicXml(e.notationXml ?? musicXml(e));
    expect(imported.meter).toEqual({numerator:e.beatsPerMeasure,denominator:4});
    if (e.polyphony) {
      const rows = (notes: number[][]) => notes.sort((a,b)=>a[0]-b[0] || a[1]-b[1] || a[2]-b[2]);
      expect(rows(imported.notes.map(n=>[n.onsetTick,n.midiPitch,n.durationTicks])))
        .toEqual(rows(soundingNotes(e).map(n=>[n.beat*480,n.pitch,n.beats*480])));
    }
    for (const hand of ["right", "left", "both"] as const) {
      const played = noteGroups(e,hand).flatMap(g=>g.pitches);
      expect(assessPractice(e,hand,played)).toMatchObject({complete:true,accuracy:100});
      expect(assessPractice(e,hand,[99,...played]).mistakes).toBe(1);
    }
  }
  expect(soundingNotes(study(8002),"left")[0]).toMatchObject({beat:0,beats:8,pitch:48});
  expect(soundingNotes(study(8006),"right")[0].beats).toBe(0.5);
  expect(soundingNotes(study(8009),"right")[0].beats).toBe(1.5);
  const chorale = study(8010);
  expect(noteGroups(chorale,"both")[0].pitches).toEqual([48,60,64]);
  // A chord needs both right-hand pitches before the exercise can advance.
  expect(assessPractice(chorale,"both",[48,60])).toMatchObject({cursor:0,pending:[64]});
});

it("uses standard scale pitches and hand-specific thumb passages, including black keys", () => {
  const scales = [8013,8014,8015,8016].map(study);
  const expected = [
    {right:[60,62,64,65,67,69,71,72],left:[48,50,52,53,55,57,59,60],fingers:[1,2,3,1,2,3,4,5],key:0},
    {right:[67,69,71,72,74,76,78,79],left:[55,57,59,60,62,64,66,67],fingers:[1,2,3,1,2,3,4,5],key:1},
    {right:[65,67,69,70,72,74,76,77],left:[53,55,57,58,60,62,64,65],fingers:[1,2,3,4,1,2,3,4],key:-1},
    {right:[57,59,60,62,64,65,68,69],left:[45,47,48,50,52,53,56,57],fingers:[1,2,3,1,2,3,4,5],key:0},
  ];
  scales.forEach((e,i)=>{
    for (const hand of ['right','left'] as const) {
      const ascent = expected[i][hand];
      expect(soundingNotes(e,hand).map(n=>n.pitch)).toEqual([...ascent,...ascent.slice(0,-1).reverse()]);
      expect(soundingNotes(e,hand).map(n=>n.beats)).toEqual([...Array(14).fill(1),2]);
      expect(e[hand].flat().slice(0,8).map(n=>n.finger)).toEqual(hand==='right'?expected[i].fingers:[5,4,3,2,1,3,2,1]);
    }
    expect(e.notationXml).toContain(`<fifths>${expected[i].key}</fifths>`);
  });
  expect(scales[3].notationXml).toContain('<accidental>sharp</accidental>');
});

it("keeps contrary motion, arpeggios and triad inversions musically correct", () => {
  const contrary = study(8017);
  expect(soundingNotes(contrary,'left').slice(0,8).map(n=>n.pitch)).toEqual([48,47,45,43,41,40,38,36]);
  expect(contrary.left.flat().slice(0,8).map(n=>n.finger)).toEqual([1,2,3,1,2,3,4,5]);
  expect(noteGroups(study(8018),'right').map(g=>g.pitches)).toEqual([
    [60,64,67],[64,67,72],[67,72,76],[72,76,79],[67,72,76],[64,67,72],[60,64,67],
  ]);
  expect(noteGroups(study(8018),'both')[0].pitches).toEqual([48,52,55,60,64,67]);
  const arpeggio = soundingNotes(study(8019),'right');
  expect(arpeggio.slice(0,7).map(n=>n.pitch)).toEqual([60,64,67,72,67,64,60]);
  expect(arpeggio.slice(7,13).map(n=>n.beats)).toEqual(Array(6).fill(0.5));
  const sonatina = study(8024);
  expect(soundingNotes(sonatina).filter(n=>n.beat>=24&&n.beat<28).some(n=>n.pitch===54)).toBe(true);
  expect(soundingNotes(sonatina).filter(n=>n.beat>=24&&n.beat<28).some(n=>n.pitch===66)).toBe(true);
});

it('orders eight stages without reassigning existing exercise identities',()=>{
  expect(classicalStages).toHaveLength(8);
  expect(classicalLibrary.map(e=>e.step)).toEqual(Array.from({length:48},(_,i)=>i+1));
  expect(classicalLibrary.map(e=>e.title!.split('.')[0])).toEqual(Array.from({length:48},(_,i)=>String(i+1)));
  for(let stage=1;stage<=8;stage++) expect(classicalLibrary.filter(e=>e.courseStage===stage)).toHaveLength(6);
  expect(study(8001)).toMatchObject({step:4,title:'4. Five-Finger Promenade'});
  expect(study(8015)).toMatchObject({step:30,title:'30. F Major — One Flat'});
  expect(study(8024)).toMatchObject({step:47,title:'47. Little Sonatina in C'});
  for(const e of classicalLibrary) if(e.notationXml) expect(e.notationXml).toContain(`<work-title>${e.title}</work-title>`);
  const before=(a:number,b:number)=>expect(study(a).step).toBeLessThan(study(b).step);
  for(const [a,b] of [[8029,8002],[8032,8010],[8033,8006],[8035,8009],[8036,8009],[8037,8013],[8038,8014],[8039,8015],[8040,8016],[8041,8018],[8043,8044],[8044,8021],[8045,8023],[8047,8024],[8024,8048]])before(a,b);
});

it('uses the intended new keys, chord shapes, rests and final rondo form',()=>{
  expect(noteGroups(study(8025),'right').map(g=>g.pitches)).toEqual([[60],[62],[60],[62],[62],[60],[60]]);
  expect(study(8028).notationXml).toContain('<rest');
  expect(soundingNotes(study(8028)).some(n=>n.beat>=14)).toBe(false);
  expect(soundingNotes(study(8038),'right').map(n=>n.pitch)).toContain(66);
  expect(study(8038).notationXml).toContain('<fifths>1</fifths>');
  expect(soundingNotes(study(8039),'right').map(n=>n.pitch)).toContain(70);
  expect(study(8039).notationXml).toContain('<fifths>-1</fifths>');
  expect(soundingNotes(study(8040),'right').map(n=>n.pitch)).toEqual([57,59,60,62,64,65,67,69,67,65,64,62,60,59,57]);
  expect(noteGroups(study(8041),'both')[3].pitches).toEqual([48,52,55,60,64,67]);
  expect(soundingNotes(study(8043),'left').slice(0,4).map(n=>n.pitch)).toEqual([48,55,52,55]);
  expect(soundingNotes(study(8044),'left').slice(0,8).map(n=>n.beats)).toEqual(Array(8).fill(.5));
  const finale=study(8048);
  expect(finale.right).toHaveLength(24);
  expect(finale.durationBeats).toBe(96);
  expect(finale.right.slice(0,4)).toEqual(finale.right.slice(8,12));
  expect(finale.right.slice(0,4)).toEqual(finale.right.slice(16,20));
  expect(soundingNotes(finale).filter(n=>n.beat>=24&&n.beat<28).map(n=>n.pitch)).toEqual(expect.arrayContaining([54,66]));
  expect(soundingNotes(finale,'right').filter(n=>n.beat>=48&&n.beat<60).map(n=>n.pitch)).toContain(70);
  expect(finale.notationXml).toContain('<accidental>sharp</accidental>');
  expect(finale.notationXml).toContain('<accidental>flat</accidental>');
});
