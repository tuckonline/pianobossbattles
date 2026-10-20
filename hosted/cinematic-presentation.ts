/** Original V10 presentation from 6e8a8c6842b19be96ae950840eeef4a9c7922a21.
 * Keep artwork/timing separate from the persistent V11 lifecycle controller.
 * Only the old exit phase is replaced: retain the final composition, then hold.
 */
export type CinematicResult = 'victory'|'defeat'|'timeout';
export type CinematicVisualPhase = 'preparing'|'entering'|'action'|'impact'|'result';
export const cinematicAssets = {
  hero: '/battle/cinematics/hero-finish.png',
  heroDown: '/battle/cinematics/hero-defeated.png',
  boss: '/battle/cinematics/boss-dominant.png',
  bossDown: '/battle/cinematics/boss-fallen.png',
} as const;
type Definition = {durationMs:number;title:string;assets:string[];stages:{id:CinematicVisualPhase;startMs:number;endMs:number}[]};
function timeline(title:string,assets:string[],points:number[]):Definition {
  const names=['preparing','entering','action','impact','result','result'] as const;
  return {title,assets,durationMs:points[6],stages:names.map((id,i)=>({id,startMs:points[i],endMs:points[i+1]}))};
}
export const cinematicDefinitions:Record<CinematicResult,Definition> = {
  victory:timeline('BOSS DEFEATED',[cinematicAssets.hero,cinematicAssets.boss,cinematicAssets.bossDown],[0,500,1000,1700,2300,4400,4800]),
  defeat:timeline('YOU WERE DEFEATED',[cinematicAssets.hero,cinematicAssets.heroDown,cinematicAssets.boss],[0,400,800,1350,1950,3700,4100]),
  timeout:timeline('TIME OUT',[cinematicAssets.boss],[0,100,450,550,700,2750,3100]),
};
