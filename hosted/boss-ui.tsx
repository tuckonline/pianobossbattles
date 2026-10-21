import {usePressurePresentation} from './battle-pressure-ui';
import {useStoryEvent,useStoryReaction,BattleStoryNotice} from './battle-story-ui';
import {BattleLoopNotice} from './battle-intro';
import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import {BattleCountdown,ComboPower,ShieldInventory} from './battle-mode-ui';
import {gameModeRegistry,enrageMultipliers} from './battle-modes';
import type { BattleView } from "./boss-battle";
import { battleCharacters, bossDifficultyLabel } from "./boss-config";
import {useBattlePresentation} from "./battle-presentation-hook";
import {useCombatAudio} from "./battle-audio-ui";
import type {AudioOutput} from "./battle-audio";
import { preloadCharacter } from "./battle-animation-player";
import { BattleStage } from "./battle-stage";
import { battleLayout, recordingBattleLayout, type BossBattleLayoutConfig } from "./battle-layout";
import "./boss.css";

export function BattleHealthBar({label,hp,max,side}:{label:string;hp:number;max:number;side:string}) {
  return <div className={`battle-health battle-health-${side}`}>
    <div><span>{label}</span><strong>{hp}<small> / {max}</small></strong></div>
    <div role="progressbar" aria-label={`${side} HP`} aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp} className="battle-hp-track"><span style={{width:`${100*hp/max}%`}} /></div>
  </div>;
}
export const BossBattlePanel = memo(function BossBattlePanel({battle:b,offline=false,combo=0,debug=false,recording=false,suppressResult=false,suspendAnimation=false,audioOutput,layoutOverride,authoritativeHud=false}:{battle:BattleView;offline?:boolean;combo?:number;debug?:boolean;recording?:boolean;suppressResult?:boolean;suspendAnimation?:boolean;audioOutput?:AudioOutput;layoutOverride?:BossBattleLayoutConfig;authoritativeHud?:boolean}) {
  const mode=gameModeRegistry[b.config.gameMode];
  const [modeNotice,setModeNotice]=useState<{key:string;text:string}>();
  const noticed=useRef({attempt:b.attemptId,phase:b.phase,shields:b.shields});
  useEffect(()=>{
    const prior=noticed.current;noticed.current={attempt:b.attemptId,phase:b.phase,shields:b.shields};
    if(offline)return;
    if(prior.attempt!==b.attemptId&&b.status==='active')setModeNotice({key:`${b.attemptId}:mode`,text:mode.title.toUpperCase()});
    else if(prior.phase!==b.phase&&b.phase==='enraged'&&b.status==='active')setModeNotice({key:`${b.attemptId}:enrage`,text:'ENRAGED'});
    else if((b.shields??0)>(prior.shields??0))setModeNotice({key:`${b.attemptId}:shield:${b.revision}`,text:'SHIELD CHARGED'});
  },[b.attemptId,b.phase,b.shields,b.status,b.revision,mode.title,offline]);
  useEffect(()=>{if(!modeNotice)return;const timeout=setTimeout(()=>setModeNotice(undefined),1800);return()=>clearTimeout(timeout);},[modeNotice]);
  const layout=layoutOverride??(recording?recordingBattleLayout:battleLayout);
  const {presentation:combatPresentation,metrics}=useBattlePresentation(b,combo,offline);
  const pressurePresentation=usePressurePresentation(b,combatPresentation,offline||suppressResult||suspendAnimation,audioOutput);
  const storyEvent=useStoryEvent(b,offline||suppressResult||suspendAnimation);
  const presentation=useStoryReaction(b,pressurePresentation,storyEvent,audioOutput);
  useCombatAudio(b,presentation,audioOutput,offline||suspendAnimation||suppressResult,suppressResult);
  const finisher=offline?undefined:presentation.finisher;
  const [outcome,setOutcome]=useState<{key:string;status:string;title:string;detail:string}>();
  const outcomeSeen=useRef(b.status==="victory"||b.status==="defeat"?`${b.attemptId}:${b.status}`:"");
  useEffect(()=>{
    const round=presentation.roundEnding;
    if(round&&presentation.finished&&presentation.outcomeAt&&!offline){
      const key=`${round.id}:${round.result}`;
      if(outcomeSeen.current!==key){outcomeSeen.current=key;setOutcome({key,status:round.result!,title:round.result==='victory'?'BOSS DEFEATED':'YOU WERE DEFEATED',detail:`Round ${round.number} · ${b.roundWins??0}W–${b.roundLosses??0}L`});}
      return;
    }
    const key=`${b.attemptId}:${b.status}`;
    if(offline||!(b.status==="victory"||b.status==="defeat")){setOutcome(undefined);return;}
    if(outcomeSeen.current===key||!presentation.finished)return;
    outcomeSeen.current=key;
    if(presentation.outcomeAt&&(!b.result||b.result==="knockout"||b.result==="timeout"))setOutcome({key,status:b.status,
      title:b.status==="victory"?"BOSS DEFEATED":b.result==="timeout"?"TIME UP":"YOU WERE DEFEATED",
      detail:b.status==="victory"?`${b.correctHits} correct notes`:`${b.bossHp} boss HP remained`});
  },[b.attemptId,b.status,b.result,b.lastAt,b.correctHits,b.bossHp,b.roundWins,b.roundLosses,offline,presentation.finished,presentation.outcomeAt,presentation.roundEnding]);
  useEffect(()=>{if(!outcome)return;const timer=setTimeout(()=>setOutcome(undefined),battleLayout.outcomeDuration);return()=>clearTimeout(timer);},[outcome]);
  useEffect(()=>{preloadCharacter(b.config.playerId);preloadCharacter(b.config.bossId);},[b.config.playerId,b.config.bossId]);
  const terminal=b.status==="victory"||b.status==="defeat";
  const label=terminal&&!presentation.finished&&(!b.result||b.result==="knockout")?"FINISHING STRIKE":b.status==="victory"?"BOSS DEFEATED":b.status==="defeat"?(b.result==="abandoned"?"BATTLE ABANDONED":b.result==="unfinished"?"BATTLE FINISHED":b.result==="timeout"?"TIME UP":"YOU WERE DEFEATED"):offline?"CONNECTION PAUSED":b.status==="paused"?"PAUSED":b.waiting?"NEXT ATTEMPT":b.status==="active"?"BATTLE IN PROGRESS":"READY TO BATTLE";
  const paused=offline||b.status==="paused"||suspendAnimation;
  const showResult=!recording||terminal||paused;
  const displayedRound=presentation.roundEnding??b.round;
  // Move the old power allocation from the boss footer to the player header.
  // Ultimate also needs a shield row at the compact 750px recording height.
  const playerResourceSpace=b.power?(mode.shields?4.5:3):0;
  return <aside className="boss-battle-panel" aria-label="Boss battle" data-game-mode={b.config.gameMode} data-boss-phase={b.phase} data-battle-status={b.status} data-battle-attempt={b.attemptId} data-phase={presentation.phase} data-pending-batches={metrics.pending} data-combat-metrics={JSON.stringify(metrics)} data-combination={presentation.combination?.id} data-combination-hit={presentation.combination?.hit} data-authoritative-player-hp={b.playerHp} data-authoritative-boss-hp={b.bossHp} data-finisher={finisher?.tone} style={{
    "--battle-duration":`${200/b.config.animationSpeed}ms`,"--battle-hud":`${layout.hudHeightPercent+playerResourceSpace}%`,
    "--battle-arena":`${layout.arenaHeightPercent}%`,"--battle-status":`${layout.statusHeightPercent-playerResourceSpace}%`,
    "--outcome-duration":`${b.config.multiRoundEnabled?b.config.roundTransitionMs:battleLayout.outcomeDuration}ms`,
  } as CSSProperties}>
    <header className="battle-hud">{!recording&&<div className="battle-brand"><span className="battle-emblem">LPF</span><span>BOSS BATTLE</span></div>}
      <div className="battle-player-row">
        {mode.health&&<BattleHealthBar label={battleCharacters[b.config.playerId].shortName} hp={authoritativeHud?b.playerHp:presentation.displayHp?.player??b.playerHp} max={b.config.playerMaxHp} side="player"/>}
        {!mode.health&&<span className="battle-player-name">{battleCharacters[b.config.playerId].shortName}</span>}
        {mode.timed&&b.timer&&<div className="battle-clock-shields"><BattleCountdown timer={b.timer} paused={offline}/></div>}
      </div>
      <ComboPower battle={b}/>
      {mode.shields&&<ShieldInventory count={b.shields??0}/>}
    </header>
    <BattleStage battle={b} presentation={presentation} paused={paused} finisher={finisher} debug={debug} config={layout}>
      <BattleLoopNotice battle={b}/>
      {!suppressResult&&!storyEvent&&modeNotice&&<div key={modeNotice.key} className="battle-mode-notice" role="status">{modeNotice.text}</div>}
      {b.config.multiRoundEnabled&&displayedRound&&<div className="battle-round-counter" data-round={displayedRound.number}><strong>{b.exerciseEnded?'BATTLE COMPLETE':`ROUND ${displayedRound.number}`}</strong><span>{b.roundWins??0}W–{b.roundLosses??0}L</span></div>}
      {!suppressResult&&outcome&&(!b.config.multiRoundEnabled||!!presentation.roundEnding||terminal)&&<div key={outcome.key} className={`battle-outcome battle-outcome-${outcome.status}`} role="status"><small>{b.config.multiRoundEnabled?'ROUND COMPLETE':'BATTLE COMPLETE'}</small><strong>{outcome.title}</strong><span>{outcome.detail}</span></div>}
      {debug&&<output className="battle-debug-readout">{presentation.phase} · {metrics.pending} queued (max {metrics.maxQueue})<br/>Contact latency avg {Math.round(metrics.averageLatencyMs)} / max {Math.round(metrics.maxLatencyMs)} ms<br/>{metrics.damageEvents} damage events · {metrics.visualStrikes} strikes · {metrics.coalescedEffects} merges · {metrics.skippedVisualHits} skipped visuals</output>}
    </BattleStage>
    <footer className="battle-status">
      <BattleHealthBar label={battleCharacters[b.config.bossId].shortName} hp={authoritativeHud?b.bossHp:presentation.displayHp?.boss??b.bossHp} max={presentation.roundEnding?.bossMaxHp??b.bossMaxHp} side="boss"/>
      {suppressResult?null:storyEvent?<BattleStoryNotice event={storyEvent}/>:showResult?<div className={`battle-result ${terminal?`battle-result-${b.status}`:""}`} role="status"><strong>{label}</strong></div>:
        <span className="battle-difficulty">{mode.health?`${bossDifficultyLabel(b.config.bossDamagePerMistake)} · −${Math.min(b.config.playerMaxHp,Math.ceil(b.config.bossDamagePerMistake*(mode.enrage?enrageMultipliers[b.phase??'normal']:1)))} HP / mistake`:'TIME ATTACK'}{mode.enrage&&b.phase!=='normal'?` · ${b.phase?.toUpperCase()}`:''}</span>}

    </footer>
  </aside>;
});
