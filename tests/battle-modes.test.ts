import {it,expect} from 'vitest';
import {createBattle,reduceBattle,configureBattle,battleView,type BattleState} from '../hosted/boss-battle';
import {defaultBossBattleConfig,bossDifficulties} from '../hosted/boss-config';
import {battleMusicalBeats,bossPhase,countdownLabel,type GameMode} from '../hosted/battle-modes';
import {battleViewSchema} from '../hosted/boss-schema';
import {evaluateGame,replayEvents,defaultGameSettings,type GameEvent} from '../hosted/game-core';
import {gameSettingsSchema} from '../hosted/game-settings';
import {noteGroups,type Exercise} from '../hosted/sight-library';
import {schmittLibrary} from '../hosted/schmitt-library';
import {BattleAnimationDirector} from '../hosted/battle-animation-director';
const config={...defaultBossBattleConfig,enabled:true,adaptivePower:false};
const start=(gameMode:GameMode='survival',notes=200,beats:number|null=100)=>reduceBattle(createBattle({...config,gameMode},notes,false,beats),{type:'start',attemptId:'a',now:0,at:1000});
const event=(n:number,outcome:GameEvent['payload']['outcome']='correct'):GameEvent=>({id:`a:${n}`,version:1,playerId:'p',sessionId:'s',attemptId:'a',sequence:n,timestamp:1000+n,type:'note.evaluated',payload:{outcome,occurrence:outcome==='correct'?`n:${n}`:null}});
const run=(s:BattleState,events:GameEvent[],now=0)=>reduceBattle(s,{type:'evaluate',attemptId:s.scoringAttemptId,events,now});
const notes=(count:number,offset=0)=>Array.from({length:count},(_,i)=>event(offset+i));
const tick=(s:BattleState,now:number)=>reduceBattle(s,{type:'tick',attemptId:s.scoringAttemptId,now,at:1000+now});

