import {memo,useLayoutEffect,useRef,useState,type CSSProperties} from "react";
import {battleAnimationLibrary,canonicalCharacters,characterIdle,type BattleAsset,type CharacterId,type RigPose} from "./battle-animation-library";
import type {ActorPlayback} from "./battle-animation-director";
import {BattleFinisher,type BattleFinisherCue} from "./battle-finisher";
import {measuredFrame,visibleArtBounds} from "./battle-layout";
import {spriteProgress} from "./battle-timeline";
import {pianoBladeRegistration,heroGroundShift} from './battle-sprite-registration';

const images=new Map<string,Promise<HTMLImageElement>>();
export function loadImage(path:string) {
  if(!images.has(path))images.set(path,new Promise<HTMLImageElement>((resolve,reject)=>{
    const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>{images.delete(path);reject(new Error("Battle artwork unavailable"));};image.src=path;
  }));
  return images.get(path)!;
}
export function preloadCharacter(id:CharacterId) {
  for(const clip of battleAnimationLibrary.filter(c=>c.characterId===id))void loadBattleAsset(clip.asset).catch(()=>{});
}
export type PlaybackAsset={draw:(context:CanvasRenderingContext2D,progress:number,rim?:boolean)=>void;frameCount:number;continuous?:boolean};
export type AssetLoader=(asset:BattleAsset)=>Promise<PlaybackAsset>;
// A rig/runtime replacement can register its own adapter here. Battle rules and
// selection only refer to the registry, never to rendering technology.
const loaders=new Map<BattleAsset["type"],AssetLoader>();
let preparedAssets=new WeakMap<BattleAsset,PlaybackAsset>();
let preparingAssets=new WeakMap<BattleAsset,Promise<PlaybackAsset>>();
const cleanedFrames=new Map<string,HTMLCanvasElement>();
const rimFrames=new Map<string,{canvas:HTMLCanvasElement;ratio:number;padding:number;opacity:number}>();
export function registerBattleAssetLoader(type:BattleAsset["type"],loader:AssetLoader){loaders.set(type,loader);preparedAssets=new WeakMap();preparingAssets=new WeakMap();}
registerBattleAssetLoader("spriteSheet",async asset=>{
  if(asset.type!=="spriteSheet")throw Error("Wrong asset adapter");
  const image=await loadImage(asset.path),w=image.width/asset.columns,h=image.height/asset.rows;
  const registered=asset.bodyRegistration==='piano-blade';
  const crop=registered?pianoBladeRegistration.canvas:asset.canvasBounds??asset.registrationBounds??visibleArtBounds(asset)??{x:0,y:0,width:w,height:h};
  const frames=asset.frames.map(frame=>{
    const box=measuredFrame(asset,frame)??{x:0,y:0,width:w,height:h,mask:undefined},key=`${asset.path}:${frame}`;
    let canvas=cleanedFrames.get(key);
    if(!canvas&&box.mask){
      canvas=document.createElement("canvas");canvas.width=box.width;canvas.height=box.height;
      const ctx=canvas.getContext("2d")!;
      ctx.fillStyle="#fff";
      for(let i=0;i<box.mask.length;i+=3)ctx.fillRect(box.mask[i+1],box.mask[i],box.mask[i+2],1);
      ctx.globalCompositeOperation="source-in";
      ctx.drawImage(image,frame%asset.columns*w+box.x,Math.floor(frame/asset.columns)*h+box.y,box.width,box.height,0,0,box.width,box.height);
      cleanedFrames.set(key,canvas);
    }
    // Small alpha-only underlays are blurred once during asset preparation,
    // never on the animation path. Cache by source frame across shared clips.
    let rim=rimFrames.get(key);
    const character=battleAnimationLibrary.find(c=>c.asset===asset)?.characterId as CharacterId|undefined;
    if(!rim&&character&&canonicalCharacters[character]){
      const ratio=Math.min(1,192/Math.max(box.width,box.height)),padding=8;
      const mask=document.createElement('canvas');mask.width=Math.ceil(box.width*ratio)+padding*2;mask.height=Math.ceil(box.height*ratio)+padding*2;
      const m=mask.getContext('2d')!;
      m.filter='blur(1.5px)';
      if(canvas)m.drawImage(canvas,padding,padding,box.width*ratio,box.height*ratio);
      else m.drawImage(image,frame%asset.columns*w+box.x,Math.floor(frame/asset.columns)*h+box.y,box.width,box.height,padding,padding,box.width*ratio,box.height*ratio);
      m.filter='none';m.globalCompositeOperation='source-in';m.fillStyle=canonicalCharacters[character].accent;m.fillRect(0,0,mask.width,mask.height);
      rim={canvas:mask,ratio,padding,opacity:canonicalCharacters[character].side==='player'?.24:.32};rimFrames.set(key,rim);
    }
    return {canvas,box,frame,rim};
  });
  return {frameCount:asset.frames.length,draw(ctx,progress,withRim=false){
    const {canvas,box,frame,rim}=frames[Math.min(frames.length-1,Math.floor(progress*frames.length))];
    const scale=Math.min(ctx.canvas.width/crop.width,ctx.canvas.height/crop.height);
    const dw=crop.width*scale,dh=crop.height*scale;
    // The hero uses a fixed source-pixel registration and a larger canvas.
    // Full weapon/cape alpha never participates in his anatomical scale.
    const dx=(ctx.canvas.width-dw)/2+(box.x-crop.x)*scale,dy=ctx.canvas.height-dh+(box.y-crop.y+(registered?heroGroundShift(asset.path,frame):0))*scale;
    if(withRim&&rim){ctx.save();ctx.globalAlpha*=rim.opacity;ctx.drawImage(rim.canvas,dx-rim.padding/rim.ratio*scale,dy-rim.padding/rim.ratio*scale,rim.canvas.width/rim.ratio*scale,rim.canvas.height/rim.ratio*scale);ctx.restore();}
    if(canvas)ctx.drawImage(canvas,dx,dy,box.width*scale,box.height*scale);
    else ctx.drawImage(image,frame%asset.columns*w+box.x,Math.floor(frame/asset.columns)*h+box.y,box.width,box.height,dx,dy,box.width*scale,box.height*scale);
  }};
});
registerBattleAssetLoader("frameSequence",async asset=>{
  if(asset.type!=="frameSequence")throw Error("Wrong asset adapter");
  const frames=await Promise.all(asset.paths.map(loadImage));
  return {frameCount:frames.length,draw(ctx,progress){ctx.drawImage(frames[Math.min(frames.length-1,Math.floor(progress*frames.length))],0,0,ctx.canvas.width,ctx.canvas.height);}};
});
const interpolatePose=(poses:RigPose[],progress:number):RigPose=>{
  const position=Math.min(1,progress)*Math.max(0,poses.length-1),a=poses[Math.floor(position)]??{x:0,y:0},b=poses[Math.ceil(position)]??a,t=position%1;
  const mix=(x:number,y:number)=>x+(y-x)*t;
  return {x:mix(a.x,b.x),y:mix(a.y,b.y),rotation:mix(a.rotation??0,b.rotation??0),scaleX:mix(a.scaleX??1,b.scaleX??1),scaleY:mix(a.scaleY??1,b.scaleY??1),opacity:mix(a.opacity??1,b.opacity??1)};
};
registerBattleAssetLoader("rigged",async asset=>{
  if(asset.type!=="rigged")throw Error("Wrong asset adapter");
  const art=await Promise.all(asset.layers.map(l=>loadImage(l.path))),byId=new Map(asset.layers.map(l=>[l.id,l]));
  return {frameCount:60,continuous:true,draw(ctx,progress){
    const transform=(id:string,visited:Set<string>)=>{
      if(visited.has(id))return;visited.add(id);const layer=byId.get(id);if(!layer)return;
      if(layer.parent)transform(layer.parent,visited);
      const pose=interpolatePose(layer.poses,progress);ctx.translate(pose.x,pose.y);ctx.rotate((pose.rotation??0)*Math.PI/180);ctx.scale(pose.scaleX??1,pose.scaleY??1);ctx.globalAlpha*=pose.opacity??1;
    };
    asset.layers.forEach((l,i)=>{ctx.save();ctx.scale(ctx.canvas.width/asset.width,ctx.canvas.height/asset.height);transform(l.id,new Set());ctx.drawImage(art[i],-l.pivotX,-l.pivotY,l.width,l.height);ctx.restore();});
  }};
});
export async function loadBattleAsset(asset:BattleAsset){
  const ready=preparedAssets.get(asset);if(ready)return ready;
  let pending=preparingAssets.get(asset);
  if(!pending){
    const loader=loaders.get(asset.type);if(!loader)throw Error("Missing asset adapter");
    pending=loader(asset).then(value=>{preparedAssets.set(asset,value);return value;}).catch(error=>{preparingAssets.delete(asset);throw error;});
    preparingAssets.set(asset,pending);
  }
  return pending;
}

