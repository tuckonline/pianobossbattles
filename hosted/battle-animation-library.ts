import {combatMotion} from './battle-motion-profile';
import {registerExpandedAnimations} from './battle-animation-expansion';
import {heroSourcePoint,heroInkBounds,spriteCrop} from './battle-sprite-registration';
// Asset data, selection and playback are deliberately independent of combat HP.
export type AnimationCategory = "idle" | "lightAttack" | "heavyAttack" | "hitReaction" | "defense" | "counter" | "movement" | "victory" | "defeat";
export type AnimationEvent = "idle" | "correct" | "mistake" | "milestone" | "victory" | "defeat";
export type RigPose = {x:number;y:number;rotation?:number;scaleX?:number;scaleY?:number;opacity?:number};
export type BattleAsset =
  | {type:"spriteSheet";path:string;columns:number;rows:number;frames:number[];registrationBounds?:{x:number;y:number;width:number;height:number};canvasBounds?:{x:number;y:number;width:number;height:number};bodyRegistration?:'piano-blade'}
  | {type:"frameSequence";paths:string[]}
  | {type:"rigged";width:number;height:number;layers:{id:string;parent?:string;path:string;width:number;height:number;pivotX:number;pivotY:number;poses:RigPose[]}[]};
export type AttackContact = {
  impactFrame:number; impactTimeMs:number; recoveryMs:number; hitStopMs:number;
  recoilIntensity:number; weaponAnchor:{x:number;y:number}; targetAnchor:{x:number;y:number};
  // Normalized actor registration coordinates, not padded PNG cells. Hero
  // weapons may extend outside 0â€“1 without changing his anatomical scale.
  weaponOrigin?:{x:number;y:number};
  targetRegion?:{name:'shoulder'|'upperTorso'|'arm'|'lowerTorso';x:number;y:number;width:number;height:number};
  bodyBounds?:{x:number;y:number;width:number;height:number};
  defenderBodyBounds?:{x:number;y:number;width:number;height:number};
  preferredBodySeparation?:number; maximumLungeDistance?:number; contactTolerance?:number;
  separationAxis?:'horizontal';
  visualBounds?:{x:number;y:number;width:number;height:number};
  defenderStep?:{x:number;y:number};
  recoilDirection?:{x:number;y:number};
  mirrored?:boolean; defenderMirrored?:boolean;
};
export type SignatureChoreography = {
  phase:"opening"|"reverse"|"cross"|"crush";
  anticipationMs:number; braceMs:number; followThroughMs:number;
  reactionId:string; reactionStart:number; reactionDurationMs:number;
  impactPower:number;
};
export interface BattleAnimationDefinition {
  id:string; characterId:string; category:AnimationCategory; label:string;
  asset:BattleAsset; durationMs:number; loop?:boolean; holdLast?:boolean;
  weight:number; cooldownMs:number; priority:number; tags:string[];
  motion?:"settle"|"advance"|"retreat"|"strike"|"recoil"|"heavy";
  contact?:AttackContact;
  // Exact pose start times in the unpaused clip clock. These hold illustrated
  // key poses; they do not manufacture interpolated or duplicated drawings.
  poseTimesMs?:number[];
  // Optional inspector labels for authored drawings, not additional states.
  posePhases?:string[];
  choreography?:SignatureChoreography;
  conditions?:{minCombo?:number;maxHpPercent?:number;bossEnraged?:boolean;battleState?:string[];eventType?:AnimationEvent[]};
}
export const canonicalCharacters = {
  grinwick:{name:"Grinwick \u2014 The Chaos Gremlin",shortName:"GRINWICK",side:"boss",accent:"#9fef49",fallback:"grinwick_idle_01"},
  piano_blade_warrior:{name:"Piano Blade Warrior",shortName:"PIANO BLADE",side:"player",accent:"#65d9fa",fallback:"hero_idle_01"},
  crimson_musical_colossus:{name:"Crimson Musical Colossus",shortName:"CRIMSON COLOSSUS",side:"boss",accent:"#f27482",fallback:"boss_idle_01"},
} as const;
export type CharacterId = keyof typeof canonicalCharacters;
export const battleAnimationLibrary:BattleAnimationDefinition[]=[];
export function registerBattleAnimation(def:BattleAnimationDefinition) {
  if(battleAnimationLibrary.some(a=>a.id===def.id))throw new Error(`Duplicate battle animation: ${def.id}`);
  if(def.durationMs<=0 || def.weight<=0 || def.cooldownMs<0)throw new Error(`Invalid animation timing: ${def.id}`);
  const asset=def.asset;
  if(asset.type==="spriteSheet" && (asset.columns<1||asset.rows<1||!asset.frames.length || asset.frames.some(f=>!Number.isInteger(f)||f<0||f>=asset.columns*asset.rows)))throw new Error(`Invalid sprite frames: ${def.id}`);
  if(def.asset.type==="frameSequence" && !def.asset.paths.length)throw new Error(`Missing frames: ${def.id}`);
  if(def.poseTimesMs){
    const count=asset.type==='spriteSheet'?asset.frames.length:asset.type==='frameSequence'?asset.paths.length:0;
    if(def.poseTimesMs.length!==count||def.poseTimesMs[0]!==0||def.poseTimesMs.some((t,i)=>!Number.isFinite(t)||t>=def.durationMs||(i>0&&t<=def.poseTimesMs![i-1])))throw new Error(`Invalid pose times: ${def.id}`);
    if(def.contact&&def.poseTimesMs[def.contact.impactFrame]!==def.contact.impactTimeMs)throw new Error(`Pose/contact mismatch: ${def.id}`);
  }
  battleAnimationLibrary.push(def);
}
function characterClips(characterId:CharacterId,prefix:"hero"|"boss",path:string) {
  const hero=prefix==="hero";
  const add=(suffix:string,category:AnimationCategory,label:string,sheet:"a"|"b",row:number,durationMs:number,options:Partial<BattleAnimationDefinition>={})=>{
    registerBattleAnimation({id:`${prefix}_${suffix}`,characterId,category,label,
      asset:{type:"spriteSheet",path:`/battle/${path}-${sheet}.png`,columns:4,rows:8,frames:[0,1,2,3].map(i=>row*4+i)},
      durationMs,weight:1,cooldownMs:0,priority:category==="victory"||category==="defeat"?100:category==="heavyAttack"?60:30,tags:[],...options});
  };
  add("idle_01","idle","Breathing guard","a",0,2600,{loop:true,weight:3,motion:"settle"});
  add("idle_02","idle",hero?"Blade reposition":"Tension stance","b",0,3000,{loop:true,weight:2,motion:"settle"});
  add("attack_light_slash_01","lightAttack",hero?"Horizontal cut":"Right claw swipe","a",1,200,{weight:3,motion:"strike"});
  add("attack_light_lunge_01","lightAttack",hero?"Lunging thrust":"Lunging maul","a",2,240,{weight:2,motion:"advance",cooldownMs:350});
  add("attack_light_rising_01","lightAttack",hero?"Rising slash":"Backhand rake","b",1,220,{weight:3,motion:"strike"});
  add("attack_heavy_arc_01","heavyAttack",hero?"Overhead crescent":"Two-arm crush","a",3,360,{motion:"heavy",cooldownMs:1200,tags:["milestone"]});
  add("attack_heavy_cross_01","heavyAttack",hero?"Cross-blade finisher":"Crimson shockwave","b",2,400,{motion:"heavy",cooldownMs:1200,tags:["rage","finisher"]});
  add("hit_reaction_01","hitReaction","Chest recoil","a",4,220,{weight:3,motion:"recoil"});
  add("hit_reaction_02","hitReaction","Shoulder stagger","b",3,260,{weight:2,motion:"recoil"});
  add("hit_reaction_low_hp_03","hitReaction","Wounded recovery","b",3,300,{weight:3,motion:"retreat",conditions:{maxHpPercent:30},tags:["lowHp"],
    ...(!hero?{asset:{type:'spriteSheet' as const,path:`/battle/${path}-b.png`,columns:4,rows:8,frames:[13,17,18,19]}}:{})});
  add("defense_guard_01","defense",hero?"Crossed blades":"Armored brace","a",5,300,{cooldownMs:600});
  add("defense_evade_02","defense",hero?"Guarded sidestep":"Shoulder guard","b",4,320,{motion:"retreat",cooldownMs:600});
  add("movement_advance_01","movement",hero?"Low advance":"Heavy stomp","b",5,600,{motion:"advance",cooldownMs:3000});
  add("movement_retreat_02","movement","Stance recovery","b",5,650,{motion:"retreat",cooldownMs:3000,
    asset:{type:"spriteSheet",path:`/battle/${path}-b.png`,columns:4,rows:8,frames:[23,22,21,20]}});
  add("counter_riposte_01","counter",hero?"Guard into riposte":"Brace and retaliate","b",1,340,{cooldownMs:1800,conditions:{minCombo:5},
    asset:{type:"spriteSheet",path:`/battle/${path}-b.png`,columns:4,rows:8,frames:[16,17,4,5,6,7]},motion:"strike",tags:["counter"]});
  add("victory_01","victory",hero?"Blade flourish":"Chest-pound roar","a",6,1000,{holdLast:true});
  add("victory_02","victory",hero?"Kneeling salute":"Dominant roar","b",6,1100,{holdLast:true});
  add("defeat_01","defeat",hero?"One-knee collapse":"Kneeling fall","a",7,900,{holdLast:true});
  add("defeat_02","defeat",hero?"Fall and brace":"Heavy collapse","b",7,1100,{holdLast:true});
}
characterClips("piano_blade_warrior","hero","piano-blade");
characterClips("crimson_musical_colossus","boss","crimson-colossus");
// Contact indexes refer to the ordered clip frames, not atlas cell numbers.
// These four-pose clips have a distinct extended weapon pose. Timing is authored
// to that pose; this is not interpolated skeletal animation or pixel collision.
for(const clip of battleAnimationLibrary){
  if(!["lightAttack","heavyAttack","counter"].includes(clip.category))continue;
  const hero=clip.characterId==="piano_blade_warrior",heavy=clip.category==="heavyAttack";
  const impactFrame=clip.category==="counter"?4:clip.id.includes("cross")||(!hero&&clip.id.includes("lunge"))?2:1;
  clip.contact={impactFrame,impactTimeMs:hero?(heavy?96:64):(heavy?120:96),
    recoveryMs:hero?110:190,hitStopMs:hero?(heavy?45:12):(heavy?60:16),recoilIntensity:hero?.7:1.25,
    weaponAnchor:hero?{x:.86,y:.47}:{x:.43,y:.48},targetAnchor:hero?{x:.76,y:.38}:{x:.49,y:.57}};
}
export const animationById=(id:string)=>battleAnimationLibrary.find(a=>a.id===id);
// Inspected A/B atlases: all rows already have roles; no unused intermediate
// drawings exist. Reuse 11 distinct hero poses and six boss poses. Future art
// work should supply genuine torso-turn/return drawings, not repeated cells.
// The three Azure contacts consume disjoint parts of one approved note batch.
const signature=(id:string,hero:boolean,label:string,sheet:'a'|'b',frames:number[],durationMs:number,impactFrame:number,poseTimesMs:number[],choreography:SignatureChoreography,hitStopMs:number,recoilIntensity:number,recoveryMs:number,cooldownMs=0)=>registerBattleAnimation({
  id,characterId:hero?'piano_blade_warrior':'crimson_musical_colossus',category:'heavyAttack',label,
  asset:{type:'spriteSheet',path:`/battle/${hero?'piano-blade':'crimson-colossus'}-${sheet}.png`,columns:4,rows:8,frames},
  durationMs,weight:1,cooldownMs,priority:75,tags:['signature'],motion:'heavy',conditions:{minCombo:hero?25:0},
  poseTimesMs,choreography,
  contact:{impactFrame,impactTimeMs:poseTimesMs[impactFrame],recoveryMs,hitStopMs,recoilIntensity,
    // Measured against the cleaned contact pose in the canvas: horizontal
    // blade, rising tip, leading cross blade, and the boss's low slam arc.
    weaponAnchor:hero?(choreography.phase==='opening'?{x:.86,y:.56}:choreography.phase==='reverse'?{x:.84,y:.3}:{x:.82,y:.64}):{x:.43,y:.85},
    targetAnchor:hero?{x:.76,y:.38}:{x:.49,y:.95}},
});
signature('hero_azure_blade_rush',true,'Azure Blade Rush','a',[8,4,5,6],260,2,[0,60,140,210],
  {phase:'opening',anticipationMs:60,braceMs:0,followThroughMs:40,reactionId:'boss_hit_reaction_02',reactionStart:.25,reactionDurationMs:200,impactPower:1},combatMotion.hitStop.light,.65,130,6000);
