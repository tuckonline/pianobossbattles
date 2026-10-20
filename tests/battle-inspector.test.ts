import {expect,it} from 'vitest';
import baseline from './fixtures/animation-registry-96.json';
import {battleAnimationLibrary} from '../hosted/battle-animation-library';
import {inspectionPoseTimes} from '../hosted/battle-animation-inspector';
import {spriteProgress} from '../hosted/battle-timeline';

it('preserves every baseline ID and character assignment, not just aggregate counts',()=>{
 expect(Object.fromEntries(battleAnimationLibrary.map(c=>[c.id,c.characterId]))).toEqual(baseline);
});

it('steps all96 clips through actual contact-locked sprite boundaries without mutating shared assets',()=>{
 const before=JSON.stringify(battleAnimationLibrary);
 for(const clip of battleAnimationLibrary){
  const times=inspectionPoseTimes(clip);
  for(const [i,time] of times.entries()){
   expect(time,clip.id).toBeGreaterThanOrEqual(0);
   expect(time,clip.id).toBeLessThan(clip.durationMs);
   const frame=Math.floor(spriteProgress(clip,{startedAt:0,contactMs:clip.contact?.impactTimeMs},time+.001)*times.length);
   expect(frame,`${clip.id} pose${i}`).toBe(i);
  }
  if(!clip.loop)expect(spriteProgress(clip,{startedAt:0,contactMs:clip.contact?.impactTimeMs},clip.durationMs)).toBe(1);
  if(clip.posePhases)expect(clip.posePhases).toHaveLength(times.length);
 }
 expect(JSON.stringify(battleAnimationLibrary)).toBe(before);
});
