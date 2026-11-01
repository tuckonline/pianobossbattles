import type { GeneratorSettings } from "../src/domains/music-generator/types";
import { availableLessonFocuses, lessonFocuses, type LessonFocus } from "../src/domains/music-generator/lesson-focus";

import { useEffect, useMemo, useRef, useState } from "react";

import { assembleSession, readPracticeSettings, readSession, recommendPractice, recordSessionResult, stages, starter, type PracticeSession, type SessionRecord } from "../src/domains/music-generator/practice-session";

import { generateClassicalExercise } from "../src/domains/music-generator/classical-generator";

import { learningSteps } from "../src/domains/music-generator/learning-steps";

import { musicalTiers } from "../src/domains/music-generator/difficulty-profiles";

import { FingeringControl, useFingering } from "./fingering-assistance";

import { ClassicalPractice } from "./classical-practice";

import { PracticeGoldContext, usePracticeGold } from "./practice-gold";

import type { EconomySnapshot } from "../src/domains/economy/rewards";

import "./practice-home.css";



export function PracticeHome({userId,difficulty,connected,active,onStart,onHome,accept,lessonSettings}:{userId:string;difficulty:number;lessonSettings?:GeneratorSettings;connected:boolean;active:boolean;onStart:()=>void;onHome:()=>void;accept:(next?:EconomySnapshot)=>void}) {

  const key=`pbb:guided-session:v1:${userId}`,historyKey=`pbb:practice-history:v1:${userId}`;

  const [session,setSession]=useState(()=>{try{return readSession(localStorage.getItem(key));}catch{return null;}});

  const [history,setHistory]=useState<SessionRecord[]>(()=>{try{const value=JSON.parse(localStorage.getItem(historyKey)??"[]");return Array.isArray(value)?value.filter(r=>r?.settings&&Number.isFinite(r.accuracy)&&typeof r.id==="string").slice(-60):[];}catch{return [];}});

  const [settings,setSettings]=useState(()=>{try{return readPracticeSettings(localStorage.getItem(`pbb:practice-settings:v1:${userId}`),difficulty);}catch{return starter(difficulty);}});

  const [minutes,setMinutes]=useState<5|10|15>(10),[focus,setFocus]=useState("current"),[custom,setCustom]=useState(false),[error,setError]=useState("");

  const recommendation=recommendPractice(settings,history), baseSelection=custom?settings:lessonSettings??recommendation.settings;

  const priorIndex=learningSteps.findIndex(s=>s.id===baseSelection.learningStep)-1;

  const prior=priorIndex>=0?learningSteps[priorIndex]:undefined;

  const selected=focus==="familiar"&&prior?{...baseSelection,difficulty:prior.difficulty,learningStep:prior.id}:baseSelection;

  const [chosenLesson,setChosenLesson]=useState<LessonFocus>();

  const availableLessons=availableLessonFocuses(selected);

  const lessonId=chosenLesson&&availableLessons.includes(chosenLesson)?chosenLesson:availableLessons[0];

  const lesson=lessonFocuses[lessonId];

  const fingers=useFingering(selected.difficulty);

  useEffect(()=>{try{if(session)localStorage.setItem(key,JSON.stringify(session));localStorage.setItem(historyKey,JSON.stringify(history));}catch{setError("Session checkpoint could not save. Keep this page open to retain your place.");}},[session,history,key,historyKey]);

  const start=()=>{

    try{

      let base=selected;

      base={...base,seed:history.length?(history.at(-1)!.settings.seed+104729)>>>0:base.seed};

      const next=assembleSession(base,minutes,crypto.randomUUID(),new Date().toISOString(),lessonId);

      next.tasks.forEach(task=>generateClassicalExercise(task.settings));

      localStorage.setItem(`pbb:practice-settings:v1:${userId}`,JSON.stringify(base));

      setSettings(base);setSession(next);setError("");onStart();

    }catch(e){setError(`Could not prepare this session: ${(e as Error).message}`);}

  };

  if(active&&session)return <GuidedSession key={session.id} session={session} userId={userId} connected={connected} accept={accept} error={error} onHome={onHome}

    update={next=>{setSession(next);const latest=next.results.at(-1);if(latest)setHistory(old=>old.some(r=>r.id===latest.id)?old:[...old,latest].slice(-60));}}/>;

  const step=learningSteps.find(s=>s.id===selected.learningStep);

  return <section className="practice-home" aria-label="Practice home">

    <header><span className="realm-eyebrow">YOUR DAILY PRACTICE</span><h1>A clear next step at the piano.</h1><p>Connect your piano, settle in, and build confidence one phrase at a time.</p></header>

    <article className="practice-primary"><span className="realm-eyebrow">TODAY’S PRACTICE</span><h2>{step?.name.replace(/^\d+ · /,"") ?? "Classical reading & musical phrases"}</h2>

      <p>{musicalTiers[selected.difficulty-1].name}{step?` — ${step.name}`:""} · {selected.key} {selected.mode} · {selected.tempoBpm} BPM</p>

      <h3>{lesson.title}</h3><p>{lesson.objective}</p><p>{minutes}-minute target · Fingering: {fingers.level}</p><p>{step?.change ?? "Read related melodic ideas and follow their cadences."}</p>

      <p>{custom?"This plan follows your customized settings.":lessonSettings?"This session reinforces your current Foundations lesson.":recommendation.reason}</p>

      <button className="primary" onClick={start}>Start Practice</button>

      {session&&!session.complete&&<button onClick={onStart}>Resume Practice · {stages[session.tasks[session.index].stage].name}</button>}{session?.complete&&<button onClick={onStart}>View Last Session</button>}

      <details onToggle={e=>{if(e.currentTarget.open)setCustom(true);}}><summary>Customize</summary>

        <label>Session length<select aria-label="Session length" value={minutes} onChange={e=>setMinutes(+e.target.value as 5|10|15)}>{[5,10,15].map(n=><option key={n} value={n}>{n} minutes</option>)}</select></label>

        <label>Practice difficulty<select aria-label="Practice difficulty" value={settings.difficulty} onChange={e=>setSettings(starter(+e.target.value))}>{musicalTiers.map((tier,i)=><option key={tier.name} value={i+1}>{tier.name}</option>)}</select></label>

        {settings.difficulty<=2&&<label>Learning step<select aria-label="Learning step" value={settings.learningStep??""} onChange={e=>{const step=learningSteps.find(s=>s.id===e.target.value);setSettings({...settings,learningStep:step?.id,tempoBpm:step?.tempo??settings.tempoBpm});}}>{learningSteps.filter(s=>s.difficulty===settings.difficulty).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}<option value="">Original tier profile</option></select></label>}

        <label>Practice focus<select aria-label="Practice focus" value={focus} onChange={e=>setFocus(e.target.value)}><option value="current">Current reading step</option><option value="familiar">Familiar reading — reinforce previous step where available</option></select></label>

        <label>Lesson objective<select aria-label="Lesson objective" value={lessonId} onChange={e=>setChosenLesson(e.target.value as LessonFocus)}>{availableLessons.map(id=><option key={id} value={id}>{lessonFocuses[id].title}</option>)}</select></label>

        <FingeringControl difficulty={settings.difficulty}/><button onClick={()=>{setCustom(false);setFocus("current");}}>Use recommendation</button>

      </details>

    </article>

    <div className="practice-stages">{stages.map((stage,i)=><article key={stage.name}><strong>{stage.name} · about {minutes*[.2,.5,.3][i]} min</strong><p>{lesson.stages[i]}</p></article>)}</div>

    <section aria-label="Recent practice progress"><h2>Your recent practice</h2>{history.length?<p>{history.length} recorded exercise completions · Latest pitch accuracy: {history.at(-1)!.accuracy}%.</p>:<p>Your first completed practice will appear here. No performance history is assumed.</p>}<p>Timing accuracy is not measured in guided practice. Session targets are estimates; every exercise finishes naturally.</p></section>

    {error&&<p role="alert">{error}</p>}

  </section>;

}

