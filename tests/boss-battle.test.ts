import {it,expect} from "vitest";
import {createBattle,reduceBattle,battleView,configureBattle,battleRunNotes,practiceLoopCount} from "../hosted/boss-battle";
import {defaultBossBattleConfig,bossHpTarget,bossDifficulties} from "../hosted/boss-config";
import {BattleAnimationDirector} from "../hosted/battle-animation-director";
import {gameSettingsSchema} from "../hosted/game-settings";
import {battleViewSchema} from "../hosted/boss-schema";
import {defaultGameSettings,evaluateGame,type GameEvent} from "../hosted/game-core";
import {noteGroups,practicePass,sightLibrary} from "../hosted/sight-library";
import {schmittLibrary} from "../hosted/schmitt-library";
import {scalesLibrary} from "../hosted/scales-library";
const config={...defaultBossBattleConfig,enabled:true};
const start=(notes=150)=>reduceBattle(createBattle(config,notes),{type:"start",attemptId:"a"});
const note=(n:number,outcome:GameEvent["payload"]["outcome"]="correct"):GameEvent=>({id:`a:${n}`,attemptId:"a",playerId:"p",sessionId:"s",version:1,sequence:n,timestamp:1000+n,type:"note.evaluated",payload:{outcome,occurrence:outcome==="correct"?String(n):null}});
const run=(s:ReturnType<typeof start>,events:GameEvent[])=>reduceBattle(s,{type:"evaluate",attemptId:"a",events});
it('one battle spans loops with stable identity, cumulative HP and per-loop occurrence deduplication',()=>{
  let s=run(start(4),[note(0,'incorrect'),note(1),note(2)]);
  const changed=configureBattle(s,{...config,bossDamagePerMistake:30},4,true);
  s=reduceBattle(changed,{type:'next-loop',attemptId:'a',nextAttemptId:'b'});
  expect(s).toMatchObject({attemptId:'a',scoringAttemptId:'b',status:'active',bossHp:2,playerHp:26,correctHits:2,revision:3,config:{bossDamagePerMistake:4}});
  expect(run(s,[note(3)])).toBe(s); // Late events from the first pass are stale.
  expect(reduceBattle(s,{type:'next-loop',attemptId:'a',nextAttemptId:'b'})).toBe(s);
  const repeatedOccurrence={...note(1),id:'b:1',attemptId:'b'};
  s=reduceBattle(s,{type:'evaluate',attemptId:'b',events:[repeatedOccurrence,repeatedOccurrence]});
  expect(s).toMatchObject({bossHp:1,correctHits:3,status:'active'});
  s=reduceBattle(s,{type:'evaluate',attemptId:'b',events:[{...note(2),id:'b:2',attemptId:'b'}]});
  expect(s).toMatchObject({attemptId:'a',status:'victory',bossHp:0,playerHp:26,correctHits:4});
  expect(battleView(s)).not.toHaveProperty('scoringAttemptId');
});
it('loop changes cannot revive a defeated player; only a new run restores HP',()=>{
  const dead=run(start(4),Array.from({length:8},(_,i)=>note(i,'incorrect')));
  const next=reduceBattle(dead,{type:'next-loop',attemptId:'a',nextAttemptId:'b'});
  expect(next).toMatchObject({attemptId:'a',status:'defeat',playerHp:0,bossHp:4,result:'knockout'});
  expect(reduceBattle(next,{type:'evaluate',attemptId:'b',events:[{...note(0),attemptId:'b',id:'b:0'}]})).toBe(next);
  expect(reduceBattle(next,{type:'start',attemptId:'c'})).toMatchObject({attemptId:'c',status:'active',playerHp:30,bossHp:4,correctHits:0});
});
it('abandoning between loops closes the full battle without a victory',()=>{
  const paused=reduceBattle(run(start(4),[note(0),note(1)]),{type:'pause',attemptId:'a'});
  expect(reduceBattle(paused,{type:'abandon',attemptId:'a'})).toMatchObject({status:'defeat',result:'abandoned',bossHp:2});
});
for(const hand of ['right','left','both'] as const)it(`counts all selected ${hand} loops, with a Schmitt cadence only on the final pass`,()=>{
  for(const ex of [sightLibrary[0],schmittLibrary[9]]){
    const count=(omit:boolean)=>noteGroups(practicePass(ex,omit),hand).flatMap(g=>g.pitches).length;
    for(const loops of [1,2,3,100])expect(battleRunNotes(ex,hand,loops)).toBe(count(false)+(loops-1)*count(true));
  }
  expect([0,-2,NaN,Infinity,1.6,200].map(practiceLoopCount)).toEqual([1,1,1,1,2,100]);
});
for(const difficulty of bossDifficulties)it(`${difficulty.label} deals ${difficulty.damage} HP per mistake until defeat`,()=>{
  const configured={...config,bossDamagePerMistake:difficulty.damage};
  const initial=reduceBattle(createBattle(configured,150),{type:"start",attemptId:"a"});
  const mistakes=Math.ceil(30/difficulty.damage);
  const before=run(initial,Array.from({length:mistakes-1},(_,i)=>note(i,"incorrect")));
  expect(before.status).toBe('active');expect(before.playerHp).toBe(30-(mistakes-1)*difficulty.damage);
  const after=run(before,[note(mistakes-1,"missed")]);
  expect(after.status).toBe('defeat');expect(after.playerHp).toBe(0);
  expect(after.bossMaxHp).toBe(150);
});
it('difficulty changes preserve live HP and damage until the next battle',()=>{
  const damaged=run(start(),[note(0,'incorrect')]);
  const nextConfig={...config,bossDamagePerMistake:30,showDamageNumbers:false};
  const updated=configureBattle(damaged,nextConfig,150,true);
  expect(updated).toMatchObject({playerHp:26,config:{bossDamagePerMistake:4,showDamageNumbers:false}});
  expect(run(updated,[note(1,'incorrect')]).playerHp).toBe(22);
  const paused=reduceBattle(updated,{type:'pause',attemptId:'a'});
  expect(configureBattle(paused,nextConfig,150,true).config.bossDamagePerMistake).toBe(4);
  const ready=configureBattle(createBattle(config,150),nextConfig,150,false);
  expect(ready.config.bossDamagePerMistake).toBe(30);
  expect(run(reduceBattle(ready,{type:'start',attemptId:'a'}),[note(0,'incorrect')]).status).toBe('defeat');
});
it("defaults OFF and migrates old settings without enabling battle",()=>{
  const s=createBattle();expect(s.status).toBe("idle");expect(s.config.enabled).toBe(false);
  expect(run(s,[note(0)])).toBe(s);
  const {bossBattle:_old,...old}=defaultGameSettings;
  void _old;
  expect(gameSettingsSchema.parse(old).bossBattle).toEqual(defaultBossBattleConfig);
});
it("requires every scored note without a percentage discount or 100-HP cap",()=>{
  expect([0,1,20,50,100,150,250,12000].map(n=>bossHpTarget(n))).toEqual([1,1,20,50,100,150,250,12000]);
  expect(createBattle(config,0).status).toBe("idle");
  expect(createBattle(config,20).status).toBe("ready");
  expect(battleViewSchema.parse(battleView(createBattle(config,12000))).bossMaxHp).toBe(12000);
});
it("old saved percentage/cap/damage settings cannot shorten the fight",()=>{
  const legacy={...config,bossMaxHp:100,targetRatio:0.8};
  const s=createBattle(legacy,250);
  expect(s.bossMaxHp).toBe(250);
  expect(s.config).not.toHaveProperty('targetRatio');
  expect(s.config).not.toHaveProperty('bossMaxHp');
  const settings=gameSettingsSchema.parse({...defaultGameSettings,bossBattle:{...legacy,playerDamagePerCorrectNote:10}});
  expect(settings.bossBattle.playerDamagePerCorrectNote).toBe(1);
  const normalized=reduceBattle(createBattle(settings.bossBattle,250),{type:'start',attemptId:'a'});
  expect(run(normalized,[note(0)]).bossHp).toBe(249);
});
it("stays active through 80%, 100 notes and the penultimate note; only the final note wins",()=>{
  let s=start(250);
  s=run(s,Array.from({length:100},(_,i)=>note(i)));
  expect(s).toMatchObject({status:'active',bossHp:150});
  s=run(s,Array.from({length:100},(_,i)=>note(i+100)));
  expect(s).toMatchObject({status:'active',bossHp:50});
  s=run(s,Array.from({length:49},(_,i)=>note(i+200)));
  expect(s).toMatchObject({status:'active',bossHp:1});
  s=run(s,[note(249,'incorrect')]);
  expect(s).toMatchObject({status:'active',bossHp:1,playerHp:26});
  s=run(s,[note(250)]);
  expect(s).toMatchObject({status:'victory',bossHp:0,playerHp:26,correctHits:250});
});
it("losing the last HP before the final note prevents victory even if practice continues",()=>{
  const oneLeft=run(start(20),Array.from({length:19},(_,i)=>note(i)));
  const defeat=run(oneLeft,[...Array.from({length:8},(_,i)=>note(i+19,'incorrect')),note(27)]);
  expect(defeat).toMatchObject({status:'defeat',bossHp:1,playerHp:0,correctHits:19});
  expect(reduceBattle(defeat,{type:'complete',attemptId:'a'})).toBe(defeat);
});
it("uses an evaluator-approved note occurrence once, never pitch/key spam",()=>{
  const s=start();const n=note(0);const once=run(s,[n]);
  expect(once.bossHp).toBe(149);expect(once.playerHp).toBe(30);
  expect(run(once,[n])).toBe(once);
  expect(run(once,[{...n,id:"another-event",sequence:1}]).bossHp).toBe(149);
  expect(run(once,[note(2,"unscored"),{...note(3),payload:{outcome:"correct",occurrence:null}}]).bossHp).toBe(149);
});
for(const outcome of ["incorrect","missed"] as const)it(`${outcome} damages once and the eighth mistake defeats`,()=>{
  const seven=run(start(),Array.from({length:7},(_,i)=>note(i,outcome)));
  expect(seven.playerHp).toBe(2);expect(seven.status).toBe("active");
  expect(run(seven,[note(0,outcome)])).toBe(seven);
  const eight=run(seven,[note(7,outcome),note(8,outcome)]);
  expect(eight.playerHp).toBe(0);expect(eight.status).toBe("defeat");expect(eight.mistakes).toBe(8);
  expect(run(eight,[note(9)])).toBe(eight);
});
it("applies rapid individual chord notes in canonical order and stops at victory",()=>{
  const events=Array.from({length:150},(_,i)=>note(i));
  const s=run(start(),events.slice().reverse());
  expect(s).toMatchObject({status:"victory",bossHp:0,correctHits:150,playerHp:30});
  expect(run(s,[note(151,"incorrect")])).toBe(s);
  expect(run(start(),[note(1),note(0,"incorrect"),note(2)])).toMatchObject({bossHp:148,playerHp:26});
});
it("ignores key releases, sustain, disconnect, paused input and stale attempts",()=>{
  const s=start();
  expect(run(s,[note(0,"unscored"),note(1,"unscored"),{...note(2),type:"midi.disconnected"}])).toMatchObject({bossHp:150,playerHp:30});
  const paused=reduceBattle(run(s,[note(0)]),{type:"pause",attemptId:"a"});
  expect(run(paused,[note(1,"incorrect")])).toBe(paused);
  const resumed=reduceBattle(paused,{type:"resume",attemptId:"a"});
  expect(run(resumed,[note(2)])).toMatchObject({bossHp:148,status:"active"});
  const restarted=reduceBattle(resumed,{type:"start",attemptId:"b"});
  expect(restarted).toMatchObject({bossHp:150,playerHp:30,revision:0,status:"active"});
  expect(run(restarted,[note(3)])).toBe(restarted);
  expect(reduceBattle(restarted,{type:"start",attemptId:"b"})).toBe(restarted);
});
it("completion and abandonment finalize unfinished battles without granting victory",()=>{
  for(const type of ["complete","abandon"] as const){
    const s=reduceBattle(run(start(),[note(0)]),{type,attemptId:"a"});
    expect(s).toMatchObject({status:"defeat",bossHp:149,result:type==="complete"?"unfinished":"abandoned"});
  }
  const win=run(start(1),[note(0)]);
  expect(reduceBattle(win,{type:"complete",attemptId:"a"})).toBe(win);
});
it("mode OFF cancels; enabling mid-attempt waits and cannot replay old notes",()=>{
  const off=createBattle(defaultBossBattleConfig,30);
  expect(run(off,[note(0)])).toBe(off);
  const waiting=createBattle(config,30,true);
  expect(waiting).toMatchObject({status:"ready",waiting:true,attemptId:""});
  expect(run(waiting,[note(0)])).toBe(waiting);
});
for(const hand of ['right','left','both'] as const)it(`requires all real ${hand} evaluation results without changing scoring or XP`,()=>{
  const exercise=scalesLibrary[0];
  const notes=noteGroups(exercise,hand).flatMap(g=>g.pitches);
  const ctx={playerId:"p",sessionId:"s",attemptId:"a",timestamp:1000};
  const result=evaluateGame(exercise,hand,[1,...notes],ctx);
  const before=structuredClone(result);
  const almost=evaluateGame(exercise,hand,[1,...notes.slice(0,-1)],ctx);
  expect(run(start(notes.length),almost.events)).toMatchObject({status:'active',playerHp:26,bossHp:1});
  expect(run(start(notes.length),result.events)).toMatchObject({status:"victory",playerHp:26,bossHp:0});
  expect(result).toEqual(before);expect(result.noteXP).toBe(notes.length*2);
  expect(result.incorrect).toBe(1);
});
it("animation scheduling coalesces bursts, never replays reconnects and cannot change HP",()=>{
  const s=start(), scheduler=new BattleAnimationDirector(battleView(s),0,1000);
  let next=s;
  for(let i=0;i<70;i++){next=run(next,[note(i)]);scheduler.receive(battleView(next),i+1,1100);}
  const before=structuredClone(next);
  const motion=scheduler.tick(1100);expect(motion.action).toBe("player");
  expect(scheduler.tick(1101)).toBe(motion);
  const accepted=scheduler.diagnostics(1101).damageEvents;scheduler.receive(battleView(next),70,1300);
  expect(scheduler.diagnostics(1300).damageEvents).toBe(accepted);
  for(let t=1300;t<=2300;t+=5)scheduler.tick(t);expect(scheduler.presentation.displayHp?.boss).toBe(80);
  expect(next).toEqual(before);expect(next.bossHp).toBe(80);
  const reconnected=new BattleAnimationDirector(battleView(next),70,1400);
  reconnected.receive(battleView(next),70,1400);expect(reconnected.tick(1400).action).toBeUndefined();
});
