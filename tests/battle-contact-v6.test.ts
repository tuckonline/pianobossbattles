import {expect,it} from 'vitest';
import {animationById,battleAnimationLibrary} from '../hosted/battle-animation-library';
import {arenaPlacement,recordingBattleLayout,idleAspect,solveWeaponContact,guardContactOffset,visualBody,bodySeparation,normalizedPoint,visibleArtBounds} from '../hosted/battle-layout';
const hero=idleAspect('piano_blade_warrior'),boss=idleAspect('crimson_musical_colossus');
it.each([518,784])('preserves character scale while the 22 percent arena gains space at height %i',height=>{
  const old=arenaPlacement(316.8,height,hero,boss,{...recordingBattleLayout,panelWidthPercent:16.5,referencePanelWidthPercent:16.5,
    idleContactX:{heroWeapon:.86,bossTarget:.76,bossWeapon:.43,heroTarget:.49}});
  const next=arenaPlacement(422.4,height,hero,boss,recordingBattleLayout);
  // The old width clamp could shave 1.5% from the enlarged hero at 1080p.
  expect(next.player.height/old.player.height).toBeGreaterThanOrEqual(.999);
  expect(next.player.height/old.player.height).toBeLessThan(1.02);
  expect(next.boss.height).toBeCloseTo(old.boss.height,5);
});
it.each([518,784])('keeps every hero contact inside the target region with separated torsos at %i',height=>{
  const width=422.4,p=arenaPlacement(width,height,hero,boss,recordingBattleLayout);
  for(const clip of battleAnimationLibrary.filter(c=>c.characterId==='piano_blade_warrior'&&c.contact)){
    const c=clip.contact!,s=solveWeaponContact(p.player,p.boss,width,height,c,recordingBattleLayout);
    expect(s.error,clip.id).toBeLessThan(.01);expect(s.withinTolerance).toBe(true);
    expect(s.target.x).toBeGreaterThanOrEqual(c.targetRegion!.x-1e-8);expect(s.target.x).toBeLessThanOrEqual(c.targetRegion!.x+c.targetRegion!.width+1e-8);
    expect(s.target.y).toBeGreaterThanOrEqual(c.targetRegion!.y-1e-8);expect(s.target.y).toBeLessThanOrEqual(c.targetRegion!.y+c.targetRegion!.height+1e-8);
    const a=visualBody({...p.player,x:p.player.x+s.offset.x,y:p.player.y+s.offset.y},c.bodyBounds!),b=visualBody(p.boss,c.defenderBodyBounds!);
    expect(bodySeparation(a,b),clip.id).toBeGreaterThanOrEqual(-.001);
  }
});
it('mirrors normalized anchors and body bounds consistently and enforces the lunge limit',()=>{
  expect(normalizedPoint({x:.8,y:.4},true).x).toBeCloseTo(.2);expect(normalizedPoint({x:.8,y:.4},true).y).toBe(.4);
  expect(visualBody({x:10,y:20,width:100,height:200},{x:.2,y:.3,width:.3,height:.4},true)).toEqual({x:60,y:80,width:30,height:80});
  const c={...animationById('hero_azure_blade_rush')!.contact!,maximumLungeDistance:.05};
  const p=arenaPlacement(422,784,hero,boss,recordingBattleLayout),s=solveWeaponContact(p.player,p.boss,422,784,c,recordingBattleLayout);
  expect(Math.hypot(s.offset.x,s.offset.y)).toBeLessThanOrEqual(784*.05+.001);expect(s.withinTolerance).toBe(false);
});
it('registers all Azure frames in one containing window and uses different targets/recoil directions',()=>{
  const clips=['hero_azure_blade_rush','hero_azure_reverse','hero_azure_cross'].map(id=>animationById(id)!);
  expect(new Set(clips.map(c=>c.contact!.targetRegion!.name)).size).toBe(3);
  expect(new Set(clips.map(c=>JSON.stringify(c.contact!.recoilDirection))).size).toBe(3);
  const windows=clips.map(c=>c.asset.type==='spriteSheet'?c.asset.registrationBounds:undefined);
  expect(windows[0]).toEqual(windows[1]);expect(windows[1]).toEqual(windows[2]);
  clips.forEach((clip,i)=>{const alpha=visibleArtBounds(clip.asset)!,window=windows[i]!;
    expect(window.x).toBeLessThanOrEqual(alpha.x);expect(window.y).toBeLessThanOrEqual(alpha.y);
    expect(window.x+window.width).toBeGreaterThanOrEqual(alpha.x+alpha.width);
    expect(window.y+window.height).toBeGreaterThanOrEqual(alpha.y+alpha.height);
  });
});
it.each([518,784])('recovers a returning opponent enough for safe counter contact at %i',height=>{
  const width=422.4,p=arenaPlacement(width,height,hero,boss,recordingBattleLayout);
  for(const clip of battleAnimationLibrary.filter(c=>c.characterId==='piano_blade_warrior'&&c.contact)){
    for(const current of [{x:-100,y:-260},{x:50,y:30},{x:-40,y:-100}]){
      const c=clip.contact!,guard=guardContactOffset(p.player,p.boss,current,width,height,c,recordingBattleLayout);
      const s=solveWeaponContact(p.player,{...p.boss,x:p.boss.x+guard.x,y:p.boss.y+guard.y},width,height,c,recordingBattleLayout);
      expect(s.error,clip.id).toBeLessThan(1);expect(s.separation,clip.id).toBeGreaterThanOrEqual(0);
      // V7 may step toward the authored central brace instead of only retreating.
      const brace=Math.hypot((c.defenderStep?.x??0)*width,(c.defenderStep?.y??0)*height);
      expect(Math.hypot(guard.x,guard.y)).toBeLessThanOrEqual(Math.max(Math.hypot(current.x,current.y),brace)+.001);
    }
  }
});
