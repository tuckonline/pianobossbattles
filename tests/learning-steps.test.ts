import {expect,it} from 'vitest';
import {learningSteps} from '../src/domains/music-generator/learning-steps';
import {generateClassicalExercise} from '../src/domains/music-generator/classical-generator';
import {validateExercise} from '../src/domains/music-generator/exercise-validator';
import {positionFinger} from '../src/domains/music-generator/hand-positions';
import {soundingNotes} from '../hosted/sight-library';
it('adjacent steps change exactly one musical demand',()=>{
 const fields=['span','rhythms','bassAttacks','movingBass'] as const;
 const changed=learningSteps.slice(1).map((s,i)=>fields.filter(k=>JSON.stringify(s[k])!==JSON.stringify(learningSteps[i][k])));
 expect(changed).toEqual([['rhythms'],['span'],['bassAttacks'],['movingBass'],['rhythms']]);
 expect(learningSteps.map(s=>s.tempo)).toEqual([50,52,54,56,58,60]);
});
it('steps produce reproducible fixed-position music with validated harmony and cadences',()=>{
 for(const [key,mode] of [['C','major'],['F','major'],['D','major'],['G','major'],['A','minor']] as const) for(const seed of [1,42]) for(const compositionVersion of [undefined,2] as const) {
 let prior:ReturnType<typeof generateClassicalExercise>|undefined;
 for(const step of learningSteps){
 const settings={difficulty:step.difficulty,key,mode,tempoBpm:step.tempo,measures:8,hands:'both' as const,seed,curriculumVersion:2 as const,positionVersion:1 as const,learningStep:step.id,compositionVersion};
 const ex=generateClassicalExercise(settings); validateExercise(ex);
 expect(ex).toEqual(generateClassicalExercise(settings));
 for(const hand of ['right','left'] as const)for(const n of ex[hand].flat().filter(n=>!n.rest))expect(n.finger).toBe(positionFinger(ex.handPositions![hand]!,n.pitch));
 expect(Math.min(...soundingNotes(ex,'right').map(n=>n.beats))).toBeGreaterThanOrEqual(step.id==='beginner-3-v1'?.5:step.id==='novice-1-v1'?2:1);
 expect(ex.left.every(bar=>bar.length <= step.bassAttacks)).toBe(true);
 if(step.id === "beginner-1-v1")expect(ex.left.every(bar=>bar.every(n=>n.pitch===bar[0].pitch))).toBe(true);
 if(step.movingBass)expect(ex.left.slice(0,7).every(bar=>bar.length===2&&bar[0].pitch!==bar[1].pitch)).toBe(true);
 if(step.id === "novice-2-v1")expect(ex.right.flat().some(n=>n.beats===1)).toBe(true);
 if(step.id === "beginner-3-v1")expect(ex.right.flat().some(n=>n.beats===.5)).toBe(true);
 if(prior){expect(ex.generated.harmony).toEqual(prior.generated.harmony);if(['beginner-1-v1','beginner-2-v1'].includes(step.id))expect(ex.right).toEqual(prior.right);if(['novice-2-v1','novice-3-v1','beginner-3-v1'].includes(step.id))expect(ex.left).toEqual(prior.left);}
 prior=ex;
 }
 }
});
it('rejects incompatible steps without silently changing the tier',()=>{
 expect(()=>generateClassicalExercise({difficulty:3,key:'C',mode:'major',tempoBpm:80,measures:8,hands:'both',seed:1,curriculumVersion:2,positionVersion:1,learningStep:'novice-1-v1'})).toThrow(/learning step/);
});
