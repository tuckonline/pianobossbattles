import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import type {OverlayState} from './obs-state';
import {BossBattlePanel} from './boss-ui';
import {ObsScore} from './obs-score';
import {BattleCinematicOverlay,useBattleCinematic} from './battle-cinematic-ui';
import {obsCinematicAudio} from './battle-audio-ui';
import {shortsBattleLayout} from './shorts-layout';
import {defaultShortsDisplay} from './shorts-display';
import {GameCelebrations} from './game-ui';
import './shorts.css';
export function ShortsPresentation({data,transport,offline,cinematic}:{data:OverlayState|null;transport:'direct'|'cloud';offline:boolean;cinematic:ReturnType<typeof useBattleCinematic>}){
  const s=data?.snapshot,b=s?.game?.battle,g=s?.game;
  const display=data?.gamePlayer?.settings.shortsDisplay??g?.settings.shortsDisplay??defaultShortsDisplay;
  const layout=useMemo(()=>({...shortsBattleLayout,characterScale:display.characterScale/100}),[display.characterScale]);
  const measure=s?Math.min(s.totalMeasures,Math.max(1,s.status==='complete'?s.totalMeasures:s.score?.activeMeasure!==undefined?s.score.activeMeasure+1:s.measure)):0;
  const [clock,setClock]=useState(()=>Date.now()),root=useRef<HTMLElement>(null);
  useEffect(()=>{if(!s?.shorts?.markerUntil)return;const id=setTimeout(()=>setClock(Date.now()),Math.max(0,s.shorts.markerUntil-Date.now())+20);return()=>clearTimeout(id);},[s?.shorts?.markerUntil]);
  useEffect(()=>{
    const report=(event:Event)=>{if(window.parent!==window)window.parent.postMessage({type:'lpf-shorts-fit',...(event as CustomEvent).detail},location.origin);};
    const node=root.current;node?.addEventListener('shorts-notation-fit',report);return()=>node?.removeEventListener('shorts-notation-fit',report);
  },[]);
  const params=new URLSearchParams(location.search),camera=Math.min(35,Math.max(15,Number(params.get('camera')??25)||25));
  const battle=Math.min(50,Math.max(30,Number(params.get('battle')??40)||40)),silent=params.has('displayPreview');
  const active=cinematic.phase!=='hidden',marker=s?.shorts?.markerUntil&&s.shorts.markerUntil>Math.max(clock,data?.updatedAt??0)?s.shorts.marker:undefined;
  return <main ref={root} className="shorts-view" aria-label="Vertical Shorts recording view" data-score-transport={transport} data-character-scale={display.characterScale} style={{
    '--shorts-camera':`${camera}fr`,'--shorts-content':`${90-camera}fr`,'--shorts-battle':`${battle}fr`,'--shorts-score':`${90-camera-battle}fr`,
    '--shorts-safe-left':`${display.safeLeft}vw`,'--shorts-safe-right':`${display.safeRight}vw`,'--shorts-safe-top':`${display.safeTop}vh`,'--shorts-safe-bottom':`${display.safeBottom}vh`,
  } as CSSProperties}>
    <div className="shorts-main">
      <section className="shorts-combat" aria-label="Shorts battle arena">
        {b?.config.enabled?<BossBattlePanel battle={b} combo={g?.live.combo??0} offline={offline} recording layoutOverride={layout} suppressResult={active} suspendAnimation={cinematic.phase==='holding'} audioOutput={silent?undefined:'obs'}/>:
          <div className="shorts-no-boss"><strong>{g?.live.combo??0}</strong><span>NOTES IN A ROW</span></div>}
      </section>
      <section className="shorts-notation" aria-label="Current musical system">{s&&<ObsScore snapshot={s} transport={transport} offline={offline} embedded notationOnly shortsDisplay={display}/>}</section>
      <div className="shorts-ending"><BattleCinematicOverlay playback={cinematic.playback} onAudioCue={silent?undefined:obsCinematicAudio}/></div>
      <div className="shorts-celebrations">{g&&<GameCelebrations alerts={offline||silent?[]:g.alerts} settings={g.settings} scene={`${g.sessionId}:${s?.exerciseNumber}`} preview={g.preview} blocked={active} receiptKey={data?.gamePlayer?.userId?`shorts:${data.gamePlayer.userId}`:undefined}/>}</div>
      {marker&&<output className="shorts-sync" aria-label="Recording sync marker">{marker}</output>}
    </div>
    <div className="shorts-camera" aria-label="Transparent area for separate OBS keyboard camera"/>
    <footer className="shorts-progress"><header className="shorts-brand"><svg viewBox="0 0 32 24" role="img" aria-label="YouTube"><rect x="0" y="1" width="32" height="22" rx="6" fill="#c94751"/><path d="M13 7v10l9-5z" fill="#fff"/></svg><span>@PianoBossBattles</span></header><p className="shorts-exercise">{s?.title??'Learn Piano Fast'}</p><div><strong>{g?.live.combo??0}</strong><span>NOTE COMBO</span></div><div><strong>{s?.accuracy===null||s?.accuracy===undefined?'—':`${s.accuracy}%`}</strong><span>ACCURACY</span></div><div><strong>{measure}<small> / {s?.totalMeasures??0}</small></strong><span>MEASURE</span></div><div className="shorts-progress-track"><i style={{width:`${s?100*measure/s.totalMeasures:0}%`}}/></div></footer>
  </main>;
}
