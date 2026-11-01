import {expect,it} from 'vitest';
import {transformMotif,validateMotifUses,type MusicalMotif} from '../src/domains/music-generator/motif-development';
import {generateClassicalExercise} from '../src/domains/music-generator/classical-generator';
import {learningSteps} from '../src/domains/music-generator/learning-steps';
import {validateExercise} from '../src/domains/music-generator/exercise-validator';
import {musicXml,soundingNotes} from '../hosted/sight-library';
import {importMusicXml} from '../src/domains/notation/musicxml';
const motif:MusicalMotif={degrees:[0,1,2,0],beats:[1,.5,.5,2],rests:[false,false,false,false]};
it('transforms a stored musical idea without mutating its identity',()=>{
 expect(transformMotif(motif,'repeat')).toEqual(motif);
 expect(transformMotif(motif,'sequence',2).degrees).toEqual([2,3,4,2]);
 expect(transformMotif(motif,'rhythm',1,[2,.5,.5,1])).toEqual({...motif,beats:[2,.5,.5,1]});
 expect(transformMotif(motif,'variation',-1).degrees).toEqual([0,0,2,0]);
 expect(transformMotif(motif,'answer',-1).degrees).toEqual([0,1,2,-1]);
 expect(motif.degrees).toEqual([0,1,2,0]);
});
it('generates reproducible developed periods within original constraints',()=>{
 const techniques=new Set<string>(),openings=new Set<string>();
 const profiles=[...learningSteps.map(s=>({difficulty:s.difficulty,learningStep:s.id,tempoBpm:s.tempo})),...[3,4,5].map(difficulty=>({difficulty,tempoBpm:80}))];
 for(const profile of profiles)for(const seed of [1,42])for(const [key,mode] of [['C','major'],['A','minor']] as const){
 const settings={...profile,key,mode,seed,measures:16,hands:'both' as const,curriculumVersion:2 as const,positionVersion:1 as const,compositionVersion:2 as const};
 const ex=generateClassicalExercise(settings);expect(ex).toEqual(generateClassicalExercise(settings));validateExercise(ex);
 const uses=ex.generated.development!;validateMotifUses(uses);expect(uses).toHaveLength(16);
 expect([3,7,11,15].map(i=>uses[i].technique)).toEqual(['cadence','cadence','cadence','cadence']);
 expect(uses[6].technique).toBe('prepare');expect(uses[6].motif.beats).toEqual(uses[0].motif.beats);
 expect(ex.generated.harmony[3].cadence).toBe('half');expect(ex.generated.harmony[15].cadence).toBe('authentic');
 uses.forEach(u=>techniques.add(u.technique));openings.add(JSON.stringify(uses[0].motif));
 const imported=importMusicXml(musicXml(ex));
 const written=(['right','left'] as const).flatMap(hand=>{let beat=0;return ex[hand].flat().flatMap(n=>{const event={pitch:n.pitch,tick:beat*480,duration:n.beats*480};beat+=n.beats;return n.rest?[]:[event];});}).sort((a,b)=>a.tick-b.tick||a.pitch-b.pitch);
 expect(imported.notes.map(n=>({pitch:n.midiPitch,tick:n.onsetTick,duration:n.durationTicks})).sort((a,b)=>a.tick-b.tick||a.pitch-b.pitch)).toEqual(written);
 if('learningStep' in profile)expect(soundingNotes(ex,'right').every(n=>n.pitch>=ex.handPositions!.right!.anchorPitch&&n.pitch<=ex.handPositions!.right!.anchorPitch+7)).toBe(true);
 }
 expect(openings.size).toBeGreaterThan(5);
 expect(techniques.has('repeat')).toBe(true);expect(techniques.has('sequence')).toBe(true);expect(techniques.has('rhythm')).toBe(true);expect(techniques.has('variation')).toBe(true);expect(techniques.has('answer')).toBe(true);
});
