import {useEffect,useState,useSyncExternalStore} from 'react';
import type {BattleView} from './boss-battle';
import {gameClient} from './game-client';
import {battleAudio,isObsAudioSource} from './battle-audio';
import './battle-intro.css';
import './battle-story.css';

// Presentation clocks read shared timestamps; only GameClient releases gameplay.
export function introLabel(battle:BattleView,now:number):string|null {
  const c=battle.countdown;
  if(!battle.config.enabled||!c)return null;
  if(c.releasedAt)return now<c.releasedAt+350?'FIGHT!':null;
  return String(Math.max(1,3-Math.floor(((c.pausedAt??now)-c.startedAt)/1000)));
}
export function BattleIntro({battle,audience=false,offline=false}:{battle:BattleView;audience?:boolean;offline?:boolean}) {
  const [now,setNow]=useState(Date.now);
  const c=battle.countdown;
  useEffect(()=>{
    if(!c)return;
    let timer:ReturnType<typeof setTimeout>;
    const tick=()=>{
      const at=Date.now();setNow(at);
      if(c.pausedAt)return;
      const next=c.releasedAt?c.releasedAt+350:c.startedAt+(Math.floor((at-c.startedAt)/1000)+1)*1000;
      if(c.releasedAt&&at>=next)return;
      if(!c.releasedAt&&at>=c.fightAt)return;
      timer=setTimeout(tick,Math.max(1,next-at));
    };
    tick();return()=>clearTimeout(timer);
  },[c]);
  useEffect(()=>{
    if(!c||c.pausedAt||offline||!audience||!isObsAudioSource())return;
    const scheduled:ReturnType<typeof setTimeout>[]=[];
    const cues=c.releasedAt?[{at:c.releasedAt,label:'FIGHT!',kind:'fight' as const}]:[0,1,2].map(i=>({at:c.startedAt+i*1000,label:String(3-i),kind:'countIn' as const}));
    for(const cue of cues){
      // Reconnect resumes the visible stage, never replays earlier cues.
      if(Date.now()-cue.at>150)continue;
      scheduled.push(setTimeout(()=>{
        if(battleAudio.snapshot().output==='obs')battleAudio.play(cue.kind,`${battle.attemptId}:intro:${cue.label}`,cue.at);
      },Math.max(0,cue.at-Date.now())));
    }
    return()=>scheduled.forEach(clearTimeout);
  },[c,battle.attemptId,audience,offline]);
  const label=introLabel(battle,now);
  if(!label)return null;
  return <div className="battle-intro" data-attempt={battle.attemptId} data-paused={!!c?.pausedAt} role="status" aria-label="Battle start countdown">
    {battle.story&&<div className="battle-story-objective">{battle.story.objective}{battle.story.rivalry&&<small>{battle.story.rivalry}</small>}</div>}
    <span key={`${battle.attemptId}:${label}`} className={label==='FIGHT!'?'battle-intro-fight':''}>{label}</span></div>;
}
export function PracticeBattleIntro(){
  const battle=useSyncExternalStore(gameClient.subscribe,()=>gameClient.state.battle);
  return <BattleIntro battle={battle}/>;
}
export function BattleLoopNotice({battle}:{battle:BattleView}){
  const [now,setNow]=useState(Date.now),loop=battle.loop;
  useEffect(()=>{setNow(Date.now());if(!loop)return;const t=setTimeout(()=>setNow(Date.now()),Math.max(0,loop.at+1600-Date.now()));return()=>clearTimeout(t);},[loop]);
  if(battle.chain)return <div className="battle-loop-notice battle-chain-progress" role="status" aria-label="Exercise queue progress">PIECE {battle.chain.index} / {battle.chain.total} · LOOP {battle.chain.pass}/{battle.chain.passes}</div>;
  if(!loop||loop.number<2||now>=loop.at+1600||battle.status!=='active')return null;
  return <div key={`${battle.attemptId}:${loop.number}`} className="battle-loop-notice" role="status">LOOP {loop.number}/{battle.loopCount}</div>;
}
