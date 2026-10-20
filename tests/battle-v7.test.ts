import {it,expect} from 'vitest';
import {animationById,battleAnimationLibrary} from '../hosted/battle-animation-library';
import {arenaPlacement,recordingBattleLayout,idleAspect,guardContactOffset,solveWeaponContact,visualBody} from '../hosted/battle-layout';
import {combatMotion,reactionMotion} from '../hosted/battle-motion-profile';
import {BattleAnimationDirector} from '../hosted/battle-animation-director';
import {createBattle,reduceBattle} from '../hosted/boss-battle';
import {defaultBossBattleConfig} from '../hosted/boss-config';
import type {GameEvent} from '../hosted/game-core';

it.each([518,784])('uses a central brace with lateral torso clearance, without changing scale at height %i',height=>{
  const width=422.4,p=arenaPlacement(width,height,idleAspect('piano_blade_warrior'),idleAspect('crimson_musical_colossus'),recordingBattleLayout);
  for(const clip of battleAnimationLibrary.filter(c=>c.characterId==='piano_blade_warrior'&&c.contact)){
    const c=clip.contact!,step=guardContactOffset(p.player,p.boss,{x:0,y:0},width,height,c,recordingBattleLayout);
    expect(step.y,clip.id).toBeLessThan(0);expect(Math.abs(step.y)).toBeLessThan(height*.09);
    const target={...p.boss,x:p.boss.x+step.x,y:p.boss.y+step.y},s=solveWeaponContact(p.player,target,width,height,c,recordingBattleLayout);
    const body=visualBody({...p.player,x:p.player.x+s.offset.x,y:p.player.y+s.offset.y},c.bodyBounds!),defender=visualBody(target,c.defenderBodyBounds!);
    expect(s.error,clip.id).toBeLessThan(1);
    expect(body.x+body.width,clip.id).toBeLessThanOrEqual(defender.x+.01);
    expect(target.y).toBeGreaterThanOrEqual(0);expect(target.y+target.height).toBeLessThanOrEqual(height);
    expect(target.width).toBe(p.boss.width);expect(target.height).toBe(p.boss.height);
  }
  expect(recordingBattleLayout.panelWidthPercent).toBe(22);
});

it('keeps light/medium/heavy presentation stops bounded, with slower boss recovery',()=>{
  expect(combatMotion.hitStop.light).toBeLessThanOrEqual(15);
  expect(combatMotion.hitStop.medium).toBeGreaterThanOrEqual(25);expect(combatMotion.hitStop.medium).toBeLessThanOrEqual(40);
  expect(combatMotion.hitStop.signature).toBeGreaterThanOrEqual(50);expect(combatMotion.hitStop.signature).toBeLessThanOrEqual(80);
  expect(combatMotion.hitStop.bossHeavy).toBeLessThanOrEqual(90);
  for(const weight of ['light','medium','heavy'] as const){
    const boss=reactionMotion('boss',weight),hero=reactionMotion('player',weight);
    expect(boss.reactionPeakMs).toBeGreaterThan(hero.reactionPeakMs);expect(boss.recoveryMs).toBeGreaterThan(hero.recoveryMs);
  }
  expect(reactionMotion('boss','light',20).force).toBeLessThan(reactionMotion('boss','heavy').force);
});

it.each([518,784])('boss claws reach the hero without hiding the hero torso at %i',height=>{
  const width=422.4,p=arenaPlacement(width,height,idleAspect('piano_blade_warrior'),idleAspect('crimson_musical_colossus'),recordingBattleLayout);
  for(const clip of battleAnimationLibrary.filter(c=>c.characterId==='crimson_musical_colossus'&&c.contact)){
    const c=clip.contact!,step=guardContactOffset(p.boss,p.player,{x:0,y:0},width,height,c,recordingBattleLayout);
    const target={...p.player,x:p.player.x+step.x,y:p.player.y+step.y},s=solveWeaponContact(p.boss,target,width,height,c,recordingBattleLayout);
    expect(s.error,clip.id).toBeLessThan(1);expect(s.separation,clip.id).toBeGreaterThanOrEqual(0);
  }
  const slam=animationById('boss_crimson_crushing_strike')!;
  if(slam.asset.type==='spriteSheet')expect(slam.asset.frames[slam.contact!.impactFrame]).toBe(14);
  expect(slam.contact!.impactTimeMs).toBe(250);
});

it('escalates signature reactions while an intervening mistake retains its ordered damage',()=>{
  let s=reduceBattle(createBattle({...defaultBossBattleConfig,enabled:true},1000),{type:'start',attemptId:'v7'});
  const director=new BattleAnimationDirector(s,30,0,()=>0);
  const event=(n:number,at:number,incorrect=false):GameEvent=>({id:`v7-${n}`,version:1,sequence:n,timestamp:at,type:'note.evaluated',attemptId:'v7',playerId:'p',sessionId:'s',payload:{outcome:incorrect?'incorrect':'correct',occurrence:`n${n}`,pitch:60+n,groupId:incorrect?'error':'chord',groupSize:incorrect?1:3,groupComplete:incorrect||n===3}});
  s=reduceBattle(s,{type:'evaluate',attemptId:'v7',events:[1,2,3].map(n=>event(n,1000))});director.receive(s,33,1000);
  const weights:string[]=[],sides:string[]=[],damage:number[]=[];let last=0;
  for(let at=1000;at<2500;at++){
    if(at===1250){s=reduceBattle(s,{type:'evaluate',attemptId:'v7',events:[event(4,at,true)]});director.receive(s,0,at);expect(s.playerHp).toBe(26);}
    const p=director.tick(at);if(p.impact&&p.impact.id!==last){last=p.impact.id;sides.push(p.impact.side);damage.push(p.impact.damage);if(p.impact.side==='player')weights.push(p.boss.reactionWeight!);}
  }
  expect(weights).toEqual(['light','medium','heavy']);expect(sides).toEqual(['player','player','player','boss']);expect(damage).toEqual([1,1,1,4]);
  expect(director.presentation.displayHp).toEqual({player:26,boss:997});expect(director.diagnostics(2500).pending).toBe(0);
  expect(new Set(['hero_azure_blade_rush','hero_azure_reverse','hero_azure_cross'].map(id=>animationById(id)!.choreography!.reactionId)).size).toBe(3);
});
