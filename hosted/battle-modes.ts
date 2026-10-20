import { practicePass, type Exercise } from './sight-library';

export type GameMode = 'survival' | 'timeAttack' | 'ultimateBoss';
export const gameModeRegistry = {
  survival: { title: 'Survival', timed: false, health: true, shields: false, enrage: false, description: 'Finish the run before your HP runs out.' },
  timeAttack: { title: 'Time Attack', timed: true, health: false, shields: false, enrage: false, description: 'Beat the countdown. Mistakes cost time, not HP.' },
  ultimateBoss: { title: 'Ultimate Boss', timed: true, health: true, shields: true, enrage: true, description: 'Survive the clock and an enraging boss. Earn a shield every 10 consecutive correct notes.' },
} as const;
export const battleTempoPresets = [{ title:'Easy', bpm:60 }, { title:'Medium', bpm:80 }, { title:'Fast', bpm:110 }, { title:'Expert', bpm:140 }] as const;
export const timerAllowances = [{ title:'Generous', multiplier:1.5 }, { title:'Balanced', multiplier:1.3 }, { title:'Tight', multiplier:1.15 }, { title:'Precision', multiplier:1.05 }] as const;
export type BossPhase = 'normal' | 'aggressive' | 'enraged';
export const enrageMultipliers = { normal:1, aggressive:1.25, enraged:1.5 } as const;
export function bossPhase(hp:number,max:number):BossPhase { return hp>0&&hp/max<=.25?'enraged':hp/max<=.5?'aggressive':'normal'; }

// Same quarter-note unit as soundingNotes/Listen. Count elapsed musical time,
// not sounding pitches: chords share time, ties retain duration, rests count.
export function battleMusicalBeats(exercise:Exercise, loops=1):number|null {
  const duration=(ex:Exercise):number|null=>{
    if(ex.durationBeats!==undefined)return Number.isFinite(ex.durationBeats)&&ex.durationBeats>0?ex.durationBeats:null;
    // Polyphonic imports need their explicit score-end metadata (trailing rests
    // cannot safely be inferred from the final sounding note).
    if(ex.polyphony)return null;
    const staves=[ex.right,ex.left].filter(staff=>staff.length).map(staff=>{
      const notes=staff.flat();
      return notes.length&&notes.every(n=>Number.isFinite(n.beats)&&n.beats>0)?notes.reduce((n,note)=>n+note.beats,0):0;
    });
    return staves.length&&staves.every(n=>n>0)?Math.max(...staves):null;
  };
  const last=duration(exercise),repeat=duration(practicePass(exercise,true));
  return last===null||repeat===null?null:last+(Math.max(1,Math.min(100,Math.round(loops)))-1)*repeat;
}
export const timedTempoStages = [{title:'Easy',bpm:60},{title:'Normal',bpm:80},{title:'Hard',bpm:110},{title:'Expert',bpm:140}] as const;
export type ExerciseTimer = { limitMs:number; elapsedMs:number; running:boolean; started:boolean; sampledAt:number; issue?:string; tempoStage?:number };
// One stage per scored pass. Expert remains the cap for longer runs. A manual
// limit is the Easy-stage budget and scales by the same tempo ratio.
export function prepareTempoStage(config:Parameters<typeof prepareExerciseTimer>[0],beats:number|null,pass=1):ExerciseTimer|undefined {
  const stage=Math.max(0,Math.min(3,Math.floor(pass)-1)),bpm=timedTempoStages[stage].bpm;
  const timer=prepareExerciseTimer({...config,selectedBpm:bpm,explicitTimeLimitSeconds:config.explicitTimeLimitSeconds*60/bpm},beats,1);
  return timer?{...timer,tempoStage:stage}:undefined;
}
export function prepareExerciseTimer(config:{gameMode:GameMode;selectedBpm:number;allowanceMultiplier:number;explicitTimeLimitSeconds:number},beats:number|null,loopCount=1):ExerciseTimer|undefined {
  if(!gameModeRegistry[config.gameMode].timed)return;
  // `beats` is the complete musical run (including selected passes/cadence),
  // already expanded exactly once by battleMusicalBeats. Round only the total.
  // A manual duration is a per-loop fallback and must scale with the same count.
  const seconds=config.explicitTimeLimitSeconds
    ? Math.ceil(config.explicitTimeLimitSeconds*loopCount)
    : beats===null?0:Math.ceil(beats*60/config.selectedBpm*config.allowanceMultiplier);
  return {limitMs:seconds*1000,elapsedMs:0,running:false,started:false,sampledAt:0,...(!seconds?{issue:'This score needs an explicit time limit because its complete musical duration is unavailable.'}:{})};
}
export function remainingTime(timer:ExerciseTimer){return Math.max(0,timer.limitMs-timer.elapsedMs);}
export function countdownLabel(ms:number){const seconds=Math.ceil(Math.max(0,ms)/1000);return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;}
