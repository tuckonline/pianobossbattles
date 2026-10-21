import {useState,useSyncExternalStore} from 'react';
import {battleAudio} from '../hosted/battle-audio';
import {gameClient} from '../hosted/game-client';
import type {GameSettings} from '../hosted/game-core';
import {selectPlayerAudio,type PlayerAudio} from '../hosted/player-audio';
import './battle-audio-settings.css';
const choices=[
  {mode:'focus',title:'Focus Mode',description:'Quiet combat so you can concentrate on your piano.'},
  {mode:'immersive',title:'Immersive Mode',description:'Gentle battle effects accompany your playing.'},
  {mode:'cinematic',title:'Cinematic Mode',description:'Experience the full battle mix and dramatic finishes.'},
] as const;
export function BattleAudioSettings({settings,hidden=false}:{settings:GameSettings;hidden?:boolean}) {
  const {playerAudio:audio,bossBattle:config}=settings;
  const status=useSyncExternalStore(battleAudio.subscribe,battleAudio.snapshot,battleAudio.snapshot);
  const [testing,setTesting]=useState(false);
  const audience=config.audioOutput==='obs';
  const save=(value:PlayerAudio)=>void gameClient.playerAudio(value);
  const route=(patch:Partial<Pick<typeof config,'soundEnabled'|'volume'|'audioOutput'>>)=>void gameClient.playerAudio(audio,{soundEnabled:config.soundEnabled,volume:config.volume,audioOutput:config.audioOutput,...patch});
  return <section className="setup-section battle-audio-settings" aria-label="Battle Audio" hidden={hidden}>
    <h2>Battle Audio</h2><p>Your piano sound is unchanged. These settings control combat effects only.</p>
    <div className="audio-presets" role="group" aria-label="Player audio preset">{choices.map(c=><button type="button" key={c.mode} aria-pressed={audio.mode===c.mode} onClick={()=>save(selectPlayerAudio(c.mode,audio))}><strong>{c.title}</strong><small>{c.description}</small></button>)}</div>
    {audience&&<p role="status">Combat effects are routed to OBS. This browser stays silent; your player preset takes effect when you choose This browser in Advanced audio settings.</p>}
    {audio.mode!=='focus'&&<div className="audio-volume"><label>Effects volume <output>{Math.round(audio.volume/.2*100)}%</output><input aria-label="Effects volume" type="range" min="0" max="100" step="1" value={Math.round(audio.volume/.2*100)} onChange={e=>save({...audio,volume:Number(e.target.value)/500})}/></label><button type="button" disabled={testing||audience||audio.volume===0} onClick={async()=>{setTesting(true);try{await battleAudio.test('heroImpact');}finally{setTesting(false);}}}>{testing?'Loading sound…':'Test Sound'}</button></div>}
    {status.error&&audio.mode!=='focus'&&!audience&&<p role="status">{status.error}</p>}
    <details className="advanced-audio"><summary>Advanced audio settings</summary>
      <label>Combat audio output<select value={config.audioOutput} onChange={e=>route({audioOutput:e.target.value as 'practice'|'obs'})}><option value="practice">This browser</option><option value="obs">OBS audience source</option></select></label>
      {audience&&<><label className="check"><input type="checkbox" checked={config.soundEnabled} onChange={e=>route({soundEnabled:e.target.checked})}/>Enable OBS battle effects</label><label>Audience effects volume <output>{Math.round(config.volume/.2*100)}%</output><input aria-label="Audience effects volume" type="range" min="0" max="100" value={Math.round(config.volume/.2*100)} onChange={e=>route({volume:Number(e.target.value)/500})}/></label></>}
      <p>Only the selected destination plays combat effects. In OBS, enable “Control audio via OBS” for your designated Browser Source. Keep monitoring off if you do not want to hear it, and include that source in your recording tracks. The existing audio-owner rules keep a second source silent.</p>
      <p>OBS audio requires a separate Browser Source output; selecting a player preset alone does not create one. If playback is blocked, use OBS Interact and click inside the designated source.</p>
      <output className="audio-status">Local audio: {status.context} · {status.unlocked?'unlocked':'waiting for interaction'} · {status.status}</output>
    </details>
  </section>;
}
