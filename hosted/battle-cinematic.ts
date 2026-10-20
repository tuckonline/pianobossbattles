import type { BattleView } from './boss-battle';
import type { CinematicSettings } from './cinematic-config';
import { cinematicDefinitions, type CinematicResult, type CinematicVisualPhase } from './cinematic-presentation';
export { cinematicAssets, cinematicDefinitions, type CinematicResult } from './cinematic-presentation';

export type CinematicPhase = 'hidden'|CinematicVisualPhase|'holding';
export function battleResult(b?:BattleView):CinematicResult|undefined {
  if(!b?.attemptId||!b.config.enabled)return;
  if(b.status==='victory')return 'victory';
  if(b.status==='defeat'&&b.result==='timeout')return 'timeout';
  if(b.status==='defeat'&&b.result==='knockout')return 'defeat';
}
export const battleResultId=(b?:BattleView)=>battleResult(b)?`${b!.attemptId}:${battleResult(b)}`:'';
export interface CinematicPlayback {
  id:string;attemptId:string;exerciseId:number;result:CinematicResult;mode:BattleView['config']['gameMode'];
  startedAt:number;resultAt:number;settings:CinematicSettings;reducedMotion:boolean;
  restored?:boolean;bossId?:string;
  story?:import('./battle-story').StoryView;
  stats:{playerHp?:number;bossHp:number;bossMaxHp:number;mistakes:number;bestCombo:number;progress:number};
}
export interface CinematicFrame {playback?:CinematicPlayback;phase:CinematicPhase;elapsed:number}
export function cinematicFrame(p:CinematicPlayback,now:number):CinematicFrame {
  const d=cinematicDefinitions[p.result];
  const elapsed=Math.min(d.durationMs,Math.max(0,(now-p.startedAt)/p.settings.durationMultiplier));
  const phase=elapsed>=d.durationMs?'holding':d.stages.find(s=>elapsed>=s.startMs&&elapsed<s.endMs)!.id;
  return {playback:p,phase,elapsed};
}
export interface CinematicInput {battle?:BattleView;exerciseId:number;bestCombo:number;settings:CinematicSettings;enabled:boolean;offline?:boolean;dismissedId?:string;reducedMotion?:boolean}
/** Presentation only. No reducer, MIDI, reward, timer or network writes. */
export class BattleCinematicController {
  private observed?:string;
  private scene?:number;
  private seen=new Set<string>();
  private dismissed=new Set<string>();
  playback?:CinematicPlayback;
  constructor(private claim:(id:string)=>boolean=()=>true){}
  receive(input:CinematicInput,now:number) {
    const {battle:b,settings}=input,id=battleResultId(b);
    const exerciseId=b?.chain?.rootExerciseNumber??input.exerciseId;
    // The receiver can load the player before its first live snapshot. A
    // placeholder exercise must not count as an exercise switch on reconnect.
    if(!b){if(!input.enabled)this.cancel();return;}
    const previous=this.observed;
    if(this.scene!==undefined&&this.scene!==exerciseId){if(id)this.dismissed.add(id);this.cancel();}
    this.scene=exerciseId;
    if(!input.enabled||b?.config.enabled===false||input.dismissedId===id){
      if(id)this.dismissed.add(id);this.cancel();
    }
    if(this.playback&&b&&b.attemptId!==this.playback.attemptId)this.cancel();
    this.observed=b.attemptId;
    if(!id||!input.enabled||this.dismissed.has(id)||this.playback?.id===id)return;
    const seen=this.seen.has(id);
    this.seen.add(id);if(this.seen.size>128)this.seen.delete(this.seen.values().next().value!);
    if(this.dismissed.size>128)this.dismissed.delete(this.dismissed.values().next().value!);
    // A reconnect restores the final frame. Only a fresh transition observed by
    // this viewer can animate. Receipts dedupe visuals, never block restoration.
    const first=this.claim(id);
    const animate=first&&!seen&&previous===b.attemptId&&!!previous&&!input.offline&&now-b.lastAt<10000&&now-b.lastAt>=-2000;
    const result=battleResult(b)!;
    this.playback={id,story:b.story,bossId:b.config.bossId,attemptId:b.attemptId,exerciseId,result:battleResult(b)!,mode:b.config.gameMode,
      startedAt:animate?now:now-cinematicDefinitions[result].durationMs*settings.durationMultiplier,restored:!animate,resultAt:b.lastAt,settings:{...settings},reducedMotion:!!input.reducedMotion,
      stats:{playerHp:b.config.gameMode==='timeAttack'?undefined:b.playerHp,bossHp:b.bossHp,bossMaxHp:b.bossMaxHp,mistakes:b.mistakes,bestCombo:result!=='timeout'&&b.story?.summary?b.story.summary.bestCombo:input.bestCombo,progress:Math.min(100,Math.round(100*b.correctHits/Math.max(1,b.expectedNotes)))}};
  }
  frame(now:number):CinematicFrame {
    if(!this.playback)return {phase:'hidden',elapsed:0};
    const frame=cinematicFrame(this.playback,now);
    if(frame.phase==='hidden')this.cancel();
    return frame;
  }
  cancel(){this.playback=undefined;}
}

/** One bounded receipt list per viewer/player; durable even if OBS restarts. */
export function cinematicReceipt(storage:Pick<Storage,'getItem'|'setItem'>,scope:string) {
  return (id:string)=>{
    const key=`pianopath:cinematic:v1:${scope}`;
    try {
      let raw:unknown=[];
      try{raw=JSON.parse(storage.getItem(key)||'[]');}catch{/* Replace a corrupt receipt list. */}
      const ids:string[]=Array.isArray(raw)?raw.filter(v=>typeof v==='string').slice(-127):[];
      if(ids.includes(id))return false;
      storage.setItem(key,JSON.stringify([...ids,id]));
    }catch{/* The controller's bounded memory and restoration rule still apply. */}
    return true;
  };
}
