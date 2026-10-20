import {it,expect} from 'vitest';
import {createBattle,reduceBattle,battleView} from '../hosted/boss-battle';
import {defaultBossBattleConfig,bossConfigSchema} from '../hosted/boss-config';
import {battleViewSchema} from '../hosted/boss-schema';
import {evaluateGame} from '../hosted/game-core';
import {practiceLibrary} from '../hosted/practice-library';
import {noteGroups} from '../hosted/sight-library';
import {BattleAnimationDirector} from '../hosted/battle-animation-director';

// V9 deliberately retires V5 continuation, including stored true preferences.
it('migrates legacy multi-round settings into one battle without losing difficulty',()=>{
 const config=bossConfigSchema.parse({...defaultBossBattleConfig,multiRoundEnabled:true,bossDamagePerMistake:15});
 expect(config).toMatchObject({multiRoundEnabled:false,gameMode:'survival',bossDamagePerMistake:15});
 const b=createBattle(config,100);expect(battleViewSchema.parse(battleView(b)).config).toEqual(config);
});
for(const mode of ['survival','ultimateBoss'] as const)it(`${mode}: defeat stays terminal through later notes and loops`,()=>{
 const config={...defaultBossBattleConfig,enabled:true,multiRoundEnabled:true,gameMode:mode,bossDamagePerMistake:30};
 let b=reduceBattle(createBattle(config,100,false,100),{type:'start',attemptId:'a',now:0});
 const ex=practiceLibrary[0],notes=noteGroups(ex,'both').flatMap(g=>g.pitches);
 const result=evaluateGame(ex,'both',[1,...notes],{playerId:'p',sessionId:'s',attemptId:'a',timestamp:1000});
 const original=structuredClone(result);
 b=reduceBattle(b,{type:'evaluate',attemptId:'a',events:result.events,now:1});
 expect(b).toMatchObject({status:'defeat',playerHp:0,bossHp:100,correctHits:0,round:{number:1},roundLosses:1});
 b=reduceBattle(b,{type:'next-loop',attemptId:'a',nextAttemptId:'b',now:100});
 expect(b).toMatchObject({status:'defeat',playerHp:0,round:{number:1}});
 expect(result).toEqual(original);expect(result.noteXP).toBe(notes.length*2);
 const d=new BattleAnimationDirector(b,0,2000);expect(d.presentation.action).toBeUndefined();expect(d.presentation.displayHp?.player).toBe(0);
 const fresh=reduceBattle(b,{type:'start',attemptId:'new',now:200});expect(fresh).toMatchObject({playerHp:30,bossHp:100,shields:0,round:{number:1}});
});
