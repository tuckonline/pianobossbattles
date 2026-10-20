import {it,expect} from 'vitest';
import {defaultShortsDisplay,shortsDisplaySchema} from '../hosted/shorts-display';
import {normalizeGameSettings} from '../hosted/game-settings';
import {portraitWindow,type PortraitMeasure} from '../src/components/music/portrait-layout';
import {shortsBattleLayout} from '../hosted/shorts-layout';
import {arenaPlacement,idleAspect,overlaps,guardContactOffset,solveWeaponContact} from '../hosted/battle-layout';
import {battleAnimationLibrary} from '../hosted/battle-animation-library';
it('upgrades old profiles and rejects unsupported or nonfinite display scales',()=>{
  expect(normalizeGameSettings({}).shortsDisplay).toEqual(defaultShortsDisplay);
  for(const characterScale of [79,141,NaN,111])expect(shortsDisplaySchema.safeParse({...defaultShortsDisplay,characterScale}).success).toBe(false);
  for(const notationScale of [89,161,Infinity,126])expect(shortsDisplaySchema.safeParse({...defaultShortsDisplay,notationScale}).success).toBe(false);
});
const simple:PortraitMeasure[]=[0,1,2].map(i=>({bounds:{left:0,right:160,top:i*200,bottom:i*200+120},staffY:i*200+20,notes:8}));
it('automatic selects two simple measures but one dense measure, with full bounds containment',()=>{
  expect(portraitWindow(simple,0,'automatic',800,400,125,1).indices).toEqual([0,1]);
  const dense=simple.map(m=>({...m,notes:32}));
  expect(portraitWindow(dense,0,'automatic',800,400,125,1).indices).toEqual([0]);
  for(const request of [90,125,160])for(const view of ['current','next','automatic']){
    const plan=portraitWindow(simple,1,view,300,90,request,1);
    expect(plan.span*plan.scale).toBeLessThanOrEqual(300);
    expect((plan.bottom-plan.top)*plan.scale).toBeLessThanOrEqual(90);
    expect(plan.effective).toBeLessThan(request);
    expect(plan.indices[0]).toBe(1);
  }
  expect(portraitWindow(simple,2,'next',800,400,125,1).indices).toEqual([2]);
});
it.each([360,1080])('Shorts scale preserves proportions, grounding, separation and signature contact at width %i',width=>{
  const height=width/9*16*.4*.77,hero=idleAspect('piano_blade_warrior'),boss=idleAspect('crimson_musical_colossus');
  const base=arenaPlacement(width,height,hero,boss,{...shortsBattleLayout,characterScale:1});
  let last=0;
  for(const factor of [.8,1.1,1.4]){
    const config={...shortsBattleLayout,characterScale:factor},positions=arenaPlacement(width,height,hero,boss,config);
    expect(positions.player.height).toBeGreaterThan(last);last=positions.player.height;
    expect(positions.player.height/base.player.height).toBeCloseTo(positions.boss.height/base.boss.height,5);
    expect(overlaps(positions.player,positions.boss)).toBe(false);
    for(const side of ['player','boss'] as const){
      const a=positions[side],target=positions[side==='player'?'boss':'player'];
      expect(a.y+a.height).toBeCloseTo(base[side].y+base[side].height,4);
      expect(a.x).toBeGreaterThanOrEqual(0);expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.x+a.width).toBeLessThanOrEqual(width);expect(a.y+a.height).toBeLessThanOrEqual(height);
      for(const clip of battleAnimationLibrary.filter(c=>c.contact&&c.characterId===(side==='player'?'piano_blade_warrior':'crimson_musical_colossus'))){
        const brace=guardContactOffset(a,target,{x:0,y:0},width,height,clip.contact!,config);
        const contact=solveWeaponContact(a,{...target,x:target.x+brace.x,y:target.y+brace.y},width,height,clip.contact!,config);
        expect(contact.error,`${factor} ${clip.id}`).toBeLessThan(1);
        expect(contact.separation).toBeGreaterThanOrEqual(-.001);
      }
    }
  }
});

it('keeps a terminal chord beside the preceding phrase at both cursor positions and all zoom settings',()=>{
 const measures:PortraitMeasure[]=[{bounds:{left:0,right:800,top:0,bottom:200},staffY:20,notes:32},{bounds:{left:800,right:860,top:0,bottom:200},staffY:20,notes:2}];
 for(const at of [0,1])for(const view of ['current','next','automatic'])for(const request of [90,125,160]){
  const plan=portraitWindow(measures,at,view,300,150,request,1);
  expect(plan.indices).toEqual([0,1]);
  expect(plan.span*plan.scale).toBeLessThanOrEqual(300);
  expect((plan.bottom-plan.top)*plan.scale).toBeLessThanOrEqual(150);
 }
});
