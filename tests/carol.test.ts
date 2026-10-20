import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import data from '../hosted/data/repertoire.json';
import {assessPractice,noteGroups,type Exercise} from '../hosted/sight-library';
import {importMusicXml} from '../src/domains/notation/musicxml';
import {previewWav} from '../src/domains/music/preview-audio';
it('Carol contains both pages, correct naturals, rests and the tied ending',()=>{
 const ex=data.find(e=>e.number===7003)! as Exercise;
 expect(ex.right).toHaveLength(183);expect(ex.durationBeats).toBe(549);expect(ex.singleHand).toBe('right');
 const notes=ex.polyphony!;expect(notes[0]).toMatchObject({pitch:63,beat:4,beats:0.5});expect(notes.at(-1)).toMatchObject({pitch:64,beat:528,beats:9});
 expect(notes.filter(n=>n.beat>=174&&n.beat<177).map(n=>n.pitch)).toEqual([55,57,59,60,62,63]);
 const played=noteGroups(ex,'right').flatMap(g=>g.pitches);expect(assessPractice(ex,'right',played)).toMatchObject({accuracy:100,complete:true});expect(assessPractice(ex,'right',played.slice(0,-1)).complete).toBe(false);
 const xml=importMusicXml(readFileSync('hosted/public'+ex.notationUrl,'utf8'));expect(xml.measures).toHaveLength(183);expect(xml.meter.numerator).toBe(3);expect(xml.key.fifths).toBe(-3);
 const expected=notes.slice(0,-1).map(n=>[n.beat*480,n.pitch,n.beats*480]);const actual=xml.notes.filter(n=>n.onsetTick<528*480).map(n=>[n.onsetTick,n.midiPitch,n.durationTicks]);expect(actual).toEqual(expected);
 expect(xml.notes.slice(-3).map(n=>[n.midiPitch,n.durationTicks])).toEqual([[64,1440],[64,1440],[64,1440]]);
});
it('preview preserves a final silent bar at the chosen tempo',()=>{
 const wav=previewWav([{type:'NOTE_ON',timestamp:0,channel:0,pitch:60,velocity:80},{type:'NOTE_OFF',timestamp:500,channel:0,pitch:60,velocity:0}],2,3000);const bytes=new DataView(wav);expect(bytes.getUint32(40,true)/2/22050).toBeCloseTo(1.58,2);
});
