import {expect,it} from 'vitest';
import {animationById} from '../hosted/battle-animation-library';
import {spriteProgress} from '../hosted/battle-timeline';
import {BattleAnimationDirector} from '../hosted/battle-animation-director';
import {battleView,createBattle,reduceBattle} from '../hosted/boss-battle';
import {defaultBossBattleConfig} from '../hosted/boss-config';
import type {GameEvent} from '../hosted/game-core';

it('the refined cut preserves its64ms contact and holds the same drawing through hit-stop',()=>{
 const clip=animationById('hero_attack_light_slash_01')!,c=clip.contact!;
 expect(c).toMatchObject({impactTimeMs:64,impactFrame:2,hitStopMs:12,recoveryMs:110});
 expect(clip.poseTimesMs).toEqual([0,28,64,98,130,170,210]);expect(clip.durationMs).toBe(260);
 expect(clip.posePhases?.[c.impactFrame]).toBe('contact');
 const clock={startedAt:1000,contactMs:64,durationMs:260,holdAt:1064,holdMs:12};
 for(const now of [1064,1070,1076])expect(Math.floor(spriteProgress(clip,clock,now)*7)).toBe(2);
 expect(spriteProgress(clip,clock,1272)).toBe(1);
});

for(const [label,count,interval] of [['single',1,1000],['moderate',9,260],['fast',36,40]] as const)
 it(`${label} input judges every note immediately, bounds visual work and never repeats a contact`,()=>{
  let state=reduceBattle(createBattle({...defaultBossBattleConfig,enabled:true},1000),{type:'start',attemptId:'continuity',now:0});
  const director=new BattleAnimationDirector(battleView(state),0,0),contacts=new Set<number>();let prior=0;
  const sample=(now:number)=>{const p=director.tick(now);if(p.impact&&p.impact.id!==prior){expect(contacts.has(p.impact.id)).toBe(false);contacts.add(p.impact.id);prior=p.impact.id;}};
  for(let n=0;n<count;n++){
   const now=1000+n*interval,event:GameEvent={id:`continuity:${n}`,attemptId:'continuity',playerId:'p',sessionId:'s',version:1,sequence:n,timestamp:now,type:'note.evaluated',payload:{outcome:'correct',occurrence:String(n)}};
   state=reduceBattle(state,{type:'evaluate',attemptId:'continuity',events:[event],now});
   expect(state.bossHp).toBe(999-n);expect(state.correctHits).toBe(n+1);
   director.receive(battleView(state),n+1,now);
   for(let t=now;t<now+interval;t+=2)sample(t);
  }
  const end=1000+count*interval+2000;for(let t=1000+count*interval;t<=end;t+=2)sample(t);
  const metrics=director.diagnostics(end);
  expect(metrics.evaluatedEvents).toBe(count);expect(metrics.damageEvents).toBe(count);
  expect(metrics.maxQueue).toBeLessThanOrEqual(6);expect(director.presentation.displayHp?.boss).toBe(1000-count);
  expect(director.presentation.action).toBeUndefined();expect(contacts.size).toBeGreaterThan(0);
 });
