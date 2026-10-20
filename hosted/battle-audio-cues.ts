import type {BattlePresentation} from './battle-animation-director';
import type {BattleView} from './boss-battle';
import type {BattleSound} from './battle-audio';
export type BattleAudioCue={id:string;kind:BattleSound;at:number};

export function combatAudioCues(b:BattleView,p:BattlePresentation,suppressResult:boolean):BattleAudioCue[] {
  const cues:BattleAudioCue[]=[],prefix=b.attemptId;
  if(p.action&&p.phase==='windup') {
    const actor=p.action==='player'?p.player:p.boss;
    cues.push({id:`${prefix}:swing:${actor.serial}`,kind:p.action==='player'?'heroSwing':'bossSwing',at:actor.startedAt+Math.max(0,(actor.contactMs??0)*.3)});
  }
  if(p.impact) {
    const hit=p.impact;
    cues.push({id:`${prefix}:contact:${hit.id}`,at:hit.at,kind:hit.side==='boss'?(hit.signaturePhase==='crush'||p.boss.clip.category==='heavyAttack'?'heavy':'hurt'):(hit.special||hit.signaturePhase==='cross'?'power':'heroImpact')});
  }
  if(!suppressResult&&p.finished&&p.outcomeAt&&(b.status==='victory'||b.status==='defeat')&&(!b.result||b.result==='knockout'||b.result==='timeout'))
    cues.push({id:`${prefix}:result:${b.status}`,at:p.outcomeAt,kind:b.result==='timeout'?'timeout':b.status});
  return cues;
}
