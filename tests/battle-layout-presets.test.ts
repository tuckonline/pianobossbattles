import {expect,it} from 'vitest';
import {battleLayoutPreferenceKey,readBattleLayout,arenaLayoutFor} from '../public-app/battle-layout-presets';
it('defaults to 40% arena for new players, retired presets, invalid or blocked storage',()=>{
 for(const value of [null,'','music','balanced','__proto__','NaN'])expect(readBattleLayout({getItem:()=>value},'player')).toBe(40);
 expect(readBattleLayout({getItem:()=>{throw Error('blocked');}},'player')).toBe(40);
});
it('reads isolated local sizes, clamps corrupted values and reuses framing configs',()=>{
 for(const [value,expected] of [['30',30],['40',40],['57',57],['70',70],['999',70],['-1',30],['42.4',42]] as const){
  const storage={getItem:(key:string)=>key===battleLayoutPreferenceKey('a')?value:null};
  expect(readBattleLayout(storage,'a')).toBe(expected);expect(readBattleLayout(storage,'b')).toBe(40);
  expect(arenaLayoutFor(expected)).toBe(arenaLayoutFor(expected));
 }
 expect(arenaLayoutFor(40).heroAnchor).toEqual({x:.395,y:.51});
});
