import {it,expect} from "vitest";
import {evaluateGame,type GameEvent} from "../hosted/game-core";
import {sightLibrary,type Exercise} from "../hosted/sight-library";
import {createBattle,reduceBattle,battleView,type BattleState} from "../hosted/boss-battle";
import {defaultBossBattleConfig} from "../hosted/boss-config";
import {battleViewSchema} from "../hosted/boss-schema";
import {BattleAnimationDirector} from "../hosted/battle-animation-director";
import {noteAttackClip,noteAttackStyle,noteAttackRules,type BattleNoteAttack} from "../hosted/battle-note-attacks";

const start=()=>reduceBattle(createBattle({...defaultBossBattleConfig,enabled:true},1000),{type:"start",attemptId:"a"});
const fixture=(groups:number[][]):Exercise=>({...sightLibrary[0],polyphony:groups.flatMap((pitches,beat)=>pitches.map(pitch=>({pitch,beat,beats:1,hand:"right" as const})))});
function play(state:BattleState,exercise:Exercise,played:number[],timestamp:number){
  const result=evaluateGame(exercise,'both',played,{playerId:'p',sessionId:'s',attemptId:state.scoringAttemptId,timestamp});
  return {result,state:reduceBattle(state,{type:'evaluate',attemptId:state.scoringAttemptId,events:result.events})};
}
const cue=(pitches:number[],id='n'):BattleNoteAttack=>({id,groupId:id,revision:1,firstAt:1000,lastAt:1000,readyAt:1000,pitches,hits:pitches.length,expectedSize:pitches.length,complete:true});

