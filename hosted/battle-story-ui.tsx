import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import type {BattleView} from './boss-battle';
import type {BattlePresentation} from './battle-animation-director';
import {animationById} from './battle-animation-library';
import {battleAudio,isObsAudioSource,type AudioOutput} from './battle-audio';
import type {StoryEvent} from './battle-story';
import './battle-story.css';

export function visibleStoryEvent(b:BattleView,now:number,blocked=false):StoryEvent|undefined{
  const s=b.story,e=s?.event;
  if(blocked||!b.config.enabled||b.status!=='active'||s?.attemptId!==b.attemptId||!e||now<e.at||now>=e.until||e.exerciseId!==(b.chain?.exerciseNumber??e.exerciseId))return;
  return e;
}
export function useStoryEvent(b:BattleView,blocked=false){
  const id=b.story?.event?.id,until=b.story?.event?.until,[now,setNow]=useState(Date.now);
  useEffect(()=>{
    if(!id||until===undefined)return;setNow(Date.now());
    const t=setTimeout(()=>setNow(Date.now()),Math.max(0,until-Date.now()));
    return()=>clearTimeout(t);
  },[id,until]);
  return visibleStoryEvent(b,now,blocked);
}
export function BattleStoryNotice({event}:{event?:StoryEvent}){
  const root=useRef<HTMLSpanElement>(null);
  const id=event?.id,at=event?.at;
  useLayoutEffect(()=>{if(root.current&&at!==undefined)root.current.style.animationDelay=`-${Math.max(0,Date.now()-at)}ms`;},[id,at]);
  if(!event)return null;
  // Negative delay resumes the shared envelope on reconnect; no replay.
  return <span ref={root} className={`battle-story-notice battle-story-${event.kind}`} key={event.id} role="status"
    data-story-id={event.id}>{event.text}</span>;
}
export function useStoryReaction(b:BattleView,base:BattlePresentation,event:StoryEvent|undefined,output?:AudioOutput){
  const clip=event?.reaction?animationById(event.reaction):undefined;
  const visible=!!clip&&!!event&&event.revision===b.revision&&base.phase==='idle'&&!base.pendingCount;
  useEffect(()=>{
    if(!visible||!event||Date.now()-event.at>1200||output!=='obs'||!isObsAudioSource()||battleAudio.snapshot().output!=='obs')return;
    // Existing engine owns deduplication, polyphony and routing.
    battleAudio.play('pressureTaunt',event.id,event.at);
  },[visible,event,output]);
  return useMemo(()=>visible&&clip&&event?{...base,boss:{...base.boss,clip,startedAt:event.at,serial:-50,staticLast:false}}:base,[visible,clip,event,base]);
}
