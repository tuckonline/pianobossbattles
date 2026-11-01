import {midiEventSchema} from "../src/domains/blocks/schema";
import {summarize,performanceEnd} from "../src/domains/realms/performance";
import {lessonScore,lessonChallenge} from "../src/domains/curriculum/performance";
import type {Pool} from 'pg';
import {z} from 'zod';
import {DomainError} from '../src/domains/auth/permissions';
import {lessons,available,activityPassed,emptyLessons,type LessonProgress} from '../src/domains/curriculum/catalog';
import {assessPractice} from '../hosted/sight-library';
const schema=z.object({expectedUserId:z.string(),action:z.enum(['state','visit','finish']),lessonId:z.string().optional(),activityId:z.string().optional(),attemptId:z.uuid().optional(),events:z.array(midiEventSchema).max(12000).optional(),elapsedMs:z.number().finite().min(0).max(3600000).optional(),tempo:z.number().min(40).max(160).optional(),pitches:z.array(z.number().int().min(0).max(127)).max(2048).optional()});
export async function lessonCommand(pool:Pool,userId:string,input:unknown){
 const c=schema.parse(input);if(c.expectedUserId!==userId)throw new DomainError('Account changed.',409);
 const db=await pool.connect();try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[userId]);
 const rows=await db.query('SELECT event FROM game_events WHERE user_id=$1 AND id=$2',[userId,'lessons:progress:v1']);
 const state:LessonProgress=rows.rows[0]?JSON.parse(rows.rows[0].event):emptyLessons();
 if(c.action!=='state'){
 const lesson=lessons.find(l=>l.id===c.lessonId);if(!lesson||!available(lesson,state))throw new DomainError('Complete the prerequisite lesson first.',409);
 state.lastLesson=lesson.id;
 if(c.action==='finish'){
 const activity=lesson.activities.find(a=>a.id===c.activityId);if(!activity||!c.attemptId)throw new DomainError('Missing lesson evidence.',400);
 const prior=lesson.activities.slice(0,lesson.activities.indexOf(activity));if(prior.some(a=>!activityPassed(a,state.records[`${lesson.id}:${a.id}`])))throw new DomainError('Complete the earlier activity first.',409);
 let result:{accuracy:number;correct:number;complete:boolean;rhythm?:number};
 if(activity.rhythm!==undefined){
 if(!c.events||c.tempo===undefined||c.elapsedMs===undefined)throw new DomainError('Timed MIDI evidence is required.',400);
 const score=lessonScore(activity.exercise,c.tempo);if(c.elapsedMs<performanceEnd(score))throw new DomainError('Finish the performance first.',400);
 const measured=summarize(score,c.events,lessonChallenge,c.elapsedMs,2);
 result={accuracy:measured.pitch,rhythm:measured.rhythm,correct:measured.feedback.filter(n=>n.status==='correct').length,complete:true};
 }else{if(!c.pitches)throw new DomainError('Pitch evidence is required.',400);result=assessPractice(activity.exercise,activity.exercise.singleHand??'both',c.pitches);}
 if(!result.complete)throw new DomainError('Finish the notes before saving.',400);
 const receipt=`lesson:attempt:${c.attemptId}`;const seen=await db.query('SELECT id FROM game_events WHERE user_id=$1 AND id=$2',[userId,receipt]);
 if(!seen.rows.length){const key=`${lesson.id}:${activity.id}`,old=state.records[key];state.records[key]={accuracy:Math.max(old?.accuracy??0,result.accuracy),correct:result.correct,attempts:(old?.attempts??0)+1,...(result.rhythm!==undefined?{rhythm:Math.max(old?.rhythm??0,result.rhythm)}:{}),mastered:old?.mastered===true||result.accuracy>=activity.accuracy&&(activity.rhythm===undefined||(result.rhythm??0)>=activity.rhythm)};
 await db.query("INSERT INTO game_events(user_id,id,session_id,sequence,event) VALUES($1,$2,'lessons:v1',0,$3)",[userId,receipt,JSON.stringify({lessonId:lesson.id,activityId:activity.id,result})]);}
 }
 await db.query("INSERT INTO game_events(user_id,id,session_id,sequence,event) VALUES($1,'lessons:progress:v1','lessons:v1',0,$2) ON CONFLICT(user_id,id) DO UPDATE SET event=excluded.event",[userId,JSON.stringify(state)]);
 }
 await db.query('COMMIT');return state;
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
