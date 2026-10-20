import {it,expect} from 'vitest';
import {createBattle,reduceBattle,battleCountingIn,configureBattle} from '../hosted/boss-battle';
import {defaultBossBattleConfig} from '../hosted/boss-config';
const config={...defaultBossBattleConfig,enabled:true,gameMode:'timeAttack' as const};
for(const loops of [1,5,10,100])it(`countdown gates gameplay and releases exactly once across ${loops} loops`,()=>{
 let b=reduceBattle(createBattle(config,loops*20,false,loops*20,loops),{type:'start',attemptId:'run',countdown:true,at:1000});
 const pending=b;
 for(const type of ['tick','complete','fight'] as const)expect(reduceBattle(b,{type,attemptId:'run',at:3999,now:99999})).toBe(pending);
 expect(reduceBattle(b,{type:'evaluate',attemptId:'run',events:[]})).toBe(pending);
 expect(b.timer?.elapsedMs).toBe(0);expect(b.timer?.running).toBe(false);
 b=reduceBattle(b,{type:'fight',attemptId:'run',at:4000});expect(battleCountingIn(b)).toBe(false);expect(b.status).toBe('active');
 const released=b;expect(reduceBattle(b,{type:'fight',attemptId:'run',at:4001})).toBe(released);
 for(let i=2;i<=loops;i++){
  b=reduceBattle(b,{type:'next-loop',attemptId:b.scoringAttemptId,nextAttemptId:`loop-${i}`});
  expect(b.attemptId).toBe('run');expect(b.countdown).toEqual(released.countdown);expect(b.status).toBe('active');expect(b.loop?.number).toBe(i);
 }
});
it('pause freezes remaining countdown and settings preserve its identity',()=>{
 let b=reduceBattle(createBattle(config,20,false,20),{type:'start',attemptId:'run',countdown:true,at:1000});
 b=reduceBattle(b,{type:'pause',attemptId:'run',at:2000});
 expect(reduceBattle(b,{type:'fight',attemptId:'run',at:9000})).toBe(b);
 b=configureBattle(b,{...config,volume:.1},20,true);
 b=reduceBattle(b,{type:'resume',attemptId:'run',at:10000});
 expect(b.countdown).toEqual({startedAt:9000,fightAt:12000});
 expect(battleCountingIn(reduceBattle(b,{type:'fight',attemptId:'run',at:11999}))).toBe(true);
 expect(battleCountingIn(reduceBattle(b,{type:'fight',attemptId:'run',at:12000}))).toBe(false);
 expect(battleCountingIn(configureBattle(b,{...config,enabled:false},20,true))).toBe(false);
 expect(reduceBattle(b,{type:'abandon',attemptId:'run'})).toMatchObject({status:'idle',countdown:undefined});
});
