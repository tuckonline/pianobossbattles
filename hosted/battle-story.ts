import {z} from 'zod';
import type {BattleView} from './boss-battle';
import type {BossBattleConfig} from './boss-config';
const count=z.number().int().nonnegative().max(10000000);
export const storyChallengeSchema=z.object({
  version:z.literal(1),boss:z.enum(['crimson_musical_colossus','grinwick']),
  mode:z.enum(['survival','timeAttack','ultimateBoss']),damage:z.number().int().positive().max(100),
  hp:z.number().int().positive().max(10000),hand:z.enum(['both','right','left']),
  bpm:z.number().min(20).max(300),allowance:z.number().min(1).max(3),limit:z.number().nonnegative().max(86400),
  powerThreshold:z.number().int().min(1).max(1000),adaptivePower:z.boolean(),
  progressiveTempo:z.boolean().optional(),
  exercises:z.array(z.object({number:z.number().int().positive().max(1000000),loops:z.number().int().min(1).max(100)})).min(1).max(213),
});
export type StoryChallenge=z.infer<typeof storyChallengeSchema>;
export function storyChallenge(config:BossBattleConfig,hand:StoryChallenge['hand'],exercises:StoryChallenge['exercises']):StoryChallenge{
  return storyChallengeSchema.parse({version:1,boss:config.bossId,mode:config.gameMode,damage:config.bossDamagePerMistake,hp:config.playerMaxHp,hand,
    bpm:config.progressiveTempo&&config.gameMode!=='survival'?60:config.selectedBpm,allowance:config.allowanceMultiplier,limit:config.explicitTimeLimitSeconds,
    powerThreshold:config.powerThreshold,adaptivePower:config.adaptivePower,progressiveTempo:config.progressiveTempo,exercises});
}
// Explicit canonical tuple: order and repeated entries matter; cosmetic settings do not.
export const storyChallengeKey=(c:StoryChallenge)=>JSON.stringify([c.version,c.boss,c.mode,c.damage,c.hp,c.hand,c.bpm,c.allowance,c.limit,c.powerThreshold,c.adaptivePower,c.exercises.map(e=>[e.number,e.loops]),...(c.progressiveTempo&&c.mode!=='survival'?['progressive-tempo-v1']:[])]);
export const storyResultSchema=z.object({
  attemptId:z.string().uuid(),finishedAt:z.number().nonnegative(),result:z.enum(['victory','defeat','timeout','unfinished']),
  correct:count,mistakes:count,bestCombo:count,completed:count,total:count,accuracy:z.number().min(0).max(100),
});
export type StoryResult=z.infer<typeof storyResultSchema>;
export type StoryRecord={key:string;last:StoryResult;best:StoryResult};
export const storyEventSchema=z.object({
  id:z.string().max(100),kind:z.enum(['critical','personalBest','frustration','finalExercise']),
  at:z.number(),until:z.number(),text:z.string().max(100),exerciseId:z.number().int(),revision:count,
  reaction:z.string().max(80).optional(),
});
export type StoryEvent=z.infer<typeof storyEventSchema>;
export const storyViewSchema=z.object({
  attemptId:z.string().max(50),objective:z.string().max(140),rivalry:z.string().max(160).optional(),
  completed:count,total:count,bestCombo:count,priorCorrect:count.optional(),priorCompleted:count.optional(),
  event:storyEventSchema.optional(),summary:storyResultSchema.optional(),
});
export type StoryView=z.infer<typeof storyViewSchema>;
export const storySaveSchema=z.object({
  action:z.literal('battleStorySave'),expectedUserId:z.string().min(1).max(200),
  challenge:storyChallengeSchema,result:storyResultSchema,
  passes:z.array(z.object({id:z.string().uuid(),notes:count})).min(1).max(21300),
});
export type StoryReceipt=z.infer<typeof storySaveSchema>;
export function startStory(attemptId:string,c:StoryChallenge,prior?:StoryRecord):StoryView{
  const total=c.exercises.length,loops=c.exercises.reduce((n,e)=>n+e.loops,0),boss=c.boss==='grinwick'?'GRINWICK':'CRIMSON COLOSSUS';
  const objective=c.mode==='timeAttack'?'FINISH BEFORE TIME RUNS OUT':total>1?`SURVIVE ${total} PIECES`:`DEFEAT ${boss}`;
  const suffix=loops>total?` · ${loops} LOOPS`:'';
  return {attemptId,objective:objective+suffix,completed:0,total,bestCombo:0,
    priorCorrect:prior?.best.correct,priorCompleted:prior?.best.completed,
    rivalry:prior?`LAST ATTEMPT: ${prior.last.completed}/${total} · BEST: ${prior.best.correct} CORRECT NOTES`:undefined};
}
/** Owner-side observer only. No gameplay commands, clocks, rewards or RNG. */
export class BattleStoryDirector {
  view:StoryView;
  private seen=new Set<string>();
  private lastNotice=-Infinity;
  private sequence=-1;
  private phase:BattleView['phase'];
  private previousExercise:number;
  constructor(attemptId:string,private challenge:StoryChallenge,prior?:StoryRecord){
    this.view=startStory(attemptId,challenge,prior);this.previousExercise=challenge.exercises[0].number;
  }
  observe(b:BattleView,input:{exerciseId:number;completed:number;bestCombo:number},now:number):StoryView{
    if(b.attemptId!==this.view.attemptId||this.view.summary||!b.config.enabled)return this.view;
    this.view={...this.view,completed:Math.max(this.view.completed,Math.min(this.view.total,input.completed)),bestCombo:Math.max(this.view.bestCombo,input.bestCombo)};
    if(this.previousExercise!==input.exerciseId){this.previousExercise=input.exerciseId;this.view={...this.view,event:undefined};}
    if(b.status==='victory'||b.status==='defeat'){
      this.view={...this.view,event:undefined};
      if(b.result==='abandoned')return this.view;
      this.view.summary={attemptId:b.attemptId,finishedAt:now,result:b.status==='victory'?'victory':b.result==='timeout'?'timeout':b.result==='unfinished'?'unfinished':'defeat',
        correct:b.correctHits,mistakes:b.mistakes,bestCombo:this.view.bestCombo,completed:this.view.completed,total:this.view.total,
        accuracy:b.correctHits+b.mistakes?100*b.correctHits/(b.correctHits+b.mistakes):0};
      return this.view;
    }
    if(b.status!=='active'||b.countdown&&!b.countdown.releasedAt||b.revision<this.sequence)return this.view;
    this.sequence=b.revision;
    const enrage=b.phase==='enraged'&&this.phase!==b.phase;this.phase=b.phase;
    const candidates:{kind:StoryEvent['kind'];test:boolean;text:string;reaction?:string}[]=[
      {kind:'critical',test:b.config.gameMode!=='timeAttack'&&b.playerHp>0&&b.playerHp/b.config.playerMaxHp<.25,text:'CRITICAL HEALTH'},
      {kind:'finalExercise',test:this.view.total>1&&b.chain?.index===this.view.total,text:'FINAL EXERCISE'},
      {kind:'personalBest',test:this.view.priorCorrect!==undefined&&b.correctHits>this.view.priorCorrect,text:'NEW PERSONAL BEST!'},
      {kind:'frustration',test:this.view.bestCombo>=50,text:b.config.bossId==='grinwick'?'GRINWICK IS LOSING HIS COOL':'COLOSSUS IS FURIOUS',
        reaction:b.config.bossId==='grinwick'?'grinwick_idle_panic_05':'boss_idle_laughter_03'},
    ];
    const eligible=candidates.filter(c=>c.test&&!this.seen.has(c.kind));
    // Consume crossed milestones even when superseded or cooling down. Never
    // replay an old achievement in a later exercise or build a popup backlog.
    eligible.forEach(c=>this.seen.add(c.kind));
    const c=eligible[0];
    // The existing ENRAGED combat warning takes priority over optional story
    // beats. Consume, rather than queue, anything it supersedes in either OBS view.
    if(enrage){
      this.lastNotice=now;
      if(this.view.event?.kind!=='critical')this.view={...this.view,event:undefined};
      if(c?.kind!=='critical')return this.view;
    }
    const criticalVisible=this.view.event?.kind==='critical'&&now<this.view.event.until;
    if(c&&(c.kind==='critical'||c.kind==='finalExercise'&&!criticalVisible||now-this.lastNotice>=12000)){
      this.lastNotice=now;
      this.view={...this.view,event:{id:`${b.attemptId}:story:${c.kind}`,kind:c.kind,at:now,until:now+2600,text:c.text,exerciseId:input.exerciseId,revision:b.revision,reaction:c.reaction}};
    }
    return this.view;
  }
}
export function storySummaryLines(s:StoryView):string[]{
  const r=s.summary;if(!r)return [];
  const lines=[r.total>1?`${r.completed}/${r.total} EXERCISES COMPLETE`:`${r.correct} CORRECT NOTES · ${Math.round(r.accuracy)}% ACCURACY`];
  if(s.priorCorrect!==undefined&&r.correct>s.priorCorrect)lines.push(`NEW PERSONAL BEST: +${r.correct-s.priorCorrect} CORRECT NOTES`);
  else lines.push(`LONGEST COMBO: ${r.bestCombo}`);
  return lines;
}