signature('hero_azure_reverse',true,'Azure Blade Rush Â· reverse slash','b',[16,4,5,6],220,2,[0,35,95,165],
  {phase:'reverse',anticipationMs:35,braceMs:0,followThroughMs:48,reactionId:'boss_hit_reaction_01',reactionStart:.25,reactionDurationMs:260,impactPower:1.2},combatMotion.hitStop.medium,1.05,150);
// B9 contains the crossed blades. B10 is the later downward follow-through.
signature('hero_azure_cross',true,'Azure Blade Rush Â· cross strike','b',[8,9,10,11,0],380,1,[0,100,205,280,335],
  {phase:'cross',anticipationMs:40,braceMs:0,followThroughMs:85,reactionId:'boss_hit_reaction_low_hp_03',reactionStart:.25,reactionDurationMs:360,impactPower:2},combatMotion.hitStop.signature,2.3,220);
signature('boss_crimson_crushing_strike',false,'Crimson Crushing Strike','a',[20,21,12,13,14,15],500,4,[0,65,125,175,250,425],
  {phase:'crush',anticipationMs:80,braceMs:70,followThroughMs:110,reactionId:'hero_hit_reaction_02',reactionStart:.25,reactionDurationMs:330,impactPower:2.15},combatMotion.hitStop.bossHeavy,2.1,250,6500);