for(const mode of ['survival','timeAttack','ultimateBoss'] as const)it(`${mode}: correct expected notes deal exactly one HP; duplicates/controls/stale events do nothing`,()=>{
 let s=start(mode);s=run(s,[event(0),event(0)]);expect(s).toMatchObject({bossHp:199,power:{charge:1}});
 s=run(s,[event(0),{...event(1),payload:event(0).payload},event(2,'unscored'),{...event(3),type:'midi.disconnected'}]);
 expect(s).toMatchObject({bossHp:199,power:{charge:1}});
 expect(run(s,[{...event(4),attemptId:'stale'}]).bossHp).toBe(199);
});
for(const mode of ['survival','timeAttack','ultimateBoss'] as const)it(`${mode}: evaluator rejects wrong pitches without advancing; XP is unchanged`,()=>{
 const ex=schmittLibrary[0],pitches=noteGroups(ex,'both').flatMap(g=>g.pitches);
 const result=evaluateGame(ex,'both',[1,...pitches.slice(0,10)],{playerId:'p',sessionId:'s',attemptId:'a',timestamp:1000});
 const before=structuredClone(result),s=run(start(mode,pitches.length),result.events);
 expect(s.correctHits).toBe(10);expect(s.bossHp).toBe(pitches.length-10);expect(s.mistakes).toBe(1);expect(result.noteXP).toBe(20);expect(result).toEqual(before);
});
for(const difficulty of bossDifficulties)it(`Health modes preserve ${difficulty.label}; Time Attack ignores its HP damage`,()=>{
 for(const mode of ['survival','timeAttack','ultimateBoss'] as const){const b=start(mode),s=run({...b,config:{...b.config,bossDamagePerMistake:difficulty.damage}},[event(0,'incorrect')]);
 expect(s.playerHp).toBe(mode!=='timeAttack'?Math.max(0,30-difficulty.damage):30);}
});
it('settings persist all modes and freeze rules during an active or paused run',()=>{
 for(const mode of ['survival','timeAttack','ultimateBoss'] as const){
  const settings=gameSettingsSchema.parse({...defaultGameSettings,bossBattle:{...config,gameMode:mode,selectedBpm:110,allowanceMultiplier:1.15,powerThreshold:50}});
  expect(settings.bossBattle.gameMode).toBe(mode);
  const old=run(start(),[event(0)]),changed=configureBattle(old,settings.bossBattle,200,true);
  expect(changed.config).toMatchObject({gameMode:'survival',selectedBpm:60,powerThreshold:100});
  expect(createBattle(settings.bossBattle,200,false,100).config.gameMode).toBe(mode);
 }
});
for(const beats of [1,.5,.25])it(`timing uses ${beats}-beat notes, not note or chord counts`,()=>{
 const ex:Exercise={number:1,right:[Array.from({length:4},()=>({pitch:60,beats,tie:false}))],left:[Array.from({length:4},()=>({pitch:48,beats,tie:false}))]};
 expect(battleMusicalBeats(ex)).toBe(4*beats);
 expect(createBattle({...config,gameMode:'timeAttack',selectedBpm:60},8,false,battleMusicalBeats(ex)).timer?.limitMs).toBe(Math.ceil(4*beats*1.5)*1000);
});
it('timing includes tied durations, explicit rests/pickups, polyphonic overlap and selected Schmitt loops',()=>{
 const ex:Exercise={number:1,right:[[{pitch:60,beats:1,tie:true},{pitch:60,beats:2,tie:false}]],left:[]};
 expect(battleMusicalBeats(ex)).toBe(3);
 const poly={...ex,durationBeats:4.5,polyphony:[{pitch:60,beat:.5,beats:2,hand:'right' as const},{pitch:64,beat:.5,beats:2,hand:'right' as const}]};
 expect(battleMusicalBeats(poly,3)).toBe(13.5);
 const schmitt=schmittLibrary[0],whole=battleMusicalBeats(schmitt)!;
 expect(battleMusicalBeats(schmitt,3)).toBe(whole+Math.max(...schmitt.polyphony!.map(n=>n.beat))*2);
});
it('unknown duration requires an explicit time limit; never uses note count',()=>{
 const s=start('timeAttack',200,null);expect(s.status).toBe('ready');expect(s.timer?.issue).toBeTruthy();
 const explicit=createBattle({...config,gameMode:'timeAttack',explicitTimeLimitSeconds:45},200,false,null);
 expect(explicit.timer).toMatchObject({limitMs:45000});expect(explicit.timer?.issue).toBeUndefined();
});
it('timer starts on the first scored evaluation, including a wrong pitch; idle and controls do not start it',()=>{
 let s=start('timeAttack');expect(tick(s,50000).timer?.elapsedMs).toBe(0);
 s=run(s,[event(0,'unscored')],50000);expect(s.timer?.started).toBe(false);
 s=run(s,[event(1,'incorrect')],60000);expect(s.timer).toMatchObject({started:true,running:true,elapsedMs:0});
 expect(tick(s,61000).timer?.elapsedMs).toBe(1000);
});
it('pause/resume excludes pauses; large delayed callbacks use elapsed time once',()=>{
 let s=run(start('timeAttack'),[event(0)],1000);
 s=reduceBattle(s,{type:'pause',attemptId:'a',now:4000});expect(s.timer?.elapsedMs).toBe(3000);
 s=tick(s,1000000);expect(s.timer?.elapsedMs).toBe(3000);
 s=reduceBattle(s,{type:'resume',attemptId:'a',now:1000000});s=tick(s,1007000);expect(s.timer?.elapsedMs).toBe(10000);
 s=tick(s,2000000);expect(s).toMatchObject({status:'defeat',result:'timeout',timer:{running:false,elapsedMs:150000}});
 expect(tick(s,3000000)).toBe(s);expect(s.roundLosses).toBe(1);
});
for(const mode of ['timeAttack','ultimateBoss'] as const)it(`${mode} has an exclusive deadline: final note before it wins, at/after it loses`,()=>{
 const initial=run(start(mode,2,1),[event(0)],1000); // ceil(1*1.5)=2 seconds
 expect(run(initial,[event(1)],2999).status).toBe('victory');
 expect(run(initial,[event(1)],3000)).toMatchObject({status:'defeat',result:'timeout',bossHp:1});
 expect(run(initial,[event(1)],3001).bossHp).toBe(1);
});
it('completion with a living boss is unsuccessful and stops time',()=>{
 const s=reduceBattle(run(start('timeAttack'),[event(0)],0),{type:'complete',attemptId:'a',now:1000});
 expect(s).toMatchObject({status:'defeat',result:'unfinished',timer:{running:false,elapsedMs:1000}});
});
it('shield awards use the existing per-note combo replay and cap inventory at three',()=>{
 let s=start('ultimateBoss');const input=notes(40),comboByEvent=replayEvents(input).comboByEvent;
 s=reduceBattle(s,{type:'evaluate',attemptId:'a',events:input,comboByEvent,now:0});expect(s.shields).toBe(3);
 const mistake=event(40,'incorrect');s=run(s,[mistake]);expect(s).toMatchObject({shields:2,playerHp:30,lastCombo:0});expect(s.combatCues?.at(-1)).toMatchObject({damage:0,blocked:true});
 expect(run(s,[mistake]).shields).toBe(2);
 s=run(s,notes(9,41));expect(s.shields).toBe(2);s=run(s,[event(50)]);expect(s.shields).toBe(3);
 s=reduceBattle(s,{type:'start',attemptId:'b',now:1000});expect(s.shields).toBe(0);
});
it('carried musical streak never grants shields for notes played before this battle',()=>{
 let s=reduceBattle(createBattle({...config,gameMode:'ultimateBoss'},200,false,100),{type:'start',attemptId:'a',combo:27,now:0});
 const input=notes(9);s=reduceBattle(s,{type:'evaluate',attemptId:'a',events:input,comboByEvent:replayEvents(input,27).comboByEvent,now:0});expect(s.shields).toBe(0);
 s=reduceBattle(s,{type:'evaluate',attemptId:'a',events:notes(10),comboByEvent:replayEvents(notes(10),27).comboByEvent,now:0});expect(s.shields).toBe(1);
});
it('enrage thresholds and ceiling damage are explicit, with full shield absorption',()=>{
 expect([51,50,26,25,1].map(h=>bossPhase(h,100))).toEqual(['normal','aggressive','aggressive','enraged','enraged']);
 let s=run(start('ultimateBoss',100),notes(50));expect(s.phase).toBe('aggressive');
 s={...s,shields:0};s=run(s,[event(50,'incorrect')]);expect(s.playerHp).toBe(25);
 s=run(s,notes(25,51));expect(s.phase).toBe('enraged');
 s=run(s,[event(76,'incorrect')]);expect(s.playerHp).toBe(25); // shield blocks all 6
 s=run({...s,shields:0},[event(77,'missed')]);expect(s.playerHp).toBe(19);
 expect(run(s,[event(77,'missed')]).phase).toBe('enraged');
});
for(const mode of ['survival','timeAttack'] as const)it(`${mode} does not grant shields or apply enrage`,()=>{
 const s=run(start(mode,100),notes(80));expect(s).toMatchObject({phase:'normal',shields:0});
 expect(run(s,[event(80,'incorrect')]).playerHp).toBe(mode==='survival'?26:30);
});
it('power survives mistakes, activates once per threshold and never awards extra damage',()=>{
 let s=run(start(),notes(99));s=run(s,[event(99,'incorrect')]);expect(s.power?.charge).toBe(99);
 s=run(s,[event(100)]);expect(s).toMatchObject({bossHp:100,playerHp:26,correctHits:100,power:{charge:0,activations:1}});
 expect(s.combatCues?.at(-1)?.special).toBe(true);expect(run(s,[event(100)]).power?.activations).toBe(1);
 expect(battleViewSchema.parse(battleView(s)).power).toEqual(s.power);expect(battleView(s)).not.toHaveProperty('timerAnchor');
});
it('adaptive power freezes its accurately displayed threshold at start',()=>{
 const s=createBattle({...config,adaptivePower:true},20);expect(s.power?.threshold).toBe(12);
 const active=reduceBattle(s,{type:'start',attemptId:'a'}),changed=configureBattle(active,{...config,powerThreshold:1},20,true);
 expect(changed.power?.threshold).toBe(12);
});
it('special presentation reuses a real note, stays bounded and yields to terminal outcomes',()=>{
 let s=reduceBattle(createBattle({...config,powerThreshold:10},150),{type:'start',attemptId:'a',now:0});
 const director=new BattleAnimationDirector(s,0,1000,()=>0);let specials=0;
 for(let i=0;i<120;i++){s=run(s,[{...event(i),timestamp:1000+i*20}]);director.receive(s,0,1000+i*20);director.tick(1000+i*20);if(director.presentation.impact?.special)specials++;}
 for(let at=3400;at<5000;at+=5){director.tick(at);if(director.presentation.impact?.special)specials++;}
 expect(s.power?.activations).toBe(12);expect(s.bossHp).toBe(30);expect(specials).toBeGreaterThan(0);expect(director.diagnostics(5000).maxQueue).toBeLessThanOrEqual(6);
 expect(director.presentation.displayHp?.boss).toBe(30);
 s=run(s,notes(30,120).map(e=>({...e,timestamp:5000})));director.receive(s,0,5000);for(let at=5000;at<9000;at+=10)director.tick(at);
 expect(s.status).toBe('victory');expect(director.presentation.finished).toBe(true);expect(director.diagnostics(9000).pending).toBe(0);
 const restored=new BattleAnimationDirector(s,0,10000);expect(restored.presentation.impact).toBeUndefined();
});
it('countdown formatting rounds up and never shows negative time',()=>{expect([0,1,60000,84000,-1].map(countdownLabel)).toEqual(['00:00','00:01','01:00','01:24','00:00']);});
it('coalesced stale visuals still reconcile HP without requiring another piano note',()=>{
 const initial=start(),director=new BattleAnimationDirector(initial,0,1000);
 const current=run(initial,notes(120));director.receive(current,120,2900);director.tick(2900);
 expect(director.presentation.displayHp).toEqual({player:30,boss:80});expect(director.diagnostics(2900).pending).toBe(0);
});
it('Ultimate phases strengthen existing attack visuals without adding combat events',()=>{
 const powers:number[]=[];
 for(const count of [0,50,75]){
  const initial={...run(start('ultimateBoss',100),notes(count)),shields:0};
  const director=new BattleAnimationDirector(initial,0,2000,()=>0);
  const hit=run(initial,[{...event(count,'incorrect'),timestamp:2000}],0);
  const snapshot=structuredClone(hit);director.receive(hit,0,2000);
  for(let now=2000;now<=2550;now+=5){director.tick(now);if(director.presentation.impact){powers.push(director.presentation.impact.power);break;}}
  expect(hit).toEqual(snapshot);expect(hit.revision).toBe(initial.revision+1);
 }
 expect(powers).toHaveLength(3);expect(powers[1]).toBeGreaterThan(powers[0]);expect(powers[2]).toBeGreaterThan(powers[1]);
});
it('disabling a timed battle stops its clock without granting victory',()=>{
 const active=run(start('timeAttack'),[event(0)],1000);
 const disabled=configureBattle(active,{...active.config,enabled:false},200,true);
 expect(disabled).toMatchObject({status:'idle',timer:{running:false},round:{result:'abandoned'}});
 expect(tick(disabled,1000000)).toBe(disabled);
});
