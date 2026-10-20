import {z} from 'zod';
import {battleViewSchema} from './boss-schema';
import {battleView,type BattleState,type BattleView} from './boss-battle';
import type {GameEvent} from './game-core';
import {BattleAnimationDirector} from './battle-animation-director';

const evaluated=z.object({id:z.string().max(200),sequence:z.number().int().nonnegative(),
  outcome:z.enum(['correct','incorrect','missed','unscored']),occurrence:z.string().max(200).nullable().optional(),
  pitch:z.number().int().min(0).max(127).optional(),groupId:z.string().max(200).optional()});
export const battleTraceSchema=z.object({version:z.literal(1),provenance:z.enum(['captured-evaluator','synthetic']),
  exercise:z.object({number:z.number().int(),title:z.string().max(300)}),
  timing:z.literal('monotonic-arrival'),frames:z.array(z.object({atMs:z.number().min(0).max(1800000),
    combo:z.number().int().nonnegative(),battle:battleViewSchema,events:z.array(evaluated).max(256)})).min(1).max(6000),
  stoppedReason:z.string().max(100)});
export type BattleTrace=z.infer<typeof battleTraceSchema>;
export function parseBattleTrace(text:string):BattleTrace {
  if(text.length>16000000)throw Error('Recording exceeds 16 MB');
  const trace=battleTraceSchema.parse(JSON.parse(text));let previous=-1;
  for(const f of trace.frames){if(f.atMs<previous)throw Error('Recording timestamps are not ordered');previous=f.atMs;}
  return trace;
}

// Opt-in, in-memory capture at the existing evaluator boundary. No raw MIDI
// subscription, player identity, progression writes, or automatic uploads.
export class BattleTraceRecorder {
  armed=false;recording=false;trace?:BattleTrace;
  private origin=0;private seen=new Set<string>();private revision=0;
  constructor(private clock=()=>performance.now()){}
  arm(){this.armed=true;this.recording=false;this.trace=undefined;this.seen.clear();}
  start(exercise:{number:number;title:string},state:BattleState,combo:number){
    if(this.recording&&state.attemptId!==this.trace?.frames[0]?.battle.attemptId)this.stop('New exercise started');
    if(!this.armed)return;this.armed=false;this.recording=true;this.origin=this.clock();this.revision=0;
    this.trace={version:1,provenance:'captured-evaluator',exercise,timing:'monotonic-arrival',frames:[],stoppedReason:'recording'};
    this.push(state,combo,[]);
  }
  capture(state:BattleState,combo:number,events:GameEvent[]=[]){
    if(!this.recording||!this.trace)return;
    const fresh=events.filter(e=>e.type==='note.evaluated'&&!this.seen.has(e.id));
    for(const e of fresh)this.seen.add(e.id);
    // Store only new evaluations and newly accepted combat cues. The evaluator
    // can re-emit the entire attempt on each update; those are not new notes.
    try{this.push(state,combo,fresh.map(e=>({id:e.id,sequence:e.sequence,outcome:e.payload.outcome??'unscored',
      occurrence:e.payload.occurrence,pitch:e.payload.pitch,groupId:e.payload.groupId})));}
    catch{this.stop('Capture failed — practice continues');return;}
    if(this.trace.frames.length>=6000||this.clock()-this.origin>=1800000)this.stop('Recording limit reached');
  }
  private push(state:BattleState,combo:number,events:BattleTrace['frames'][number]['events']){
    const view=battleView(state),cues=view.combatCues?.filter(c=>c.revision>this.revision)??[];
    this.trace!.frames.push({atMs:this.clock()-this.origin,combo,battle:{...view,noteAttacks:[],combatCues:structuredClone(cues)},events});this.revision=state.revision;
  }
  stop(reason='Stopped by player'){this.recording=false;this.armed=false;if(this.trace)this.trace.stoppedReason=reason;return this.trace;}
}
export const battleRecorder=new BattleTraceRecorder();

// Rebase wall-clock cue timestamps onto recorded monotonic arrivals so replay
// remains valid days later, across machines, and at a deterministic test clock.
export function replayFrame(frame:BattleTrace['frames'][number],epoch:number):BattleView {
  const at=epoch+frame.atMs,b=frame.battle,delta=at-b.lastAt;
  const rebase=(r:NonNullable<BattleView['round']>)=>({...r,startedAt:r.startedAt+delta,endedAt:r.endedAt===undefined?undefined:r.endedAt+delta});
  return {...b,lastAt:at,round:b.round?rebase(b.round):undefined,recentRounds:b.recentRounds?.map(rebase),combatCues:b.combatCues?.map(c=>({...c,at,note:c.note?{...c.note,firstAt:at,lastAt:at,readyAt:at}:undefined}))};
}
export function measureBattleTrace(trace:BattleTrace){
  const epoch=10000,first=trace.frames[0];
  const d=new BattleAnimationDirector(replayFrame(first,epoch),first.combo,epoch,()=>.25);
  let i=1,accepted=0,evaluatedCount=0,prior=first.battle.revision;
  const end=Math.ceil(trace.frames.at(-1)!.atMs)+5000;
  for(let t=0;t<=end;t++){
    while(i<trace.frames.length&&trace.frames[i].atMs<=t){const f=trace.frames[i++];
      evaluatedCount+=f.events.length;accepted+=Math.max(0,f.battle.revision-prior);prior=f.battle.revision;
      d.receive(replayFrame(f,epoch),f.combo,epoch+f.atMs);}
    d.tick(epoch+t);
  }
  return {provenance:trace.provenance,evaluatedCount,authoritativeDamageEvents:accepted,...d.diagnostics(epoch+end)};
}
