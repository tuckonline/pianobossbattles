import {characterIdle} from './battle-animation-library';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {BattleView} from './boss-battle';
import type {BattlePresentation} from './battle-animation-director';
import {animationById,type BattleAnimationDefinition} from './battle-animation-library';
import {battleAudio,isObsAudioSource,type AudioOutput} from './battle-audio';
import {pressureDuration} from './battle-pressure';
import {loadBattleAsset} from './battle-animation-player';
import './battle-pressure.css';
const clips=new Map<string,BattleAnimationDefinition>();
function pose(id:string){
 if(!clips.has(id)){const source=animationById(id)!;clips.set(id,{...source,id:`pressure_${id}`,category:'idle',durationMs:pressureDuration,loop:false,holdLast:false,motion:'settle',contact:undefined,choreography:undefined});}
 return clips.get(id)!;
}
// Dedicated expression art, fitted to the existing actor rectangle and foot
// baseline. Normal combat assets and their anatomical registration stay intact.
const panic:BattleAnimationDefinition={...pose('hero_expression_surprised'),id:'pressure_hero_panic',label:'Anime panic',
 poseTimesMs:[0,180,520,1120]};
// Use illustrated claw lift / open-chested snarl / relaxed poses, not a held
// guard. A fixed idle registration prevents pose padding from shrinking him.
const taunt:BattleAnimationDefinition={...pose('boss_idle_laughter_03'),id:'pressure_boss_taunt',label:'Claw-flexing laugh',
 poseTimesMs:[0,180,420,760,1120]};
export function usePressurePresentation(b:BattleView,base:BattlePresentation,blocked:boolean,output?:AudioOutput){
 const bossTaunt=b.config.bossId==='grinwick'?(b.pressure?.stage===3?pose(b.bossHp/b.bossMaxHp<=.25?'grinwick_idle_panic_05':'grinwick_idle_applause_03'):animationById('grinwick_cackle')!):taunt;
 useEffect(()=>{if(b.config.pressureReactions){void loadBattleAsset(panic.asset).catch(()=>{});void loadBattleAsset(bossTaunt.asset).catch(()=>{});}},[b.config.pressureReactions,bossTaunt]);
 const cue=b.pressure,cueId=cue?.id,cueAt=cue?.at,cueStage=cue?.stage;
 const [clock,setClock]=useState(Date.now);
 const consumed=useRef(new Set<string>());
 useEffect(()=>{if(!cueStage||cueAt===undefined)return;setClock(Date.now());const t=setTimeout(()=>setClock(Date.now()),Math.max(0,cueAt+pressureDuration-Date.now()));return()=>clearTimeout(t);},[cueId,cueStage,cueAt]);
 const visible=!!cue?.stage&&b.config.pressureReactions&&b.status==='active'&&!blocked&&base.phase==='idle'&&!base.pendingCount&&clock<cue.at+pressureDuration;
 useEffect(()=>{
  if(!cue?.stage)return;
  const id=`${cue.id}:pressure:${cue.stage}`;
  if(consumed.current.has(id))return;
  consumed.current.add(id);if(consumed.current.size>128)consumed.current.delete(consumed.current.values().next().value!);
  // A busy/paused/stale cue is consumed, never queued behind an attack.
  if(!visible||cue.stage===1||Date.now()-cue.at>200||output!=='obs'||!isObsAudioSource()||battleAudio.snapshot().output!=='obs')return;
  battleAudio.play(cue.stage===2?'pressureTaunt':'pressureTension',id,cue.at);
 },[cue,visible,output]);
 return useMemo(()=>{
  if(!visible||!cue)return base;
  const player={...base.player,clip:cue.stage>=2?panic:pose('hero_idle_01'),startedAt:cue.at,serial:-cue.stage,pressure:cue.stage};
  const boss={...base.boss,clip:cue.stage>=2?bossTaunt:characterIdle(b.config.bossId),startedAt:cue.at,serial:-cue.stage,pressure:cue.stage};
  return {...base,player,boss};
 },[base,visible,cue,bossTaunt,b.config.bossId]);
}
// Accessibility/test marker only. Eyes, mouth, sweat and stress marks are all
// drawn in the dedicated sprite; no floating face or symbol overlays.
export function PressureExpression({stage}:{stage:number}){
 if(stage<2)return null;
 return <span className="battle-anxiety" data-pressure-expression={stage} aria-label={stage===3?'Piano Blade startled':'Piano Blade anxious'}/>;
}