// Contact regions follow the exposed armor, away from the face. The bright
// outer edge of a swept blade is a valid blade contact, not the actor center.
// Torso boxes deliberately exclude trailing capes, extended arms and weapons.
for(const clip of battleAnimationLibrary){
  const c=clip.contact;if(!c)continue;
  const hero=clip.characterId==='piano_blade_warrior';
  c.weaponOrigin=hero?{x:.58,y:.55}:{x:.47,y:.38};
  c.maximumLungeDistance=.78;c.contactTolerance=.065;
  if(!hero){
    const slam=clip.choreography?.phase==='crush',down=slam||clip.id.includes('lunge')||clip.id.includes('cross')||clip.id.includes('arc')||clip.category==='counter';
    // Claw edges, never the body centre. A14 is the planted downward contact;
    // A13 is still the raised-claw preparation, despite its painted glow.
    if(clip.id==='boss_attack_heavy_arc_01')c.impactFrame=2;
    c.weaponAnchor=down?{x:slam?.28:.24,y:slam?.87:.83}:{x:.14,y:.60};
    c.targetAnchor={x:.56,y:down?.70:.58};
    c.targetRegion={name:down?'lowerTorso':'upperTorso',x:.44,y:down?.54:.44,width:.20,height:down?.24:.24};
    c.bodyBounds={x:down?.38:.34,y:.32,width:.38,height:.44};
    c.defenderBodyBounds={x:.32,y:.32,width:.31,height:.42};
    c.preferredBodySeparation=.018;c.separationAxis='horizontal';
    c.defenderStep={x:-.015,y:down?.085:.045};
  }
  if(hero){
    const phase=clip.choreography?.phase;
    const rising=phase==='reverse'||clip.id.includes('rising');
    const cross=phase==='cross'||clip.id.includes('cross');
    const overhead=clip.id.includes('arc');
    c.weaponAnchor=rising?{x:.90,y:.44}:cross?{x:.82,y:.64}:overhead?{x:.72,y:.80}:{x:.86,y:.56};
    c.targetAnchor=rising?{x:.55,y:.35}:cross?{x:.58,y:.48}:overhead?{x:.54,y:.65}:{x:.53,y:.27};
    c.targetRegion={name:rising?'upperTorso':cross?'arm':overhead?'lowerTorso':'shoulder',
      x:overhead?.32:.39,y:c.targetAnchor.y-.06,width:.20,height:.12};
    c.bodyBounds={x:rising?.35:.32,y:.32,width:rising?.29:.31,height:.42};
    c.defenderBodyBounds={x:.27,y:.24,width:.50,height:.51};
    c.preferredBodySeparation=.018;c.separationAxis='horizontal';
    // Deliberate bracing steps toward the central exchange area. These are
    // absolute offsets from guard, not cumulative movement on every note.
    c.defenderStep={x:.025,y:phase==='cross'?-.085:phase==='reverse'?-.065:-.045};
    c.recoilDirection=rising?{x:.65,y:-.35}:cross?{x:.55,y:.85}:{x:.55,y:.30};
  }
}
// One common registration window across all Azure segments. The original
// per-clip crop changed body scale whenever wide sword trails entered a clip.
// Keep those trails intact and remap the measured anchors into the shared view.
const azureCrops:Record<string,{x:number;y:number;width:number;height:number}>={
  hero_azure_blade_rush:{x:8,y:12,width:303,height:176},
  hero_azure_reverse:{x:7,y:-1,width:284,height:215},
  hero_azure_cross:{x:0,y:0,width:291,height:199},
};
for(const [id,old] of Object.entries(azureCrops)){
  const clip=animationById(id)!,c=clip.contact!;
  if(clip.asset.type!=='spriteSheet')continue;
  const common={x:0,y:-1,width:311,height:215},aspect=211/188;
  const map=(p:{x:number;y:number})=>({x:(old.x+p.x*old.width-common.x)/common.width,
    y:1-(common.y+common.height-old.y-old.height+(1-p.y)*old.width/aspect)*aspect/common.width});
  c.weaponAnchor=map(c.weaponAnchor);c.weaponOrigin=map(c.weaponOrigin!);
  const body=c.bodyBounds!,start=map(body),end=map({x:body.x+body.width,y:body.y+body.height});
  c.bodyBounds={...start,width:end.x-start.x,height:end.y-start.y};
  clip.asset.registrationBounds=common;
}
export const characterIdle=(id:CharacterId)=>animationById(canonicalCharacters[id].fallback)!;

