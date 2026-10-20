import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import data from '../hosted/data/czerny-op481.json';
import { soundingNotes, noteGroups, assessPractice, type Exercise } from '../hosted/sight-library';
import { importMusicXml } from '../src/domains/notation/musicxml';

it('includes only checked original pieces 1 and 2 with playable written-out repeats and printed fingerings', () => {
  expect(data.map(e => e.number)).toEqual([6001,6002]);
  const sort = (rows: number[][]) => rows.sort((a,b)=>a[0]-b[0] || a[1]-b[1] || a[2]-b[2]);
  for (const raw of data) {
    const ex = raw as Exercise;
    const xml = readFileSync('hosted/public'+raw.notationUrl,'utf8');
    const imported = importMusicXml(xml);
    expect(sort(imported.notes.map(n=>[n.onsetTick,n.midiPitch,n.durationTicks]))).toEqual(sort(soundingNotes(ex,'both').map(n=>[n.beat*480,n.pitch,n.beats*480])));
    expect(xml.match(/<measure /g)?.length).toBe(raw.number===6001?64:32);
    const fingers = [...xml.matchAll(/<fingering[^>]*>(.*?)<\/fingering>/g)].map(m=>m[1]);
    expect(fingers.length).toBeGreaterThan(20);
    expect(fingers.every(f=> /^[1-5]$/.test(f))).toBe(true);
    for (const hand of ['both','left','right'] as const) {
      const played = noteGroups(ex,hand).flatMap(g=>g.pitches);
      expect(assessPractice(ex,hand,played)).toMatchObject({complete:true,accuracy:100});
      expect(assessPractice(ex,hand,played.slice(0,-1)).complete).toBe(false);
    }
  }
});
