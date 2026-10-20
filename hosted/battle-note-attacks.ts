import {animationById,type BattleAnimationDefinition,type CharacterId} from "./battle-animation-library";

// Only presentation groups nearby, evaluator-approved tones. No tempo grading.
export const noteAttackRules={chordWindowMs:120,historySize:8,maxVisualChord:6};
export type BattleNoteAttack={
  id:string;groupId:string;revision:number;firstAt:number;lastAt:number;readyAt:number;
  pitches:number[];hits:number;expectedSize:number;complete:boolean;
};
export type NoteAttackStyle={key:number;chordSize:number;power:number;angle:number;arcs:number;hits:number;label:string};

// All twelve pitch classes have a stable visual signature. Octaves adjust the
// slash angle; existing original poses are reused instead of adding 88 atlases.
const keyStyles=[
  ["slash",-32],["rising",-62],["lunge",-8],["slash",28],
  ["rising",-44],["lunge",14],["slash",-16],["rising",42],
  ["lunge",-26],["slash",58],["rising",12],["lunge",34],
] as const;
export function noteAttackStyle(cue:BattleNoteAttack):NoteAttackStyle {
  const key=Math.min(...cue.pitches),size=cue.complete?cue.pitches.length:1;
  const chordSize=Math.max(1,size),strength=Math.min(noteAttackRules.maxVisualChord,chordSize);
  const octave=Math.floor(key/12)-5;
  return {key,chordSize,power:1+(strength-1)*.25,angle:keyStyles[key%12][1]+octave*1.25,
    arcs:strength,hits:cue.hits,label:chordSize>1?`${chordSize}-note chord`:""};
}
export function noteAttackClip(character:CharacterId,cue:BattleNoteAttack):BattleAnimationDefinition|undefined {
  const style=noteAttackStyle(cue),prefix=character==="piano_blade_warrior"?"hero":"boss";
  const suffix=style.chordSize>=3?"attack_heavy_cross_01":style.chordSize===2?"attack_heavy_arc_01":`attack_light_${keyStyles[style.key%12][0]}_01`;
  const clip=animationById(`${prefix}_${suffix}`);if(!clip)return undefined;
  const duration=style.chordSize>1?Math.min(550,300+style.chordSize*40):clip.durationMs;
  // Mapped player actions deliberately repeat for the same key. Weighted
  // variety/cooldowns remain in the existing boss/idle/reaction selector.
  return {...clip,durationMs:duration};
}
