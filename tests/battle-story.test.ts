import {expect,it} from 'vitest';
import {BattleStoryDirector,storyChallenge,storyChallengeKey,storySummaryLines,type StoryRecord} from '../hosted/battle-story';
import {createBattle,reduceBattle,battleView} from '../hosted/boss-battle';
import {defaultBossBattleConfig,bossDifficulties} from '../hosted/boss-config';
import {battleViewSchema} from '../hosted/boss-schema';
import {visibleStoryEvent} from '../hosted/battle-story-ui';
import {BattleCinematicController} from '../hosted/battle-cinematic';
import {defaultCinematicSettings} from '../hosted/cinematic-config';
const id=crypto.randomUUID();
const config={...defaultBossBattleConfig,enabled:true};
const challenge=storyChallenge(config,'both',[{number:1,loops:2},{number:2,loops:3}]);
const start=()=>reduceBattle(createBattle(config,100),{type:'start',attemptId:id,at:0,now:0});
const prior:StoryRecord={key:storyChallengeKey(challenge),last:{attemptId:crypto.randomUUID(),finishedAt:1,result:'defeat',correct:30,mistakes:8,bestCombo:20,completed:1,total:2,accuracy:79},
 best:{attemptId:crypto.randomUUID(),finishedAt:0,result:'defeat',correct:40,mistakes:8,bestCombo:30,completed:1,total:2,accuracy:83}};
