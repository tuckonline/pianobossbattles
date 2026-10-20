import {it,expect} from 'vitest';
import {BattleAnimationDirector} from '../hosted/battle-animation-director';
import {animationById,BattleAnimationSelector,battleAnimationLibrary} from '../hosted/battle-animation-library';
import {createBattle,reduceBattle,type BattleState} from '../hosted/boss-battle';
import {defaultBossBattleConfig} from '../hosted/boss-config';
import type {GameEvent} from '../hosted/game-core';
import {spriteProgress} from '../hosted/battle-timeline';
const start=()=>reduceBattle(createBattle({...defaultBossBattleConfig,enabled:true},1000),{type:'start',attemptId:'a'});
const hit=(s:BattleState,n:number,at:number,outcome:'correct'|'incorrect'='correct',chord=false)=>reduceBattle(s,{type:'evaluate',attemptId:'a',events:[{id:`e${n}`,version:1,sequence:n,timestamp:at,type:'note.evaluated',attemptId:'a',playerId:'p',sessionId:'s',payload:{outcome,occurrence:`n${n}`,pitch:60+n%12,groupId:chord?'chord':String(n),groupSize:chord?3:1,groupComplete:!chord||n===2}} satisfies GameEvent]});
it('Azure Blade Rush has three synchronized contacts backed by exactly three evaluated chord notes',()=>{
  let s=start();const d=new BattleAnimationDirector(s,30,0,()=>0);
  for(let i=0;i<3;i++)s=hit(s,i,1000,'correct',true);
  d.receive(s,33,1000);expect(d.tick(1000).player.clip.id).toBe('hero_azure_blade_rush');
  const damage:number[]=[],clips:string[]=[];let last=0;
  for(let t=1000;t<2100;t++){
    const p=d.tick(t);if(p.impact&&p.impact.id!==last){last=p.impact.id;damage.push(p.impact.damage);clips.push(p.player.clip.id);
      const clip=p.player.clip;expect(clip.asset.type).toBe('spriteSheet');if(clip.asset.type==='spriteSheet')expect(Math.floor(spriteProgress(clip,p.player,t)*clip.asset.frames.length)).toBe(clip.contact!.impactFrame);
      expect(p.boss.clip.category).toBe('hitReaction');}
  }
  expect(clips).toEqual(['hero_azure_blade_rush','hero_azure_reverse','hero_azure_cross']);expect(damage).toEqual([1,1,1]);expect(d.presentation.displayHp).toEqual({player:30,boss:997});expect(s.correctHits).toBe(3);expect(d.diagnostics(2100).damageEvents).toBe(3);
});
it('Crimson Crushing Strike uses a weightier contact and one existing mistake damage',()=>{
  let s=start();const d=new BattleAnimationDirector(s,0,0,()=>0);
  for(let i=0;i<4;i++){s=hit(s,i,1000+i*900,'incorrect');d.receive(s,0,1000+i*900);d.tick(1000+i*900);if(i<3)for(let t=1000+i*900;t<1900+i*900;t++)d.tick(t);}
  const p=d.presentation;expect(p.boss.clip.id).toBe('boss_crimson_crushing_strike');expect(p.boss.contactMs).toBe(250);
  const impact=d.tick(p.boss.holdAt!);expect(impact.player.clip.category).toBe('hitReaction');expect(impact.impact?.damage).toBe(4);expect(impact.displayHp?.player).toBe(14);expect(s.mistakes).toBe(4);
});
it('Azure escalates three distinct reactions and holds the actual crossed-blade drawing on the final contact',()=>{
  let s=start();const d=new BattleAnimationDirector(s,30,0,()=>0);
  for(let i=0;i<3;i++)s=hit(s,i,1000,'correct',true);d.receive(s,33,1000);
  const reactions:{id:string;start:number;force:number;hold:number;power:number}[]=[];let last=0;
  for(let t=1000;t<2200;t++){const p=d.tick(t);if(p.impact&&p.impact.id!==last){last=p.impact.id;
    reactions.push({id:p.boss.clip.id,start:p.boss.startProgress!,force:p.boss.recoilIntensity!,hold:p.boss.holdMs!,power:p.impact.power});
    if(p.impact.signaturePhase==='cross'){
      expect(p.player.clip.asset.type).toBe('spriteSheet');
      if(p.player.clip.asset.type==='spriteSheet')expect(p.player.clip.asset.frames[p.player.clip.contact!.impactFrame]).toBe(9);
      expect(p.player.holdMs).toBeGreaterThanOrEqual(50);expect(p.player.holdMs).toBeLessThanOrEqual(80);
    }
  }}
  expect(new Set(reactions.map(r=>`${r.id}:${r.start}`)).size).toBe(3);
  expect(reactions[2].force).toBeGreaterThan(reactions[1].force*2);
  expect(reactions[2].power).toBeGreaterThan(reactions[0].power);
  expect(d.presentation.phase).toBe('idle');expect(s.bossHp).toBe(997);
});
it.each([.8,1,1.3])('authored ready poses, contact, and hit-stop remain aligned at %sx speed',speed=>{
  for(const id of ['hero_azure_blade_rush','hero_azure_reverse','hero_azure_cross','boss_crimson_crushing_strike']){
    const clip=animationById(id)!,contact=clip.contact!,clock={startedAt:1000,durationMs:clip.durationMs/speed,contactMs:contact.impactTimeMs/speed,holdAt:1000+contact.impactTimeMs/speed,holdMs:contact.hitStopMs/speed};
    const count=clip.poseTimesMs!.length,frame=(at:number)=>Math.floor(spriteProgress(clip,clock,at)*count);
    expect(frame(1000)).toBe(0);expect(frame(1000+clip.poseTimesMs![1]/speed-1)).toBe(0);
    expect(frame(clock.holdAt)).toBe(contact.impactFrame);expect(frame(clock.holdAt+clock.holdMs-1)).toBe(contact.impactFrame);
    expect(spriteProgress(clip,clock,1000+clock.durationMs+clock.holdMs)).toBe(1);
  }
});
it('a lethal fourth mistake resolves the heavy slam once before defeat and cleans up on reset',()=>{
  let s={...start(),playerHp:16};const d=new BattleAnimationDirector(s,0,0,()=>0);
  for(let n=0;n<4;n++){s=hit(s,n,1000+n*1100,'incorrect');d.receive(s,0,1000+n*1100);d.tick(1000+n*1100);if(n<3)for(let t=1000+n*1100;t<2100+n*1100;t++)d.tick(t);}
  expect(s.status).toBe('defeat');expect(d.presentation.boss.clip.id).toBe('boss_crimson_crushing_strike');
  const at=d.presentation.boss.holdAt!;expect(d.tick(at-1).impact).toBeUndefined();
  expect(d.tick(at).impact?.damage).toBe(4);expect(d.presentation.displayHp?.player).toBe(0);
  d.tick(at+400);expect(d.presentation.player.clip.category).toBe('defeat');expect(d.presentation.boss.clip.category).toBe('victory');
  const reset=reduceBattle(s,{type:'start',attemptId:'next'});d.receive(reset,0,6000);
  expect(d.presentation.phase).toBe('idle');expect(d.presentation.impact).toBeUndefined();expect(d.presentation.finisher).toBeUndefined();
});
it('signature contacts preserve ordered damage when a rapid stream and counterattack arrive during the combo',()=>{
  let s=start();const d=new BattleAnimationDirector(s,30,0,()=>0);for(let n=0;n<3;n++)s=hit(s,n,1000,'correct',true);d.receive(s,33,1000);
  let n=3;for(let t=1000;t<6000;t+=5){if(t>1000&&t<=3000&&t%50===0){s=hit(s,n++,t,t===1250?'incorrect':'correct');d.receive(s,30+s.correctHits,t);}d.tick(t);}
  expect(d.diagnostics(6000).damageEvents).toBe(n);expect(d.diagnostics(6000).maxQueue).toBeLessThanOrEqual(6);
  expect(d.presentation.displayHp).toEqual({player:s.playerHp,boss:s.bossHp});expect(d.presentation.phase).toBe('idle');
});
it('signature metadata enforces cooldown and combo eligibility without hiding ordinary attacks',()=>{
  const selector=new BattleAnimationSelector(()=>0),signature='hero_azure_blade_rush',exclude=battleAnimationLibrary.filter(c=>c.id!==signature).map(c=>c.id);
  const ctx={eventType:'milestone' as const,combo:24,hpPercent:100,bossEnraged:false,battleState:'active'};
  expect(selector.choose('piano_blade_warrior','heavyAttack',ctx,0,exclude)).toBeUndefined();
  expect(selector.choose('piano_blade_warrior','heavyAttack',{...ctx,combo:25},0,exclude)?.id).toBe(signature);
  expect(selector.choose('piano_blade_warrior','heavyAttack',{...ctx,combo:25},5999,exclude)).toBeUndefined();
  expect(selector.choose('piano_blade_warrior','heavyAttack',{...ctx,combo:25},6000,exclude)?.id).toBe(signature);
  for(const id of ['hero_azure_blade_rush','hero_azure_reverse','hero_azure_cross','boss_crimson_crushing_strike']){const a=animationById(id)!.asset;if(a.type==='spriteSheet')expect(new Set(a.frames).size).toBe(a.frames.length);}
});
it('a fast two-hand passage can trigger Azure from adjacent approved groups without extra damage',()=>{
  let s=start();const d=new BattleAnimationDirector(s,0,0,()=>0);let n=0,last=0;const phases:string[]=[];
  for(let t=1000;t<6000;t+=5){
    if(t<3560&&(t-1000)%40===0){for(let i=0;i<2;i++)s=hit(s,n++,t);d.receive(s,n,t);}
    const p=d.tick(t);if(p.impact&&p.impact.id!==last){last=p.impact.id;if(p.impact.signaturePhase)phases.push(p.impact.signaturePhase);}
  }
  expect(phases).toContain('opening');expect(phases).toContain('cross');
  expect(phases.filter(p=>p==='opening')).toHaveLength(1);
  expect(d.diagnostics(6000).damageEvents).toBe(128);expect(d.diagnostics(6000).maxQueue).toBeLessThanOrEqual(6);
  expect(s.bossHp).toBe(872);expect(d.presentation.displayHp).toEqual({player:30,boss:872});
});
