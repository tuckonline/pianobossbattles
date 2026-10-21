import bounds from "./battle-art-bounds.json" with {type:'json'};
import { characterIdle, type BattleAsset, type CharacterId } from "./battle-animation-library";
import type {AttackContact} from "./battle-animation-library";

export type Rect = {x:number;y:number;width:number;height:number};
export type Point = {x:number;y:number};
export interface BossBattleLayoutConfig {
  panelWidthPercent:number;
  hudHeightPercent:number; arenaHeightPercent:number; statusHeightPercent:number;
  heroScale:number; bossScale:number;
  characterScale?:number;
  idleArrangement?:"stacked"|"side-by-side";
  heroVisibleScale?:number; referenceArenaHeightPercent?:number;
  referencePanelWidthPercent?:number;
  idleContactX?:{heroWeapon:number;heroTarget:number;bossWeapon:number;bossTarget:number};
  heroIdleZone:Rect; bossIdleZone:Rect;
  heroAnchor:Point; bossAnchor:Point;
  minimumIdleSeparation:number;
  allowCombatOverlap:boolean; attackOverlapDistance:number;
  returnToIdleDuration:number; recoilDuration:number; outcomeDuration:number;
  showArenaBackground:boolean; showCharacterShadows:boolean; showDamageNumbers:boolean;
  attackMotionIntensity:number;
}
// Zones, anchors and separation use 0–1 arena coordinates. Scales describe the
// relative visible height, not the dimensions of a padded PNG. No physics here.
export const battleLayout:BossBattleLayoutConfig = {
  panelWidthPercent:22, hudHeightPercent:10, arenaHeightPercent:76, statusHeightPercent:14,
  referencePanelWidthPercent:16.5,
  heroScale:1.8, bossScale:2.25,
  heroIdleZone:{x:.015,y:.01,width:.88,height:.44},
  bossIdleZone:{x:.02,y:.46,width:.96,height:.53},
  heroAnchor:{x:.30,y:.23}, bossAnchor:{x:.72,y:.735},
  minimumIdleSeparation:.035, allowCombatOverlap:true, attackOverlapDistance:.42,
  returnToIdleDuration:200, recoilDuration:180, outcomeDuration:4000,
  showArenaBackground:true, showCharacterShadows:true, showDamageNumbers:true,
  attackMotionIntensity:1,
};
// Reclaim redundant branding/status space in the unified view. Keep the boss's
// original scale basis; only enlarge the hero's measured alpha envelope.
export const recordingBattleLayout:BossBattleLayoutConfig = {
  ...battleLayout, hudHeightPercent:7.5, arenaHeightPercent:81, statusHeightPercent:11.5,
  referenceArenaHeightPercent:battleLayout.arenaHeightPercent, heroVisibleScale:1.12,
  // Preserve the established neutral composition when individual attack
  // anchors change. Attack reach is resolved at action boundaries below.
  idleContactX:{
    heroWeapon:.86,bossTarget:.53,bossWeapon:.43,heroTarget:.49,
  },
};
const art = bounds as Record<string,{frameWidth:number;frameHeight:number;frames:number[][];masks:number[][];sha256:string}>;
export function measuredFrame(asset:BattleAsset,frame:number) {
  if(asset.type!=="spriteSheet")return undefined;
  const sheet=art[asset.path],box=sheet?.frames[frame];
  return box ? {x:box[0],y:box[1],width:box[2],height:box[3],mask:sheet.masks[frame]} : undefined;
}
export function visibleArtBounds(asset:BattleAsset):Rect|undefined {
  if(asset.type!=="spriteSheet")return undefined;
  const sheet=art[asset.path];if(!sheet)return undefined;
  const frames=asset.frames.map(frame=>sheet.frames[frame]);
  if(frames.some(frame=>!frame))return undefined;
  const x=Math.min(...frames.map(f=>f[0])),y=Math.min(...frames.map(f=>f[1]));
  return {x,y,width:Math.max(...frames.map(f=>f[0]+f[2]))-x,height:Math.max(...frames.map(f=>f[1]+f[3]))-y};
}
export function idleAspect(id:CharacterId) {
  const asset=characterIdle(id).asset;
  const crop=id==='grinwick'&&asset.type==='spriteSheet'?asset.registrationBounds:visibleArtBounds(asset);
  return crop ? crop.width/crop.height : 4/3;
}
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const center=(r:Rect):Point=>({x:r.x+r.width/2,y:r.y+r.height/2});
export function overlaps(a:Rect,b:Rect,gap=0) {
  return a.x < b.x+b.width+gap && a.x+a.width+gap > b.x && a.y < b.y+b.height+gap && a.y+a.height+gap > b.y;
}
export function arenaPlacement(width:number,height:number,heroAspect:number,bossAspect:number,config=battleLayout) {
  const zone=(r:Rect):Rect=>({x:r.x*width,y:r.y*height,width:r.width*width,height:r.height*height});
  const heroZone=zone(config.heroIdleZone),bossZone=zone(config.bossIdleZone);
  const gap=config.minimumIdleSeparation*Math.min(width,height);
  // Fit the base pair together, with the boss 25% taller before hero enlargement. Their full measured
  // alpha envelopes (including weapons) are stricter than face/torso boundaries.
  const referenceHeight=height*(config.referenceArenaHeightPercent??config.arenaHeightPercent)/config.arenaHeightPercent;
  // Widening the panel buys travel/separation space, not another enlargement.
  const widthBasis=(config.referencePanelWidthPercent??config.panelWidthPercent)/config.panelWidthPercent;
  let unit=Math.min(referenceHeight*config.heroIdleZone.height/config.heroScale,heroZone.width*widthBasis/(heroAspect*config.heroScale),
    referenceHeight*config.bossIdleZone.height/config.bossScale,bossZone.width*widthBasis/(bossAspect*config.bossScale),
    (referenceHeight-gap)/(config.idleArrangement==="side-by-side"?Math.max(config.heroScale*(config.heroVisibleScale??1),config.bossScale):config.heroScale+config.bossScale));
  const baseUnit=unit;
  if(config.characterScale!==undefined&&unit>0){
    const hero=config.heroScale*(config.heroVisibleScale??1),boss=config.bossScale;
    const heroRoom=Math.min(heroZone.height,config.heroAnchor.y*height+baseUnit*hero/2-heroZone.y);
    const bossRoom=Math.min(bossZone.height,config.bossAnchor.y*height+baseUnit*boss/2-bossZone.y);
    unit*=Math.max(0,Math.min(config.characterScale,heroZone.width/(unit*hero*heroAspect),heroRoom/(unit*hero),bossZone.width/(unit*boss*bossAspect),bossRoom/(unit*boss)));
  }
  const place=(scale:number,aspect:number,z:Rect,anchor:Point):Rect=>{
    const h=unit*scale,w=h*aspect;
    const y=config.characterScale===undefined?anchor.y*height-h/2:anchor.y*height+baseUnit*scale/2-h;
    return {x:clamp(anchor.x*width-w/2,z.x,z.x+z.width-w),y:clamp(y,z.y,z.y+z.height-h),width:w,height:h};
  };
  const contact=config.idleContactX,bossWidth=unit*config.bossScale*bossAspect;
  const contactWidth=contact?(width-bossWidth*(1-contact.bossTarget))/contact.heroWeapon:width;
  const heroGrowth=Math.min(config.heroVisibleScale??1,contactWidth/(unit*config.heroScale*heroAspect)||1,
    config.characterScale===undefined?(height-gap-unit*config.bossScale)/(unit*config.heroScale)||1:Infinity);
  const player=place(config.heroScale*heroGrowth,heroAspect,heroZone,config.heroAnchor),boss=place(config.bossScale,bossAspect,bossZone,config.bossAnchor);
  if(contact){
    // At narrow widths preserve reachable contact anchors as well as idle
    // separation. This is visual placement only; neither attack rules nor HP change.
    boss.x=clamp(boss.x,Math.max(0,player.width*contact.heroWeapon-boss.width*contact.bossTarget),
      Math.min(width-boss.width,width-player.width*(1-contact.heroWeapon)-boss.width*contact.bossTarget));
    player.x=clamp(player.x,Math.max(0,boss.width*contact.bossWeapon-player.width*contact.heroTarget),
      Math.min(width-player.width,width-boss.width*(1-contact.bossWeapon)-player.width*contact.heroTarget));
  }
  if(overlaps(player,boss,gap)) {
    // Resolve only the visual layout, once on resize. No HP, notes or collision
    // events are involved; offset the pair without making either fighter smaller.
    const needed=player.y+player.height+gap-boss.y;
    const down=Math.min(needed,Math.max(0,height-boss.y-boss.height));boss.y+=down;
    player.y=Math.max(0,player.y-Math.max(0,needed-down));
  }
  return {player,boss};
}
export function boundOffset(rect:Rect,offset:Point,width:number,height:number):Point {
  return {x:clamp(offset.x,-rect.x,width-rect.x-rect.width),y:clamp(offset.y,-rect.y,height-rect.y-rect.height)};
}
export function attackOffset(actor:Rect,target:Rect,width:number,height:number,config=battleLayout):Point {
  const a=center(actor),b=center(target),distance=Math.hypot(b.x-a.x,b.y-a.y)||1;
  const direction={x:(b.x-a.x)/distance,y:(b.y-a.y)/distance};
  // Distance along the visual path until the two artwork envelopes touch.
  const entry=(start:number,size:number,other:number,otherSize:number,d:number)=>
    Math.abs(d)<.0001 ? -Infinity : d>0 ? (other-start-size)/d : (other+otherSize-start)/d;
  const contact=Math.max(0,entry(actor.x,actor.width,target.x,target.width,direction.x),entry(actor.y,actor.height,target.y,target.height,direction.y));
  const overlap=(config.allowCombatOverlap ? config.attackOverlapDistance : -config.minimumIdleSeparation)*Math.min(width,height);
  const travel=Math.max(0,Math.min(distance*.8,contact+overlap*config.attackMotionIntensity));
  return boundOffset(actor,{x:direction.x*travel,y:direction.y*travel},width,height);
}
export function recoilOffset(actor:Rect,attacker:Rect,width:number,height:number,config=battleLayout):Point {
  const a=center(actor),b=center(attacker),distance=Math.hypot(a.x-b.x,a.y-b.y)||1;
  const amount=Math.min(width,height)*.055*config.attackMotionIntensity;
  return boundOffset(actor,{x:(a.x-b.x)/distance*amount,y:(a.y-b.y)/distance*amount},width,height);
}
export function contactOffset(actor:Rect,target:Rect,width:number,height:number,contact:AttackContact,config=battleLayout):Point {
  return solveWeaponContact(actor,target,width,height,contact,config).offset;
}
export const normalizedPoint=(p:Point,mirrored=false):Point=>({x:mirrored?1-p.x:p.x,y:p.y});
export function visualBody(rect:Rect,body:Rect,mirrored=false):Rect {
  return {x:rect.x+rect.width*(mirrored?1-body.x-body.width:body.x),y:rect.y+rect.height*body.y,width:rect.width*body.width,height:rect.height*body.height};
}
export function bodySeparation(a:Rect,b:Rect){
  const dx=Math.max(b.x-a.x-a.width,a.x-b.x-b.width),dy=Math.max(b.y-a.y-a.height,a.y-b.y-b.height);
  return dx>0||dy>0?Math.hypot(Math.max(0,dx),Math.max(0,dy)):Math.max(dx,dy);
}
// A bounded visual contact solver, evaluated once per action. Candidate points
// stay on the authored armor region. No gameplay collision, HP or note events.
export function solveWeaponContact(actor:Rect,target:Rect,width:number,height:number,c:AttackContact,config=battleLayout,from:Point={x:0,y:0}){
  const weapon=normalizedPoint(c.weaponAnchor,c.mirrored),preferred=normalizedPoint(c.targetAnchor,c.defenderMirrored);
  const unit=Math.min(width,height),gap=(c.preferredBodySeparation??0)*unit;
  const maxTravel=(c.maximumLungeDistance??1)*height;
  const candidates=[preferred],region=c.targetRegion;
  if(region)for(let y=0;y<=6;y++)for(let x=0;x<=6;x++)candidates.push(normalizedPoint({x:region.x+region.width*x/6,y:region.y+region.height*y/6},c.defenderMirrored));
  const evaluate=(point:Point)=>{
    let offset={x:target.x+target.width*point.x-actor.x-actor.width*weapon.x,y:target.y+target.height*point.y-actor.y-actor.height*weapon.y};
    const distance=Math.hypot(offset.x-from.x,offset.y-from.y);
    if(distance>maxTravel)offset={x:from.x+(offset.x-from.x)*maxTravel/distance,y:from.y+(offset.y-from.y)*maxTravel/distance};
    // An overscan canvas is not a character boundary. Keep the registered
    // body inside the arena while allowing trailing cloth outside its box.
    const containment=c.visualBounds&&c.bodyBounds?visualBody(actor,c.bodyBounds,c.mirrored):actor;
    offset=config.allowCombatOverlap?boundOffset(containment,offset,width,height):attackOffset(actor,target,width,height,config);
    const moved={...actor,x:actor.x+offset.x,y:actor.y+offset.y};
    const a=c.bodyBounds?visualBody(moved,c.bodyBounds,c.mirrored):undefined,b=c.defenderBodyBounds?visualBody(target,c.defenderBodyBounds,c.defenderMirrored):undefined;
    // A weapon can reach above the shoulder while the bodies still merge.
    // Authored frontal attacks require lateral torso clearance as well.
    const separation=a&&b?c.separationAxis==='horizontal'?Math.max(b.x-a.x-a.width,a.x-b.x-b.width):bodySeparation(a,b):Infinity;
    const landed={x:(moved.x+actor.width*weapon.x-target.x)/target.width,y:(moved.y+actor.height*weapon.y-target.y)/target.height};
    // A panel clamp can land between sampled region points. If the blade still
    // touches the authored region, use that exact point instead of a false miss.
    const regionLeft=region?(c.defenderMirrored?1-region.x-region.width:region.x):0;
    if(region&&landed.x>=regionLeft&&landed.x<=regionLeft+region.width&&landed.y>=region.y&&landed.y<=region.y+region.height)point=landed;
    const error=Math.hypot(moved.x+actor.width*weapon.x-target.x-target.width*point.x,moved.y+actor.height*weapon.y-target.y-target.height*point.y);
    const cost=Math.max(0,gap-separation)*1000+error*100+Math.hypot((point.x-preferred.x)*target.width,(point.y-preferred.y)*target.height);
    return {offset,target:point,weapon,separation,error,cost,withinTolerance:error<=(c.contactTolerance??.01)*unit};
  };
  return candidates.map(evaluate).reduce((best,next)=>next.cost<best.cost?next:best);
}
// A counter can arrive while the previous attacker is still deep in its lunge.
// Recover only as far toward its guard as needed during the incoming windup.
// Both fighters use this same endpoint, avoiding a teleport or chasing a moving target.
export function guardContactOffset(attacker:Rect,target:Rect,current:Point,width:number,height:number,c:AttackContact,config=battleLayout):Point {
  const safe=boundOffset(target,current,width,height);
  const desired=c.defenderStep?boundOffset(target,{x:c.defenderStep.x*width,y:c.defenderStep.y*height},width,height):{x:0,y:0};
  if(c.defenderStep){
    const stepContact=solveWeaponContact(attacker,{...target,x:target.x+desired.x,y:target.y+desired.y},width,height,c,config);
    if(stepContact.error<1&&stepContact.separation>=(c.preferredBodySeparation??0)*Math.min(width,height)-.01)return desired;
  }
  for(let step=0;step<=12;step++){
    const offset={x:safe.x+(desired.x-safe.x)*step/12,y:safe.y+(desired.y-safe.y)*step/12};
    const result=solveWeaponContact(attacker,{...target,x:target.x+offset.x,y:target.y+offset.y},width,height,c,config);
    if(result.error<1&&result.separation>=(c.preferredBodySeparation??0)*Math.min(width,height)-.01&&(!c.defenderStep||step>=6))return offset;
  }
  return {x:0,y:0};
}
