import {bossProfile} from './boss-registry';
import {storySummaryLines} from './battle-story';
import './battle-story.css';
import {animationById} from './battle-animation-library';
import {BattleAnimationPlayer} from './battle-animation-player';
/* eslint-disable @next/next/no-img-element -- Hosted Vite renderer shares decoded transparent images with the battle cache; Next Image is not available here. */
import { memo, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BattleCinematicController, cinematicAssets, cinematicDefinitions, cinematicFrame, cinematicReceipt, type CinematicFrame, type CinematicInput, type CinematicPlayback } from './battle-cinematic';
import { loadImage } from './battle-animation-player';
import './battle-cinematic.css';
import './grinwick.css';

let practiceActive=false;
const presenceListeners=new Set<()=>void>();
const setPracticePresence=(active:boolean)=>{if(practiceActive===active)return;practiceActive=active;for(const listener of presenceListeners)listener();};
export const usePracticeCinematicActive=()=>useSyncExternalStore(callback=>{presenceListeners.add(callback);return()=>{presenceListeners.delete(callback);};},()=>practiceActive,()=>false);

export function useBattleCinematic(input:CinematicInput,scope:string,recording:boolean) {
  const director=useRef<BattleCinematicController|undefined>(undefined);
  const [frame,setFrame]=useState<CinematicFrame>({phase:'hidden',elapsed:0});
  const latest=useRef(input);latest.current=input;
  const prior=useRef('');
  useEffect(()=>{
    // Each recording viewer must observe its own entrance/contact timeline.
    // A silent preview in another tab must not consume the audio owner's receipt.
    // Session storage survives source refresh; initial terminal snapshots still
    // restore directly to holding even when a new browser session has no receipt.
    director.current=new BattleCinematicController(id=>cinematicReceipt(recording?sessionStorage:localStorage,scope)(id));
    prior.current='';
    let raf=0,disposed=false;
    const update=()=>{
      if(disposed)return;
      const next=director.current!.frame(Date.now()),key=`${next.playback?.id??''}:${next.phase}`;
      if(key!==prior.current){prior.current=key;setFrame(next);if(!recording)setPracticePresence(next.phase!=="hidden");}
      if(next.playback&&next.phase!=='holding'&&!document.hidden)raf=requestAnimationFrame(update);
    };
    const receive=()=>{
      const s=latest.current.settings;
      const reduced=s.reducedMotion==='always'||(s.reducedMotion==='auto'&&!recording&&matchMedia('(prefers-reduced-motion: reduce)').matches);
      director.current!.receive({...latest.current,reducedMotion:reduced},Date.now());
      cancelAnimationFrame(raf);update();
    };
    notify.current=receive;receive();
    // Hidden sources retain their result. On return, elapsed time settles the
    // scene once; neither focus changes nor reconnects restart its entrance.
    const visibility=()=>receive();
    document.addEventListener('visibilitychange',visibility);
    return()=>{disposed=true;cancelAnimationFrame(raf);director.current?.cancel();if(!recording)setPracticePresence(false);notify.current=()=>{};document.removeEventListener('visibilitychange',visibility);};
  },[scope,recording]);
  const notify=useRef(()=>{});
  useLayoutEffect(()=>notify.current(),[input]);
  useEffect(()=>{
    if(!input.enabled)return;
    // Fixed registry, shared sprite image cache, no per-result image allocation.
    for(const path of [...Object.values(cinematicAssets),...(input.battle?.config.bossId==='grinwick'?['/battle/grinwick/a.png','/battle/grinwick/b.png',...Object.values(bossProfile('grinwick').cinematics)]:[])])void loadImage(path).catch(()=>{});
  },[input.enabled,input.battle?.config.bossId]);
  return frame;
}
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const ease=(n:number)=>{const x=clamp(n);return x*x*(3-2*x);};

