import {useLayoutEffect,useRef,useState} from 'react';
import {BattleAnimationDirector} from './battle-animation-director';
import type {BattleView} from './boss-battle';

// Shared by the visible arena and the practice-only audio observer. This is the
// existing presentation clock, never a second evaluator or gameplay simulation.
export function useBattlePresentation(b:BattleView,combo:number,offline:boolean) {
  const director=useRef<BattleAnimationDirector|null>(null);
  if(!director.current)director.current=new BattleAnimationDirector(b,combo);
  const [presentation,setPresentation]=useState(director.current.presentation);
  const [metrics,setMetrics]=useState(()=>director.current!.diagnostics(0));
  useLayoutEffect(()=>{
    let timer:ReturnType<typeof setTimeout>|undefined,disposed=false;
    director.current!.receive(b,combo,Date.now(),offline);
    const advance=()=>{
      if(disposed)return;
      const at=Date.now(),next=director.current!.tick(at);
      setPresentation(previous=>previous===next?previous:next);
      setMetrics(director.current!.diagnostics(at));
      const wake=director.current!.nextWakeAt(at);
      if(wake!==undefined)timer=setTimeout(advance,Math.max(1,wake-at));
    };
    advance();
    return()=>{disposed=true;clearTimeout(timer);};
  },[b,offline,combo]);
  return {presentation,metrics};
}
