import type {BattleAnimationDefinition} from "./battle-animation-library";
export type CombatClock={startedAt:number;holdAt?:number;holdMs?:number;durationMs?:number;contactMs?:number;recoveryMs?:number;startProgress?:number};
export const cinematicRules={batchWindowMs:125,maxPendingBatches:6,maxVisualAgeMs:650,followThroughMs:45,finishDurationMs:3200};
export const comboTier=(combo:number)=>combo>=200?5:combo>=100?4:combo>=50?3:combo>=25?2:combo>=10?1:0;
// Only presentation time stops. Wall time, evaluator events and HP never do.
export function combatElapsed(clock:CombatClock,now:number){
  const held=clock.holdAt===undefined?0:Math.max(0,Math.min(clock.holdMs??0,now-clock.holdAt));
  return Math.max(0,now-clock.startedAt-held);
}
export function spriteProgress(clip:BattleAnimationDefinition,clock:CombatClock,now:number,speed=1){
  const duration=clock.durationMs??clip.durationMs/speed,elapsed=combatElapsed(clock,now);
  if(clip.loop)return (elapsed%duration)/duration;
  if(clip.poseTimesMs){
    // Scale authored pose timing around the delivered contact. Both sprite and
    // compositor freeze on that exact key pose during the shared hit-stop.
    const contact=clip.contact,at=clock.contactMs;
    const time=contact&&at!==undefined?(elapsed<=at?elapsed/Math.max(1,at)*contact.impactTimeMs:
      contact.impactTimeMs+(elapsed-at)/Math.max(1,duration-at)*(clip.durationMs-contact.impactTimeMs)):elapsed/duration*clip.durationMs;
    if(time>=clip.durationMs-1e-7)return 1;
    let frame=0;while(frame+1<clip.poseTimesMs.length&&time>=clip.poseTimesMs[frame+1]-1e-7)frame++;
    return (frame+.01)/clip.poseTimesMs.length;
  }
  if(!clip.contact||clock.contactMs===undefined)return Math.min(1,(clock.startProgress??0)+(1-(clock.startProgress??0))*elapsed/duration);
  const count=clip.asset.type==="spriteSheet"?clip.asset.frames.length:clip.asset.type==="frameSequence"?clip.asset.paths.length:60;
  const impact=clip.contact.impactFrame/count,at=clock.contactMs;
  // At contact, select the exact authored frame and hold it through hit-stop.
  return Math.min(1,elapsed<=at?elapsed/Math.max(1,at)*impact:impact+(elapsed-at)/Math.max(1,duration-at)*(1-impact));
}