function GuidedSession({session,userId,connected,accept,update,onHome,error}:{session:PracticeSession;userId:string;connected:boolean;accept:(next?:EconomySnapshot)=>void;update:(next:PracticeSession)=>void;onHome:()=>void;error:string}) {

  const gold=usePracticeGold(userId,accept,session.id),task=session.tasks[session.index];

  const cache=useRef(new Map<string,ReturnType<typeof generateClassicalExercise>>());

  const [metronome,setMetronome]=useState(false);

  const exercise=useMemo(()=>{

    const prepare=(settings:typeof task.settings)=>{const key=JSON.stringify(settings);let value=cache.current.get(key);if(!value){value=generateClassicalExercise(settings);cache.current.set(key,value);}return value;};

    try{const value=prepare(task.settings);const next=session.tasks[session.index+1];if(next){try{prepare(next.settings);}catch{/* Report only if the next study is entered. */}}return {value,error:""};}

    catch(e){return {value:undefined,error:(e as Error).message};}

  },[task,session.tasks,session.index]);

  const lesson=session.focus?lessonFocuses[session.focus]:undefined;

  const result=session.results.find(r=>r.id===`${session.id}:${session.index}:${session.attempt}`);

  const change=(next:PracticeSession)=>update({...next,updatedAt:new Date().toISOString()});

  const end=()=>{change({...session,complete:true});void gold.flush();};

  const replay=(slower=false)=>{const tasks=[...session.tasks];if(slower){const tempoBpm=Math.max(40,task.settings.tempoBpm-5);tasks[session.index]={...task,seconds:task.settings.measures*4*60/tempoBpm,settings:{...task.settings,tempoBpm}};}change({...session,tasks,attempt:session.attempt+1});};

  const correct=session.results.reduce((n,r)=>n+r.correct,0),mistakes=session.results.reduce((n,r)=>n+r.mistakes,0);

  if(session.complete)return <section className="practice-home" aria-label="Session summary"><h1>Your practice, complete.</h1>{lesson&&<><h2>{lesson.title}</h2><p>Lesson objective: {lesson.objective}</p><p>Reflect: could you use this habit through the final phrase? Completion does not establish mastery.</p></>}<p>{session.results.length} exercises completed · {session.results.length?`${correct+mistakes?Math.round(correct/(correct+mistakes)*100):0}% pitch accuracy`:"Pitch accuracy not yet available"}</p>

    <p>{Math.floor(gold.confirmed.activeMs/1000)} seconds of server-confirmed eligible active practice · {gold.confirmed.earned} gold earned</p>

    <p>Skills practiced: {[...new Set(session.results.map(r=>learningSteps.find(s=>s.id===r.settings.learningStep)?.name ?? "Classical phrase reading"))].join(", ")||"No completed studies yet"}.</p>

    <p>Next: {recommendPractice(task.settings,session.results).reason}</p><p>Rewards continue through the existing practice ledger; completing a session adds no extra payout.</p>

    {gold.pendingMs>0&&<p role="status">Some active practice time is still waiting to save. Confirmed totals will update after saving.</p>}{gold.error&&<p role="status">{gold.error}</p>}<button onClick={()=>void gold.flush()}>Refresh saved practice</button><button className="primary" onClick={onHome}>Return Home / Start Another Session</button>

  </section>;

  return <PracticeGoldContext.Provider value={gold.record}><section className="guided-practice" aria-label="Guided practice session">

    <header><span className="realm-eyebrow">{stages[task.stage].name} · Exercise {session.index+1} of {session.tasks.length}</span><h1>{lesson?.stages[task.stage]??stages[task.stage].objective}</h1>{lesson&&<p>Lesson: {lesson.title}</p>}<p>{session.minutes}-minute target; continue at your pace. Reload resumes this exercise from its beginning.</p><progress aria-label="Session progress" value={session.index+(result?1:0)} max={session.tasks.length}/></header>

    {error&&<p role="alert">{error}</p>}{gold.error&&<p role="status">{gold.error}</p>}

    {exercise.value?<ClassicalPractice key={`${session.index}:${session.attempt}`} piece={exercise.value} pieceDifficulty={task.settings.difficulty} guided connected={connected} onClose={end}

      metronome={metronome} onMetronomeChange={setMetronome} completedResult={result} onRepeat={()=>replay()} onSlower={()=>replay(true)}

      onContinue={()=>session.index+1===session.tasks.length?end():change({...session,index:session.index+1,attempt:0})}

      preparation={lesson&&task.stage===1?<aside aria-label="Lesson explanation"><strong>Before you play</strong><p>{lesson.explanation}</p></aside>:undefined}

      onComplete={result=>{update(recordSessionResult(session,result,new Date().toISOString()));void gold.flush();}}/>:<p role="alert">{exercise.error} <button onClick={end}>End Session</button></p>}

  </section></PracticeGoldContext.Provider>;

}





