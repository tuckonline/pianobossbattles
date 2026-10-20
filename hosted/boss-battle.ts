import type {BattlePressure} from './battle-pressure';
import { replayEvents, type GameEvent } from "./game-core";
import { gameModeRegistry, usesProgressiveTempo, prepareExerciseTimer, prepareTempoStage, enrageMultipliers, bossPhase, type BossPhase, type ExerciseTimer } from './battle-modes';
import { noteGroups, practicePass, type Exercise, type Hand } from "./sight-library";
import { bossConfigSchema, bossHpTarget, defaultBossBattleConfig, type BossBattleConfig } from "./boss-config";
import {noteAttackRules,type BattleNoteAttack} from "./battle-note-attacks";

export type BattleStatus = "idle" | "ready" | "active" | "paused" | "victory" | "defeat";
export type BattleRound={id:string;attemptId:string;number:number;playerMaxHp:number;playerHp:number;bossMaxHp:number;bossHp:number;status:"active"|"paused"|"ended";startedAt:number;endedAt?:number;result?:"victory"|"defeat"|"unfinished"|"abandoned";startRevision:number;endRevision?:number};
export type CombatCue={revision:number;at:number;side:"player"|"boss";outcome:"correct"|"incorrect"|"missed";playerHp:number;bossHp:number;note?:BattleNoteAttack;roundId?:string;sourceEventId?:string;damage?:number;blocked?:boolean;special?:boolean};
export type BattleView = {
  story?:import('./battle-story').StoryView;
  chain?:{index:number;total:number;exerciseNumber:number;rootExerciseNumber:number;nextExerciseNumber?:number;pass:number;passes:number};
  pressure?:BattlePressure;
  countdown?:{startedAt:number;fightAt:number;releasedAt?:number;pausedAt?:number};
  loop?:{number:number;at:number};
  config: BossBattleConfig;
  status: BattleStatus;
  attemptId: string;
  expectedNotes: number;
  playerHp: number;
  bossHp: number;
  bossMaxHp: number;
  correctHits: number;
  mistakes: number;
  revision: number;
  lastAction?: "player" | "boss";
  lastAt: number;
  result?: "knockout" | "unfinished" | "abandoned" | "timeout";
  musicalBeats?:number|null;
  loopCount?:number;
  timer?:ExerciseTimer;
  shields?:number;
  phase?:BossPhase;
  power?:{charge:number;threshold:number;activations:number};
  waiting: boolean;
  noteAttacks?: BattleNoteAttack[];
  combatCues?:CombatCue[];
  round?:BattleRound;
  recentRounds?:BattleRound[];
  roundWins?:number;
  roundLosses?:number;
  remainingNotes?:number;
  remainingKnown?:boolean;
  exerciseEnded?:boolean;
};
// attemptId remains the battle's stable identity for OBS. Each loop still has
// its own authoritative scoring attempt, accepted only through this private ID.
export type BattleState = BattleView & { scoringAttemptId: string; seenIds: string[]; occurrences: string[]; attackClusterId?:string; lastSequence?:number; roundHistory?:BattleRound[]; timerAnchor?:number; lastCombo?:number; shieldComboOrigin?:number; firstPassBeats?:number|null };
export type BattleEvent =
  | { type: "start"; attemptId: string; at?:number; now?:number; combo?:number; countdown?:boolean }
  | { type: "next-loop"; attemptId: string; nextAttemptId: string; now?:number; beats?:number|null }
  | { type: "evaluate"; attemptId: string; events: GameEvent[]; now?:number; comboByEvent?:Record<string,number> }
  | { type: "fight" | "pause" | "resume" | "complete" | "abandon" | "tick"; attemptId: string; at?:number; now?:number };

export function battleCountingIn(state:BattleView){return !!state.countdown&&!state.countdown.releasedAt;}

export function practiceLoopCount(value: number) {
  return Number.isFinite(value) ? Math.max(1, Math.min(100, Math.round(value))) : 1;
}
export function battleRunNotes(exercise: Exercise, hand: Hand, loops = 1) {
  const count = (omit: boolean) => noteGroups(practicePass(exercise, omit), hand)
    .reduce((sum, group) => sum + group.pitches.length, 0);
  // Schmitt's final cadence is played only on the last pass.
  return count(false) + (practiceLoopCount(loops) - 1) * count(true);
}

