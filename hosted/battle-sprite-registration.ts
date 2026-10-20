import atlas from './battle-art-bounds.json' with {type:'json'};

type Box={x:number;y:number;width:number;height:number};
type Sprite={type:string;path?:string;frames?:number[];registrationBounds?:Box;bodyRegistration?:'piano-blade'};
const sheets=atlas as Record<string,{frames:number[][]}>;
// Source-pixel registration, measured against the canonical A0–A3 guard.
// Wider capes/swords get more canvas, never a smaller character.
export const pianoBladeRegistration={
  reference:{x:9,y:4,width:211,height:188},
  canvas:{x:-72,y:-40,width:432,height:264},
  rasterScale:2.5,
  ground:192,
};
// Foot contact lines (not glow/weapon alpha bottoms). Crouches remain shorter;
// only their ground offset changes. Values are source-cell pixel coordinates.
const groundA=[192,192,192,192,187,187,188,187,178,179,180,182,196,197,198,196,194,198,196,194,193,193,195,193,192,192,192,195,183,179,177,177];
const groundB=[193,196,195,194,198,198,199,198,193,193,194,192,193,193,194,193,194,194,195,194,198,198,198,197,192,192,192,190,181,181,177,179];
export function heroGroundShift(path:string,frame:number){return pianoBladeRegistration.ground-(path.endsWith('-a.png')?groundA:groundB)[frame];}
export function spriteCrop(asset:Sprite):Box|undefined {
  if(asset.type!=='spriteSheet'||!asset.path||!asset.frames)return;
  if(asset.registrationBounds)return asset.registrationBounds;
  const frames=asset.frames.map(i=>sheets[asset.path!]?.frames[i]);if(frames.some(f=>!f))return;
  const x=Math.min(...frames.map(f=>f[0])),y=Math.min(...frames.map(f=>f[1]));
  return {x,y,width:Math.max(...frames.map(f=>f[0]+f[2]))-x,height:Math.max(...frames.map(f=>f[1]+f[3]))-y};
}
export function heroSourcePoint(point:{x:number;y:number},crop:Box,path:string,frame:number){
  const r=pianoBladeRegistration.reference,s=Math.min(r.width/crop.width,r.height/crop.height);
  const x=crop.x+(point.x*r.width-(r.width-crop.width*s)/2)/s;
  const y=crop.y+(point.y*r.height-(r.height-crop.height*s))/s+heroGroundShift(path,frame);
  return {x:(x-r.x)/r.width,y:(y-r.y)/r.height};
}
export function heroInkBounds(path:string,frames:number[]):Box {
  const r=pianoBladeRegistration.reference,boxes=frames.map(i=>{const [x,y,width,height]=sheets[path].frames[i];return {x,y:y+heroGroundShift(path,i),width,height};});
  const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
  return {x:(x-r.x)/r.width,y:(y-r.y)/r.height,width:(Math.max(...boxes.map(b=>b.x+b.width))-x)/r.width,height:(Math.max(...boxes.map(b=>b.y+b.height))-y)/r.height};
}