// Remap the existing authored contacts into the fixed body coordinate space.
// Animation timing, artwork, damage, and the idle layout remain unchanged.
for(const clip of battleAnimationLibrary){
  const asset=clip.asset;if(clip.characterId!=='piano_blade_warrior'||asset.type!=='spriteSheet')continue;
  const crop=spriteCrop(asset)!;
  if(clip.contact){
    const c=clip.contact,frame=asset.frames[c.impactFrame],map=(p:{x:number;y:number})=>heroSourcePoint(p,crop,asset.path,frame);
    c.weaponAnchor=map(c.weaponAnchor);if(c.weaponOrigin)c.weaponOrigin=map(c.weaponOrigin);
    if(c.bodyBounds){const b=c.bodyBounds,a=map(b),z=map({x:b.x+b.width,y:b.y+b.height});c.bodyBounds={...a,width:z.x-a.x,height:z.y-a.y};}
    c.visualBounds=heroInkBounds(asset.path,asset.frames);
  }
  asset.bodyRegistration='piano-blade';
}

export interface AnimationContext {eventType:AnimationEvent;combo:number;hpPercent:number;bossEnraged:boolean;battleState:string}
export class BattleAnimationSelector {
  private used=new Map<string,number>();
  private recent=new Map<string,string[]>();
  constructor(private random=()=>Math.random(),private library:readonly BattleAnimationDefinition[]=battleAnimationLibrary){}
  choose(characterId:string,category:AnimationCategory,context:AnimationContext,now:number,exclude:readonly string[]=[],roll?:number) {
    const eligible=this.library.filter(a=>{
      const c=a.conditions;
      return a.characterId===characterId && a.category===category && !exclude.includes(a.id) && now-(this.used.get(a.id)??-Infinity)>=a.cooldownMs &&
        (!c || ((c.minCombo===undefined||context.combo>=c.minCombo)&&(c.maxHpPercent===undefined||context.hpPercent<=c.maxHpPercent)&&
          (c.bossEnraged===undefined||context.bossEnraged===c.bossEnraged)&&(!c.battleState||c.battleState.includes(context.battleState))&&
          (!c.eventType||c.eventType.includes(context.eventType))));
    });
    if(!eligible.length)return undefined; // Never violate a cooldown/condition to fill a slot.
    const key=`${characterId}:${category}`,history=this.recent.get(key)??[];
    const alternatives=eligible.filter(a=>a.id!==history.at(-1));
    const pool=alternatives.length?alternatives:eligible;
    const weights=pool.map(a=>a.weight*(history.includes(a.id)?0.25:1));
    let choice=Math.max(0,Math.min(0.999999,roll??this.random()))*weights.reduce((a,b)=>a+b,0),index=0;
    for(;index<weights.length-1;index++){choice-=weights[index];if(choice<0)break;}
    const selected=pool[index];this.used.set(selected.id,now);this.recent.set(key,[...history,selected.id].slice(-3));
    return selected;
  }
}

