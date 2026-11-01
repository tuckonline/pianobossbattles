import type { Finger } from "../hosted/sight-library";
import {expect,it} from 'vitest';
import {assembleSession,readSession,recordSessionResult,recommendPractice,starter,readPracticeSettings} from '../src/domains/music-generator/practice-session';
import {generateClassicalExercise} from '../src/domains/music-generator/classical-generator';
it('plans valid warm-up/focus/application within a flexible target',()=>{
 for(const difficulty of [1,2,3,5]){const settings=starter(difficulty),s=assembleSession(settings,10,'test','now');
 expect([...new Set(s.tasks.map(t=>t.stage))]).toEqual([0,1,2]);
 expect(s.tasks.reduce((n,t)=>n+t.seconds+10,0)).toBeGreaterThan(480);
 expect(s.tasks.reduce((n,t)=>n+t.seconds+10,0)).toBeLessThan(720);
 for(const task of s.tasks){const ex=generateClassicalExercise(task.settings);expect(ex.durationBeats!*60/ex.tempoBpm!).toBe(task.seconds);expect(task.settings.difficulty).toBe(difficulty);expect(task.settings.learningStep).toBe(settings.learningStep);}
 expect(readSession(JSON.stringify(s))).toEqual(s);
 }
});
it('requires three comparable results and changes one step without increasing tempo',()=>{
 const base=starter(1);base.learningStep='novice-3-v1';base.tempoBpm=54;
 let s=assembleSession(base,5,'test','now');
 s=recordSessionResult(s,{accuracy:99,correct:99,mistakes:1},'now');
 expect(recordSessionResult(s,{accuracy:99,correct:99,mistakes:1},'now')).toBe(s);
 expect(recommendPractice(base,s.results).settings).toEqual(base);
 const history=[0,1,2].map(n=>({...s.results[0],id:String(n)}));
 expect(recommendPractice(base,history).settings).toMatchObject({learningStep:'beginner-1-v1',tempoBpm:54});
 expect(recommendPractice(base,history.map(r=>({...r,accuracy:50}))).settings).toMatchObject({learningStep:'novice-2-v1',tempoBpm:54});
 expect(readPracticeSettings(JSON.stringify(base))).toEqual(base);expect(readSession('broken')).toBeNull();
});
import { availableLessonFocuses, supportsLesson } from '../src/domains/music-generator/lesson-focus';
it('keeps one verified lesson through all stages and deterministic resume',()=>{
 for(const seed of [1,27])for(const step of ['novice-1-v1','novice-3-v1','beginner-2-v1','beginner-3-v1']){
  const settings={...starter(step.startsWith('novice')?1:2),learningStep:step,seed};
  for(const focus of availableLessonFocuses(settings)){
   const session=assembleSession(settings,5,'lesson','now',focus);
   expect(assembleSession(settings,5,'lesson','now',focus)).toEqual(session);
   expect(readSession(JSON.stringify(session))).toEqual(session);
   expect(session.focus).toBe(focus);
   expect(new Set(session.tasks.map(t=>t.stage)).size).toBe(3);
   for(const task of session.tasks){
    const exercise=generateClassicalExercise(task.settings);
    expect(supportsLesson(exercise,focus)).toBe(true);
    expect(task.settings.learningStep).toBe(step);
    const melody=exercise.right.flat().filter(n=>!n.rest);
    expect(new Set(melody.map(n=>n.pitch)).size).toBeGreaterThan(1);
    expect(exercise.generated.harmony.at(-1)?.cadence).toBe('authentic');
    if(focus==='steady-pulse')for(const bar of [...exercise.right,...exercise.left]){
     expect(bar.reduce((n,note)=>n+note.beats,0)).toBe(4);
     expect(bar.every(n=>[1,2,4].includes(n.beats)&&!n.tie)).toBe(true);
    }
    for(const hand of ['right','left'] as const)for(const note of exercise[hand].flat().filter(n=>!n.rest))
     expect(exercise.handPositions?.[hand]?.fingerPitches[note.finger as Finger]).toBe(note.pitch);
   }
  }
 }
});
it('excludes unsupported objectives without rewriting old checkpoints',()=>{
 const settings={...starter(2),learningStep:'beginner-3-v1'};
 expect(availableLessonFocuses(settings)).toEqual(['note-recognition']);
 expect(()=>assembleSession(settings,5,'lesson','now','steady-pulse')).toThrow('not supported');
 const old=assembleSession(starter(),5,'old','now');delete old.focus;
 expect(readSession(JSON.stringify(old))).toEqual(old);
 expect(readSession(JSON.stringify({...old,focus:'invented'}))).toBeNull();
});

