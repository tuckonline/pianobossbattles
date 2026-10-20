import {memo,useEffect,useRef,useState} from "react";
import type {BattleView} from "./boss-battle";

export const FINISHER_DURATION_MS=3400;
export type BattleFinisherCue={id:string;attemptId:string;target:"player"|"boss";tone:"blue"|"red";startedAt:number;compact?:boolean};
function knockout(b:BattleView) {
  if(b.status==="victory"&&b.bossHp===0&&b.playerHp>0)return "blue" as const;
  if(b.status==="defeat"&&b.playerHp===0&&b.result==="knockout")return "red" as const;
}
// Presentation-only lifecycle: restore a result without replaying it. A new
// attempt may celebrate again; duplicate snapshots and reconnects may not.
export class BattleFinisherTracker {
  private seen=new Set<string>();
  current?:BattleFinisherCue;
  constructor(initial:BattleView){if(knockout(initial))this.seen.add(`${initial.attemptId}:${initial.status}`);}
  receive(b:BattleView,now:number,offline=false) {
    const tone=knockout(b),id=`${b.attemptId}:${b.status}`;
    if(offline||!tone||this.current?.attemptId!==b.attemptId||now-(this.current?.startedAt??0)>=FINISHER_DURATION_MS)this.current=undefined;
    if(tone&&!this.seen.has(id)){
      this.seen.add(id);if(this.seen.size>64)this.seen.delete(this.seen.values().next().value!);
      if(!offline&&b.attemptId&&now-b.lastAt>=-5000&&now-b.lastAt<2000)
        this.current={id,attemptId:b.attemptId,target:tone==="blue"?"boss":"player",tone,startedAt:now};
    }
    return this.current;
  }
}
export function useBattleFinisher(b:BattleView,offline:boolean) {
  const tracker=useRef<BattleFinisherTracker|null>(null);
  if(!tracker.current)tracker.current=new BattleFinisherTracker(b);
  const [cue,setCue]=useState<BattleFinisherCue>();
  useEffect(()=>{setCue(tracker.current!.receive(b,Date.now(),offline));},[b,offline]);
  useEffect(()=>{
    if(!cue)return;
    const timer=setTimeout(()=>setCue(current=>current?.id===cue.id?undefined:current),Math.max(0,FINISHER_DURATION_MS-(Date.now()-cue.startedAt)));
    return()=>clearTimeout(timer);
  },[cue]);
  // Remove immediately on reset/scene change, before the lifecycle effect runs.
  return !offline&&cue?.attemptId===b.attemptId&&knockout(b)===cue?.tone?cue:undefined;
}

