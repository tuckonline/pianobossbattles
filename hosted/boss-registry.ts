// Presentation profiles only. HP, scoring and MIDI live in the shared engine.
export const bossProfiles = {
 crimson_musical_colossus:{id:'crimson_musical_colossus',name:'Crimson Colossus',description:'Brutal power. Crushing attacks.',portrait:'/battle/cinematics/boss-dominant.png',accent:'#f27482',signature:'boss_crimson_crushing_strike',taunt:'pressure_boss_taunt',heightRatio:undefined as number|undefined,sound:'crimson',cinematics:{standing:'/battle/cinematics/boss-dominant.png',fallen:'/battle/cinematics/boss-fallen.png'}},
 grinwick:{id:'grinwick',name:'Grinwick \u2014 The Chaos Gremlin',description:'Fast claws. Wicked tricks.',portrait:'/battle/grinwick/portrait.png',accent:'#9fef49',signature:'grinwick_goblin_frenzy',taunt:'grinwick_cackle',heightRatio:.65,sound:'grinwick',cinematics:{standing:'/battle/grinwick/victory.png',fallen:'/battle/grinwick/defeat.png'}},
} as const;
export type BossId=keyof typeof bossProfiles;
export const bossProfile=(id:string)=>bossProfiles[id as BossId]??bossProfiles.crimson_musical_colossus;
export function bossClipId(id:string,clip:string){return id==='grinwick'&&clip.startsWith('boss_')?(clip==='boss_crimson_crushing_strike'?'grinwick_goblin_frenzy':clip.replace(/^boss_/,'grinwick_')):clip;}