// Optional integration hook. No AudioContext/dependency is created by playback.
export type CinematicAudioCue={id:string;result:CinematicPlayback['result'];cue:'impact'|'result'};
export const BattleCinematicOverlay=memo(function BattleCinematicOverlay({playback,atMs,debug=false,missingAssets=false,onAudioCue}:{playback?:CinematicPlayback;atMs?:number;debug?:boolean;missingAssets?:boolean;onAudioCue?:(cue:CinematicAudioCue)=>void}) {
  const root=useRef<HTMLDivElement>(null);
  const [ready,setReady]=useState(false);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    if(!playback)return;
    let disposed=false,expired=false;
    setFailed(false);setReady(false);
    const timeout=setTimeout(()=>{expired=true;if(!disposed)setFailed(true);},650);
    void Promise.all([...cinematicDefinitions[playback.result].assets,...(playback.bossId==='grinwick'&&playback.result!=='timeout'?Object.values(bossProfile('grinwick').cinematics):[])].map(loadImage)).then(()=>{
      if(!disposed&&!expired){clearTimeout(timeout);setReady(true);}
    }).catch(()=>{if(!disposed){clearTimeout(timeout);setFailed(true);}});
    return()=>{disposed=true;clearTimeout(timeout);};
  },[playback]);
  useEffect(()=>{
    if(!playback||!root.current)return;
    const el=root.current,d=cinematicDefinitions[playback.result],stages=d.stages;
    let raf=0;const emitted=new Set<string>();
    const paint=()=>{
      const elapsed=atMs??cinematicFrame(playback,Date.now()).elapsed;
      const holding=elapsed>=d.durationMs;
      const t=Math.min(elapsed,stages[5].startMs-1);
      const enter=ease((t-stages[1].startMs)/(stages[1].endMs-stages[1].startMs));
      const action=ease((t-stages[2].startMs)/(stages[2].endMs-stages[2].startMs));
      const impact=clamp((t-stages[3].startMs)/(stages[3].endMs-stages[3].startMs));
      const result=ease((t-stages[4].startMs)/280);
      const down=ease((impact-.15)/.7),reduced=playback.reducedMotion;
      const intensity={low:.35,medium:.65,high:1}[playback.settings.intensity];
      const visible=t>=stages[1].startMs;
      el.style.opacity=String(visible?(reduced?enter:1):0);
      el.style.transform=reduced?'none':`translate3d(${(1-enter)*101}%,0,0)`;
      el.style.setProperty('--action',String(reduced?1:action));
      el.style.setProperty('--down',String(down));
      el.style.setProperty('--title',String(result));
      el.style.setProperty('--title-y',`${reduced?0:(1-result)*18}px`);
      el.style.setProperty('--hit',String(reduced?0:Math.sin(Math.PI*clamp(impact*2))*intensity));
      el.style.setProperty('--slash',String(reduced?0:clamp((action-.6)*3)*(1-clamp(impact*2))));
      el.style.setProperty('--slash-x',`${-25+action*65}%`);
      el.style.setProperty('--hero-x',`${reduced?0:action*14}%`);
      el.style.setProperty('--boss-x',`${reduced?0:down*8}%`);
      el.style.setProperty('--loser-y',`${reduced?0:down*10}%`);
      el.style.setProperty('--drift',`${reduced?0:Math.max(0,t-stages[4].startMs)/1600}%`);
      const phase=holding?'holding':stages.find(s=>elapsed>=s.startMs&&elapsed<s.endMs)?.id??'hidden';
      el.dataset.phase=phase;
      if(!playback.restored&&onAudioCue&&(phase==='impact'||phase==='result')&&!emitted.has(phase)){
        emitted.add(phase);onAudioCue({id:playback.id,result:playback.result,cue:phase});
      }
      if(atMs===undefined&&!holding&&!document.hidden)raf=requestAnimationFrame(paint);
    };
    const repaint=()=>{cancelAnimationFrame(raf);paint();};
    const observer=new ResizeObserver(repaint);observer.observe(el);
    document.addEventListener('visibilitychange',repaint);
    paint();return()=>{cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener('visibilitychange',repaint);};
  },[playback,atMs,onAudioCue]);
  if(!playback)return null;
  const {result,stats,settings}=playback,grinwick=playback.bossId==='grinwick'&&result!=='timeout',fallback=!ready||failed||missingAssets;
  return <div ref={root} className={`battle-cinematic cinematic-${result}${debug?' cinematic-debug':''}`} data-boss={grinwick?"grinwick":undefined} data-cinematic-id={playback.id} data-result={result} data-reduced-motion={playback.reducedMotion} data-fallback={fallback} role="status" aria-label={`${cinematicDefinitions[result].title} cinematic`}>
    <div className="cinematic-atmosphere"/>
    <div className="cinematic-horizon"/>
    <div className="cinematic-lines"/>
    {!fallback&&<div className="cinematic-cast" aria-hidden="true">
      {result!=='timeout'&&<div className="cinematic-hero">
        <img className={result==='defeat'?'cinematic-standing':''} src={cinematicAssets.hero} alt="" onError={()=>setFailed(true)}/>
        {result==='defeat'&&<img className="cinematic-fallen" src={cinematicAssets.heroDown} alt="" onError={()=>setFailed(true)}/>}
      </div>}
      <div className="cinematic-boss">
        {grinwick?<BattleAnimationPlayer id="grinwick" side="boss" aspect={1} speed={1/settings.durationMultiplier} playback={{clip:animationById(result==='victory'?'grinwick_defeat_01':'grinwick_victory_01')!,startedAt:playback.startedAt+cinematicDefinitions[result].stages[3].startMs*settings.durationMultiplier,serial:1,staticLast:playback.restored||atMs!==undefined&&atMs>=cinematicDefinitions[result].durationMs}}/>:<>
        <img className={result==='victory'?'cinematic-standing':''} src={cinematicAssets.boss} alt="" onError={()=>setFailed(true)}/>
        {result==='victory'&&<img className="cinematic-fallen" src={cinematicAssets.bossDown} alt="" onError={()=>setFailed(true)}/>}
        </>}
      </div>
    </div>}
    <svg className="cinematic-slash" viewBox="0 0 400 400" preserveAspectRatio="none" aria-hidden="true">
      <path className="cinematic-energy-tail" d="M20 15 Q420 162 285 390 Q363 188 20 15Z"/>
      <path className="cinematic-energy-core" d="M20 15 Q405 178 285 390 Q372 185 20 15Z"/>
      <path className="cinematic-energy-trace" d="M14 66 Q312 171 244 344 M35 90 Q272 173 230 320"/>
    </svg>
    <div className="cinematic-contact" aria-hidden="true"/>
    <div className="cinematic-copy">
      <div className="cinematic-eyebrow">{result==='victory'?'PIANO BLADE · AZURE FINISH':result==='defeat'?(grinwick?'GRINWICK \u00b7 GOBLIN FRENZY':'CRIMSON COLOSSUS \u00b7 FINAL STRIKE'):'CLOCK EXPIRED · 00:00'}</div>
      <h2>{cinematicDefinitions[result].title}</h2>
      <div className="cinematic-rule"/>
      {settings.showStats&&<div className="cinematic-stats">
        {result==='victory'?<>{stats.playerHp!==undefined&&<span><b>{stats.playerHp}</b> HP REMAINING</span>}<span><b>{stats.bestCombo}</b> BEST COMBO</span></>:
         result==='defeat'?<><span><b>{stats.bossHp}</b> BOSS HP</span><span><b>{stats.mistakes}</b> MISTAKES</span><span><b>{stats.bestCombo}</b> BEST COMBO</span></>:
         <><span><b>{stats.bossHp}</b> BOSS HP</span><span><b>{stats.progress}%</b> NOTES COMPLETED</span><span>TIME EXPIRED</span></>}
      </div>}
      {result!=='timeout'&&playback.story?.summary&&<div className="cinematic-story-summary" aria-label="Battle story summary">{storySummaryLines(playback.story).map(line=><div key={line}>{line}</div>)}</div>}
    </div>
    {debug&&<small className="cinematic-debug-label">{result} · {playback.id} · notation stays mounted</small>}
  </div>;
});