export function createBattle(config = defaultBossBattleConfig, expectedNotes = 0, waiting = false, musicalBeats:number|null=null,loopCount=1,firstPassBeats:number|null=musicalBeats===null?null:musicalBeats/Math.max(1,loopCount)): BattleState {
  config = bossConfigSchema.parse(config);
  loopCount=Number.isFinite(loopCount)?Math.max(1,Math.min(100000,Math.round(loopCount))):1;
  const bossMaxHp = bossHpTarget(expectedNotes);
  return { config, status: config.enabled && expectedNotes > 0 ? "ready" : "idle",
    attemptId: "", expectedNotes, playerHp: config.playerMaxHp, bossHp: bossMaxHp,
    bossMaxHp, correctHits: 0, mistakes: 0, revision: 0, lastAt: 0, waiting,
    scoringAttemptId: "", seenIds: [], occurrences: [], noteAttacks:[],combatCues:[],
    remainingNotes:expectedNotes,remainingKnown:Number.isInteger(expectedNotes)&&expectedNotes>0,roundWins:0,roundLosses:0,recentRounds:[],roundHistory:[],lastSequence:-1,
    musicalBeats,loopCount,firstPassBeats,timer:usesProgressiveTempo(config)?prepareTempoStage(config,musicalBeats===null?null:firstPassBeats):prepareExerciseTimer(config,musicalBeats,loopCount),shields:0,phase:'normal',lastCombo:0,shieldComboOrigin:0,
    power:{charge:0,threshold:config.adaptivePower?Math.min(config.powerThreshold,Math.max(1,Math.ceil(expectedNotes*.6))):config.powerThreshold,activations:0} };
}
export function battleView(state: BattleState): BattleView {
  const { scoringAttemptId: _scoring, seenIds: _seen, occurrences: _occurrences, attackClusterId:_cluster, lastSequence:_sequence,roundHistory:_history,timerAnchor:_anchor,lastCombo:_combo,shieldComboOrigin:_origin,firstPassBeats:_first, ...view } = state;
  void _scoring; void _seen; void _occurrences; void _cluster;void _sequence;void _history;
  void _anchor;void _combo;void _origin;void _first;
  return view;
}
export function configureBattle(state: BattleState, config: BossBattleConfig, notes: number, duringAttempt: boolean): BattleState {
  config = bossConfigSchema.parse(config);
  if (config.enabled !== state.config.enabled) {
    if(!config.enabled&&state.round){const ended=endRound(state,"abandoned",Date.now());return stopTimer({...ended,config,status:"idle",exerciseEnded:true,lastAction:undefined});}
    return createBattle(config, notes, duringAttempt,state.musicalBeats,state.loopCount);
  }
  if(config.bossId!==state.config.bossId && !duringAttempt && (state.status==="ready"||state.status==="idle") && Object.keys(config).every(k=>k==="bossId"||config[k as keyof BossBattleConfig]===state.config[k as keyof BossBattleConfig]))return {...state,config};
  if ((state.status === "ready" && !battleCountingIn(state)) || state.status === "idle")
    return createBattle(config, notes, state.waiting,state.musicalBeats,state.loopCount);
  // A fight keeps its damage setting through pause and its result screen.
  // The saved preference is used by the next manually started run, not its loops.
  const frozen=state.config;
  if(state.chain)config={...config,multiRoundEnabled:false};
  return {...state, config:{...config,bossId:frozen.bossId,bossDamagePerMistake:frozen.bossDamagePerMistake,playerMaxHp:frozen.playerMaxHp,gameMode:frozen.gameMode,selectedBpm:frozen.selectedBpm,allowanceMultiplier:frozen.allowanceMultiplier,explicitTimeLimitSeconds:frozen.explicitTimeLimitSeconds,progressiveTempo:frozen.progressiveTempo,powerThreshold:frozen.powerThreshold,adaptivePower:frozen.adaptivePower}};
}
function beginRound(state:BattleState,at:number):BattleState {
  const number=(state.round?.number??0)+1,bossMaxHp=bossHpTarget(state.remainingNotes??state.expectedNotes);
  const round:BattleRound={id:`${state.attemptId}:round:${number}`,attemptId:state.scoringAttemptId,number,
    playerMaxHp:state.config.playerMaxHp,playerHp:state.config.playerMaxHp,bossMaxHp,bossHp:bossMaxHp,
    status:"active",startedAt:at,startRevision:state.revision};
  return {...state,round,status:"active",playerHp:round.playerHp,bossHp:bossMaxHp,bossMaxHp,result:undefined,lastAction:undefined,attackClusterId:undefined};
}
function endRound(state:BattleState,result:NonNullable<BattleRound['result']>,at:number):BattleState {
  if(!state.round||state.round.status==="ended")return state;
  const round:BattleRound={...state.round,playerHp:state.playerHp,bossHp:state.bossHp,status:"ended",result,endedAt:at,endRevision:state.revision};
  return {...state,round,roundHistory:[...(state.roundHistory??[]),round],recentRounds:[...(state.recentRounds??[]),round].slice(-8),
    roundWins:(state.roundWins??0)+(result==="victory"?1:0),roundLosses:(state.roundLosses??0)+(result==="defeat"?1:0)};
}
// Only the practice owner advances this monotonic clock. OBS receives snapshots.
function advanceTimer(state:BattleState,now:number,at=Date.now()):BattleState {
  const timer=state.timer;
  if(!timer?.running||state.timerAnchor===undefined)return state;
  const elapsedMs=Math.min(timer.limitMs,timer.elapsedMs+Math.max(0,now-state.timerAnchor));
  if(elapsedMs===timer.elapsedMs)return state;
  const next={...state,timerAnchor:now,timer:{...timer,elapsedMs,sampledAt:at}};
  // Deadline is exclusive: an evaluation delivered at elapsed >= limit loses.
  if(elapsedMs>=timer.limitMs)return stopTimer({...endRound(next,'defeat',at),status:'defeat',result:'timeout',lastAt:at,revision:state.revision+1,lastAction:undefined,exerciseEnded:true});
  return next;
}
function stopTimer(state:BattleState):BattleState {
  return state.timer?{...state,timer:{...state.timer,running:false},timerAnchor:undefined}:state;
}
export function reduceBattle(state: BattleState, event: BattleEvent): BattleState {
  if (!state.config.enabled || state.expectedNotes < 1) return state;
  const now=event.now??performance.now();
  if (event.type === 'start') {
    if (!event.attemptId || event.attemptId === state.attemptId || state.timer?.issue) return state;
    const at=event.at??Date.now(),next={ ...createBattle(state.config,state.expectedNotes,false,state.musicalBeats,state.loopCount,state.firstPassBeats), attemptId:event.attemptId, scoringAttemptId:event.attemptId,lastCombo:event.combo??0,shieldComboOrigin:event.combo??0,loop:{number:1,at} };
    return event.countdown?{...next,status:'ready',countdown:{startedAt:at,fightAt:at+3000}}:beginRound(next,at);
  }
  if (event.attemptId !== state.scoringAttemptId || !state.attemptId) return state;
  if(battleCountingIn(state)){
    const c=state.countdown!,at='at' in event?event.at??Date.now():Date.now();
    if(event.type==='abandon')return {...state,status:'idle',countdown:undefined,exerciseEnded:true};
    if(event.type==='pause'&&!c.pausedAt)return {...state,status:'paused',countdown:{...c,pausedAt:at}};
    if(event.type==='resume'&&c.pausedAt){const shift=at-c.pausedAt;return {...state,status:'ready',countdown:{startedAt:c.startedAt+shift,fightAt:c.fightAt+shift}};}
    if(event.type==='fight'&&!c.pausedAt&&at>=c.fightAt)return beginRound({...state,countdown:{...c,releasedAt:at}},at);
    return state; // No evaluation, loop advance or gameplay timer before FIGHT.
  }
  if(event.type==='fight')return state;
  if (event.type === 'next-loop') {
    if (!event.nextAttemptId || event.nextAttemptId === state.scoringAttemptId || !['active','paused','victory','defeat'].includes(state.status)) return state;
    // A loop is a scoring-ID boundary, not a pause or a new battle. Preserve the
    // monotonic clock (and any explicit user pause) across that boundary.
    state=advanceTimer(state,now);
    if(usesProgressiveTempo(state.config)&&state.timer&&['active','paused'].includes(state.status)){
      const timer=prepareTempoStage(state.config,event.beats===undefined?state.firstPassBeats??null:event.beats,(state.loop?.number??1)+1)!;
      // Advance on the existing authoritative boundary, never on a remount or
      // OBS clock. No banked Easy time, repeated intro, damage, or combo reset.
      if(timer.issue)return stopTimer({...state,status:'defeat',result:'unfinished',timer,exerciseEnded:true});
      state={...state,timer:{...timer,started:state.timer.started,running:state.timer.running,sampledAt:Date.now()},timerAnchor:state.timer.running?now:undefined};
    }
    return {...state,scoringAttemptId:event.nextAttemptId,loop:{number:(state.loop?.number??1)+1,at:Date.now()},
      seenIds:[],occurrences:[],lastSequence:-1,lastAction:undefined,attackClusterId:undefined};
  }
  if (state.status==='victory'||state.status==='defeat') return state;
  state=advanceTimer(state,now,'at' in event?event.at:undefined);
  if(state.status==='defeat')return state;
  if(event.type==='tick')return state;
  if(event.type==='pause')return state.status==='active'?stopTimer({...state,status:'paused',round:state.round?{...state.round,status:'paused'}:undefined,lastAction:undefined,attackClusterId:undefined}):state;
  if(event.type==='resume')return state.status==='paused'?{...state,status:'active',round:state.round?{...state.round,status:'active'}:undefined,timer:state.timer?.started?{...state.timer,running:true,sampledAt:Date.now()}:state.timer,timerAnchor:now}:state;
  if(event.type==='complete'||event.type==='abandon')return stopTimer({...endRound(state,event.type==='complete'?'unfinished':'abandoned',event.at??Date.now()),exerciseEnded:true,status:'defeat',result:event.type==='complete'?'unfinished':'abandoned',lastAction:undefined});
  if(event.type!=='evaluate'||state.status!=='active')return state;
  let next=state;
  const seen=new Set(state.seenIds),occurrences=new Set(state.occurrences);
  const ordered=event.events.filter(e=>e.attemptId===state.scoringAttemptId&&e.type==='note.evaluated'&&!seen.has(e.id)&&e.sequence>(state.lastSequence??-1)).sort((a,b)=>a.sequence-b.sequence||a.id.localeCompare(b.id));
  // Mirror the existing combo replay, never a second set of streak rules. Live
  // practice supplies the exact per-event values from its own replay result.
  const combos=event.comboByEvent??replayEvents(ordered,state.lastCombo??0).comboByEvent;
  const mode=gameModeRegistry[state.config.gameMode];
  for(const e of ordered){
    if(next.status!=='active')break;
    if(seen.has(e.id))continue;
    seen.add(e.id);next={...next,lastSequence:e.sequence};
    const outcome=e.payload.outcome,occurrence=e.payload.occurrence;
    const correct=outcome==='correct'&&!!occurrence&&!occurrences.has(occurrence);
    const mistake=(outcome==='incorrect'||outcome==='missed')&&!(occurrence&&occurrences.has(occurrence));
    if(!correct&&!mistake)continue;
    if(next.timer&&!next.timer.started)next={...next,timerAnchor:now,timer:{...next.timer,started:true,running:true,sampledAt:Date.now()}};
    const combo=combos[e.id]??next.lastCombo??0;
    next={...next,lastCombo:combo};
    if(correct){
      occurrences.add(occurrence!);
      const bossHp=Math.max(0,next.bossHp-1),power=next.power!;
      const special=power.charge+1>=power.threshold;
      const streakNotes=combo-(next.shieldComboOrigin??0);
      const earned=mode.shields&&streakNotes>0&&streakNotes%10===0;
      next={...next,remainingNotes:Math.max(0,(next.remainingNotes??0)-1),bossHp,correctHits:next.correctHits+1,revision:next.revision+1,
        lastAction:'player',lastAt:e.timestamp,status:bossHp===0?'victory':'active',
        shields:Math.min(3,(next.shields??0)+(earned?1:0)),phase:mode.enrage&&bossHp>0?bossPhase(bossHp,next.bossMaxHp):next.phase,
        power:{...power,charge:special?0:power.charge+1,activations:power.activations+(special?1:0)}};
      next=recordNoteAttack(next,e);
      next={...next,combatCues:[...(next.combatCues??[]),{revision:next.revision,at:e.timestamp,roundId:next.round?.id,sourceEventId:e.id,side:'player' as const,outcome:'correct' as const,playerHp:next.playerHp,bossHp:next.bossHp,damage:1,special,note:next.noteAttacks?.at(-1)?.revision===next.revision?next.noteAttacks.at(-1):undefined}].slice(-32)};
    }else{
      if(outcome==='missed'){
        if(occurrence){occurrences.add(occurrence);next={...next,remainingNotes:Math.max(0,(next.remainingNotes??0)-1)};}
        else next={...next,remainingKnown:false};
      }
      const blocked=mode.shields&&(next.shields??0)>0;
      const adjusted=Math.min(next.config.playerMaxHp,Math.ceil(next.config.bossDamagePerMistake*(mode.enrage?enrageMultipliers[next.phase??'normal']:1)));
      const damage=mode.health&&!blocked?Math.min(next.playerHp,adjusted):0,playerHp=next.playerHp-damage;
      next={...next,playerHp,shields:(next.shields??0)-(blocked?1:0),shieldComboOrigin:0,mistakes:next.mistakes+1,revision:next.revision+1,
        lastAction:'boss',lastAt:e.timestamp,status:playerHp===0?'defeat':'active',result:playerHp===0?'knockout':undefined,attackClusterId:undefined};
      next={...next,combatCues:[...(next.combatCues??[]),{revision:next.revision,at:e.timestamp,roundId:next.round?.id,sourceEventId:e.id,side:'boss' as const,outcome:outcome as 'incorrect'|'missed',playerHp,bossHp:next.bossHp,damage,blocked}].slice(-32)};
    }
    if(next.round)next={...next,round:{...next.round,playerHp:next.playerHp,bossHp:next.bossHp}};
    if(next.status==='victory'||next.status==='defeat')next=stopTimer(endRound(next,next.status,e.timestamp));
  }
  return seen.size===state.seenIds.length?state:{...next,seenIds:[...seen],occurrences:[...occurrences]};
}

