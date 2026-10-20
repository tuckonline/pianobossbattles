import {useState} from "react";
import {battleAnimationLibrary,canonicalCharacters,type AnimationCategory,type CharacterId} from "./battle-animation-library";
import {BattleAnimationPlayer} from "./battle-animation-player";
import {BattleChoreographyPreview} from "./battle-choreography-preview";
import {BattleAnimationInspector} from "./battle-animation-inspector";
const categories:AnimationCategory[]=["idle","lightAttack","heavyAttack","hitReaction","defense","counter","movement","victory","defeat"];
const labels:Record<AnimationCategory,string>={idle:"Idle",lightAttack:"Light attacks",heavyAttack:"Heavy attacks",hitReaction:"Hit reactions",defense:"Defense",counter:"Counters",movement:"Movement",victory:"Victory",defeat:"Defeat"};
export function BattleAnimationPreview(){
  const [debug]=useState(()=>new URLSearchParams(window.location.search).get('battleDebug')==='1');
  const [open,setOpen]=useState(false),[character,setCharacter]=useState<CharacterId>("piano_blade_warrior");
  const [category,setCategory]=useState<AnimationCategory>("lightAttack"),[selected,setSelected]=useState("");
  const [replay,setReplay]=useState(()=>({at:Date.now(),serial:0}));
  const clips=battleAnimationLibrary.filter(a=>a.characterId===character&&a.category===category);
  const clip=clips.find(c=>c.id===selected)??clips[0];
  const reset=()=>setReplay(r=>({at:Date.now(),serial:r.serial+1}));
  return <details className="battle-library" onToggle={e=>{setOpen(e.currentTarget.open);reset();}}>
    <summary>Character animation library</summary>
    {open&&<div className="battle-library-body">
      <p>Visual preview only. This does not affect the battle, HP, XP or achievements.</p>
      <div className="boss-options">
        <label>Character <select aria-label="Preview character" value={character} onChange={e=>{setCharacter(e.target.value as CharacterId);setSelected("");reset();}}>
          {Object.entries(canonicalCharacters).map(([id,c])=><option key={id} value={id}>{c.name}</option>)}
        </select></label>
        <label>Action <select aria-label="Preview action category" value={category} onChange={e=>{setCategory(e.target.value as AnimationCategory);setSelected("");reset();}}>
          {categories.map(c=><option key={c} value={c}>{labels[c]}</option>)}
        </select></label>
        <label>Variant <select aria-label="Preview animation variant" value={clip.id} onChange={e=>{setSelected(e.target.value);reset();}}>
          {clips.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
        </select></label>
        <button type="button" onClick={reset}>Replay animation</button>
      </div>
      {debug?<BattleAnimationInspector key={`${clip.id}:${replay.serial}`} clip={clip}/>:<div className="battle-library-preview" aria-label="Animation preview">
        <BattleAnimationPlayer id={character} side={canonicalCharacters[character].side} playback={{clip,startedAt:replay.at,serial:replay.serial,contactMs:clip.contact?.impactTimeMs}}/>
        <span>{clip.label}</span>
      </div>}
      <p>{battleAnimationLibrary.filter(a=>a.characterId===character).length} registered clips · Sprite sheets, frame sequences and layered rigs supported.</p>
      {debug&&<BattleChoreographyPreview/>}
    </div>}
  </details>;
}