// Dedicated drawn Grinwick poses, shared atlas registration and existing player.
// All source cells have identical dimensions; crouches never alter the scale.
const grinRows:Record<string,[string,number[],string]>= {
 idle_01:['a',[0,1,2,3],'Scheming guard'],idle_02:['a',[0,2,1,3],'Ear twitch and claw flex'],
 attack_light_slash_01:['a',[4,5,6,7],'Claw Swipe'],attack_light_lunge_01:['a',[8,9,10,11],'Gremlin Pounce'],attack_light_rising_01:['a',[4,6,5,7],'Reverse Claw'],
 attack_heavy_arc_01:['a',[8,9,10,11],'Gremlin Pounce'],attack_heavy_cross_01:['b',[0,1,2,3,7],'Frenzy Finisher'],
 hit_reaction_01:['b',[4,5,6,7],'Elastic stagger'],hit_reaction_02:['b',[5,4,6,7],'Heavy knockback'],hit_reaction_low_hp_03:['b',[6,4,6,7],'Enraged recovery'],
 defense_guard_01:['a',[8,0,2,3],'Claw guard'],defense_evade_02:['a',[8,10,11,0],'Skitter dodge'],
 movement_advance_01:['a',[8,9,10,11],'Hop into guard'],movement_retreat_02:['a',[10,9,8,0],'Spring back'],counter_riposte_01:['a',[8,4,5,6,7],'Claw counter'],
 victory_01:['b',[12,13,14,15],'Mocking victory dance'],victory_02:['b',[12,14,13,15],'Triumphant cackle'],
 defeat_01:['b',[8,9,10,11],'Dazed collapse'],defeat_02:['b',[8,9,10,11],'Shocked tumble'],
};
for(const source of [...battleAnimationLibrary].filter(c=>c.characterId==='crimson_musical_colossus'&&!c.tags.includes('signature'))){
 const row=grinRows[source.id.replace(/^boss_/,'')];if(!row)continue;
 const [sheet,frames,label]=row;
 registerBattleAnimation({...source,id:source.id.replace(/^boss_/,'grinwick_'),characterId:'grinwick',label,
 asset:{type:'spriteSheet',path:`/battle/grinwick/${sheet}.png`,columns:4,rows:4,frames,registrationBounds:{x:100,y:165,width:312,height:300},canvasBounds:{x:0,y:0,width:512,height:512}},
 contact:source.contact?{...source.contact,impactFrame:source.category==='counter'?2:source.id.includes('cross')?3:source.id.includes('rising')?2:1,weaponAnchor:source.id.includes('cross')?{x:.36,y:.88}:source.id.includes('lunge')||source.id.includes('arc')?{x:-.18,y:.34}:{x:-.23,y:.4},weaponOrigin:{x:.55,y:.49},bodyBounds:{x:.36,y:.25,width:.34,height:.55},visualBounds:{x:0,y:0,width:1,height:1}}:undefined});
}
registerBattleAnimation({id:'grinwick_goblin_frenzy',characterId:'grinwick',category:'heavyAttack',label:'Goblin Frenzy',asset:{type:'spriteSheet',path:'/battle/grinwick/b.png',columns:4,rows:4,frames:[0,1,2,1,2,3,7],registrationBounds:{x:100,y:165,width:312,height:300},canvasBounds:{x:0,y:0,width:512,height:512}},durationMs:500,weight:1,cooldownMs:6500,priority:75,tags:['signature'],motion:'heavy',poseTimesMs:[0,70,120,170,210,250,425],choreography:{phase:'crush',anticipationMs:70,braceMs:60,followThroughMs:110,reactionId:'hero_hit_reaction_02',reactionStart:.25,reactionDurationMs:330,impactPower:2.15},contact:{...animationById('grinwick_attack_light_slash_01')!.contact!,impactFrame:5,weaponAnchor:{x:.36,y:.88},impactTimeMs:250,recoveryMs:250,hitStopMs:combatMotion.hitStop.bossHeavy,recoilIntensity:2.1}});
registerBattleAnimation({id:'grinwick_cackle',characterId:'grinwick',category:'idle',label:'Cackle Taunt',asset:{type:'spriteSheet',path:'/battle/grinwick/a.png',columns:4,rows:4,frames:[12,13,14,13,14,15,0],registrationBounds:{x:100,y:165,width:312,height:300},canvasBounds:{x:0,y:0,width:512,height:512}},durationMs:1400,weight:1,cooldownMs:5000,priority:40,tags:['pressure'],conditions:{eventType:[]}});