export const BattleAnimationPlayer=memo(function BattleAnimationPlayer({id,side,playback,speed=1,paused=false,finisher,aspect=4/3,stageMotion=false,inspectionTimeMs}:{id:CharacterId;side:"player"|"boss";playback:ActorPlayback;speed?:number;paused?:boolean;finisher?:BattleFinisherCue;aspect?:number;stageMotion?:boolean;inspectionTimeMs?:number}){
  const canvas=useRef<HTMLCanvasElement>(null),pauseAt=useRef<number|undefined>(undefined);
  const [assetState,setAssetState]=useState("loading");
  const character=canonicalCharacters[id],clip=playback.clip;
  const a=clip.asset;
  const registration=a.type==='spriteSheet'?(a.bodyRegistration?pianoBladeRegistration:a.canvasBounds&&a.registrationBounds?{reference:a.registrationBounds,canvas:a.canvasBounds,ground:a.registrationBounds.y+a.registrationBounds.height,rasterScale:2.5}:undefined):undefined;
  const canvasStyle=registration?{position:'absolute' as const,left:`${(registration.canvas.x-registration.reference.x)/registration.reference.width*100}%`,top:`${(registration.canvas.y-registration.reference.y)/registration.reference.height*100}%`,width:`${registration.canvas.width/registration.reference.width*100}%`,height:`${registration.canvas.height/registration.reference.height*100}%`,transformOrigin:`${(registration.reference.x+registration.reference.width/2-registration.canvas.x)/registration.canvas.width*100}% ${(registration.ground-registration.canvas.y)/registration.canvas.height*100}%`}:{};
  useLayoutEffect(()=>{
    let disposed=false,raf=0,lastFrame=-1;
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    if(paused){pauseAt.current??=Date.now();}else pauseAt.current=undefined;
    const ctx=canvas.current?.getContext("2d");if(!ctx)return;
    const frameReadout=canvas.current?.closest('.battle-fighter')?.querySelector('.battle-frame-readout');
    let loaded:PlaybackAsset|undefined,fallback=false;
    const paint=()=>{
      if(disposed||!loaded)return;
      const terminal=clip.holdLast && (playback.staticLast||media.matches);
      const progress=terminal?1:media.matches?0:spriteProgress(clip,playback,inspectionTimeMs===undefined?(pauseAt.current??Date.now()):playback.startedAt+inspectionTimeMs,speed);
      const frame=fallback?0:Math.min(loaded.frameCount-1,Math.floor(progress*loaded.frameCount));
      if(frame!==lastFrame || loaded.continuous){
        ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
        // Authored drawings define anatomical motion; never ghost whole poses.
        loaded.draw(ctx,fallback?0:progress,stageMotion);
        lastFrame=frame;canvas.current!.dataset.spriteFrame=String(frame);
        if(frameReadout)frameReadout.textContent=`current frame ${frame} · ${Math.round(progress*100)}%`;
      }
      if(inspectionTimeMs===undefined&&!paused&&!media.matches&&!document.hidden&&(clip.loop||progress<1))raf=requestAnimationFrame(paint);
    };
    const restart=()=>{cancelAnimationFrame(raf);lastFrame=-1;paint();};
    const ready=preparedAssets.get(clip.asset);
    if(ready){loaded=ready;setAssetState("ready");paint();}
    else {setAssetState("loading");void loadBattleAsset(clip.asset).then(asset=>{if(!disposed){loaded=asset;setAssetState("ready");paint();}}).catch(async()=>{
      if(disposed)return;
      try {const asset=await loadBattleAsset(characterIdle(id).asset);if(!disposed){loaded=asset;fallback=true;setAssetState("fallback");paint();}}
      catch {if(!disposed)setAssetState("unavailable");}
    });}
    media.addEventListener("change",restart);document.addEventListener("visibilitychange",restart);
    return()=>{disposed=true;cancelAnimationFrame(raf);media.removeEventListener("change",restart);document.removeEventListener("visibilitychange",restart);};
    // Action identity and clock shifts restart playback. New presentation
    // objects at contact must not restart the canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[id,clip,playback.startedAt,playback.serial,playback.staticLast,speed,paused,aspect,inspectionTimeMs]);
  return <div className={`battle-character battle-character-${side}${finisher?" battle-character-engulfed":""}`} data-animation-id={clip.id} data-animation-category={clip.category} data-asset-status={assetState}
    style={{"--actor-accent":character.accent,"--actor-duration":`${clip.durationMs/speed}ms`,aspectRatio:registration?`${registration.reference.width}/${registration.reference.height}`:undefined,animationPlayState:paused?"paused":"running"} as CSSProperties}>
    <canvas key={stageMotion?id:`${id}:${playback.serial}`} ref={canvas} width={registration?registration.canvas.width*registration.rasterScale:512} height={registration?registration.canvas.height*registration.rasterScale:Math.round(512/aspect)} role="img" aria-label={character.name} className={`battle-sprite${stageMotion?"":` battle-motion-${clip.motion??"none"}`}`} style={{...canvasStyle,animationPlayState:paused?"paused":"running",transform:clip.contact?.mirrored?'scaleX(-1)':undefined}} />
    {assetState==="unavailable"&&<span className="battle-art-unavailable">{character.shortName}</span>}
    {finisher&&<BattleFinisher key={finisher.id} cue={finisher}/>}
  </div>;
});