const clamp=(n:number)=>Math.max(0,Math.min(1,n));
// Small, bounded canvas effect: no image downloads, full-screen filters, camera
// shake, audio or state mutations. Only the defeated actor gets this canvas.
function paintFlames(ctx:CanvasRenderingContext2D,tone:"blue"|"red",elapsed:number,still:boolean,compact=false) {
  const w=ctx.canvas.width,h=ctx.canvas.height,t=elapsed/1000;
  ctx.clearRect(0,0,w,h);
  const envelope=still?.55:clamp(elapsed/(compact?100:350))*clamp((FINISHER_DURATION_MS-elapsed)/900);
  if(envelope<=0)return;
  const palette=tone==="blue"?{outer:"#1263fb",middle:"#29bbff",core:"#b9f9ff",glow:"40,154,255"}:{outer:"#b91945",middle:"#ff493d",core:"#ffd0a3",glow:"244,56,67"};
  ctx.save();ctx.globalCompositeOperation="screen";
  const halo=ctx.createRadialGradient(w*.54,h*.74,0,w*.54,h*.74,w*.48);
  halo.addColorStop(0,`rgba(${palette.glow},${.32*envelope})`);halo.addColorStop(.5,`rgba(${palette.glow},${.12*envelope})`);halo.addColorStop(1,`rgba(${palette.glow},0)`);
  ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
  // Curved flame tongues rise around the body. Their endpoints are not particles
  // or random flashes: coherent waves create a continuous burn at 30/60 FPS.
  const tongues=compact?7:11;
  for(let layer=0;layer<(compact?2:3);layer++)for(let i=0;i<tongues;i++){
    const phase=i*1.73+layer*2.1,center=w*(.22+i*.61/(tongues-1)),base=h*.93;
    const body=1-Math.abs(i-(tongues-1)/2)/((tongues-1)/2+2);
    const rise=h*(.28+body*.39+Math.sin(t*5+phase)*.065)*(.45+.55*clamp(elapsed/550));
    const width=w*(.035+body*.04)*(1-layer*.2),sway=Math.sin(t*7+phase)*w*.045;
    const tipX=center+sway,tipY=base-rise*(1-layer*.12);
    const gradient=ctx.createLinearGradient(center,base,tipX,tipY);
    gradient.addColorStop(0,layer===2?palette.core:palette.middle);
    gradient.addColorStop(.45,layer===0?palette.outer:palette.middle);
    gradient.addColorStop(1,`rgba(${palette.glow},0)`);
    ctx.globalAlpha=envelope*(layer===0?.7:layer===1?.6:.72);ctx.fillStyle=gradient;
    ctx.beginPath();ctx.moveTo(center-width,base);
    ctx.bezierCurveTo(center-width*1.5,base-rise*.28,tipX+width*.85,tipY+rise*.3,tipX,tipY);
    ctx.bezierCurveTo(tipX+width*.35,tipY+rise*.48,center+width*1.2,base-rise*.36,center+width,base);
    ctx.quadraticCurveTo(center,base+h*.02,center-width,base);ctx.fill();
  }
  // A low ignition ring and a limited number of drifting embers, all contained
  // in the actor's rectangle and clipped by the arena's existing overflow.
  const ring=clamp(elapsed/800);
  ctx.globalAlpha=envelope*(1-ring)*.75;ctx.strokeStyle=palette.core;ctx.lineWidth=3;
  ctx.beginPath();ctx.ellipse(w*.53,h*.93,w*(.12+.3*ring),h*(.015+.045*ring),0,0,Math.PI*2);ctx.stroke();
  if(!still)for(let i=0;i<(compact?8:22);i++){
    const life=(t*.55+i*.137)%1,x=w*(.24+(i*.173)% .58)+Math.sin(t*2+i)*w*.035,y=h*(.92-life*.72);
    ctx.globalAlpha=envelope*Math.sin(life*Math.PI)*.7;ctx.fillStyle=i%3?palette.middle:palette.core;
    ctx.beginPath();ctx.ellipse(x,y,1.2+(i%3)*.45,2.5+(i%4),Math.sin(i)*.5,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
export const BattleFinisher=memo(function BattleFinisher({cue}:{cue:BattleFinisherCue}){
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const ctx=canvas.current?.getContext("2d");if(!ctx)return;
    const media=matchMedia("(prefers-reduced-motion: reduce)");let frame=0,disposed=false;
    const draw=()=>{
      if(disposed)return;
      const elapsed=Date.now()-cue.startedAt;
      if(elapsed>=FINISHER_DURATION_MS){ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);return;}
      paintFlames(ctx,cue.tone,media.matches?900:elapsed,media.matches,cue.compact);
      if(!media.matches&&!document.hidden)frame=requestAnimationFrame(draw);
    };
    const restart=()=>{cancelAnimationFrame(frame);draw();};draw();
    media.addEventListener("change",restart);document.addEventListener("visibilitychange",restart);
    return()=>{disposed=true;cancelAnimationFrame(frame);media.removeEventListener("change",restart);document.removeEventListener("visibilitychange",restart);};
  },[cue]);
  // Repeated inter-round endings use fewer pixels and paths; the full final
  // victory/defeat effect remains unchanged. No per-frame React updates.
  return <canvas ref={canvas} width={cue.compact?256:512} height={cue.compact?256:512} className="battle-finisher" data-finisher-tone={cue.tone} data-finisher-target={cue.target} aria-hidden="true"/>;
});
