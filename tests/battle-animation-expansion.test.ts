import {describe,it,expect} from 'vitest';
import {BattleAnimationDirector} from '../hosted/battle-animation-director';
import {animationById,battleAnimationLibrary} from '../hosted/battle-animation-library';
import {battleView,createBattle,type BattleView} from '../hosted/boss-battle';
import {defaultBossBattleConfig} from '../hosted/boss-config';
import {spriteProgress} from '../hosted/battle-timeline';
import atlas from '../hosted/battle-art-bounds.json';
const initial=():BattleView=>({...battleView(createBattle({...defaultBossBattleConfig,enabled:true},1000)),attemptId:'variation-fixture',status:'active'});
const hit=(b:BattleView,at:number):BattleView=>{
 const revision=b.revision+1,bossHp=b.bossHp-1;
 return {...b,revision,bossHp,correctHits:b.correctHits+1,lastAt:at,lastAction:'player',
  combatCues:[...(b.combatCues??[]),{revision,at,side:'player' as const,outcome:'correct' as const,playerHp:b.playerHp,bossHp,damage:1}].slice(-32)};
};
describe('expanded illustrated animation library',()=>{
 it('packages 48 isolated genuine drawings with transparent margin around every frame',()=>{
  for(const name of ['hero','boss','grinwick']){
   const sheet=atlas[`/battle/expanded/${name}.png` as keyof typeof atlas];
   expect(sheet.frames).toHaveLength(16);
   for(const [x,y,w,h] of sheet.frames){expect(x).toBeGreaterThan(0);expect(y).toBeGreaterThan(0);expect(x+w).toBeLessThan(sheet.frameWidth);expect(y+h).toBeLessThan(sheet.frameHeight);}
  }
 });
 it('every new contact holds its authored impact drawing at the exact contact time',()=>{
  const attacks=battleAnimationLibrary.filter(c=>c.tags.includes('expanded')&&c.contact);
  expect(attacks.length).toBe(8);
  for(const clip of attacks){
   const count=clip.asset.type==='spriteSheet'?clip.asset.frames.length:0,contact=clip.contact!;
   expect(clip.poseTimesMs?.[contact.impactFrame]).toBe(contact.impactTimeMs);
   const clock={startedAt:1000,contactMs:contact.impactTimeMs,holdAt:1000+contact.impactTimeMs,holdMs:contact.hitStopMs};
   for(const elapsed of [0,contact.hitStopMs/2,contact.hitStopMs]){
    expect(Math.floor(spriteProgress(clip,clock,clock.holdAt+elapsed)*count)).toBe(contact.impactFrame);
   }
  }
 });
 it('rotates three regular attacks on repeated notes and a late viewer agrees on the next note',()=>{
  let b=initial();const a=new BattleAnimationDirector(b,0,0),ids:string[]=[];
  for(let i=0;i<9;i++){
   const now=1000+i*1000;b=hit(b,now);a.receive(b,i+1,now);ids.push(a.tick(now).player.clip.id);a.tick(now+800);
  }
  expect(ids).toEqual(Array.from({length:9},(_,i)=>['hero_attack_light_slash_01','hero_attack_dash_02','hero_attack_light_rising_01'][i%3]));
  const late=new BattleAnimationDirector(b,9,9900);late.tick(9950);
  b=hit(b,10000);a.receive(b,10,10000);late.receive(b,10,10000);
  expect(late.tick(10000).player.clip.id).toBe(a.tick(10000).player.clip.id);
 });
 it('idle activity does not perturb the next regular attack in either audience layout',()=>{
  const start=initial(),a=new BattleAnimationDirector(start,0,0),b=new BattleAnimationDirector(start,0,0);
  a.tick(4000);a.tick(8000);const next=hit(start,9000);
  a.receive(next,1,9000);b.receive(next,1,9000);
  expect(a.tick(9000).player.clip.id).toBe(b.tick(9000).player.clip.id);
 });
 it('reserves an occasional finisher while each note immediately lowers authoritative HP',()=>{
  let b=initial();const d=new BattleAnimationDirector(b,0,0),saved=structuredClone(b);
  for(let n=1;n<=12;n++){
   const now=n*1000;b=hit(b,now);expect(b.bossHp).toBe(saved.bossHp-n);d.receive(b,n,now);
   expect(d.tick(now).player.clip.category).toBe(n===12?'heavyAttack':'lightAttack');d.tick(now+800);
  }
  expect(d.presentation.displayHp?.boss).toBe(b.bossHp);
 });
 it('coalesced snapshots retain every damage point without one visual strike per note',()=>{
  let b=initial();const d=new BattleAnimationDirector(b,0,0);
  for(let n=0;n<30;n++)b=hit(b,1000);
  const saved=structuredClone(b);d.receive(b,30,1000);
  for(let t=1000;t<=2600;t+=10)d.tick(t);
  expect(b).toEqual(saved);expect(d.presentation.displayHp?.boss).toBe(970);
  expect(d.diagnostics(2600).evaluatedEvents).toBe(30);
  expect(d.diagnostics(2600).visualStrikes).toBeLessThan(30);
  const restored=new BattleAnimationDirector(b,30,2700);expect(restored.tick(2800).action).toBeUndefined();
 });
 it('keeps the new personalities and cinematics available for each character',()=>{
  for(const id of ['hero_expression_surprised','hero_victory_exhausted_04','boss_idle_laughter_03','boss_defeat_collapse_03','grinwick_idle_applause_03','grinwick_defeat_tumble_03'])
   expect(animationById(id)?.tags).toContain('expanded');
 });
});
