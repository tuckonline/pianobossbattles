import { availableLessonFocuses, lessonFocuses, supportsLesson, type LessonFocus } from "./lesson-focus";
import { generateClassicalExercise, validateSettings } from "./classical-generator";
import { learningSteps } from "./learning-steps";
import { musicalTiers } from "./difficulty-profiles";
import { supportsNovicePosition } from "./hand-positions";
import type { GeneratorSettings } from "./types";
export type PracticeResult = { accuracy:number; correct:number; mistakes:number };
export type SessionTask = { stage:0|1|2; settings:GeneratorSettings; seconds:number };
export type SessionRecord = PracticeResult & { id:string; task:number; at:string; settings:GeneratorSettings };
export type PracticeSession = {version:1;focus?:LessonFocus;id:string;minutes:5|10|15;tasks:SessionTask[];index:number;attempt:number;results:SessionRecord[];startedAt:string;updatedAt:string;complete:boolean};
export const stages=[{name:"Warm-up",objective:"Settle into familiar notes and a comfortable pulse."},{name:"Focused practice",objective:"Reinforce your selected reading step with short studies."},{name:"Musical application",objective:"Connect the skill to a longer phrase with motifs and cadences."}] as const;
export function starter(difficulty=1):GeneratorSettings {
  const tier=Math.max(1,Math.min(5,Math.trunc(difficulty)||1)),step=learningSteps.find(s=>s.difficulty===tier);
  return {difficulty:tier,key:"C",mode:"major",tempoBpm:step?.tempo??musicalTiers[tier-1].tempo,measures:8,hands:"both",seed:1,curriculumVersion:2,positionVersion:1,compositionVersion:2,learningStep:step?.id};
}
export function readPracticeSettings(raw:string|null,difficulty=1):GeneratorSettings {
  try {const settings=JSON.parse(raw??"null") as GeneratorSettings;if(!settings)return starter(difficulty);validateSettings(settings);
    if((settings.difficulty===1||settings.learningStep)&&!supportsNovicePosition(settings.key,settings.mode))return starter(difficulty);
    return settings;
  }catch{return starter(difficulty);}
}
export function recommendPractice(settings:GeneratorSettings,history:SessionRecord[]) {
  const recent=history.filter(r=>r.settings.difficulty===settings.difficulty&&r.settings.learningStep===settings.learningStep).slice(-3);
  const index=learningSteps.findIndex(s=>s.id===settings.learningStep);
  if(recent.length===3&&recent.every(r=>r.accuracy<70)&&index>0){const prior=learningSteps[index-1];return {settings:{...settings,difficulty:prior.difficulty,learningStep:prior.id},reason:"Your last three comparable studies had lower pitch accuracy. Revisit one familiar step at your current tempo."};}
  if(recent.length===3&&recent.every(r=>r.accuracy>=95)&&index>=0&&index<learningSteps.length-1){const next=learningSteps[index+1];return {settings:{...settings,difficulty:next.difficulty,learningStep:next.id},reason:"Your last three comparable studies reached at least 95% pitch accuracy. Try one new musical demand at the same tempo."};}
  return {settings,reason:recent.length<3?"There is not enough comparable practice history yet. This plan uses your selected level and a gentle warm-up.":"Keep reinforcing your current reading step. Timing accuracy is not measured in this practice mode."};
}
export function assembleSession(settings:GeneratorSettings,minutes:5|10|15,id:string,now:string,focus:LessonFocus=availableLessonFocuses(settings)[0]):PracticeSession {
  validateSettings(settings);
  if(!availableLessonFocuses(settings).includes(focus))throw Error("This lesson focus is not supported at the selected step.");
  const tasks:SessionTask[]=[];
  for(const stage of [0,1,2] as const){const measures=stage===2?16:8,tempoBpm=stage===0?Math.max(40,settings.tempoBpm-5):settings.tempoBpm;
    const seconds=measures*4*60/tempoBpm;
    const count=Math.max(1,Math.round(minutes*60*[.2,.5,.3][stage]/(seconds+10)));
    for(let n=0;n<count;n++)tasks.push({stage,seconds,settings:{...settings,measures,tempoBpm,compositionVersion:2,seed:(settings.seed+tasks.length*7919)>>>0}});
  }
  for(const task of tasks)if(!supportsLesson(generateClassicalExercise(task.settings),focus))throw Error("The generated study does not support this lesson objective. Choose another seed or focus.");
  return {version:1,focus,id,minutes,tasks,index:0,attempt:0,results:[],startedAt:now,updatedAt:now,complete:false};
}
export function recordSessionResult(session:PracticeSession,result:PracticeResult,now:string):PracticeSession {
  const id=`${session.id}:${session.index}:${session.attempt}`;
  if(session.complete||session.results.some(r=>r.id===id))return session;
  return {...session,updatedAt:now,results:[...session.results,{...result,id,task:session.index,at:now,settings:session.tasks[session.index].settings}]};
}
export function readSession(raw:string|null):PracticeSession|null {
  try {const s=JSON.parse(raw??"null") as PracticeSession;if(!s||s.version!==1||typeof s.id!=="string"||![5,10,15].includes(s.minutes)||!Array.isArray(s.tasks)||!s.tasks.length||s.tasks.length>100||!Number.isInteger(s.index)||s.index<0||s.index>=s.tasks.length||!Number.isInteger(s.attempt)||s.attempt<0||!Array.isArray(s.results)||typeof s.complete!=="boolean")return null;
    if(s.focus!==undefined&&!Object.hasOwn(lessonFocuses,s.focus))return null;
    s.tasks.forEach(t=>{validateSettings(t.settings);if(![0,1,2].includes(t.stage)||!Number.isFinite(t.seconds)||t.seconds<=0)throw Error();});
    s.results.forEach(r=>validateSettings(r.settings));
    if(s.results.some(r=>typeof r.id!=="string"||!Number.isFinite(r.accuracy)||r.accuracy<0||r.accuracy>100||!Number.isFinite(r.correct)||!Number.isFinite(r.mistakes)||r.correct<0||r.mistakes<0))return null;
    return s;
  }catch{return null;}
}
