import {it,expect} from 'vitest';
import {battleMusicalBeats} from '../hosted/battle-modes';
import {createBattle,reduceBattle,configureBattle,battleRunNotes} from '../hosted/boss-battle';
import {defaultBossBattleConfig} from '../hosted/boss-config';
import {evaluateGame} from '../hosted/game-core';
import {practicePass,type Exercise} from '../hosted/sight-library';
import {schmittLibrary} from '../hosted/schmitt-library';
const config={...defaultBossBattleConfig,enabled:true};
const ex:Exercise={number:1,right:[[{pitch:60,beats:1.25,tie:false},{pitch:62,beats:1,tie:false}]],left:[]};
for(const mode of ['timeAttack','ultimateBoss'] as const)for(const bpm of [60,83,140])it(`${mode} at ${bpm} BPM scales 1–5 loops once, rounding only the final duration`,()=>{
 for(let loops=1;loops<=5;loops++){
  const c={...config,gameMode:mode,selectedBpm:bpm,allowanceMultiplier:1.3};
  const b=createBattle(c,battleRunNotes(ex,'both',loops),false,battleMusicalBeats(ex,loops),loops);
  expect(b.timer?.limitMs).toBe(Math.ceil(2.25*60/bpm*1.3*loops)*1000);
  expect(b.bossMaxHp).toBe(2*loops);expect(b.loopCount).toBe(loops);
  const manual=createBattle({...c,explicitTimeLimitSeconds:31},b.expectedNotes,false,b.musicalBeats,loops);
  expect(manual.timer?.limitMs).toBe(31000*loops);
 }
});
it('Schmitt repeats follow the actual omitted-cadence passes for both time and HP',()=>{
 const s=schmittLibrary[0],repeat=practicePass(s,true);
 for(let loops=1;loops<=5;loops++){
  const beats=battleMusicalBeats(s)!+(loops-1)*battleMusicalBeats(repeat)!;
  const b=createBattle({...config,gameMode:'timeAttack'},battleRunNotes(s,'both',loops),false,battleMusicalBeats(s,loops),loops);
  expect(b.musicalBeats).toBe(beats);expect(b.timer?.limitMs).toBe(Math.ceil(beats*1.5)*1000);
 }
});
for(const mode of ['timeAttack','ultimateBoss'] as const)it(`${mode}: one clock crosses loops, settings freeze, explicit pause only`,()=>{
 let b=reduceBattle(createBattle({...config,gameMode:mode,explicitTimeLimitSeconds:10},6,false,6.75,3),{type:'start',attemptId:'first',now:0});
 const events=evaluateGame(ex,'both',[60,62],{playerId:'p',sessionId:'s',attemptId:'first',timestamp:1}).events;
 b=reduceBattle(b,{type:'evaluate',attemptId:'first',events,now:1000});
 b=reduceBattle(b,{type:'tick',attemptId:'first',now:2000});expect(b.timer?.elapsedMs).toBe(1000);
 b=configureBattle(b,{...b.config,selectedBpm:140,allowanceMultiplier:3,explicitTimeLimitSeconds:1},6,true);
 expect(b.timer?.limitMs).toBe(30000);expect(b.loopCount).toBe(3);expect(b.config.selectedBpm).toBe(60);
 b=reduceBattle(b,{type:'next-loop',attemptId:'first',nextAttemptId:'second',now:4000});
 expect(b).toMatchObject({attemptId:'first',scoringAttemptId:'second',status:'active',bossHp:4,timer:{running:true,elapsedMs:3000,limitMs:30000}});
 b=reduceBattle(b,{type:'pause',attemptId:'second',now:5000});
 b=reduceBattle(b,{type:'tick',attemptId:'second',now:50000});expect(b.timer?.elapsedMs).toBe(4000);
 b=reduceBattle(b,{type:'resume',attemptId:'second',now:50000});
 b=reduceBattle(b,{type:'tick',attemptId:'second',now:75999});expect(b.status).toBe('active');
 b=reduceBattle(b,{type:'tick',attemptId:'second',now:76000});expect(b).toMatchObject({status:'defeat',result:'timeout',timer:{running:false,elapsedMs:30000}});
});
it('loop boundaries do not resume an explicit pause or defeat',()=>{
 let b=reduceBattle(createBattle({...config,gameMode:'timeAttack'},6,false,6.75,3),{type:'start',attemptId:'one',now:0});
 b=reduceBattle(b,{type:'pause',attemptId:'one',now:0});
 b=reduceBattle(b,{type:'next-loop',attemptId:'one',nextAttemptId:'two',now:10000});expect(b.status).toBe('paused');expect(b.timer?.running).toBe(false);
});
