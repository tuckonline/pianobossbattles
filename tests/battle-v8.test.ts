import {it,expect} from 'vitest';
import {battleAnimationLibrary,animationById} from '../hosted/battle-animation-library';
import {pianoBladeRegistration,heroGroundShift,heroInkBounds,heroSourcePoint,spriteCrop} from '../hosted/battle-sprite-registration';
import {arenaPlacement,idleAspect,recordingBattleLayout,guardContactOffset,solveWeaponContact,visibleArtBounds} from '../hosted/battle-layout';

it('registers all hero poses to the unchanged guard, independently of weapon alpha',()=>{
  const r=pianoBladeRegistration.reference,c=pianoBladeRegistration.canvas;
  expect(r).toEqual({x:9,y:4,width:211,height:188});
  for(const clip of battleAnimationLibrary.filter(c=>c.characterId==='piano_blade_warrior')){
    expect(clip.asset.type).toBe('spriteSheet');if(clip.asset.type!=='spriteSheet')continue;
    if(clip.tags.includes('expanded')||clip.asset.path.includes('/continuity/')){
      // The new atlas uses its own pixel origin but the exact same anatomical
      // window dimensions. Raised swords get canvas space without body scaling.
      const registered=clip.asset.registrationBounds!,canvas=clip.asset.canvasBounds!,ink=visibleArtBounds(clip.asset)!;
      expect(registered.width).toBe(r.width);expect(registered.height).toBe(r.height);
      expect(ink.x).toBeGreaterThanOrEqual(canvas.x);expect(ink.y).toBeGreaterThanOrEqual(canvas.y);
      expect(ink.x+ink.width).toBeLessThanOrEqual(canvas.x+canvas.width);expect(ink.y+ink.height).toBeLessThanOrEqual(canvas.y+canvas.height);
      continue;
    }
    expect(clip.asset.bodyRegistration).toBe('piano-blade');
    const ink=heroInkBounds(clip.asset.path,clip.asset.frames);
    expect(ink.x*r.width+r.x).toBeGreaterThanOrEqual(c.x);
    expect(ink.y*r.height+r.y).toBeGreaterThanOrEqual(c.y);
    expect((ink.x+ink.width)*r.width+r.x).toBeLessThanOrEqual(c.x+c.width);
    expect((ink.y+ink.height)*r.height+r.y).toBeLessThanOrEqual(c.y+c.height);
  }
  for(const clip of battleAnimationLibrary.filter(c=>c.characterId==='crimson_musical_colossus'))if(clip.asset.type==='spriteSheet')expect(clip.asset.bodyRegistration).toBeUndefined();
});
it('keeps crouched height natural while registering the feet, not the sword glow',()=>{
  const a='/battle/piano-blade-a.png',b='/battle/piano-blade-b.png';
  expect(heroGroundShift(a,0)).toBe(0);
  expect(heroGroundShift(a,8)+178).toBe(192);
  expect(heroGroundShift(a,5)+187).toBe(192);
  expect(heroGroundShift(b,5)+198).toBe(192);
  expect(heroGroundShift(b,9)+193).toBe(192);
  expect(heroGroundShift(b,0)+193).toBe(192);
  // Dash is crouched, so its head is lower; it is never stretched to idle height.
  expect(heroInkBounds(b,[21]).height).toBeLessThan(heroInkBounds(a,[0]).height);
});
it('maps old bottom-aligned authored contacts to the same source pixels, with translation only',()=>{
  // The refined atlas copies A5 into the same anatomical coordinates.
  // Check its unchanged contact against the original authored source crop.
  const asset={type:'spriteSheet' as const,path:'/battle/piano-blade-a.png',columns:4,rows:8,frames:[4,5,6,7]};
  const crop=spriteCrop(asset)!,r=pianoBladeRegistration.reference;
  const tip=heroSourcePoint({x:.86,y:.56},crop,asset.path,5);
  expect(animationById('hero_attack_light_slash_01')!.contact!.weaponAnchor).toEqual(tip);
  const start=heroSourcePoint({x:0,y:0},crop,asset.path,5),end=heroSourcePoint({x:1,y:0},crop,asset.path,5);
  expect((end.x-start.x)*r.width).toBeCloseTo(crop.width);
  expect(tip.x).toBeGreaterThan(1); // weapon overscan is intentional, not body scaling
});
it.each([518,784])('keeps registered body size, contact and torso separation at arena height %i',height=>{
  const width=422.4,p=arenaPlacement(width,height,idleAspect('piano_blade_warrior'),idleAspect('crimson_musical_colossus'),recordingBattleLayout);
  for(const clip of battleAnimationLibrary.filter(c=>c.characterId==='piano_blade_warrior'&&c.contact)){
    const c=clip.contact!,step=guardContactOffset(p.player,p.boss,{x:0,y:0},width,height,c,recordingBattleLayout);
    const s=solveWeaponContact(p.player,{...p.boss,x:p.boss.x+step.x,y:p.boss.y+step.y},width,height,c,recordingBattleLayout);
    expect(s.error,clip.id).toBeLessThan(.001);expect(s.separation,clip.id).toBeGreaterThanOrEqual(0);
  }
  expect(recordingBattleLayout.panelWidthPercent).toBe(22);
});
