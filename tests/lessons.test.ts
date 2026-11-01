import {referenceEvents,performanceEnd} from "../src/domains/realms/performance";
import {lessonScore} from "../src/domains/curriculum/performance";
import {activityPassed,curriculum} from "../src/domains/curriculum/catalog";
import {it,expect,afterAll} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import type {Pool} from 'pg';
import {lessons,levels,available,completed,emptyLessons} from '../src/domains/curriculum/catalog';
import {lessonCommand} from '../public-app/lesson-service';
import {realmCommand} from '../public-app/realm-service';
import {musicXml,noteGroups,assessPractice} from '../hosted/sight-library';
import {validatePositionFingering} from '../src/domains/music-generator/hand-positions';
const db=new PGlite();const pool={connect:async()=>({query:db.query.bind(db),release:()=>{}})} as unknown as Pool;
afterAll(()=>db.close());
it('provides valid Foundations and Beginner lessons with pitch-specific criteria',()=>{
 expect(levels).toHaveLength(6);expect(lessons).toHaveLength(22);
 expect(available(lessons[0],emptyLessons())).toBe(true);expect(available(lessons[1],emptyLessons())).toBe(true);
 for(const lesson of lessons)for(const a of lesson.activities){validatePositionFingering(a.exercise);expect(musicXml(a.exercise)).toContain('score-partwise');for(const bar of a.exercise.right)expect(bar.reduce((s,n)=>s+n.beats,0)).toBe(4);const pitches=noteGroups(a.exercise,a.exercise.singleHand??'both').flatMap(g=>g.pitches);expect(assessPractice(a.exercise,a.exercise.singleHand??'both',pitches)).toMatchObject({complete:true,accuracy:100});}
 expect(new Set(lessons[0].activities.flatMap(a=>a.exercise.right.flat().map(n=>n.pitch)))).toEqual(new Set([60]));
 expect(new Set(lessons[2].activities.flatMap(a=>a.exercise.right.flat().map(n=>n.pitch)))).toEqual(new Set([60,62,64]));
});
it('persists all lessons, prerequisites and idempotent evidence without awarding gold',async()=>{
 await db.exec('CREATE TABLE game_events(user_id text,id text,session_id text,sequence int,event text,PRIMARY KEY(user_id,id));');
 const command=(body:Record<string,unknown>)=>lessonCommand(pool,'learner',{expectedUserId:'learner',...body});
 expect((await command({action:'visit',lessonId:lessons[1].id})).lastLesson).toBe(lessons[1].id);
 for(const lesson of lessons){await command({action:'visit',lessonId:lesson.id});for(const a of lesson.activities){const body={action:'finish',lessonId:lesson.id,activityId:a.id,attemptId:crypto.randomUUID(),pitches:noteGroups(a.exercise,a.exercise.singleHand??'both').flatMap(g=>g.pitches),...(a.rhythm!==undefined?{events:referenceEvents(lessonScore(a.exercise)),elapsedMs:performanceEnd(lessonScore(a.exercise)),tempo:a.exercise.tempoBpm}: {})};await command(body);const state=await command(body);expect(state.records[`${lesson.id}:${a.id}`].attempts).toBe(1);}expect(completed(lesson,await command({action:'state'}))).toBe(true);}
 const state=await command({action:'state'});expect(state.lastLesson).toBe('beginner-graduation-v1');expect(Object.keys(state.records)).toHaveLength(82);
 expect((await db.query("SELECT * FROM game_events WHERE session_id='economy:v1'")).rows).toHaveLength(0);
});
it('rejects stale Adventure reward commands before touching storage',async()=>{
 await expect(realmCommand(pool,'learner',{action:'begin',expectedUserId:'learner',attemptId:crypto.randomUUID(),config:{version:1,challengeId:'steady-pulse',seed:1,key:'C',tempo:50}})).rejects.toThrow('retired');
});

it('organizes four units and validates the actual beginner skill content',()=>{
 const course=curriculum.levels[1];expect(course.units).toHaveLength(4);for(const unit of course.units)expect(unit.lessonIds).toHaveLength(4);
 const lesson=(suffix:string)=>lessons.find(l=>l.id===`beginner-${suffix}-v1`)!;
 expect(lesson('bass-explorer').activities.every(a=>a.exercise.singleHand==='left')).toBe(true);
 const intervals=lesson('intervals').activities[0].exercise.right.map(bar=>bar[1].pitch-bar[0].pitch);expect(intervals).toEqual([2,4,5,7]);
 expect(lesson('new-positions').activities[1].exercise.right.flat().some(n=>n.pitch===70&&n.finger===4)).toBe(true);
 expect(lesson('triads').activities.slice(0,3).map(a=>a.exercise.right[0].map(n=>n.pitch))).toEqual([[60,64,67],[65,69,72],[67,71,74]]);
 for(const id of ['rhythm-check','graduation']){const a=lesson(id).activities.at(-1)!;const beats=new Set(a.exercise.right.flat().map(n=>n.beats));for(const beat of [.5,1,2])expect(beats.has(beat)).toBe(true);expect(a.rhythm).toBe(70);}
 const study=lesson('classical-study');expect(study.activities[2].exercise.right).toHaveLength(16);expect(study.activities[2].exercise).toEqual(study.activities[3].exercise);
 expect(lesson('graduation').activities[2].exercise.right).not.toEqual(lesson('graduation').activities[3].exercise.right);
 expect(lesson('articulation').activities[1].exercise.notationXml).toContain('<staccato/>');expect(lesson('articulation').activities[0].exercise.notationXml).toContain('<slur type="start"');
 expect(activityPassed(lesson('graduation').activities[3],{accuracy:100,rhythm:100,correct:20,attempts:2,mastered:false})).toBe(false);
});

it('does not accept pitch-only evidence for a timed graduation check',async()=>{
 const state=await lessonCommand(pool,'learner',{action:'state',expectedUserId:'learner'});
 const id='beginner-graduation-v1';delete state.records[`${id}:master`];
 await db.query("INSERT INTO game_events(user_id,id,session_id,sequence,event) VALUES('timed-learner','lessons:progress:v1','lessons:v1',0,$1)",[JSON.stringify(state)]);
 await expect(lessonCommand(pool,'timed-learner',{action:'finish',expectedUserId:'timed-learner',lessonId:id,activityId:'master',attemptId:crypto.randomUUID(),pitches:[]})).rejects.toThrow('Timed MIDI evidence');
 const a=lessons.find(l=>l.id===id)!.activities[3],score=lessonScore(a.exercise,40);
 const saved=await lessonCommand(pool,'timed-learner',{action:'finish',expectedUserId:'timed-learner',lessonId:id,activityId:'master',attemptId:crypto.randomUUID(),tempo:40,events:referenceEvents(score),elapsedMs:performanceEnd(score)});
 expect(saved.records[`${id}:master`]).toMatchObject({accuracy:100,rhythm:100,mastered:true});
});
