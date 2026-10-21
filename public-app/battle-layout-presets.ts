import {shortsBattleLayout} from '../hosted/shorts-layout';

export const defaultArenaPercent=40;
export const minArenaPercent=30,maxArenaPercent=70;
export const battleLayoutPreferenceKey=(userId:string)=>`pbb:battle-layout:v2:${userId}`;
export function normalizeArenaPercent(value:number){return Math.max(minArenaPercent,Math.min(maxArenaPercent,Math.round(value)));}
export function readBattleLayout(storage:Pick<Storage,'getItem'>,userId:string):number {
  try {
    const saved=storage.getItem(battleLayoutPreferenceKey(userId));
    if(saved?.trim() && Number.isFinite(Number(saved)))return normalizeArenaPercent(Number(saved));
  } catch { /* Browser storage can be unavailable; rendering still works. */ }
  // Retired preset preferences intentionally yield the new Music Focus default.
  return defaultArenaPercent;
}
const baseArenaLayout={...shortsBattleLayout,idleArrangement:'side-by-side' as const,
  referenceArenaHeightPercent:77,characterScale:1.1,
  heroIdleZone:{x:.08,y:.04,width:.41,height:.92},bossIdleZone:{x:.51,y:.04,width:.41,height:.92},
  heroAnchor:{x:.34,y:.51},bossAnchor:{x:.66,y:.51}};
// Shorter arenas need closer idle positions to preserve the authored reach.
// Cache configurations so ordinary scoring renders do not reset animation effects.
const arenaLayouts=Array.from({length:maxArenaPercent-minArenaPercent+1},(_,i)=>{
  const percent=i+minArenaPercent,x=Math.max(.34,.395+(40-percent)*.00275);
  return {...baseArenaLayout,heroAnchor:{x,y:.51},bossAnchor:{x:1-x,y:.51}};
});
export const arenaLayoutFor=(percent:number)=>arenaLayouts[normalizeArenaPercent(percent)-minArenaPercent];
