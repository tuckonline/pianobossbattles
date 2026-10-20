import {bossProfile} from './boss-registry';
import {PressureExpression} from './battle-pressure-ui';
import {memo,useEffect,useLayoutEffect,useMemo,useRef,useState,type CSSProperties,type ReactNode} from "react";
import type {BattleView} from "./boss-battle";
import type {ActorPlayback,BattlePresentation} from "./battle-animation-director";
import {BattleAnimationPlayer} from "./battle-animation-player";
import {type AttackContact} from "./battle-animation-library";
import type {BattleFinisherCue} from "./battle-finisher";
import {arenaPlacement,attackOffset,solveWeaponContact,guardContactOffset,battleLayout,boundOffset,idleAspect,recoilOffset,visualBody,type BossBattleLayoutConfig,type Rect} from "./battle-layout";
import {reactionMotion,combatMotion} from './battle-motion-profile';

type FighterProps={side:"player"|"boss";battle:BattleView;playback:ActorPlayback;incomingContact?:AttackContact;rect:Rect;opponent:Rect;width:number;height:number;paused:boolean;finisher?:BattleFinisherCue;config:BossBattleLayoutConfig;debug?:boolean};
const Fighter=memo(function Fighter({side,battle:b,playback,incomingContact,rect,opponent,width,height,paused,finisher,config,debug}:FighterProps){
  const motion=useRef<HTMLDivElement>(null),animation=useRef<Animation|null>(null),returnTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const shadow=useRef<HTMLElement>(null),shadowAnimation=useRef<Animation|null>(null);
  const pausedRef=useRef(paused);pausedRef.current=paused;
  const id=side==="player"?b.config.playerId:b.config.bossId;
  useLayoutEffect(()=>{
    const node=motion.current;if(!node)return;
    const media=matchMedia("(prefers-reduced-motion: reduce)");
    const reset=()=>{animation.current?.cancel();shadowAnimation.current?.cancel();animation.current=null;shadowAnimation.current=null;clearTimeout(returnTimer.current);node.style.transform="none";if(shadow.current)shadow.current.style.transform="none";node.dataset.motionPhase="rest";node.style.zIndex="2";};
    if(media.matches){reset();return;}
    if(playback.clip.tags.includes('entrance')){
      reset();
      const dx=Math.min(width*.10,Math.max(0,width-rect.x-rect.width)),hop=rect.height*.16;
      const steps=[[0,dx,0],[.16,dx*.6,-hop],[.30,0,0],[.42,0,rect.height*.035],[.55,0,0],[1,0,0]];
      const options={duration:playback.clip.durationMs,easing:'ease-out',fill:'none' as FillMode};
      animation.current=node.animate(steps.map(([offset,x,y])=>({offset,transform:`translate(${x}px,${y}px)`})),options);
      shadowAnimation.current=shadow.current?.animate(steps.map(([offset,x])=>({offset,transform:`translateX(${x}px)`})),options)??null;
      for(const a of [animation.current,shadowAnimation.current])if(a&&typeof document.timeline.currentTime==='number')a.startTime=document.timeline.currentTime-Math.max(0,Date.now()-playback.startedAt);
      return()=>{animation.current?.cancel();shadowAnimation.current?.cancel();};
    }
    if(playback.pressure){
      reset();
      node.style.setProperty("--pressure-age",`-${Math.max(0,Date.now()-playback.startedAt)}ms`);
      const taunting=side==='boss'&&playback.pressure>=2;
      const amount=-(taunting?.14:playback.pressure===1?.008:playback.pressure===3?.025:.018)*width;
      // Short recoil for the hero; a forward lean and shoulder shudder for the
      // boss. Foot translation is shared with the shadow, body rotation isn't.
      const steps=taunting?[[0,0],[.22,amount],[.46,amount*.9],[.58,amount],[.72,amount*.9],[.86,amount*.8],[1,0]]:[[0,0],[.12,amount],[.22,amount*.55],[.34,amount*.85],[.7,amount*.5],[1,0]];
      const floorFrames=steps.map(([offset,x])=>({offset,transform:`translateX(${x}px)`}));
      const frames=steps.map(([offset,x])=>({offset,transform:`translateX(${x}px) rotate(${taunting?(x/amount||0)*-3:(x/amount||0)*-2}deg)`}));
      node.style.transformOrigin='50% 100%';
      const options={duration:1400,easing:'ease-in-out',fill:'none' as FillMode};
      animation.current=node.animate(frames,options);shadowAnimation.current=shadow.current?.animate(floorFrames,options)??null;
      for(const a of [animation.current,shadowAnimation.current])if(a&&typeof document.timeline.currentTime==='number')a.startTime=document.timeline.currentTime-Math.max(0,Date.now()-playback.startedAt);
      return()=>{animation.current?.cancel();shadowAnimation.current?.cancel();node.style.removeProperty('transform-origin');};
    }
    const category=playback.clip.category;
    const attacking=["lightAttack","heavyAttack","counter"].includes(category),recoiling=category==="hitReaction";
    if(playback.freezeUntil!==undefined){
      const transform=getComputedStyle(node).transform;
      animation.current?.cancel();shadowAnimation.current?.cancel();clearTimeout(returnTimer.current);
      animation.current=null;shadowAnimation.current=null;
      node.style.transform=transform;if(shadow.current)shadow.current.style.transform=transform;
      if(incomingContact){
        const matrix=new DOMMatrixReadOnly(transform),to=guardContactOffset(opponent,rect,{x:matrix.m41,y:matrix.m42},width,height,incomingContact,config);
        const frames=[{transform},{transform:`translate(${to.x}px, ${to.y}px)`}];
        const options={duration:Math.max(1,playback.holdMs??playback.freezeUntil-Date.now()),easing:'ease-out',fill:'forwards' as FillMode};
        animation.current=node.animate(frames,options);shadowAnimation.current=shadow.current?.animate(frames,options)??null;
        if(typeof document.timeline.currentTime==='number'){
          animation.current.startTime=document.timeline.currentTime-Math.max(0,Date.now()-(playback.freezeUntil-options.duration));
          if(shadowAnimation.current)shadowAnimation.current.startTime=animation.current.startTime;
        }
        if(pausedRef.current){animation.current.pause();shadowAnimation.current?.pause();}
      }
      node.dataset.motionPhase="guard";node.style.zIndex="2";return;
    }
    // Keep an existing return segment running when the director restores idle.
    if(!attacking&&!recoiling&&animation.current?.playState==="running"&&node.dataset.motionPhase!=="guard"&&category!=="victory"&&category!=="defeat")return;
    // JS contact timers can land between compositor frames. Seek the defender
    // to the shared guard endpoint before capturing its recoil origin, just as
    // the attack track is synchronized to its contact frame below.
    if(recoiling&&node.dataset.motionPhase==='guard')for(const active of [animation.current,shadowAnimation.current])
      if(active)active.currentTime=Number(active.effect?.getTiming().duration??0);
    const current=new DOMMatrixReadOnly(getComputedStyle(node).transform);
    // The registered body may travel outside its idle rectangle. Clamping the
    // old rectangle here would snap a linked slash back before the next hit.
    const from={x:current.m41,y:current.m42};
    const bounds=playback.clip.contact?.visualBounds&&playback.clip.contact.bodyBounds?visualBody(rect,playback.clip.contact.bodyBounds,playback.clip.contact.mirrored):rect;
    const bounded=(offset:{x:number;y:number})=>boundOffset(bounds,offset,width,height);
    animation.current?.cancel();shadowAnimation.current?.cancel();clearTimeout(returnTimer.current);
    // Measure only on an action boundary, never in the canvas frame loop. A
    // chained strike targets the defender's held on-screen position, not idle.
    const other=node.parentElement?.querySelector<HTMLElement>(`.battle-fighter-${side==="player"?"boss":"player"}`);
    const otherTransform=other?new DOMMatrixReadOnly(getComputedStyle(other).transform):undefined;
    const otherOffset={x:otherTransform?.m41??0,y:otherTransform?.m42??0};
    const guard=attacking&&playback.clip.contact?guardContactOffset(rect,opponent,otherOffset,width,height,playback.clip.contact,config):otherOffset;
    const visibleOpponent={...opponent,x:opponent.x+guard.x,y:opponent.y+guard.y};
    const attackConfig={...config,attackMotionIntensity:config.attackMotionIntensity*(playback.strike?.power??1)};
    const solution=attacking&&playback.clip.contact?solveWeaponContact(rect,visibleOpponent,width,height,playback.clip.contact,attackConfig,from):undefined;
    const direction=playback.reactionContact?.recoilDirection;
    const force=Math.min(width,height)*.055*config.attackMotionIntensity*(playback.recoilIntensity??1);
    const recoil=direction?{x:direction.x*force,y:direction.y*force}:recoilOffset(rect,visibleOpponent,width,height,{...config,attackMotionIntensity:config.attackMotionIntensity*(playback.recoilIntensity??1)});
    const offset=attacking?(solution?.offset??attackOffset(rect,visibleOpponent,width,height,attackConfig)):recoiling?bounded({x:from.x+recoil.x,y:from.y+recoil.y}):{x:0,y:0};
    // Recoil uses the available arena, not the intersection of every future
    // weapon's reach. The next windup resolves its own safe guard/contact.
    const anchor=playback.clip.contact;
    node.dataset.contactError=String(solution?.error??0);
    node.dataset.bodySeparation=String(solution?.separation??0);
    node.dataset.targetX=String(solution?.target.x??anchor?.targetAnchor.x??.5);
    node.dataset.targetY=String(solution?.target.y??anchor?.targetAnchor.y??.5);
    node.dataset.weaponX=String(solution?.weapon.x??anchor?.weaponAnchor.x??.5);
    node.dataset.weaponY=String(solution?.weapon.y??anchor?.weaponAnchor.y??.5);
    node.dataset.lungeX=String(offset.x);node.dataset.lungeY=String(offset.y);
    node.dataset.reactionWeight=playback.reactionWeight??'';
    node.dataset.recoilDistance=String(recoiling?Math.hypot(offset.x-from.x,offset.y-from.y):0);
    const readout=node.querySelector('.battle-geometry-readout');
    if(readout)readout.textContent=`${playback.clip.label} · impact frame ${anchor?.impactFrame??0} · ${Math.round(playback.contactMs??0)}ms · gap ${Math.round(solution?.separation??0)} / desired ${Math.round((anchor?.preferredBodySeparation??0)*Math.min(width,height))}px · contact error ${(solution?.error??0).toFixed(1)}px`;
    const duration=playback.durationMs??(attacking?playback.clip.durationMs:recoiling?config.recoilDuration:0)/b.config.animationSpeed;
    const recovery=playback.recoveryMs??config.returnToIdleDuration/b.config.animationSpeed,hold=playback.holdMs??0,total=duration+recovery+hold;
    const contact=playback.contactMs??duration*.4;
    const transform=(x:number,y:number)=>`translate(${x}px, ${y}px)`;
    const frames:Keyframe[]=[{transform:transform(from.x,from.y),offset:0}];
    const choreography=playback.clip.choreography;
    if(duration>0){
      if(attacking&&choreography){
        const ratio=contact/playback.clip.contact!.impactTimeMs;
        const anticipation=choreography.anticipationMs*ratio,braceAt=(choreography.anticipationMs+choreography.braceMs)*ratio;
        const direction={x:offset.x-from.x,y:offset.y-from.y},distance=Math.hypot(direction.x,direction.y)||1;
        const brace=bounded({x:from.x-direction.x/distance*rect.width*.035,y:from.y+(side==='player'?rect.height*.018:-rect.height*.025)});
        frames.push({transform:transform(brace.x,brace.y),offset:anticipation/total,easing:'ease-in-out'});
        if(braceAt>anticipation)frames.push({transform:transform(brace.x,brace.y),offset:braceAt/total});
        // Preserve the ready/brace pose before a decisive approach. At contact
        // the complete weapon pose, motion, HP, recoil and trail share a clock.
        frames.at(-1)!.easing=side==='player'?'cubic-bezier(.35,0,.18,1)':'cubic-bezier(.55,.05,.45,1)';
        // Weapon follow-through is illustrated; do not drive the torso farther
        // into the defender after reaching the safe contact endpoint.
        const through=bounded({x:offset.x-direction.x/distance*rect.width*.018,y:offset.y-direction.y/distance*rect.height*.012});
        frames.push({transform:transform(offset.x,offset.y),offset:contact/total},
          {transform:transform(offset.x,offset.y),offset:(contact+hold)/total,easing:'ease-out'},
          {transform:transform(through.x,through.y),offset:(contact+hold+Math.min(choreography.followThroughMs*ratio,duration-contact))/total,easing:'cubic-bezier(.25,.65,.35,1)'},
          {transform:transform(through.x*.68,through.y*.68),offset:(duration+hold)/total,easing:'cubic-bezier(.2,.6,.35,1)'});
      }else if(attacking){
        const ready=bounded({x:from.x+(offset.x-from.x)*.025,y:from.y+(side==='player'?rect.height*.012:-rect.height*.012)});
        frames.push({transform:transform(ready.x,ready.y),offset:contact*.22/total,easing:combatMotion[side].launch},
        {transform:transform(offset.x,offset.y),offset:contact/total},
        {transform:transform(offset.x,offset.y),offset:(contact+hold+Math.min(45,duration-contact))/total,easing:"cubic-bezier(.2,.7,.2,1)"},
        {transform:transform(offset.x*.65,offset.y*.65),offset:(duration+hold)/total,easing:combatMotion[side].settle});
      }else if(recoiling){
        const motion=reactionMotion(side,playback.reactionWeight,playback.reactionPressure),peak=Math.min(motion.reactionPeakMs/b.config.animationSpeed,duration*.5);
        frames.push({transform:transform(from.x,from.y),offset:hold/total,easing:motion.launch},
          {transform:transform(offset.x,offset.y),offset:(hold+peak)/total,easing:motion.settle},
          {transform:transform(offset.x*.8,offset.y*.8),offset:(hold+duration*.78)/total,easing:motion.settle});
      }
    }
    frames.push({transform:"translate(0px, 0px)",offset:1});
    node.dataset.motionPhase=duration?attacking?"attack":"recoil":"return";
    node.style.zIndex=attacking?"5":recoiling?"3":"2";
    frames[0].easing=side==="player"?"cubic-bezier(.16,.75,.3,1)":"cubic-bezier(.5,.12,.65,1)";
    const active=node.animate(frames,{duration:total,easing:"linear",fill:"forwards"});animation.current=active;
    // Separate ground layer, identical transform timeline: the shadow follows
    // the fighter without ever drawing over the other character's body.
    shadowAnimation.current=shadow.current?.animate(frames,{duration:total,easing:"linear",fill:"forwards"})??null;
    if(typeof document.timeline.currentTime==="number"){
      active.startTime=document.timeline.currentTime-Math.max(0,Date.now()-playback.startedAt);
      if(shadowAnimation.current)shadowAnimation.current.startTime=active.startTime;
    }
    const markReturn=()=>{if(animation.current===active)node.dataset.motionPhase="return";};
    returnTimer.current=setTimeout(markReturn,Math.max(0,duration+hold-(Date.now()-playback.startedAt)));
    active.onfinish=()=>{if(animation.current!==active)return;node.dataset.motionPhase="rest";node.style.zIndex="2";active.cancel();shadowAnimation.current?.cancel();animation.current=null;shadowAnimation.current=null;node.style.transform="none";if(shadow.current)shadow.current.style.transform="none";};
    if(pausedRef.current){active.pause();shadowAnimation.current?.pause();}
    const reduce=()=>{if(media.matches)reset();};media.addEventListener("change",reduce);
    return()=>media.removeEventListener("change",reduce);
    // Serial is the action identity. Chord strength and late-contact clock
    // updates must not restart movement; contact delivery is aligned below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[playback.serial,playback.clip,rect,opponent,width,height,config,b.config.animationSpeed]);
  useLayoutEffect(()=>{
    if(playback.contactDeliveredAt===undefined)return;
    // Match late-delivered contact to the canvas clock without restarting the
    // approach or asking React to update on every animation frame.
    for(const active of [animation.current,shadowAnimation.current])if(active&&typeof document.timeline.currentTime==='number')
      active.startTime=document.timeline.currentTime-(playback.contactMs??0);
  },[playback.contactDeliveredAt,playback.contactMs]);
  useEffect(()=>{for(const active of [animation.current,shadowAnimation.current]){if(paused)active?.pause();else if(active?.playState==="paused")active.play();}},[paused]);
  useEffect(()=>()=>{animation.current?.cancel();shadowAnimation.current?.cancel();clearTimeout(returnTimer.current);},[]);
  const strike=playback.strike,weapon=playback.clip.contact?.weaponAnchor,origin=playback.clip.contact?.weaponOrigin;
  return <>
    {config.showCharacterShadows&&<i ref={shadow} aria-hidden="true" className={`battle-ground-shadow battle-ground-shadow-${side}`} style={{left:rect.x+rect.width*(side==='player'?.28:.18),top:rect.y+rect.height*(side==='player'?.98:.93),width:rect.width*.64,height:Math.max(5,rect.height*(side==='player'?.04:.065))}}/>}
    <div ref={motion} className={`battle-fighter battle-fighter-${side}`} data-motion-phase="rest" data-pressure={playback.pressure} data-signature={playback.clip.tags.includes('signature')} data-signature-phase={playback.clip.choreography?.phase} data-attack-key={strike?.key} data-chord-size={strike?.chordSize}
    data-target-region={playback.clip.contact?.targetRegion?.name}
    style={{left:rect.x,top:rect.y,width:rect.width,height:rect.height} as CSSProperties}>
    <BattleAnimationPlayer id={id} side={side} playback={playback} speed={b.config.animationSpeed} paused={paused} finisher={finisher} aspect={rect.width/rect.height} stageMotion/>
    {side==="player"&&playback.pressure&&<PressureExpression key={`${playback.startedAt}:${playback.pressure}`} stage={playback.pressure}/>}
    {debug&&<><svg className="battle-contact-debug" viewBox="0 0 100 100" preserveAspectRatio="none"><circle cx={(playback.clip.contact?.weaponAnchor.x??.5)*100} cy={(playback.clip.contact?.weaponAnchor.y??.5)*100} r="2"/>{playback.clip.contact?.weaponOrigin&&<path d={`M ${playback.clip.contact.weaponOrigin.x*100} ${playback.clip.contact.weaponOrigin.y*100} L ${playback.clip.contact.weaponAnchor.x*100} ${playback.clip.contact.weaponAnchor.y*100}`}/>}<rect x={(playback.clip.contact?.bodyBounds?.x??.29)*100} y={(playback.clip.contact?.bodyBounds?.y??.27)*100} width={(playback.clip.contact?.bodyBounds?.width??.46)*100} height={(playback.clip.contact?.bodyBounds?.height??.43)*100}/></svg><small className="battle-geometry-readout"/><small className="battle-frame-readout"/></>}
    {strike&&weapon&&origin&&!playback.clip.choreography&&<svg key={playback.serial} className="battle-note-strike" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style={{"--strike-power":strike.power,"--strike-duration":`${(playback.durationMs??playback.clip.durationMs/b.config.animationSpeed)-(playback.contactMs??0)}ms`,transformOrigin:`${weapon.x*100}% ${weapon.y*100}%`,animationDelay:`${playback.contactMs??0}ms`,animationPlayState:paused?"paused":"running"} as CSSProperties}>
      <g transform={playback.clip.contact?.mirrored?'translate(100 0) scale(-1 1)':undefined}>{Array.from({length:Math.min(3,strike.arcs)},(_,i)=><path key={i} d={`M ${origin.x*100} ${origin.y*100} Q ${(origin.x+weapon.x)*50} ${(origin.y+weapon.y)*50-4-i*2} ${weapon.x*100} ${weapon.y*100}`} strokeWidth={.45+strike.power*.18} opacity={1-i*.18}/>)}
      {strike.chordSize>1&&<circle cx={weapon.x*100} cy={weapon.y*100} r={3+strike.power} className="battle-chord-ring"/>}</g>
    </svg>}
  </div></>;
});

export function BattleStage({battle:b,presentation,paused,finisher,children,config=battleLayout,debug=false}:{battle:BattleView;presentation:BattlePresentation;paused:boolean;finisher?:BattleFinisherCue;children?:ReactNode;config?:BossBattleLayoutConfig;debug?:boolean}){
  const stage=useRef<HTMLDivElement>(null),impactNode=useRef<HTMLDivElement>(null),contactDebug=useRef<SVGSVGElement>(null);
  const [size,setSize]=useState({width:0,height:0});
  useEffect(()=>{
    const node=stage.current;if(!node)return;
    const observer=new ResizeObserver(([entry])=>{const {width,height}=entry.contentRect;setSize(old=>old.width===width&&old.height===height?old:{width,height});});
    observer.observe(node);return()=>observer.disconnect();
  },[]);
  const placement=useMemo(()=>{const p=arenaPlacement(size.width,size.height,idleAspect(b.config.playerId),idleAspect(b.config.bossId),config),ratio=bossProfile(b.config.bossId).heightRatio;if(ratio){const height=p.player.height*ratio,width=height*idleAspect(b.config.bossId);p.boss={x:p.boss.x+(p.boss.width-width)/2,y:p.boss.y+p.boss.height-height,width,height};}return p;},[size,b.config.playerId,b.config.bossId,config]);
  const impact=presentation.impact,action=impact?.side,target=action==="player"?placement.boss:placement.player;
  const contact=action?presentation[action].clip.contact:undefined;
  useLayoutEffect(()=>{
    if(!debug||!contactDebug.current||!presentation.action)return;
    const side=presentation.action,actor=stage.current?.querySelector<HTMLElement>(`.battle-fighter-${side}`),r=placement[side];
    if(!actor)return;
    const end={x:r.x+Number(actor.dataset.lungeX)+r.width*Number(actor.dataset.weaponX),y:r.y+Number(actor.dataset.lungeY)+r.height*Number(actor.dataset.weaponY)};
    const line=contactDebug.current.querySelector('line')!,circle=contactDebug.current.querySelector('circle')!;
    line.setAttribute('x1',String(r.x+r.width*.5));line.setAttribute('y1',String(r.y+r.height*.5));line.setAttribute('x2',String(end.x));line.setAttribute('y2',String(end.y));
    circle.setAttribute('cx',String(end.x));circle.setAttribute('cy',String(end.y));
  },[debug,presentation.serial,presentation.action,placement]);
  useLayoutEffect(()=>{
    if(!impactNode.current||!action)return;
    const defender=stage.current?.querySelector<HTMLElement>(`.battle-fighter-${action==="player"?"boss":"player"}`);
    const transform=defender?new DOMMatrixReadOnly(getComputedStyle(defender).transform):undefined;
    const attacker=stage.current?.querySelector<HTMLElement>(`.battle-fighter-${action}`);
    impactNode.current.style.left=`${target.x+(transform?.m41??0)+target.width*Number(attacker?.dataset.targetX??contact?.targetAnchor.x??.5)}px`;
    impactNode.current.style.top=`${target.y+(transform?.m42??0)+target.height*Number(attacker?.dataset.targetY??contact?.targetAnchor.y??.4)}px`;
    if(debug&&attacker&&defender){
      const a=attacker.getBoundingClientRect(),d=defender.getBoundingClientRect();
      const distance=Math.hypot(a.x+a.width*Number(attacker.dataset.weaponX)-d.x-d.width*Number(attacker.dataset.targetX),a.y+a.height*Number(attacker.dataset.weaponY)-d.y-d.height*Number(attacker.dataset.targetY));
      const label=attacker.querySelector('.battle-geometry-readout');if(label)label.textContent+=` · actual ${distance.toFixed(1)}px`;
    }
  },[impact?.id,action,target,contact,debug]);
  return <div ref={stage} data-boss={b.config.bossId} className="battle-stage" style={{'--combat-intensity':b.config.effectIntensity??1} as CSSProperties} data-effects={b.config.effectIntensity!==0} data-phase={presentation.phase} data-combo-tier={presentation.tier??0} data-background={config.showArenaBackground} data-enraged={b.bossHp/b.bossMaxHp<=.25&&b.status==="active"}>
    <div className="battle-environment" aria-hidden="true"><i className="battle-light battle-light-cyan"/><i className="battle-light battle-light-crimson"/><div className="battle-floor"/></div>
    {size.width>0&&size.height>0&&<>
      <Fighter side="player" battle={b} playback={presentation.player} incomingContact={presentation.boss.clip.contact} rect={placement.player} opponent={placement.boss} {...size} paused={paused} finisher={finisher?.target==="player"?finisher:undefined} config={config} debug={debug}/>
      <Fighter side="boss" battle={b} playback={presentation.boss} incomingContact={presentation.player.clip.contact} rect={placement.boss} opponent={placement.player} {...size} paused={paused} finisher={finisher?.target==="boss"?finisher:undefined} config={config} debug={debug}/>
      {impact&&action&&<div ref={impactNode} key={impact.id} className={`battle-impact battle-impact-${action}${impact.hits>1?" battle-impact-chord":""}`} data-shield-block={impact.blocked} data-combo-power={impact.special} data-signature-impact={impact.signaturePhase} data-contact-at={impact.at} aria-hidden="true" style={{left:target.x+target.width*(contact?.targetAnchor.x??.5),top:target.y+target.height*(contact?.targetAnchor.y??.4),"--impact-power":impact.power,animationPlayState:paused?"paused":"running"} as CSSProperties}>
        {impact.signaturePhase==='cross'&&<svg className="battle-armor-burst" viewBox="-40 -40 80 80"><path d="M-36 -4L-9 -7L-16 -31L2 -11L28 -30L14 -4L37 8L10 9L10 32L-4 13L-30 24L-14 5Z"/></svg>}
        {impact.blocked&&<svg className="battle-shield-fracture" viewBox="-50 -55 100 110"><path d="M0 -50 40 -32v34L12 43 4 12 13 -6 -4 -17 5 -39ZM-8 -48-40 -32V2l28 41-1-28-11-19 8-18Z"/></svg>}
        <i/><svg className="battle-sparks" viewBox="-50 -50 100 100"><path d="M-42 -16L-15 -6M-32 30L-12 10M5 -40L2 -13M37 -28L13 -9M40 21L14 7M-3 39L-1 13"/></svg>
        {impact.signaturePhase&&<svg className="battle-signature-contact" viewBox="-70 -70 140 140" aria-hidden="true">
          {impact.signaturePhase==='opening'?<path d="M-66 12 Q-22 -14 42 0 Q-10 8 -66 12"/>:
            impact.signaturePhase==='reverse'?<path d="M-48 54 Q-20 8 40 -43 Q12 4 -48 54"/>:
            impact.signaturePhase==='cross'?<><path d="M-56 -46 Q0 -9 56 46 Q0 9 -56 -46"/><path d="M-56 46 Q0 9 56 -46 Q0 -9 -56 46"/></>:
            <><path d="M-26 -62 Q-28 -13 7 28 Q-6 -16 -26 -62"/><path d="M-3 -60 Q-10 -8 29 30 Q13 -14 -3 -60"/><path d="M20 -52 Q14 -9 47 24 Q33 -15 20 -52"/></>}
        </svg>}
        {config.showDamageNumbers&&b.config.showDamageNumbers&&impact.damage>0&&<span>−{impact.damage}</span>}
        {impact.label&&<small className="battle-chord-label">{impact.label}</small>}
      </div>}
      {debug&&<svg className="battle-contact-debug" width={size.width} height={size.height} aria-label="Contact anchors">{[placement.player,placement.boss].map((r,i)=><g key={i}><rect x={r.x} y={r.y} width={r.width} height={r.height}/><circle cx={r.x+r.width*.5} cy={r.y+r.height*.4} r="5"/></g>)}</svg>}
      {debug&&<svg ref={contactDebug} className="battle-contact-debug" width={size.width} height={size.height} aria-label="Lunge endpoint and target contact"><line/><circle r="6"/><text x="8" y={size.height-10} fill="#d8f2ff" stroke="none" fontSize="10">{presentation.phase} · {presentation.action?presentation[presentation.action].clip.label:'guard'}</text></svg>}
    </>}
    {children}
  </div>;
}
