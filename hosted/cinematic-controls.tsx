import { useEffect, useState } from 'react';
import { gameClient, useGame } from './game-client';
import type { GameSettings } from './game-core';
import { defaultCinematicSettings, type CinematicSettings } from './cinematic-config';
import { battleResultId, cinematicDefinitions, type CinematicPlayback, type CinematicResult } from './battle-cinematic';
import { BattleCinematicOverlay, useBattleCinematic } from './battle-cinematic-ui';
import { practiceCinematicAudio } from './battle-audio-ui';

export function CinematicControls({settings,onChange}:{settings:GameSettings;onChange:(s:CinematicSettings)=>void}) {
  const game=useGame(),s=settings.cinematics??defaultCinematicSettings,id=battleResultId(game.battle);
  const set=<K extends keyof CinematicSettings>(key:K,value:CinematicSettings[K])=>onChange({...s,[key]:value});
  return <fieldset className="cinematic-settings"><legend>Battle result cinematics</legend><div className="cinematic-options">
    <label><input type="checkbox" checked={s.enabled} onChange={e=>set('enabled',e.target.checked)}/>Enable OBS cinematics</label>
    <label><input type="checkbox" checked={s.practice} onChange={e=>set('practice',e.target.checked)}/>Also show over my practice score</label>
    <label>Result intensity<select value={s.intensity} onChange={e=>set('intensity',e.target.value as CinematicSettings['intensity'])}><option>low</option><option>medium</option><option>high</option></select></label>
    <label>Animation duration<select value={s.durationMultiplier} onChange={e=>set('durationMultiplier',Number(e.target.value))}><option value="0.5">Half</option><option value="1">Normal</option><option value="1.5">Longer</option><option value="2">Double</option></select></label>
    <label><input type="checkbox" checked={s.showStats} onChange={e=>set('showStats',e.target.checked)}/>Show result statistics</label>
    <label>Result motion<select value={s.reducedMotion} onChange={e=>set('reducedMotion',e.target.value as CinematicSettings['reducedMotion'])}><option value="auto">Respect device outside OBS</option><option value="always">Reduced motion everywhere</option><option value="never">Full motion</option></select></label>
    <button type="button" disabled={!id} onClick={()=>gameClient.dismissCinematic(id)}>Dismiss result in recording view</button>
  </div><small>Result screens stay visible until you restart, start another attempt, choose another exercise, or dismiss them. Optional audio follows Battle sounds and the selected output; dismissing reveals your current practice state.</small></fieldset>;
}

export function PracticeCinematic({exerciseNumber,force=false}:{exerciseNumber:number;force?:boolean}) {
  const game=useGame(),s=game.player.settings.cinematics??defaultCinematicSettings;
  const frame=useBattleCinematic({battle:game.battle,exerciseId:exerciseNumber,bestCombo:game.live.attemptBest??game.live.best,
    settings:s,enabled:s.enabled&&(s.practice||force),dismissedId:gameClient.overlay().cinematicDismissedId},`practice:${game.player.userId}`,false);
  return <><BattleCinematicOverlay playback={frame.playback} onAudioCue={practiceCinematicAudio}/>{frame.playback&&<button type="button" style={{position:'absolute',right:12,top:12,zIndex:31}} onClick={()=>gameClient.dismissCinematic(frame.playback!.id)}>Skip cinematic</button>}</>;
}

/** Explicit developer opt-in on the practice URL. Never mounted in OBS. */
export function CinematicDeveloperPreview() {
  const [playback,setPlayback]=useState<CinematicPlayback>(),[time,setTime]=useState(0),[playing,setPlaying]=useState(false);
  const [half,setHalf]=useState(false),[debug,setDebug]=useState(false),[missing,setMissing]=useState(false),[reduced,setReduced]=useState(false),[size,setSize]=useState('1920/634');
  useEffect(()=>{
    if(!playing||!playback)return;
    let frame=0,previous=performance.now();
    const tick=(now:number)=>{const delta=(now-previous)*(half?.5:1);previous=now;setTime(t=>Math.min(cinematicDefinitions[playback.result].durationMs,t+delta));frame=requestAnimationFrame(tick);};
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[playing,half,playback]);
  useEffect(()=>{if(playback&&time>=cinematicDefinitions[playback.result].durationMs)setPlaying(false);},[time,playback]);
  const play=(result:CinematicResult)=>{
    setPlayback({id:`preview:${crypto.randomUUID()}`,attemptId:'preview',exerciseId:0,result,mode:'survival',startedAt:0,resultAt:0,settings:{...defaultCinematicSettings},reducedMotion:reduced,stats:{playerHp:26,bossHp:result==='victory'?0:21,bossMaxHp:66,mistakes:3,bestCombo:42,progress:68}});setTime(0);setPlaying(true);
  };
  return <details className="cinematic-settings"><summary>Developer cinematic preview · no rewards</summary>
    <div className="cinematic-preview-toolbar">{(['victory','defeat','timeout'] as const).map(result=><button type="button" key={result} onClick={()=>play(result)}>Preview {result}</button>)}
      <button type="button" onClick={()=>setPlaying(!playing)}>{playing?'Pause preview':'Play preview'}</button>
      <button type="button" onClick={()=>{setPlaying(false);setTime(playback?cinematicDefinitions[playback.result].stages[3].startMs:0);}}>Skip to impact</button>
      <button type="button" onClick={()=>{setPlaying(false);setTime(playback?cinematicDefinitions[playback.result].stages[4].startMs+300:0);}}>Skip to results</button>
      <button type="button" onClick={()=>{setPlaying(false);setPlayback(undefined);setTime(0);}}>Cancel cinematic preview</button>
      <label><input type="checkbox" checked={half} onChange={e=>setHalf(e.target.checked)}/>Half speed</label>
      <label><input type="checkbox" checked={debug} onChange={e=>setDebug(e.target.checked)}/>Debug bounds</label>
      <label><input type="checkbox" checked={missing} onChange={e=>setMissing(e.target.checked)}/>Missing assets</label>
      <label><input type="checkbox" checked={reduced} onChange={e=>{setReduced(e.target.checked);setPlayback(p=>p?{...p,reducedMotion:e.target.checked}:p);}}/>Reduced motion preview</label>
      <label>Preview viewport<select value={size} onChange={e=>setSize(e.target.value)}><option value="1920/634">1920 × 750 recording</option><option value="1920/964">1920 × 1080 recording</option><option value="1280/590">1280 × 720 recording</option></select></label>
      <input aria-label="Cinematic timeline" type="range" min="0" max={playback?cinematicDefinitions[playback.result].durationMs:4800} value={time} onChange={e=>{setPlaying(false);setTime(Number(e.target.value));}}/>
      <output>{Math.round(time)} ms</output>
    </div><div className="cinematic-preview-stage" style={{aspectRatio:size}}><BattleCinematicOverlay playback={playback} atMs={time} debug={debug} missingAssets={missing}/></div>
  </details>;
}