it('keys boss, all difficulties, mode, ordered exercises, repetitions and hand without cosmetic settings',()=>{
 const keys=new Set<string>();
 for(const bossId of ['grinwick','crimson_musical_colossus'] as const)for(const d of bossDifficulties)for(const gameMode of ['survival','timeAttack','ultimateBoss'] as const)
 keys.add(storyChallengeKey(storyChallenge({...config,bossId,bossDamagePerMistake:d.damage,gameMode},'both',challenge.exercises)));
 expect(keys.size).toBe(36);
 expect(storyChallengeKey(storyChallenge({...config,volume:.2,animationSpeed:1.2},'both',challenge.exercises))).toBe(storyChallengeKey(challenge));
 expect(storyChallengeKey({...challenge,hand:'right'})).not.toBe(prior.key);
 expect(storyChallengeKey({...challenge,powerThreshold:200})).not.toBe(prior.key);
 expect(storyChallengeKey({...challenge,adaptivePower:false})).not.toBe(prior.key);
 expect(storyChallengeKey({...challenge,exercises:[...challenge.exercises].reverse()})).not.toBe(prior.key);
 expect(storyChallengeKey({...challenge,exercises:[{number:1,loops:1},{number:2,loops:3}]})).not.toBe(prior.key);
});
it('has one introduction for the stable attempt across 1, 5, 10 and 100 loops',()=>{
 for(const loops of [1,5,10,100]){
  const c=storyChallenge(config,'both',[{number:1,loops}]),d=new BattleStoryDirector(id,c);
  let b=reduceBattle(createBattle(config,1000),{type:'start',attemptId:id,at:0,now:0,countdown:true});
  b={...b,story:d.observe(b,{exerciseId:1,completed:0,bestCombo:0},0)};
  const intro=b.countdown;
  b=reduceBattle(b,{type:'fight',attemptId:id,at:3000,now:3000});
  for(let n=1;n<loops;n++)b=reduceBattle(b,{type:'next-loop',attemptId:b.scoringAttemptId,nextAttemptId:crypto.randomUUID(),now:3000+n});
  expect(b.attemptId).toBe(id);expect(b.countdown?.startedAt).toBe(intro?.startedAt);expect(b.countdown?.releasedAt).toBe(3000);
  expect(d.view.completed).toBe(0);
 }
});
it('does not invent a first-attempt or tying PB; compares the best, not the last result',()=>{
 const d=new BattleStoryDirector(id,challenge,prior),b=start(),input={exerciseId:1,completed:0,bestCombo:0};
 expect(d.observe({...b,correctHits:30,revision:30},input,100).event).toBeUndefined();
 expect(d.observe({...b,correctHits:40,revision:40},input,200).event).toBeUndefined();
 const s=d.observe({...b,correctHits:41,revision:41},input,300);
 expect(s.event?.kind).toBe('personalBest');
 expect(d.observe({...b,correctHits:42,revision:42},input,20000).event?.id).toBe(s.event?.id);
 expect(new BattleStoryDirector(id,challenge).observe({...b,correctHits:41},input,300).event).toBeUndefined();
});
it('critical preempts, events expire on reconnect, cooldown consumes superseded beats, exercise changes clear old cues',()=>{
 const d=new BattleStoryDirector(id,challenge,prior),b=start(),input={exerciseId:1,completed:0,bestCombo:0};
 const pb=d.observe({...b,correctHits:41,revision:41},input,100);
 const critical=d.observe({...b,playerHp:6,correctHits:42,revision:42},input,200);
 expect(pb.event?.kind).toBe('personalBest');expect(critical.event?.kind).toBe('critical');
 const view={...b,story:critical};expect(visibleStoryEvent(view,250)?.id).toBe(critical.event?.id);
 expect(visibleStoryEvent(view,3000)).toBeUndefined();expect(visibleStoryEvent({...view,status:'paused'},250)).toBeUndefined();
 expect(visibleStoryEvent(view,250,true)).toBeUndefined();
 d.observe({...b,revision:50},{...input,bestCombo:50},500);
 expect(d.observe({...b,revision:51},{...input,bestCombo:50},15000).event?.kind).toBe('critical');
 const last=d.observe({...b,revision:52,chain:{index:2,total:2,exerciseNumber:2,rootExerciseNumber:1,pass:1,passes:3}},{...input,exerciseId:2,completed:1},16000);
 expect(last.event?.kind).toBe('finalExercise');
 expect(d.observe({...b,revision:53,chain:{index:2,total:2,exerciseNumber:2,rootExerciseNumber:1,pass:2,passes:3}},{...input,exerciseId:2,completed:1},40000).event?.id).toBe(last.event?.id);
});
it('uses boss-specific existing reactions and excludes pressure during countdown, pause and terminal states',()=>{
 for(const bossId of ['grinwick','crimson_musical_colossus'] as const){
  const c=storyChallenge({...config,bossId},'both',[{number:1,loops:1}]),d=new BattleStoryDirector(id,c),b={...start(),config:{...config,bossId}};
  expect(d.observe({...b,status:'paused'},{exerciseId:1,completed:0,bestCombo:50},100).event).toBeUndefined();
  const s=d.observe(b,{exerciseId:1,completed:0,bestCombo:50},200);
  expect(s.event?.reaction).toBe(bossId==='grinwick'?'grinwick_idle_panic_05':'boss_idle_laughter_03');
 }
 const d=new BattleStoryDirector(id,challenge),b=start();
 expect(d.observe({...b,phase:'enraged'},{exerciseId:1,completed:0,bestCombo:50},100).event).toBeUndefined();
 expect(d.observe({...b,phase:'enraged'},{exerciseId:1,completed:0,bestCombo:51},20000).event).toBeUndefined();
});
it('freezes a truthful result, roundtrips identical OBS state and preserves held cinematic lifecycle',()=>{
 for(const result of ['victory','defeat','timeout'] as const){
  const d=new BattleStoryDirector(id,challenge,prior),b=start();
  const terminal={...b,status:result==='victory'?'victory' as const:'defeat' as const,result:result==='timeout'?'timeout' as const:'knockout' as const,correctHits:50,mistakes:3,lastAt:500};
  const story=d.observe(terminal,{exerciseId:2,completed:result==='victory'?2:1,bestCombo:22},500);
  expect(storySummaryLines(story)[1]).toBe('NEW PERSONAL BEST: +10 CORRECT NOTES');
  expect(d.observe({...terminal,correctHits:70},{exerciseId:2,completed:2,bestCombo:40},900)).toBe(story);
  const packet=battleViewSchema.parse({...battleView(terminal),story});expect(packet.story).toEqual(story);
  const controller=new BattleCinematicController();
  controller.receive({battle:packet,exerciseId:2,bestCombo:10,settings:defaultCinematicSettings,enabled:true},1000);
  expect(controller.frame(999999).phase).toBe('holding');expect(controller.playback?.story).toEqual(story);
  expect(controller.playback?.stats.bestCombo).toBe(result==='timeout'?10:22);
  controller.receive({battle:{...packet,attemptId:crypto.randomUUID(),status:'ready'},exerciseId:2,bestCombo:22,settings:defaultCinematicSettings,enabled:true},1000000);
  expect(controller.frame(1000000).phase).toBe('hidden');
 }
});