registerBattleAnimation({id:'grinwick_entrance',characterId:'grinwick',category:'movement',label:'Skitter and mock',asset:{type:'spriteSheet',path:'/battle/grinwick/a.png',columns:4,rows:4,frames:[8,9,10,12,13,14,0],registrationBounds:{x:100,y:165,width:312,height:300},canvasBounds:{x:0,y:0,width:512,height:512}},durationMs:1800,weight:1,cooldownMs:0,priority:30,tags:['entrance'],conditions:{eventType:[]},motion:'advance'});
registerExpandedAnimations(registerBattleAnimation,animationById);
// Preserve the existing attack identity, contact drawing and contact clock.
// Three new in-between drawings bridge the swing and recovery; the original
// A4/A5/A6/A7 are copied unchanged into the fixed registration canvas.
{
 const cut=animationById('hero_attack_light_slash_01')!;
 cut.asset={type:'spriteSheet',path:'/battle/continuity/hero-horizontal.png',columns:7,rows:1,frames:[0,1,2,3,4,5,6],
   registrationBounds:{x:81,y:44,width:211,height:188},canvasBounds:{x:0,y:0,width:432,height:264}};
 cut.durationMs=260;cut.poseTimesMs=[0,28,64,98,130,170,210];
 cut.posePhases=['anticipation','early swing','contact','follow-through','recovery bend','recovery lower','guard'];
 cut.contact={...cut.contact!,impactFrame:2};
}
for(const [id,path,times,phases] of [
 ['hero_attack_light_lunge_01','hero-lunge',[0,28,64,112,165,215],['load','bent-elbow approach','contact','withdraw','rise to guard','guard']],
 ['hero_attack_light_rising_01','hero-rising',[0,28,64,108,155,215],['crouch','uncoil','contact','overhead follow-through','lower elbow','guard']],
] as const){
 const clip=animationById(id)!;
 clip.asset={type:'spriteSheet',path:`/battle/continuity/${path}.png`,columns:6,rows:1,frames:[0,1,2,3,4,5],
   registrationBounds:{x:81,y:44,width:211,height:188},canvasBounds:{x:0,y:0,width:432,height:264}};
 clip.durationMs=260;clip.poseTimesMs=[...times];clip.posePhases=[...phases];
 clip.contact={...clip.contact!,impactFrame:2};
}
{
 const crush=animationById('boss_attack_heavy_arc_01')!;
 // A13 painted a floor burst while the arms were still overhead. Replace that
 // incompatible pose with a real descending-arm drawing; retain A14 contact.
 crush.asset={type:'spriteSheet',path:'/battle/continuity/boss-crush.png',columns:5,rows:1,frames:[0,1,2,3,4],
   registrationBounds:{x:3,y:7,width:256,height:207}};
 crush.poseTimesMs=[0,75,120,235,305];
 crush.posePhases=['raised load','descending arms','contact','weighted recovery','guard'];
}
for(const id of ['grinwick_attack_light_lunge_01','grinwick_attack_heavy_arc_01']){
 const clip=animationById(id)!,at=clip.contact!.impactTimeMs;
 clip.asset={type:'spriteSheet',path:'/battle/continuity/grinwick-pounce.png',columns:6,rows:1,frames:[0,1,2,3,4,5],
   registrationBounds:{x:100,y:165,width:312,height:300},canvasBounds:{x:0,y:0,width:512,height:512}};
 const tail=clip.durationMs-at;
 clip.poseTimesMs=[0,Math.round(at*.48),at,at+Math.round(tail*.3),at+Math.round(tail*.57),at+Math.round(tail*.82)];
 clip.posePhases=['compressed crouch','tucked launch','contact','feet-down landing','absorb landing','guard'];
 clip.contact={...clip.contact!,impactFrame:2};
}
for(const [id,frames,phases] of [
 ['grinwick_hit_reaction_02',[5,6,7],['knockback','absorb recoil','guard']],
 ['grinwick_hit_reaction_low_hp_03',[6,4,7],['compressed recoil','recover balance','guard']],
] as const){
 const clip=animationById(id)!;
 if(clip.asset.type==='spriteSheet')clip.asset={...clip.asset,frames:[...frames]};
 clip.posePhases=[...phases];
 // Keep the existing duration and progress-based reaction entry/chaining.
 // Intermediate neutral/crouch bounce is removed, not hidden by blending.
}
