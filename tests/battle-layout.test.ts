import {it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import bounds from "../hosted/battle-art-bounds.json";
import {arenaPlacement,attackOffset,battleLayout,recordingBattleLayout,boundOffset,idleAspect,overlaps,recoilOffset,visibleArtBounds,solveWeaponContact,guardContactOffset,visualBody} from "../hosted/battle-layout";
import {battleAnimationLibrary,characterIdle} from "../hosted/battle-animation-library";

it('alpha metadata matches every unmodified source atlas and every registered sprite clip',()=>{
  for(const [path,data] of Object.entries(bounds)){
    expect(createHash('sha256').update(readFileSync(`hosted/public${path}`)).digest('hex')).toBe(data.sha256);
    expect(data.frames).toHaveLength(path.includes('/continuity/')?data.imageWidth/data.frameWidth*data.imageHeight/data.frameHeight:path.includes("/grinwick/")||path.includes('/expanded/')?16:32);
    data.frames.forEach(([x,y,w,h],index)=>{
      const columns=data.imageWidth/data.frameWidth;
      const sx=index%columns*data.frameWidth+x,sy=Math.floor(index/columns)*data.frameHeight+y;
      expect(sx).toBeGreaterThanOrEqual(0);expect(sy).toBeGreaterThanOrEqual(0);
      expect(sx+w).toBeLessThanOrEqual(data.imageWidth);expect(sy+h).toBeLessThanOrEqual(data.imageHeight);
      const mask=data.masks[index];expect(mask.length).toBeGreaterThan(0);expect(mask.length%3).toBe(0);
      for(let i=0;i<mask.length;i+=3){expect(mask[i]).toBeLessThan(h);expect(mask[i+1]+mask[i+2]).toBeLessThanOrEqual(w);}
    });
  }
  for(const clip of battleAnimationLibrary)expect(visibleArtBounds(clip.asset)?.height).toBeGreaterThan(0);
  for(const id of ['piano_blade_warrior','crimson_musical_colossus'] as const){
    const rect=visibleArtBounds(characterIdle(id).asset)!;
    expect(rect.width).toBeLessThan(256);expect(rect.height).toBeLessThan(192);
  }
});
const hero=idleAspect('piano_blade_warrior'),boss=idleAspect('crimson_musical_colossus');
it.each([[315,638],[315,488],[209,608],[120,420],[420,1000]])('recording enlarges only the hero up to 12 percent, keeps idle separation and bounded strikes at %i×%i',(width,contentHeight)=>{
  const base=arenaPlacement(width,contentHeight*.76,hero,boss),height=contentHeight*.81;
  const next=arenaPlacement(width,height,hero,boss,recordingBattleLayout);
  if(width===315)expect(next.player.height/base.player.height).toBeCloseTo(1.12,5);
  expect(next.player.height/base.player.height).toBeGreaterThan(1.10);
  expect(next.player.height/base.player.height).toBeLessThanOrEqual(1.12001);
  expect(next.boss.height).toBeCloseTo(base.boss.height,5);
  expect(next.boss.height).toBeGreaterThan(next.player.height);
  expect(overlaps(next.player,next.boss,Math.min(width,height)*battleLayout.minimumIdleSeparation-.001)).toBe(false);
  for(const side of ['player','boss'] as const){
    const a=next[side],other=next[side==='player'?'boss':'player'];
    for(const c of battleAnimationLibrary.filter(c=>c.characterId===(side==='player'?'piano_blade_warrior':'crimson_musical_colossus')&&c.contact)){
      const brace=guardContactOffset(a,other,{x:0,y:0},width,height,c.contact!,recordingBattleLayout);
      const result=solveWeaponContact(a,{...other,x:other.x+brace.x,y:other.y+brace.y},width,height,c.contact!,recordingBattleLayout),d=result.offset;
      // Hero coordinates now describe the fixed idle registration. His wider
      // attack canvas may overscan; the visible body remains contained.
      const box=c.contact!.visualBounds&&c.contact!.bodyBounds?visualBody(a,c.contact!.bodyBounds!):a;
      expect(box.x+d.x).toBeGreaterThanOrEqual(-.001);expect(box.y+d.y).toBeGreaterThanOrEqual(-.001);
      expect(box.x+box.width+d.x).toBeLessThanOrEqual(width+.001);expect(box.y+box.height+d.y).toBeLessThanOrEqual(height+.001);
      expect(result.error).toBeLessThan(1);
      if(c.contact!.bodyBounds)expect(result.separation).toBeGreaterThanOrEqual(-.001);
    }
  }
});
for(const [width,height] of [[315,799],[315,518],[209,326],[156,266],[156,222],[420,1050]])it(`separates whole idle silhouettes and bounds strikes/recoil at ${width}×${height}`,()=>{
  const layout=arenaPlacement(width,height,hero,boss),gap=Math.min(width,height)*battleLayout.minimumIdleSeparation;
  expect(overlaps(layout.player,layout.boss,gap-.001)).toBe(false);
  expect(layout.boss.height/layout.player.height).toBeCloseTo(1.25);
  expect(layout.player.y).toBeLessThan(layout.boss.y);
  for(const side of ['player','boss'] as const){
    const a=layout[side],other=layout[side==='player'?'boss':'player'];
    const attack=attackOffset(a,other,width,height),recoil=recoilOffset(a,other,width,height);
    for(const offset of [{x:0,y:0},attack,recoil]){
      expect(a.x+offset.x).toBeGreaterThanOrEqual(-.001);expect(a.y+offset.y).toBeGreaterThanOrEqual(-.001);
      expect(a.x+a.width+offset.x).toBeLessThanOrEqual(width+.001);expect(a.y+a.height+offset.y).toBeLessThanOrEqual(height+.001);
    }
    expect(overlaps({...a,x:a.x+attack.x,y:a.y+attack.y},other)).toBe(true);
    const safe=attackOffset(a,other,width,height,{...battleLayout,allowCombatOverlap:false});
    expect(overlaps({...a,x:a.x+safe.x,y:a.y+safe.y},other)).toBe(false);
  }
});
it('configured idle zones may collide but their visible envelopes are separated without shrinking',()=>{
  const config={...battleLayout,heroAnchor:{x:.5,y:.5},bossAnchor:{x:.5,y:.5},heroIdleZone:{x:0,y:.1,width:1,height:.5},bossIdleZone:{x:0,y:.1,width:1,height:.5}};
  const positions=arenaPlacement(300,650,hero,boss,config);
  expect(overlaps(positions.player,positions.boss,10)).toBe(false);
  expect(boundOffset(positions.player,{x:10000,y:-10000},300,650)).toEqual({x:300-positions.player.x-positions.player.width,y:-positions.player.y});
});
it.each([518,784])('bounds strong recoil and recovers to the next attack contact at arena height %i',height=>{
  const width=315,layout=arenaPlacement(width,height,hero,boss,recordingBattleLayout);
  for(const side of ['player','boss'] as const){
    const attacker=layout[side],target=layout[side==='player'?'boss':'player'];
    const contacts=battleAnimationLibrary.filter(c=>c.characterId===(side==='player'?'piano_blade_warrior':'crimson_musical_colossus')&&c.contact).map(c=>c.contact!);
    for(const original of [{x:80,y:80},{x:-80,y:-80}]){
      const offset=boundOffset(target,original,width,height),moved={...target,x:target.x+offset.x,y:target.y+offset.y};
      expect(moved.x).toBeGreaterThanOrEqual(0);expect(moved.y).toBeGreaterThanOrEqual(0);
      expect(moved.x+moved.width).toBeLessThanOrEqual(width);expect(moved.y+moved.height).toBeLessThanOrEqual(height);
      for(const c of contacts){
        const guard=guardContactOffset(attacker,target,offset,width,height,c,recordingBattleLayout);
        const result=solveWeaponContact(attacker,{...target,x:target.x+guard.x,y:target.y+guard.y},width,height,c,recordingBattleLayout);
        expect(result.error).toBeLessThan(.001);
      }
    }
  }
});
