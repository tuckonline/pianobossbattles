import {RealmPerformance} from "./realm-performance";
import {lessonScore,lessonChallenge} from "../src/domains/curriculum/performance";
import {useFingering} from "./fingering-assistance";
import {supabase,syncServerSession} from "./supabase";
import {useCallback,useEffect,useMemo,useState} from 'react';
import type {User} from '@supabase/supabase-js';
import {lessons,levels,curriculum,activityPassed,available,completed,nextLesson,emptyLessons,type LessonProgress} from '../src/domains/curriculum/catalog';
import {platformRequest} from '../src/lib/platform-request';
import {ClassicalPractice} from './classical-practice';
import {PracticeHome} from './practice-home';
import {FingeringProvider,FingeringControl} from './fingering-assistance';
import {MidiSetup} from '../src/components/midi/setup';
import {PracticeGoldContext,usePracticeGold} from './practice-gold';
import {PracticeStudio,RoyalMusicShop,useMusicRoom} from './music-room';
import type {PracticeResult} from '../src/domains/music-generator/practice-session';
import './realm.css';
import './practice-home.css';
import './learning-home.css';
export function LearningHome({user}:{user:User}){return <FingeringProvider userId={user.id}><Workspace user={user}/></FingeringProvider>;}
function Workspace({user}:{user:User}){
 const [screen,setScreen]=useState('Home'),[connected,setConnected]=useState(false),[selected,setSelected]=useState<string>(),[piece,setPiece]=useState<string>();
 const [progress,setProgress]=useState<LessonProgress>(emptyLessons),[loaded,setLoaded]=useState(false),[error,setError]=useState('');
 const room=useMusicRoom(user.id),gold=usePracticeGold(user.id,room.accept);
 const request=useCallback(async(body:Record<string,unknown>)=>{const r=await platformRequest({...body,expectedUserId:user.id},'/api/lessons');const data=await r.json();if(!r.ok)throw Error(data.error??'Lesson progress could not save.');setProgress(data);return data as LessonProgress;},[user.id]);
 useEffect(()=>{void request({action:'state'}).then(()=>setLoaded(true)).catch(e=>setError(e.message));},[request]);
 const open=async(id:string)=>{try{await request({action:'visit',lessonId:id});setSelected(id);setScreen('Lessons');setError('');}catch(e){setError((e as Error).message);}};
 const next=nextLesson(progress);
 const practice=(id:string)=>{const lesson=lessons.find(l=>l.id===id)!;if(!lesson.recipe)return;localStorage.setItem(`pbb:practice-settings:v1:${user.id}`,JSON.stringify(lesson.recipe));setSelected(undefined);setScreen('Infinite Practice');};
 const finished=lessons.filter(l=>completed(l,progress)).length;
 const go=(name:string)=>{setSelected(undefined);setScreen(name);};
 const logout=async()=>{await gold.flush();await supabase.auth.signOut();await syncServerSession();};
 const navItems=[['Home','Home','home'],['Lessons','Lessons','book'],['Practice','Practice','piano'],['Music Library','Library','library'],['More','More','more']];
 return <PracticeGoldContext.Provider value={gold.record}><div className="realm-home learning-workspace studio-theme">
 <header className="learning-header"><div className="learning-brand"><h1>Piano Boss Battles</h1><p>Your personal piano studio</p></div><div className="learning-header-controls"><span className="learning-gold" aria-label={`${room.economy?.gold??0} gold balance`}>{room.economy?.gold??0} gold</span><button className="studio-account" aria-label="Account and settings" onClick={()=>go('More')}><StudioIcon name="account"/></button></div>
 <details className="studio-midi"><summary><span className={`connection-dot ${connected?'connected':''}`}/><span>MIDI keyboard · {connected?'Connected':typeof navigator.requestMIDIAccess==='function'?'Not connected':'Unsupported'}</span><span className="studio-midi-action">{connected?'Details':'Connect'}</span></summary><div className="studio-midi-controls"><MidiSetup compact onConnectionChange={setConnected}/><p>Connection details and permission messages appear here.</p></div></details></header>
 <nav className="studio-desktop-nav" aria-label="Primary navigation">{['Home','Lessons','Practice','Music Library','Music Shop','Progress'].map(name=><button key={name} aria-current={screen===name||name==='Practice'&&['session','guided','Infinite Practice'].includes(screen)?'page':undefined} onClick={()=>go(name)}>{name}</button>)}</nav>
 <nav className="studio-mobile-nav" aria-label="Mobile navigation">{navItems.map(([name,label,icon])=><button key={name} aria-current={screen===name||name==='Practice'&&['session','guided','Infinite Practice'].includes(screen)||name==='More'&&['Settings','Music Shop','Progress'].includes(screen)?'page':undefined} onClick={()=>go(name)}><StudioIcon name={icon}/><span>{label}</span></button>)}</nav>
 {error&&<p role="alert">{error} <button onClick={()=>{setError('');void request({action:'state'}).then(()=>setLoaded(true)).catch(e=>setError(e.message));}}>Retry</button></p>}
 {screen==='Home'&&<section className="studio-home" aria-label="Practice home">{!loaded?<p role="status">Loading your next lesson…</p>:<>
 <article className="studio-primary"><span className="studio-eyebrow">{finished<lessons.length?'CONTINUE LEARNING':'YOUR NEXT PRACTICE'}</span><h2>{finished<lessons.length?next.title:'Keep your music growing'}</h2><p className="studio-meta">{levels[(next.level??1)-1].title} · {levels[(next.level??1)-1].units[next.unit??0]}</p><p>{finished<lessons.length?next.objective:'Reinforce your skills with a guided warm-up, focused practice, and a musical study.'}</p><button className="primary" onClick={()=>finished<lessons.length?void open(next.id):go('guided')}>{finished<lessons.length?'Continue Lesson':'Start Practice'}</button><button className="studio-text-button" onClick={()=>go('Infinite Practice')}>Or start free practice →</button></article>
 <section className="studio-progress" aria-label="Learning progress"><div><strong>{finished} of {lessons.length} lessons completed</strong><p>Small steps. Lasting progress.</p></div><progress aria-label="Completed lessons" value={finished} max={lessons.length}/></section>
 <div className="studio-quick"><article><StudioIcon name="piano"/><h3>Practice your way</h3><p>Follow a guided session or create a fresh Classical study.</p><button onClick={()=>go('Practice')}>Explore practice</button></article><article><StudioIcon name="library"/><h3>Your music collection</h3><p>Return to familiar music and pieces you own.</p><button onClick={()=>go('Music Library')}>Open library</button></article></div>
 </>}</section>}
 {screen==='Practice'&&<section className="practice-home"><span className="studio-eyebrow">MAKE TIME FOR MUSIC</span><h1>Choose your practice</h1><div className="studio-quick"><article><h2>Guided Practice</h2><p>A connected warm-up, focused study, and musical application. Resume saved sessions from here.</p><button className="primary" onClick={()=>go('guided')}>Open Guided Practice</button></article><article><h2>Infinite Practice</h2><p>Create a study using your difficulty, key, hand and tempo settings.</p><button onClick={()=>go('Infinite Practice')}>Open Infinite Practice</button></article></div></section>}
 {(screen==='guided'||screen==='session')&&<PracticeHome lessonSettings={loaded?next.recipe:undefined} userId={user.id} difficulty={1} connected={connected} active={screen==='session'} onStart={()=>setScreen('session')} onHome={()=>setScreen('Home')} accept={room.accept}/>}
 {screen==='More'&&<section className="practice-home studio-more"><h1>Your studio</h1><p>{user.email}</p>{['Music Shop','Progress','Settings'].map(name=><button key={name} onClick={()=>go(name)}>{name} →</button>)}<button onClick={()=>void logout()}>Log out</button></section>}
 {screen==='Settings'&&<section className="practice-home"><h1>Practice preferences</h1><FingeringControl difficulty={next.difficulty}/><p>Tempo, key and hands can be adjusted in your practice setup.</p></section>}
 {screen==='Progress'&&<section className="studio-progress"><strong>{finished} lessons completed</strong>{room.economy?.practiceMs!==undefined&&<p>{Math.floor(room.economy.practiceMs/60000)} minutes of recorded eligible active practice</p>}<p>Lesson cards below show recorded personal bests.</p></section>}
 {screen==='Infinite Practice'&&<ClassicalPractice userId={user.id} connected={connected} onClose={()=>setScreen('Home')}/>}
 {screen==='Music Library'&&<PracticeStudio room={room} connected={connected} selectedId={piece} onOpenPiece={setPiece} onClosePiece={()=>setPiece(undefined)} onGenerate={()=>setScreen('Infinite Practice')}/>}
 {screen==='Music Shop'&&<RoyalMusicShop room={room} onPractice={id=>{setPiece(id);setScreen('Music Library');}}/>}
 {(screen==='Lessons'||screen==='Progress')&&(!loaded?<p>Loading lesson progress…</p>:selected?<LessonPlayer key={selected} lessonId={selected} progress={progress} connected={connected} request={request} onClose={()=>setSelected(undefined)} onPractice={()=>practice(selected)}/>:<section className="practice-home lesson-curriculum"><h1>{screen}</h1><p>{levels[(next.level??1)-1].title} · {lessons.filter(l=>completed(l,progress)).length}/{lessons.length} completed</p><p>Records describe pitch evidence and, where explicitly assessed, onset timing. All implemented lessons are open during testing. These levels are not formal examination grades.</p><button className="primary" onClick={()=>void open(progress.lastLesson&& !completed(lessons.find(l=>l.id===progress.lastLesson)!,progress)?progress.lastLesson:next.id)}>Continue Learning</button>
 {curriculum.levels.map((level,i)=><section key={level.title}><h2>Level {i+1} — {level.title}</h2>{i===1&&<p>Read confidently. Develop rhythm. Play with both hands.</p>}<p>{lessons.filter(l=>(l.level??1)===i+1&&completed(l,progress)).length}/{lessons.filter(l=>(l.level??1)===i+1).length} implemented lessons completed</p>{level.units.map(unit=><div key={unit.id}><h3>{unit.title}</h3>{unit.implemented&&<p>{unit.lessonIds.filter(id=>completed(lessons.find(l=>l.id===id)!,progress)).length}/{unit.lessonIds.length} lessons completed in this unit</p>}{unit.implemented?lessons.filter(l=>unit.lessonIds.includes(l.id)).map(l=><article key={l.id}><h4>{l.title}</h4><p>{l.objective}</p>{progress.records[`${l.id}:apply`]&&<p>Best application pitch accuracy: {progress.records[`${l.id}:apply`].accuracy}%</p>}<p>{completed(l,progress)?'Completed · measured criteria met':Object.keys(progress.records).some(k=>k.startsWith(l.id+':'))||progress.lastLesson===l.id?'In progress':available(l,progress)?'Available':'Complete the previous lesson to unlock'}</p><button disabled={!available(l,progress)} onClick={()=>void open(l.id)}>{completed(l,progress)?'Revisit':'Open lesson'}</button></article>):<p>Not yet implemented</p>}</div>)}</section>)}</section>)}
 </div></PracticeGoldContext.Provider>;
}
function LessonPlayer({lessonId,progress,connected,request,onClose,onPractice}:{lessonId:string;progress:LessonProgress;connected:boolean;request:(body:Record<string,unknown>)=>Promise<LessonProgress>;onClose:()=>void;onPractice:()=>void}){
 const lesson=lessons.find(l=>l.id===lessonId)!;
 const [index,setIndex]=useState(()=>{const i=lesson.activities.findIndex(a=>!activityPassed(a,progress.records[`${lesson.id}:${a.id}`]));return i<0?0:i;});
 const [attempt,setAttempt]=useState(()=>crypto.randomUUID()),[result,setResult]=useState<PracticeResult>(),[evidence,setEvidence]=useState<number[]>(),[saved,setSaved]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false),[tempo,setTempo]=useState(lesson.activities[index].exercise.tempoBpm??50);
 const fingering=useFingering(lesson.difficulty);
 const [timing,setTiming]=useState<number>();
 const [timedEvidence,setTimedEvidence]=useState<Record<string,unknown>>();
 const activity=lesson.activities[index];
 const exercise=useMemo(()=>({...activity.exercise,tempoBpm:tempo}),[activity,tempo]);
 const save=async(pitches:number[],timed?:Record<string,unknown>)=>{try{await request({...timed,action:'finish',lessonId,activityId:activity.id,attemptId:attempt,pitches});setSaved(true);setError('');}catch(e){setError((e as Error).message);}};
 const repeat=()=>{setAttempt(crypto.randomUUID());setResult(undefined);setEvidence(undefined);setSaved(false);setError('');setTiming(undefined);setTimedEvidence(undefined);};
 const continueLesson=()=>{if(!saved||!result||result.accuracy<activity.accuracy||(activity.rhythm!==undefined&&(timing??0)<activity.rhythm))return;if(index===lesson.activities.length-1)setDone(true);else{setIndex(index+1);repeat();}};
 if(done)return <section className="practice-home"><h1>Lesson complete</h1><p>{lesson.objective}</p><p>Required measured criteria met. {lesson.limitation}</p><ul>{lesson.activities.map(a=>{const r=progress.records[`${lesson.id}:${a.id}`];return <li key={a.id}>{a.title}: best pitch {r?.accuracy??0}%{a.rhythm!==undefined?` · best rhythm ${r?.rhythm??0}%`:""}</li>;})}</ul>{lesson.id==="beginner-graduation-v1"&&<p>Beginner course completed: reading and pitch/onset criteria demonstrated. Continue practicing even subdivisions and comfortable coordination. This is not a certification of technique or expressive performance.</p>}{lesson.recipe&&<button onClick={onPractice}>Practice This Skill</button>}<button className="primary" onClick={onClose}>Continue Learning</button></section>;
 return <section><h1>{lesson.title}</h1><p>{lesson.objective}</p><p>{lesson.instruction}</p><p>{lesson.limitation}</p><p>{activity.title} · {index+1}/{lesson.activities.length} · {activity.accuracy?`Reach ${activity.accuracy}% pitch accuracy.`:'Find each note at your own pace; mistakes do not block completion.'}</p>
 {error&&<p role="alert">{error}<button onClick={()=>evidence&&void save(evidence,timedEvidence)}>Retry Save</button></p>}
 {activity.rhythm!==undefined?<><p>Timed check: at least {activity.accuracy}% pitch and {activity.rhythm}% rhythm. Slower tempos are allowed.</p><button onClick={()=>{setTempo(t=>Math.max(40,t-5));repeat();}}>Practice Again Slower</button>{result?<div><p>Pitch {result.accuracy}% · Rhythm {timing}%</p><button onClick={repeat}>Repeat Assessment</button><button disabled={!saved||result.accuracy<activity.accuracy||(timing??0)<activity.rhythm} onClick={continueLesson}>Continue</button></div>:<RealmPerformance key={attempt} lessonMode score={lessonScore(exercise)} challenge={lessonChallenge} connected={connected} practice fingeringLevel={fingering.level} onExit={onClose} onFinish={(events,elapsedMs,r)=>{setResult({accuracy:r.pitch,correct:r.feedback.filter(n=>n.status==='correct').length,mistakes:r.wrong??0});setTiming(r.rhythm);setEvidence([]);setTimedEvidence({events,elapsedMs,tempo});void save([],{events,elapsedMs,tempo});}}/>}</>:<ClassicalPractice key={attempt} piece={exercise} pieceDifficulty={lesson.difficulty} connected={connected} guided onClose={onClose} completedResult={result} onRepeat={repeat} onSlower={()=>{setTempo(t=>Math.max(40,t-5));repeat();}}
 onComplete={(r,pitches)=>{setResult(r);setEvidence(pitches);void save(pitches);}}
 onContinue={continueLesson}/> }
 {result&&!saved&&<p>Saving lesson evidence before continuing…</p>}{result&&result.accuracy<activity.accuracy&&<p>Try again to meet this activity’s pitch goal. Your best result is kept.</p>}
 </section>;
}

function StudioIcon({name}:{name:string}){
 const paths:Record<string,string>={home:'M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10',book:'M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3ZM12 6v16',piano:'M3 5h18v14H3ZM7 5v8m5-8v8m5-8v8M8 13v6m8-6v6',library:'M4 4v16M9 4v16M14 4v16M18 4l3 16',more:'M5 12h1m5 0h1m5 0h1',account:'M8 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0M4 21v-2a8 8 0 0 1 16 0v2'};
 return <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]??paths.home}/></svg>;
}
