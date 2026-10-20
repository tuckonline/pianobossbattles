import {useEffect,useLayoutEffect,useState,useSyncExternalStore} from 'react';
import {battleAudio,claimBattleAudio,isObsAudioSource,type AudioOutput,type BattleSound,type AudioDiagnostics} from './battle-audio';
import {combatAudioCues} from './battle-audio-cues';
import {useBattlePresentation} from './battle-presentation-hook';
import {useGame} from './game-client';
import type {BossBattleConfig} from './boss-config';
import type {BattleView} from './boss-battle';
import type {BattlePresentation} from './battle-animation-director';
import type {CinematicAudioCue} from './battle-cinematic-ui';
import {usePracticeCinematicActive} from './battle-cinematic-ui';

export function useBattleAudioOutput(config:BossBattleConfig|undefined,user:string|undefined,role:AudioOutput,eligible=true) {
  useLayoutEffect(()=>{if(config)battleAudio.configure(config);},[config]);
  useEffect(()=>user?claimBattleAudio(user,role,eligible):undefined,[user,role,eligible]);
}
export function useCombatAudio(b:BattleView,p:BattlePresentation,role:AudioOutput|undefined,offline:boolean,suppressResult:boolean) {
  useEffect(()=>{
    if(!role||offline||!b.config.enabled||b.status==='paused'||battleAudio.snapshot().output!==role)return;
    const timers=combatAudioCues(b,p,suppressResult).map(cue=>{
      const play=()=>{if(battleAudio.snapshot().output===role)battleAudio.play(cue.kind,cue.id,cue.at);};
      const delay=cue.at-Date.now();if(delay>0)return setTimeout(play,delay);
      play();return undefined;
    });
    return()=>timers.forEach(clearTimeout);
  },[b,p,role,offline,suppressResult]);
}
export const practiceCinematicAudio=(cue:CinematicAudioCue)=>cinematicAudio(cue,'practice');
export const obsCinematicAudio=(cue:CinematicAudioCue)=>cinematicAudio(cue,'obs');
function cinematicAudio(cue:CinematicAudioCue,role:AudioOutput) {
  if(battleAudio.snapshot().output!==role)return;
  battleAudio.play(cue.cue==='result'?cue.result:cue.result==='victory'?'power':'heavy',`${cue.id}:cinematic:${cue.cue}`);
}
function PracticeCombatAudio() {
  const game=useGame(),{presentation}=useBattlePresentation(game.battle,game.live.combo,false);
  useCombatAudio(game.battle,presentation,'practice',usePracticeCinematicActive(),game.player.settings.cinematics.enabled&&game.player.settings.cinematics.practice);
  return null;
}
export function PracticeAudioOutput() {
  const game=useGame(),config=game.player.settings.bossBattle;
  useBattleAudioOutput(config,game.player.userId,'practice');
  return config.enabled&&config.soundEnabled&&config.audioOutput==='practice'?<PracticeCombatAudio/>:null;
}
export function useObsAudioOutput(config:BossBattleConfig|undefined,user:string|undefined,unified:boolean) {
  useBattleAudioOutput(config,user,'obs',unified&&isObsAudioSource());
}
export function BattleAudioControls({config,onChange}:{config:BossBattleConfig;onChange:(s:BossBattleConfig)=>void}) {
  const status=useSyncExternalStore(battleAudio.subscribe,battleAudio.snapshot,battleAudio.snapshot);
  const [remote,setRemote]=useState<{at:number;data:AudioDiagnostics}>();
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{
    const receive=(event:Event)=>{const data=(event as CustomEvent<AudioDiagnostics>).detail;setRemote(prior=>!data.owner&&prior?.data.owner&&Date.now()-prior.at<3000?prior:{at:Date.now(),data});};
    window.addEventListener('battle-audio-status',receive);
    const timer=setInterval(()=>setNow(Date.now()),2000);
    return()=>{window.removeEventListener('battle-audio-status',receive);clearInterval(timer);};
  },[]);
  const tests:[BattleSound,string][]=[['heroSwing','Test hero attack'],['bossSwing','Test boss attack'],['heavy','Test heavy impact'],['victory','Test victory sound'],['defeat','Test defeat sound'],['timeout','Test TIME OUT sound']];
  return <fieldset className="cinematic-settings" aria-label="Battle audio settings"><legend>Battle sound output &amp; diagnostics</legend>
    <label>Play battle sounds through <select aria-label="Battle audio output" value={config.audioOutput} onChange={e=>onChange({...config,audioOutput:e.target.value as AudioOutput})}><option value="practice">Practice browser</option><option value="obs">OBS Browser Source</option></select></label>
    <p>Choose OBS for recording. In OBS, use the /obs/recording or /obs/shorts Browser Source, enable <strong>Control audio via OBS</strong>, unmute its mixer channel, and set monitoring as needed. Other browser previews stay silent. If blocked, choose Interact on the source and click inside it once.</p>
    <p>Approved Sonniss effects are trimmed and balanced for piano practice. Short hits rotate; creature and effort voices are spaced out during rapid passages. Start around 40% Battle volume, then balance against your actual piano recording. TIME OUT retains its original sound.</p>
    <p>Test Battle Sound auditions effects in this browser only. These tests never change HP, XP or progress. Keep one audio source per scene; avoid also capturing monitored effects through Desktop Audio.</p>
    <div className="cinematic-options">{tests.map(([kind,title])=><button type="button" key={kind} disabled={!config.soundEnabled||config.volume===0} onClick={async()=>{
      await battleAudio.test(kind);
      if(kind==='heroSwing'||kind==='bossSwing')setTimeout(()=>battleAudio.play(kind==='heroSwing'?'heroImpact':'hurt',`test-contact:${crypto.randomUUID()}`,Date.now(),true),160);
    }}>{title}</button>)}</div>
    <output data-testid="battle-audio-diagnostics">AudioContext: {status.context} · Unlocked: {status.unlocked?'yes':'no'} · Sound: {config.soundEnabled?'enabled':'disabled'} · Master volume: {Math.round(config.volume/.2*100)}%<br/>
      {status.status} · Played: {status.played} · Active effects: {status.active} · Coalesced: {status.dropped} · Last: {status.lastCue} · {status.lastDecision}<br/>{status.assets}
      {status.error&&<span role="status"><br/>{status.error}</span>}
    </output>
    {config.audioOutput==='obs'&&<p role="status" data-testid="obs-audio-diagnostics">{remote&&now-remote.at<6000?`OBS audio: ${remote.data.context} · ${remote.data.unlocked?'unlocked':'blocked / waiting for interaction'} · ${remote.data.status} · Last: ${remote.data.lastCue} · ${remote.data.lastDecision}${remote.data.error?' · '+remote.data.error:''}`:'OBS audio status unavailable. Open the unified source; a direct score connection reports its audio state here. Local tests do not confirm OBS mixer output.'}</p>}
  </fieldset>;
}
