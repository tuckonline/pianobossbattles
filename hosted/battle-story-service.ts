import type {D1Platform} from './service';
import {DomainError} from '../src/domains/auth/permissions';
import {evaluateGame,replayEvents} from './game-core';
import {practicePass,type Exercise} from './sight-library';
import {storyChallengeKey,type StoryReceipt,type StoryRecord,type StoryResult} from './battle-story';

export async function readStoryRecords(p:D1Platform,user:string):Promise<StoryRecord[]>{
  const rows=await p.all<{challengeKey:string;lastResult:string;bestResult:string}>(
    'SELECT challenge_key,last_result,best_result FROM battle_story_records WHERE user_id=?',user);
  return rows.map(r=>({key:r.challengeKey,last:JSON.parse(r.lastResult),best:JSON.parse(r.bestResult)}));
}
export async function saveStoryRecord(p:D1Platform,user:string,c:StoryReceipt){
  if(c.expectedUserId!==user)throw new DomainError('Your signed-in account changed. Reopen the original account to save this battle.',401);
  if(await p.one('SELECT attempt_id FROM battle_story_attempts WHERE user_id=? AND attempt_id=?',user,c.result.attemptId))return readStoryRecords(p,user);
  if(c.passes[0].id!==c.result.attemptId||new Set(c.passes.map(x=>x.id)).size!==c.passes.length)throw new DomainError('Invalid battle receipts');
  const plan=c.challenge.exercises.flatMap((e,index)=>Array.from({length:e.loops},(_,pass)=>({...e,index,pass})));
  if(c.passes.length>plan.length)throw new DomainError('Too many battle passes');
  let correct=0,mistakes=0,bestCombo=0,combo=0,completed=0,session='';
  for(let i=0;i<c.passes.length;i++){
    const receipt=c.passes[i],entry=plan[i];
    const saved=await p.one<{sessionId:string;exerciseNumber:number;conditionKey:string;played:string}>(
      'SELECT session_id,exercise_number,condition_key,played FROM game_attempts WHERE user_id=? AND id=?',user,receipt.id);
    if(!saved)throw new DomainError('Waiting for scored notes to save',409);
    if(i===0)session=saved.sessionId;
    if(saved.sessionId!==session||saved.exerciseNumber!==entry.number)throw new DomainError('Battle receipt configuration mismatch');
    const exercise=await p.command({id:user} as Parameters<D1Platform['command']>[0],{action:'practiceExercise',exerciseNumber:entry.number}) as Exercise;
    const omit=exercise.collection==='schmitt-op16'&&entry.pass<entry.loops-1;
    // Same condition format as syncGame; do not accept the other hand or cadence.
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(practicePass(exercise,omit)))))).map(x=>x.toString(16).padStart(2,'0')).join('');
    const expected=`v1:${entry.number}:${c.challenge.hand}:${Number(omit)}:${hash}`;
    if(saved.conditionKey!==expected)throw new DomainError('Battle receipt hands or loops mismatch');
    const played:number[]=JSON.parse(saved.played);
    if(played.length<receipt.notes)throw new DomainError('Waiting for battle note checkpoint',409);
    const r=evaluateGame(practicePass(exercise,omit),c.challenge.hand,played.slice(0,receipt.notes),{playerId:user,sessionId:session,attemptId:receipt.id,timestamp:0});
    if(i<c.passes.length-1&&!r.complete)throw new DomainError('Incomplete earlier pass');
    correct+=r.correct;mistakes+=r.incorrect;
    const streak=replayEvents(r.events,combo);combo=streak.combo;bestCombo=Math.max(bestCombo,streak.best);
    if(r.complete&&entry.pass===entry.loops-1)completed++;
  }
  // Authoritative battle terminal counters may stop within a chord. The frozen
  // prefix must agree with saved evaluation, never trust arbitrary score totals.
  if(correct!==c.result.correct||mistakes!==c.result.mistakes||completed!==c.result.completed)
    throw new DomainError('Battle summary does not match saved notes');
  if(c.result.result==='victory'&&completed!==c.challenge.exercises.length)throw new DomainError('Victory requires completing the challenge');
  const result:StoryResult={...c.result,total:c.challenge.exercises.length,correct,mistakes,completed,bestCombo,accuracy:correct+mistakes?100*correct/(correct+mistakes):0};
  const key=storyChallengeKey(c.challenge),json=JSON.stringify(result);
  try{
    await p.atomic('NOT EXISTS(SELECT 1 FROM battle_story_attempts WHERE user_id=? AND attempt_id=?)',[user,result.attemptId],[
      p.stmt('INSERT INTO battle_story_attempts(user_id,attempt_id,challenge_key,challenge,result) VALUES(?,?,?,?,?)',user,result.attemptId,key,JSON.stringify(c.challenge),json),
      p.stmt(`INSERT INTO battle_story_records(user_id,challenge_key,last_result,best_result) VALUES(?,?,?,?)
        ON CONFLICT(user_id,challenge_key) DO UPDATE SET
        last_result=CASE WHEN json_extract(excluded.last_result,'$.finishedAt')>json_extract(last_result,'$.finishedAt') THEN excluded.last_result ELSE last_result END,
        best_result=CASE WHEN json_extract(excluded.best_result,'$.correct')>json_extract(best_result,'$.correct') THEN excluded.best_result ELSE best_result END`,user,key,json,json),
    ]);
  }catch(error){if(!await p.one('SELECT attempt_id FROM battle_story_attempts WHERE user_id=? AND attempt_id=?',user,result.attemptId))throw error;}
  return readStoryRecords(p,user);
}