it('evaluator annotates approved pitch and written chord completion without changing scoring',()=>{
  const {result,state}=play(start(),fixture([[60,64,67],[62]]),[67,1,60,64],1000);
  expect(result).toMatchObject({correct:3,incorrect:1,noteXP:6,complete:false});
  expect(result.events[0].payload).toMatchObject({pitch:67,groupId:'0',groupSize:3,groupComplete:false});
  expect(result.events[1].payload.outcome).toBe('incorrect');
  expect(result.events[3].payload).toMatchObject({pitch:64,groupComplete:true});
  expect(state).toMatchObject({bossHp:997,playerHp:26});
  // The intervening wrong key prevents a clean chord flourish.
  expect(noteAttackStyle(state.noteAttacks!.at(-1)!).chordSize).toBe(1);
});
it('out-of-order chord tones merge across incremental evaluations and earn only one HP each',()=>{
  const ex=fixture([[60,64,67],[62]]);let s=start();
  s=play(s,ex,[67],1000).state;s=play(s,ex,[67,60],1040).state;s=play(s,ex,[67,60,64],1080).state;
  expect(s).toMatchObject({bossHp:997,correctHits:3,revision:3});expect(s.noteAttacks).toHaveLength(1);
  expect(s.noteAttacks![0]).toMatchObject({pitches:[60,64,67],hits:3,complete:true,readyAt:1080});
  expect(noteAttackStyle(s.noteAttacks![0]).chordSize).toBe(3);
  expect(play(s,ex,[67,60,64],1090).state).toBe(s);
  expect(battleViewSchema.parse(battleView(s)).noteAttacks).toEqual(s.noteAttacks);
  expect(battleView(s)).not.toHaveProperty('attackClusterId');
});
it('fast neighboring score entries are individual attacks, never a fabricated chord',()=>{
  const s=play(start(),fixture([[60],[62],[64],[65]]),[60,62,64],1000).state;
  expect(s.noteAttacks).toHaveLength(3);
  expect(s.noteAttacks!.every(a=>noteAttackStyle(a).chordSize===1)).toBe(true);
});
it('slowly rolled or incomplete chords keep all damage and XP but use ordinary attack visuals',()=>{
  const ex=fixture([[60,64,67],[62]]);let s=play(start(),ex,[60],1000).state;
  s=play(s,ex,[60,64],1300).state;const done=play(s,ex,[60,64,67],1600);s=done.state;
  expect(s.noteAttacks).toHaveLength(3);expect(s.noteAttacks!.every(a=>noteAttackStyle(a).chordSize===1)).toBe(true);
  expect(s.bossHp).toBe(997);expect(done.result.noteXP).toBe(6);
  const partial=play(start(),ex,[60,64],1000).state.noteAttacks![0];
  expect(partial).toMatchObject({complete:false,hits:2,readyAt:1120});expect(noteAttackStyle(partial).chordSize).toBe(1);
});
it('repeated unison occurrences cannot inflate the number of distinct keys in a chord',()=>{
  const s=play(start(),fixture([[60,60,64],[67]]),[60,60,64],1000).state;
  expect(s.bossHp).toBe(997);expect(noteAttackStyle(s.noteAttacks![0])).toMatchObject({chordSize:2,hits:3});
});
it('only unique correct evaluator occurrences create cues; controls, misses and duplicate IDs do not',()=>{
  let s=start();const event=evaluateGame(fixture([[60],[62]]),'both',[60],{playerId:'p',sessionId:'s',attemptId:'a',timestamp:1000}).events[0];
  s=reduceBattle(s,{type:'evaluate',attemptId:'a',events:[event,event]});
  const controls:GameEvent[]=[{...event,id:'release',payload:{outcome:'unscored',pitch:62}},{...event,id:'disconnect',type:'midi.disconnected'},{...event,id:'miss',sequence:1,payload:{outcome:'missed',pitch:62}}];
  s=reduceBattle(s,{type:'evaluate',attemptId:'a',events:controls});
  expect(s.noteAttacks).toHaveLength(1);expect(s).toMatchObject({bossHp:999,playerHp:26});
});
it('loop groups are distinct, pause breaks chord assembly, and visual history stays bounded',()=>{
  const ex=fixture([[60,64],[67]]);let s=play(start(),ex,[60],1000).state;
  s=reduceBattle(s,{type:'pause',attemptId:'a'});s=reduceBattle(s,{type:'resume',attemptId:'a'});
  s=play(s,ex,[60,64],1050).state;expect(s.noteAttacks!.at(-1)!.complete).toBe(false);
  s=reduceBattle(s,{type:'next-loop',attemptId:'a',nextAttemptId:'b'});
  s=play(s,ex,[60,64],1100).state;expect(s.noteAttacks!.at(-1)!.groupId).toBe('b:0');expect(s.noteAttacks!.at(-1)!.complete).toBe(true);
  s=reduceBattle(s,{type:'start',attemptId:'c'});
  s=play(s,fixture(Array.from({length:30},(_,i)=>[60+i%12])),Array.from({length:29},(_,i)=>60+i%12),1200).state;
  expect(s.noteAttacks).toHaveLength(noteAttackRules.historySize);
});
it('every piano key has a stable style and larger chords increase visible strength with no damage multiplier',()=>{
  const signatures=new Set<string>();
  for(let key=21;key<=108;key++){
    const a=cue([key]),style=noteAttackStyle(a),clip=noteAttackClip('piano_blade_warrior',a)!;
    expect(clip.category).toBe('lightAttack');expect(noteAttackStyle(a)).toEqual(style);
    signatures.add(`${clip.id}:${style.angle}`);
  }
  expect(signatures.size).toBe(88);
  let last=0;
  for(let n=1;n<=6;n++){const a=cue(Array.from({length:n},(_,i)=>60+i*2));const s=noteAttackStyle(a);expect(s.power).toBeGreaterThan(last);last=s.power;expect(s.arcs).toBe(n);}
});
it('director attacks on the first chord tone, upgrades when complete, and never replays on reconnect',()=>{
  const ex=fixture([[60,64,67],[62]]);let s=start();const d=new BattleAnimationDirector(battleView(s),0,0);
  s=play(s,ex,[60],1000).state;d.receive(battleView(s),1,1000);expect(s.bossHp).toBe(999);const initial=d.tick(1000);expect(initial.action).toBe('player');expect(initial.strike?.chordSize).toBe(1);
  s=play(s,ex,[60,64],1040).state;d.receive(battleView(s),2,1040);expect(d.tick(1040).player.startedAt).toBe(initial.player.startedAt);
  d.tick(1064);s=play(s,ex,[60,64,67],1080).state;d.receive(battleView(s),3,1080);const p=d.tick(1080);
  expect(p.impact).toMatchObject({hits:2,damage:2});const upgraded=d.tick(1121);expect(upgraded.strike).toMatchObject({chordSize:3,hits:1});expect(upgraded.player.clip.category).toBe('heavyAttack');
  d.receive(battleView(s),3,1140);expect(d.tick(1140).player.serial).toBe(upgraded.player.serial);expect(d.tick(1900).action).toBeUndefined();expect(d.presentation.displayHp?.boss).toBe(997);
  expect(new BattleAnimationDirector(battleView(s),3,1900).tick(1950).action).toBeUndefined();
});
it('a completed chord upgrades immediately even inside the minimum action interval',()=>{
  const ex=fixture([[60,64],[62]]);let s=start();const d=new BattleAnimationDirector(battleView(s),0,0);
  s=play(s,ex,[60],1000).state;d.receive(battleView(s),1,1000);d.tick(1000);
  s=play(s,ex,[60,64],1020).state;d.receive(battleView(s),2,1020);
  expect(d.tick(1020).strike?.chordSize).toBe(2);expect(s.correctHits).toBe(2);expect(s.bossHp).toBe(998);
});
it('separate notes retain contacts and chain after follow-through without queuing full clips',()=>{
  const ex=fixture([[60],[62],[64],[65],[67]]);let s=start();const d=new BattleAnimationDirector(battleView(s),0,0);
  s=play(s,ex,[60],1000).state;d.receive(battleView(s),1,1000);const first=d.tick(1000);
  s=play(s,ex,[60,62],1020).state;d.receive(battleView(s),2,1020);
  expect(d.tick(1020).player.startedAt).toBe(first.player.startedAt);expect(d.nextWakeAt(1020)).toBe(1064);
  expect(d.tick(1064).impact?.hits).toBe(1);const second=d.tick(1121);expect(second.strike?.key).toBe(62);expect(second.player.startedAt).toBe(1121);
  s=play(s,ex,[60,62,64],1200).state;d.receive(battleView(s),3,1200);d.tick(1200);
  for(let t=1200;t<=1800;t+=5)d.tick(t);expect(d.presentation.boss.clip.category).toBe('idle');
  s=play(s,ex,[60,62,64,65],1801).state;d.receive(battleView(s),4,1801);expect(d.tick(1801).strike?.key).toBe(65);
  d.receive({...battleView(s),status:'paused'},4,1810);expect(d.nextWakeAt(1810)).toBeUndefined();
});
it('mistake damage is immediate and its reaction follows the current strike contact in order',()=>{
  const ex=fixture([[60,64,67],[62]]);let s=start();const d=new BattleAnimationDirector(battleView(s),0,0);
  s=play(s,ex,[60,64,67],1000).state;d.receive(battleView(s),3,1000);d.tick(1000);
  s=play(s,ex,[60,64,67,1],1020).state;d.receive(battleView(s),0,1020);
  expect(d.tick(1020).action).toBe('player');expect(d.tick(1250).action).toBe('boss');expect(s).toMatchObject({bossHp:997,playerHp:26});
});
it('rapid coalesced updates retain the strongest chord, mistakes take priority and no backlog remains',()=>{
  let s=start();const d=new BattleAnimationDirector(battleView(s),0,0),ex=fixture([[60,64,67,72],[62],[64],[65],[67]]);
  s=play(s,ex,[60,64,67,72,62,64,65],1000).state;d.receive(battleView(s),7,1000);
  expect(d.tick(1000).strike?.chordSize).toBe(4);expect(d.tick(1800).action).toBeUndefined();
  s=play(s,ex,[60,64,67,72,62,64,65,1],1900).state;d.receive(battleView(s),0,1900);
  expect(d.tick(1900).action).toBe('boss');expect(d.tick(2700).action).toBeUndefined();
});
