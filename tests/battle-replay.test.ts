import {it,expect} from 'vitest';
import {BattleTraceRecorder,parseBattleTrace,measureBattleTrace,replayFrame} from '../hosted/battle-replay';
import {createBattle,reduceBattle} from '../hosted/boss-battle';
import {defaultBossBattleConfig} from '../hosted/boss-config';
import {evaluateGame} from '../hosted/game-core';
import {practiceLibrary} from '../hosted/practice-library';
import {noteGroups} from '../hosted/sight-library';

it('captures each authoritative evaluation once with monotonic timing, without changing live state',()=>{
  let clock=1000;const recorder=new BattleTraceRecorder(()=>clock),ex=practiceLibrary[0];
  let battle=reduceBattle(createBattle({...defaultBossBattleConfig,enabled:true},1000),{type:'start',attemptId:'captured'});
  recorder.capture(battle,0);expect(recorder.trace).toBeUndefined();recorder.arm();recorder.start({number:ex.number,title:ex.title!},battle,0);
  const played:number[]=[];const groups=noteGroups(ex,'both').slice(0,16);
  for(const group of groups){clock+=62.5;played.push(...group.pitches);
    const r=evaluateGame(ex,'both',played,{playerId:'private-id',sessionId:'private-session',attemptId:'captured',timestamp:1700000000000+clock});
    battle=reduceBattle(battle,{type:'evaluate',attemptId:'captured',events:r.events});const before=structuredClone(battle);
    recorder.capture(battle,r.correct,r.events);expect(battle).toEqual(before);
  }
  const trace=recorder.stop()!,text=JSON.stringify(trace);expect(text).not.toContain('private-id');expect(text).not.toContain('private-session');
  expect(trace.frames.flatMap(f=>f.events)).toHaveLength(32);expect(trace.frames.at(-1)?.atMs).toBe(1000);
  const parsed=parseBattleTrace(text),result=measureBattleTrace(parsed);
  expect(result.authoritativeDamageEvents).toBe(32);expect(result.evaluatedCount).toBe(32);expect(result.displayHp?.boss).toBe(968);
  expect(measureBattleTrace(parsed)).toEqual(result);
  // This test uses generated input, so fixtures must not assert real hardware provenance.
  parsed.provenance='synthetic';expect(measureBattleTrace(parsed).provenance).toBe('synthetic');
});
it('rejects malformed, oversized, or unordered traces and keeps replay timestamps fresh',()=>{
  const r=new BattleTraceRecorder(()=>0),b=reduceBattle(createBattle({...defaultBossBattleConfig,enabled:true},10),{type:'start',attemptId:'a'});
  r.arm();r.start({number:1,title:'Test'},b,0);const t=r.stop()!;
  expect(replayFrame(t.frames[0],5000).lastAt).toBe(5000);
  expect(()=>parseBattleTrace('x')).toThrow();expect(()=>parseBattleTrace(' '.repeat(16000001))).toThrow();
  t.frames.push({...t.frames[0],atMs:10},{...t.frames[0],atMs:5});expect(()=>parseBattleTrace(JSON.stringify(t))).toThrow('ordered');
});
