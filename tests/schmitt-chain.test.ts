import {it,expect} from 'vitest';
import {schmittChain} from '../hosted/schmitt-chain';
import {schmittLibrary} from '../hosted/schmitt-library';
import {battleRunNotes,createBattle,reduceBattle} from '../hosted/boss-battle';
import {battleMusicalBeats} from '../hosted/battle-modes';
import {defaultBossBattleConfig} from '../hosted/boss-config';
import {battleViewSchema} from '../hosted/boss-schema';
it('sums per-exercise cadence-aware notes and beats once',()=>{
 const entries=[2,3,1].map((loops,i)=>({exercise:schmittLibrary[i],loops})),p=schmittChain(entries,'both');
 expect(p.notes).toBe(entries.reduce((n,e)=>n+battleRunNotes(e.exercise,'both',e.loops),0));expect(p.beats).toBe(entries.reduce((n,e)=>n+battleMusicalBeats(e.exercise,e.loops)!,0));expect(p.loops).toBe(6);
 expect(createBattle({...defaultBossBattleConfig,enabled:true},p.notes,false,p.beats,p.loops).bossHp).toBe(p.notes);
});
it('manual Time Attack scales over more than 100 total repetitions',()=>{
 const p=schmittChain([0,1].map(i=>({exercise:schmittLibrary[i],loops:100})),'both');const b=createBattle({...defaultBossBattleConfig,enabled:true,gameMode:'timeAttack',explicitTimeLimitSeconds:30},p.notes,false,p.beats,p.loops);
 expect(b.timer?.limitMs).toBe(6000000);expect(battleViewSchema.safeParse(b).success).toBe(true);
});
it('chain does not mutate selection; validates collection',()=>{
 const e={exercise:schmittLibrary[0],loops:101};expect(schmittChain([e],'both').plan[0].loops).toBe(100);expect(e.loops).toBe(101);expect(()=>schmittChain([],'both')).toThrow();expect(()=>schmittChain([{...e,exercise:{...e.exercise,collection:'other'}}],'both')).toThrow();
});
it('transition preserves terminal defeat and timeout instead of respawning',()=>{
 for(const gameMode of ['survival','timeAttack'] as const){let b=createBattle({...defaultBossBattleConfig,enabled:true,gameMode,multiRoundEnabled:false,explicitTimeLimitSeconds:1},100,false,20,2);b=reduceBattle(b,{type:'start',attemptId:'a',now:0,at:0});
 b={...b,status:'defeat',result:gameMode==='timeAttack'?'timeout':'knockout',playerHp:0};const n=reduceBattle(b,{type:'next-loop',attemptId:'a',nextAttemptId:'b',now:5000});expect(n.status).toBe('defeat');expect(n.playerHp).toBe(0);expect(n.attemptId).toBe('a');expect(n.result).toBe(b.result);}
});
