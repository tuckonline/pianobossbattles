import {it,expect} from 'vitest';
import {BattleAnimationDirector} from '../hosted/battle-animation-director';
import {battleAnimationLibrary} from '../hosted/battle-animation-library';
import {spriteProgress,comboTier,cinematicRules} from '../hosted/battle-timeline';
import {arenaPlacement,solveWeaponContact,idleAspect} from '../hosted/battle-layout';
import {createBattle,reduceBattle,battleView,type BattleState} from '../hosted/boss-battle';
import {defaultBossBattleConfig} from '../hosted/boss-config';
import type {GameEvent} from '../hosted/game-core';
const start=(notes=1000)=>reduceBattle(createBattle({...defaultBossBattleConfig,enabled:true},notes),{type:'start',attemptId:'a'});
function hit(s:BattleState,at:number,outcome:'correct'|'incorrect'|'missed'='correct',groupSize=1,group='g'){
  const n=s.revision+1,e:GameEvent={id:`e${n}`,version:1,playerId:'p',sessionId:'s',attemptId:'a',exerciseId:1,sequence:n,timestamp:at,type:'note.evaluated',payload:{outcome,occurrence:`n${n}`,pitch:60+n%12,groupId:groupSize>1?group:`g${n}`,groupSize,groupComplete:groupSize===1||n%groupSize===0}};
  return reduceBattle(s,{type:'evaluate',attemptId:'a',events:[e]});
}
it('all attack variants have an in-range distinct contact frame and character-specific timing',()=>{
  for(const c of battleAnimationLibrary.filter(c=>['lightAttack','heavyAttack','counter'].includes(c.category))){
    expect(c.contact).toBeDefined();expect(c.contact!.impactTimeMs).toBeLessThan(c.durationMs);
    if(c.asset.type==='spriteSheet'){expect(c.contact!.impactFrame).toBeGreaterThan(0);expect(c.contact!.impactFrame).toBeLessThan(c.asset.frames.length-1);}
  }
});
it.each(['correct','incorrect','missed'] as const)('%s applies damage immediately, then contacts with synchronized sprite, recoil and visible HP',outcome=>{
  let s=start();const d=new BattleAnimationDirector(battleView(s),0,0,()=>0);s=hit(s,1000,outcome);d.receive(battleView(s),1,1000);
  const side=outcome==='correct'?'player':'boss',target=side==='player'?'boss':'player',p=d.tick(1000),at=p[side].holdAt!;
  expect(s[target==='boss'?'bossHp':'playerHp']).toBe(target==='boss'?999:26);
  expect(p.displayHp![target]).toBe(target==='boss'?1000:30);expect(p[target].clip.category).toBe('idle');
  expect(d.tick(at-1).impact).toBeUndefined();const contact=d.tick(at);
  expect(contact[target].clip.category).toBe('hitReaction');expect(contact.displayHp![target]).toBe(target==='boss'?999:26);
  expect(contact.impact).toMatchObject({at,side,hits:1,damage:target==='boss'?1:4});
  const actor=contact[side],count=actor.clip.asset.type==='spriteSheet'?actor.clip.asset.frames.length:4;
  expect(Math.floor(spriteProgress(actor.clip,actor,at)*count)).toBe(actor.clip.contact!.impactFrame);
  expect(spriteProgress(actor.clip,actor,at+actor.holdMs!-1)).toBe(spriteProgress(actor.clip,actor,at));
  expect(d.tick(2000).phase).toBe('idle');expect(d.presentation.displayHp![target]).toBe(target==='boss'?999:26);
});
it('three quick notes keep three contacts, a stronger ending, and do not fabricate a chord',()=>{
  let s=start();const d=new BattleAnimationDirector(battleView(s),0,0);s=hit(s,1000);d.receive(s,1,1000);const p=d.tick(1000);
  for(const at of [1020,1040]){s=hit(s,at);d.receive(s,s.correctHits,at);d.tick(at);}
  expect(d.presentation.player.startedAt).toBe(p.player.startedAt);expect(d.presentation.strike?.chordSize).toBe(1);
  const contacts:number[]=[];let previous=0,final=false;
  for(let t=1040;t<2000;t+=2){const v=d.tick(t);final ||= !!v.combination?.final;if(v.impact&&v.impact.id!==previous){previous=v.impact.id;contacts.push(v.impact.damage);}}
  expect(contacts).toEqual([1,1,1]);expect(final).toBe(true);expect(d.presentation.displayHp?.boss).toBe(997);
  expect(d.diagnostics(2000).visualCombinations).toBe(1);
});
it('a completed written chord upgrades effects without restarting its contact clock',()=>{
  let s=start();const d=new BattleAnimationDirector(battleView(s),0,0);
  s=hit(s,1000,'correct',3);d.receive(s,1,1000);const p=d.tick(1000);
  s=hit(s,1020,'correct',3);d.receive(s,2,1020);s=hit(s,1040,'correct',3);d.receive(s,3,1040);
  expect(d.presentation.strike?.chordSize).toBe(3);expect(d.presentation.player.startedAt).toBe(p.player.startedAt);
  d.tick(p.player.holdAt!);expect(d.presentation.impact?.damage).toBe(3);
});
it('mixed evaluations preserve the order hero, boss, hero through the accepted event journal',()=>{
  let s=start();const d=new BattleAnimationDirector(battleView(s),0,0);s=hit(s,1000);s=hit(s,1001,'incorrect');s=hit(s,1002);d.receive(s,1,1010);
  const actions:string[]=[],impacts:number[]=[];let serial=0;
  for(let t=1010;t<2300;t+=5){const p=d.tick(t);if(p.impact&&p.impact.id!==serial){serial=p.impact.id;actions.push(p.impact.side);impacts.push(p.impact.damage);}}
  expect(actions).toEqual(['player','boss','player']);expect(impacts).toEqual([1,4,1]);expect(d.presentation.displayHp).toEqual({player:26,boss:998});
});
it('pause freezes the contact clock and restart discards all old visual events',()=>{
  let s=start();const d=new BattleAnimationDirector(battleView(s),0,0);s=hit(s,1000);d.receive(s,1,1000);const p=d.tick(1000);
  d.receive({...s,status:'paused'},1,1030);expect(d.nextWakeAt(2000)).toBeUndefined();expect(d.tick(2000).impact).toBeUndefined();
  d.receive(s,1,2030);expect(d.presentation.player.holdAt).toBe(p.player.holdAt!+1000);
  d.tick(p.player.holdAt!+1000);expect(d.presentation.displayHp?.boss).toBe(999);
  const reset=reduceBattle(s,{type:'start',attemptId:'b'});d.receive(reset,1,2200);expect(d.presentation.phase).toBe('idle');expect(d.diagnostics(2200).pending).toBe(0);
});
it.each([true,false])('terminal strike resolves before collapse; reload never replays it (%s)',win=>{
  let s=start(win?1:1000);const d=new BattleAnimationDirector(battleView(s),0,0);
  if(!win)s={...s,playerHp:4};s=hit(s,1000,win?'correct':'incorrect');d.receive(s,1,1000);
  expect(s.status).toBe(win?'victory':'defeat');expect(d.presentation.phase).toBe('windup');expect(d.presentation.finished).toBe(false);
  const side=win?'player':'boss',at=d.presentation[side].holdAt!;d.tick(at);expect(d.presentation.finisher?.tone).toBe(win?'blue':'red');
  d.tick(at+300);expect(d.presentation.finished).toBe(true);expect(d.presentation[side].clip.category).toBe('victory');
  d.tick(6000);expect(d.presentation.phase).toBe('settled');expect(d.presentation.finisher).toBeUndefined();
  const restored=new BattleAnimationDirector(s,1,7000);expect(restored.presentation[side].staticLast).toBe(true);expect(restored.presentation.finisher).toBeUndefined();
});
it.each([50,100,200])('long %sms note streams have bounded visuals and exact final HP',interval=>{
  let s=start();const d=new BattleAnimationDirector(s,0,0);let next=1000,maxPending=0;
  for(let t=1000;t<=1000+interval*160+1000;t+=5){
    if(t===next&&s.correctHits<160){s=hit(s,t);d.receive(s,s.correctHits,t);next+=interval;}
    d.tick(t);maxPending=Math.max(maxPending,d.diagnostics(t).pending);
  }
  expect(s.correctHits).toBe(160);expect(d.presentation.displayHp?.boss).toBe(840);expect(d.presentation.phase).toBe('idle');expect(maxPending).toBeLessThanOrEqual(cinematicRules.maxPendingBatches);
});
it('combo progression has six visual tiers without changing damage',()=>{expect([0,9,10,24,25,49,50,99,100,199,200].map(comboTier)).toEqual([0,0,1,1,2,2,3,3,4,4,5]);});
it('configured contact anchors can actually meet inside every supported arena size',()=>{
  for(const [w,h] of [[316.8,820.8],[316.8,532],[211.2,334.4],[158.4,273.6]]){
    const p=arenaPlacement(w,h,idleAspect('piano_blade_warrior'),idleAspect('crimson_musical_colossus'));
    for(const side of ['player','boss'] as const){const a=p[side],t=p[side==='player'?'boss':'player'],m=battleAnimationLibrary.find(c=>c.id===(side==='player'?'hero_attack_light_slash_01':'boss_attack_light_slash_01'))!.contact!,o=solveWeaponContact(a,t,w,h,m);
      expect(o.error).toBeLessThan(1);
    }
  }
});
it('a reconnect during the finishing strike restores the ending without replaying flames',()=>{
  let s=start(1);const d=new BattleAnimationDirector(s,0,0);s=hit(s,1000);d.receive(s,1,1000);d.tick(1150);expect(d.presentation.finisher).toBeDefined();
  d.receive(s,1,1200,true);expect(d.presentation.finisher).toBeUndefined();d.receive(s,1,2200);expect(d.tick(2200).phase).toBe('settled');expect(d.presentation.player.staticLast).toBe(true);
});
it('journal overflow and out-of-order snapshots restore exact HP without inventing ordering',()=>{
  let s=start();const d=new BattleAnimationDirector(s,0,0);for(let i=0;i<90;i++)s=hit(s,1000);
  d.receive(s,90,1000);for(let t=1000;t<=2200;t+=5)d.tick(t);expect(d.presentation.displayHp?.boss).toBe(910);expect(d.diagnostics(2200).skippedVisualHits).toBe(58);
  d.receive({...s,revision:1,bossHp:999},1,1900);expect(d.presentation.displayHp?.boss).toBe(910);
});
it.each([8,16,256])('%i-note bursts coalesce bounded cosmetics while conserving every accepted damage event',count=>{
  let s=start();const d=new BattleAnimationDirector(s,0,0);let n=0;
  for(let t=1000;t<=1000+count*20+1200;t+=2){if(n<count&&t===1000+n*20){s=hit(s,t);d.receive(s,++n,t);}d.tick(t);}
  const m=d.diagnostics(1000+count*20+1200);
  expect(m.damageEvents).toBe(count);expect(m.evaluatedEvents).toBe(count);expect(m.maxQueue).toBeLessThanOrEqual(6);
  expect(m.maxLatencyMs).toBeLessThan(650);expect(m.coalescedEffects).toBeGreaterThan(0);expect(m.visualStrikes).toBeGreaterThan(2);
  expect(d.presentation.displayHp?.boss).toBe(1000-count);expect(d.presentation.phase).toBe('idle');
});
it('holds an unfinished recoil for the next contact and preserves the reaction pose within a chain',()=>{
  let s=start();const d=new BattleAnimationDirector(s,0,0,()=>0);
  for(const t of [1000,1020]){s=hit(s,t);d.receive(s,s.correctHits,t);d.tick(t);}
  const first=d.tick(1064);expect(first.boss.startProgress).toBe(.25);
  const follow=d.tick(1121);expect(follow.boss.freezeUntil).toBeGreaterThan(1121);expect(follow.boss.clip.id).toBe(first.boss.clip.id);
  const next=d.tick(follow.player.holdAt!);expect(next.boss.clip.id).toBe(first.boss.clip.id);expect(next.boss.startProgress).toBeGreaterThan(.25);
});
it('a late browser frame delivers sprite, impact and recoil together without changing damage',()=>{
  let s=start();const d=new BattleAnimationDirector(s,0,0,()=>0);s=hit(s,1000);d.receive(s,1,1000);const p=d.tick(1000);
  const delivered=p.player.holdAt!+30,v=d.tick(delivered);
  expect(v.impact?.at).toBe(delivered);expect(v.boss.startedAt).toBe(delivered);expect(v.player.contactDeliveredAt).toBe(delivered);
  expect(v.player.holdAt).toBe(delivered);expect(v.displayHp?.boss).toBe(999);expect(s.correctHits).toBe(1);
});
