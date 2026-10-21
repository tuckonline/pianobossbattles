import {useEffect,useState,type CSSProperties} from 'react';
import {ObsOverlay} from '../hosted/obs';
import type {OverlayState} from '../hosted/obs-state';
import {ObsScore} from '../hosted/obs-score';
import {BossBattlePanel} from '../hosted/boss-ui';
import {shortsBattleLayout} from '../hosted/shorts-layout';
import {BattleCinematicOverlay,type useBattleCinematic} from '../hosted/battle-cinematic-ui';
import {obsCinematicAudio} from '../hosted/battle-audio-ui';
import {GameCelebrations} from '../hosted/game-ui';
import {defaultShortsDisplay} from '../hosted/shorts-display';
import {notationPresets} from '../src/components/music/notation-presets';
import {defaultCreatorPreferences} from './creator-config';
import './notation-appearance.css';
import '../hosted/shorts.css';
import './creator.css';
export function CreatorViewer(){
 const [ready,setReady]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  document.documentElement.classList.add('obs-mode');
  const token=new URLSearchParams(location.hash.slice(1)).get('view');
  // Fragments are never sent to HTTP servers/referrers. Remove after exchange;
  // the narrow HttpOnly cookie supports normal OBS refresh and reconnect.
  history.replaceState(null,'',location.pathname+location.search);
  const request=token?fetch('/api/creator/view/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})}):fetch('/api/creator/view');
  void request.then(async r=>{if(!r.ok)throw Error((await r.json()).error??'Viewing link unavailable');setReady(true);}).catch(e=>setError(e.message));
  return()=>document.documentElement.classList.remove('obs-mode');
 },[]);
 if(!ready)return <main className="creator-view-message" role="status">{error||'Connecting to Creator Studio…'}</main>;
 return <ObsOverlay unified creator vertical={location.pathname.endsWith('/vertical')}/>;
}
export function CreatorPresentation({data,offline,transport,cinematic,vertical}:{data:OverlayState|null;offline:boolean;transport:'cloud'|'direct';cinematic:ReturnType<typeof useBattleCinematic>;vertical:boolean}){
 const p=data?.creator??defaultCreatorPreferences,s=data?.snapshot,g=s?.game,b=g?.battle,palette=notationPresets[p.notation];
 const active=cinematic.phase!=='hidden';
 const layout={...shortsBattleLayout,characterScale:p.characterScale/100};
 const style={'--notation-paper':palette.paper,'--notation-ink':palette.ink,'--notation-current':palette.current,'--notation-correct':palette.correct,'--notation-incorrect':palette.incorrect,
 '--creator-arena':`${p.horizontalArenaPercent}%`,'--creator-camera':`${p.cameraPercent}fr`,'--creator-content':`${94-p.cameraPercent}fr`,'--creator-battle':`${p.arenaPercent}fr`,'--creator-score':`${94-p.cameraPercent-p.arenaPercent}fr`,'--creator-hud':p.hudScale/100} as CSSProperties;
 return <main className={`creator-output ${vertical?'creator-vertical':'creator-horizontal'}`} data-notation-preset={p.notation} data-score-transport={transport} style={style} aria-label={`${vertical?'Vertical':'Horizontal'} creator recording`}>
  <header className="creator-output-banner"><strong>{s?.title??'Piano Boss Battles'}</strong><span><svg viewBox="0 0 32 24" aria-hidden="true"><rect y="1" width="32" height="22" rx="6" fill="#c94751"/><path d="M13 7v10l9-5z" fill="white"/></svg>@PianoBossBattles</span><small>{s?`${s.hand==='both'?'Both hands':s.hand+' hand'} · Measure ${s.measure}/${s.totalMeasures}`:'Waiting for Creator Studio'}</small></header>
  <div className={`creator-output-content${vertical?' shorts-main':''}`}>
   <section className="creator-arena" aria-label="Battle arena">{b?.config.enabled?<BossBattlePanel authoritativeHud={offline||b.status==='paused'} battle={b} combo={g?.live.combo??0} offline={offline} recording layoutOverride={layout} suppressResult={active} suspendAnimation={cinematic.phase==='holding'} audioOutput="obs"/>:<div className="creator-view-message">{g?`${g.live.combo} notes in a row`:'Waiting for battle'}</div>}</section>
   <section className="creator-score" aria-label="Sheet music">{s&&<ObsScore snapshot={s} offline={offline} transport={transport} embedded notationOnly shortsDisplay={{...defaultShortsDisplay,notationScale:p.notationScale,notationView:p.measures}}/>}</section>
   <div className={vertical?'creator-ending shorts-ending':'creator-ending'}><BattleCinematicOverlay playback={cinematic.playback} onAudioCue={obsCinematicAudio}/></div>
   <div className="creator-celebrations">{g&&<GameCelebrations alerts={offline?[]:g.alerts} settings={g.settings} scene={`${g.sessionId}:${s?.exerciseNumber}`} blocked={active} receiptKey={`creator:${data?.viewerKey}`}/>}</div>
  </div>
  {vertical&&<div className="creator-camera" aria-label="Transparent space for separate OBS piano camera"/>}
 </main>;
}