// Called only after a unique correct occurrence has earned its normal damage.
// These compact cues survive OBS frame coalescing; they never grant damage/XP.
function recordNoteAttack(state:BattleState,event:GameEvent):BattleState {
  const {pitch,groupId,groupSize,groupComplete}=event.payload;
  if(typeof pitch!=="number"||!Number.isInteger(pitch)||pitch<0||pitch>127||groupId===undefined||typeof groupSize!=="number"||!Number.isInteger(groupSize)||groupSize<1||groupSize>128)return state;
  const id=`${state.scoringAttemptId}:${groupId}`,previous=state.noteAttacks?.at(-1);
  const joins=previous&&previous.id===state.attackClusterId&&previous.groupId===id&&!previous.complete&&event.timestamp>=previous.lastAt&&event.timestamp-previous.firstAt<=noteAttackRules.chordWindowMs;
  const firstAt=joins?previous.firstAt:event.timestamp;
  const pitches=[...new Set([...(joins?previous.pitches:[]),pitch])].sort((a,b)=>a-b);
  const hits=(joins?previous.hits:0)+1;
  const complete=!!groupComplete&&hits===groupSize;
  const cue:BattleNoteAttack={id:joins?previous.id:event.id,groupId:id,revision:state.revision,firstAt,lastAt:event.timestamp,
    readyAt:groupComplete?event.timestamp:firstAt+noteAttackRules.chordWindowMs,pitches,hits,expectedSize:groupSize,complete};
  const history=joins?state.noteAttacks!.slice(0,-1):state.noteAttacks??[];
  return {...state,attackClusterId:cue.id,noteAttacks:[...history,cue].slice(-noteAttackRules.historySize)};
}
