import { useEffect, useState } from 'react';
import { battleTempoPresets, timedTempoStages, countdownLabel, gameModeRegistry, remainingTime, timerAllowances, type ExerciseTimer, type GameMode } from './battle-modes';
import type { BossBattleConfig } from './boss-config';
import type { BattleView } from './boss-battle';

// A local presentation clock interpolates snapshots; it never adjudicates a
// timeout, alters battle state, or subscribes to the piano.
export function BattleCountdown({timer,paused=false}:{timer:ExerciseTimer;paused?:boolean}) {
  const [remaining,setRemaining]=useState(()=>remainingTime(timer));
  useEffect(()=>{
    const start=performance.now(),base=remainingTime(timer);
    const update=()=>setRemaining(Math.max(0,base-(timer.running&&!paused?performance.now()-start:0)));
    update();if(!timer.running||paused)return;
    const tick=setInterval(update,100);return()=>clearInterval(tick);
  },[timer,paused]);
  const fraction=remaining/Math.max(1,timer.limitMs);
  const stage=timer.tempoStage===undefined?undefined:timedTempoStages[timer.tempoStage];
  return <div className="battle-countdown" data-warning={fraction<.1?'red':fraction<.2?'amber':'none'} data-running={timer.running&&!paused&&remaining>0} aria-label="Battle countdown">
    <span className="battle-clock-label"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M9 2h6M12 5V2m6 4 2-2M12 8v5l3 2"/></svg><span>TIME LEFT{stage&&<small className="battle-tempo-stage">{stage.title.toUpperCase()} · {stage.bpm} BPM</small>}</span></span>
    <strong>{timer.issue?'SET LIMIT':countdownLabel(remaining)}</strong>
    <i className="battle-clock-track" aria-hidden="true"><i style={{transform:`scaleX(${Math.max(0,Math.min(1,fraction))})`}}/></i>
  </div>;
}
export function ShieldInventory({count}:{count:number}) {
  return <span className="battle-shields" aria-label={`${count} of 3 shields`}>{[1,2,3].map(n=><svg key={n} viewBox="0 0 20 22" data-charged={count>=n} aria-hidden="true"><path d="M10 1 18 4v7c0 5-8 10-8 10S2 16 2 11V4Z"/></svg>)}</span>;
}
export function ComboPower({battle}:{battle:BattleView}) {
  const power=battle.power;if(!power)return null;
  return <div className="battle-power"><div><span>COMBO POWER</span><strong>{power.charge} / {power.threshold}</strong></div><div role="progressbar" aria-label="Combo Power" aria-valuenow={power.charge} aria-valuemin={0} aria-valuemax={power.threshold}><i style={{width:`${100*power.charge/power.threshold}%`}}/></div></div>;
}
export function BattleModeControls({config,active,disabled,onChange}:{config:BossBattleConfig;active:BattleView;disabled:boolean;onChange:(c:BossBattleConfig)=>void}) {
  const [customTempo,setCustomTempo]=useState(!battleTempoPresets.some(p=>p.bpm===config.selectedBpm));
  const set=(patch:Partial<BossBattleConfig>)=>onChange({...config,...patch});
  const mode=gameModeRegistry[config.gameMode];
  return <div className="battle-mode-controls">
    <div className="boss-options"><label>Game mode<select aria-label="Game mode" value={config.gameMode} disabled={disabled} onChange={e=>set({gameMode:e.target.value as GameMode})}>{Object.entries(gameModeRegistry).map(([id,m])=><option key={id} value={id}>{m.title}</option>)}</select></label>
    {(mode.timed||config.pressureReactions)&&<>
      <label>Practice tempo<select aria-label="Practice tempo preset" disabled={mode.timed&&config.progressiveTempo} value={customTempo||!battleTempoPresets.some(p=>p.bpm===config.selectedBpm)?'custom':config.selectedBpm} onChange={e=>{setCustomTempo(e.target.value==='custom');if(e.target.value!=='custom')set({selectedBpm:Number(e.target.value)});}}><option value="custom">Custom BPM</option>{battleTempoPresets.map(p=><option key={p.bpm} value={p.bpm}>{p.title} · {p.bpm} BPM</option>)}</select></label>
      <label>Quarter-note BPM<input aria-label="Practice BPM" disabled={mode.timed&&config.progressiveTempo} type="number" min="20" max="300" value={config.selectedBpm} onChange={e=>{const n=+e.target.value;if(n>=20&&n<=300)set({selectedBpm:Math.round(n)});}}/></label>
    </>}
    {mode.timed&&<>
      <label className="check"><input type="checkbox" checked={config.progressiveTempo} onChange={e=>set({progressiveTempo:e.target.checked})}/>Progressive speed challenge</label>
      {config.progressiveTempo&&<p>Easy 60 → Normal 80 → Hard 110 → Expert 140 BPM. Advance after each exercise or loop; stay at Expert thereafter. Each pass gets its own clock with no carried-over time. Choose at least 4 passes to play all four stages. HP and combos continue, with only one opening countdown. A manual limit is the Easy-stage allowance and shortens at each faster speed.</p>}
      <label>Timer allowance<select aria-label="Timer allowance" value={config.allowanceMultiplier} onChange={e=>set({allowanceMultiplier:+e.target.value})}>{!timerAllowances.some(p=>p.multiplier===config.allowanceMultiplier)&&<option value={config.allowanceMultiplier}>Custom ×{config.allowanceMultiplier}</option>}{timerAllowances.map(p=><option key={p.multiplier} value={p.multiplier}>{p.title} · ×{p.multiplier}</option>)}</select></label>
      <label>Explicit time limit (seconds per loop)<input aria-label="Explicit time limit" type="number" min="0" max="86400" value={config.explicitTimeLimitSeconds} onChange={e=>{const n=+e.target.value;if(n>=0&&n<=86400)set({explicitTimeLimitSeconds:Math.round(n)});}}/><small>0 uses the score’s musical duration. A manual limit is multiplied by the selected loops.</small></label>
    </>}
    <label>Combo Power threshold<input aria-label="Combo Power threshold" type="number" min="1" max="1000" value={config.powerThreshold} onChange={e=>{const n=+e.target.value;if(n>=1&&n<=1000)set({powerThreshold:Math.round(n)});}}/></label>
    <label className="check"><input type="checkbox" checked={config.adaptivePower} onChange={e=>set({adaptivePower:e.target.checked})}/>Adapt Combo Power for short exercises</label></div>
    <p>{mode.description} One battle spans all selected loops. Mode, damage, timing, and power settings apply when you start the next run.</p>
    {config.gameMode!==active.config.gameMode&&<p role="status">Next run: {mode.title}. Current battle: {gameModeRegistry[active.config.gameMode].title}.</p>}
    {config.bossDamagePerMistake!==active.config.bossDamagePerMistake&&<p role="status">Next battle: {config.bossDamagePerMistake} HP per mistake. This battle stays at {active.config.bossDamagePerMistake} HP per mistake.</p>}
    {mode.health&&config.bossDamagePerMistake>=config.playerMaxHp&&<p>{config.gameMode==='survival'?'One mistake defeats you.':'One unshielded mistake defeats you.'}</p>}
    {active.timer&&<p>{active.timer.issue??(active.timer.tempoStage!==undefined?`${timedTempoStages[active.timer.tempoStage].title} · ${timedTempoStages[active.timer.tempoStage].bpm} BPM · this pass: ${countdownLabel(active.timer.limitMs)}. The clock continues immediately at each pass boundary and pauses with practice.`:`${active.loopCount??1} loop(s) · ${active.musicalBeats??'Explicit'} quarter-note beats · ${active.config.selectedBpm} BPM · time limit ${countdownLabel(active.timer.limitMs)}. The clock starts on your first evaluated note and pauses with practice.`)}</p>}
    <p>Combo Power is visual only. {config.adaptivePower?'Short runs use the smaller of your threshold or 60% of their scored notes. ':''}A wrong note keeps accumulated power.</p>
  </div>;
}
