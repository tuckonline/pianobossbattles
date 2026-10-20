import {expect,it} from 'vitest';
import {createBattle,reduceBattle,configureBattle,battleView} from '../hosted/boss-battle';
import {defaultBossBattleConfig} from '../hosted/boss-config';
import {prepareTempoStage,battleMusicalBeats} from '../hosted/battle-modes';
import {battleViewSchema} from '../hosted/boss-schema';
import {storyChallenge,storyChallengeKey} from '../hosted/battle-story';
import {schmittLibrary} from '../hosted/schmitt-library';
import {practicePass} from '../hosted/sight-library';
import type {GameEvent} from '../hosted/game-core';
const config={...defaultBossBattleConfig,enabled:true,gameMode:'timeAttack' as const,progressiveTempo:true,allowanceMultiplier:1};
const note=(attemptId:string,n=1):GameEvent=>({id:`${attemptId}:${n}`,version:1,playerId:'p',sessionId:'s',attemptId,sequence:n,timestamp:1000+n,type:'note.evaluated',payload:{outcome:'correct',occurrence:`${n}`}});
it('stages use musical time at 60/80/110/140 BPM and cap at Expert, with proportional manual limits',()=>{
 expect([1,2,3,4,5,100].map(pass=>prepareTempoStage(config,28,pass)?.limitMs)).toEqual([28000,21000,16000,12000,12000,12000]);
 expect([1,2,3,4].map(pass=>prepareTempoStage({...config,explicitTimeLimitSeconds:28},null,pass)?.limitMs)).toEqual([28000,21000,16000,12000]);
 expect(prepareTempoStage(config,null)?.issue).toBeTruthy();
 expect(prepareTempoStage({...config,gameMode:'survival'},28)).toBeUndefined();
});
it('passes advance once without a new countdown or combat reset; stale boundaries and reconnect preserve stage',()=>{
 let s=createBattle(config,100,false,140,5,28);
 s=reduceBattle(s,{type:'start',attemptId:'a',now:0,at:1000,countdown:true});
 s=reduceBattle(s,{type:'fight',attemptId:'a',at:4000,now:0});
 s=reduceBattle(s,{type:'evaluate',attemptId:'a',events:[note('a')],now:0});
 const countdown=s.countdown;
 for(let i=1;i<=4;i++){
  const old=s.scoringAttemptId,evt={type:'next-loop' as const,attemptId:old,nextAttemptId:`pass${i+1}`,now:i*100,beats:28};
  s=reduceBattle(s,evt);
  expect(s).toMatchObject({attemptId:'a',bossHp:99,correctHits:1,playerHp:30,timer:{tempoStage:Math.min(i,3),elapsedMs:0,running:true}});
  expect(s.countdown).toEqual(countdown);expect(reduceBattle(s,evt)).toBe(s);
  expect(battleViewSchema.parse(battleView(s)).timer).toEqual(s.timer);
 }
 const frozen=configureBattle(s,{...config,progressiveTempo:false},100,true);
 expect(frozen.config.progressiveTempo).toBe(true);
 expect(reduceBattle(s,{type:'start',attemptId:'new',now:500}).timer?.tempoStage).toBe(0);
});
it('new passes remain timed while waiting for their first note; pause excludes time, an expired clock cannot be rescued',()=>{
 let s=reduceBattle(createBattle(config,10,false,56,2,28),{type:'start',attemptId:'a',now:0});
 s=reduceBattle(s,{type:'evaluate',attemptId:'a',events:[note('a')],now:0});
 const expired=reduceBattle(s,{type:'next-loop',attemptId:'a',nextAttemptId:'b',now:28000,beats:28});
 expect(expired).toMatchObject({status:'defeat',result:'timeout',timer:{tempoStage:0,running:false}});
 s=reduceBattle(s,{type:'next-loop',attemptId:'a',nextAttemptId:'b',now:1000,beats:28});
 s=reduceBattle(s,{type:'pause',attemptId:'b',now:2000});
 expect(s.timer).toMatchObject({elapsedMs:1000,running:false});
 s=reduceBattle(s,{type:'resume',attemptId:'b',now:100000});
 expect(reduceBattle(s,{type:'tick',attemptId:'b',now:120000})).toMatchObject({status:'defeat',result:'timeout',timer:{limitMs:21000}});
});
it('uses exact Schmitt pass duration, including the final cadence, and separates personal-best challenges',()=>{
 const ex=schmittLibrary[0],repeat=battleMusicalBeats(practicePass(ex,true))!,last=battleMusicalBeats(ex)!;
 expect(repeat).toBeLessThan(last);
 let s=reduceBattle(createBattle(config,100,false,repeat+last,2,repeat),{type:'start',attemptId:'a',now:0});
 expect(s.timer?.limitMs).toBe(Math.ceil(repeat)*1000);
 s=reduceBattle(s,{type:'next-loop',attemptId:'a',nextAttemptId:'b',now:0,beats:last});
 expect(s.timer?.limitMs).toBe(Math.ceil(last*60/80)*1000);
 const args=[{number:ex.number,loops:4}];
 const plain=storyChallenge({...config,progressiveTempo:false},'both',args),stepped=storyChallenge(config,'both',args);
 expect(storyChallengeKey(stepped)).not.toBe(storyChallengeKey(plain));
 expect(storyChallengeKey({...plain,progressiveTempo:undefined})).toBe(storyChallengeKey(plain));
});
