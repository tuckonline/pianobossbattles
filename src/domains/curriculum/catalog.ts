import {beginnerLessons,beginnerUnits} from "./beginner";
import type { Exercise, ScoreNote } from '../../../hosted/sight-library';
import { noviceHandPositions, assignPositionFingers } from '../music-generator/hand-positions';
import { starter } from '../music-generator/practice-session';
export const levels = [
 {title:'Foundations',units:['Getting to Know the Keyboard','Keyboard layout and octaves','First staff reading']},
 {title:'Beginner Pianist',units:beginnerUnits},
 {title:'Elementary',units:['Major and minor keys','Scales, intervals and triads','Arpeggios, positions and articulation']},
 {title:'Intermediate',units:['Rhythm and inversions','Harmony and broken chords','Independence, dynamics and sight-reading']},
 {title:'Advanced',units:['Independent voices','Chromaticism and technique','Interpretation and Classical repertoire']},
 {title:'Expert',units:['Polyphony and harmony','Larger forms and technical patterns','Performance preparation and complex repertoire']},
];
export type Activity = {id:'try'|'practice'|'apply'|'master';rhythm?:number;title:string;accuracy:number;exercise:Exercise};
export type Lesson = {id:string;title:string;objective:string;prerequisites:string[];level?:number;unit?:number;difficulty:1|2;position:string;instruction:string;limitation:string;skill:string;activities:Activity[];recipe?:ReturnType<typeof starter>};
function score(title:string,pitches:number[],durations:number[]=[2,2]):Exercise {
 const right:ScoreNote[][]=[];
 for(let i=0;i<pitches.length;){const bar:ScoreNote[]=[];for(const beats of durations){const pitch=pitches[i++%pitches.length];bar.push({pitch,beats,tie:false,spelling:{step:({60:'C',62:'D',64:'E',65:'F',67:'G'} as const)[pitch as 60],alter:0,octave:4}});}right.push(bar);}
 if(title.includes('Apply:'))right.push([{pitch:60,beats:4,tie:false,spelling:{step:'C',alter:0,octave:4}}]);
 const handPositions=noviceHandPositions('C','major','right');assignPositionFingers(right,handPositions.right!);
 return {number:0,title,tempoBpm:50,beatsPerMeasure:4,durationBeats:right.length*4,right,left:right.map(()=>[{pitch:0,beats:4,tie:false,rest:true}]),singleHand:'right',handPositions,generatedFingering:'fixed-position',keySignature:{fifths:0,mode:'major'}};
}
const specs=[
 ['middle-c','Finding Middle C','Locate and play Middle C (C4).','Find a group of two black keys near the middle of your keyboard. C is immediately to their left. Middle C is C4; keyboard octave labels vary. Take your time finding the matching note.',[60,60],[60,60,60,60],[60,60,60,60]],
 ['finger-numbers','Understanding Finger Numbers','Connect finger numbers with a comfortable right-hand C position.','On either hand: thumb 1, index 2, middle 3, ring 4, little finger 5. Place right-hand 1 on C4, then 2 on D, 3 on E, 4 on F, 5 on G. Use the displayed fingers if guidance is enabled; MIDI checks pitches, not your fingers.',[60,62,64,65,67,65],[60,62,64,65,67,64],[60,62,64,65,67,65,62,60]],
 ['cde','Playing C, D, and E','Recognize and play three neighboring notes.','C, D and E are neighboring white keys. Keep right-hand fingers 1, 2 and 3 near them. Read each note before you play. A step moves to the next letter name.',[60,62,64,62],[60,62,64,62,64,62,60,60],[60,62,64,62,64,62,62,60]],
 ['five-notes','Expanding to Five Notes','Read C through G without moving the hand position.','Add F under finger 4 and G under finger 5. Keep your hand comfortable; avoid stretching or pressing hard. Read both steps and skips, and notice when the melody returns.',[60,62,64,65,67,65],[60,64,62,65,64,67,65,60],[60,62,64,65,67,65,62,60]],
 ['note-values','Reading Quarter and Half Notes','Count quarter notes for one beat and half notes for two.','In 4/4, count 1–2–3–4 evenly. A quarter note lasts one beat, a half note two, and a whole note four. Try counting aloud with the optional metronome. This player waits for pitches and does not certify rhythm.',[60,62,64],[64,62,60,60,62,64],[60,62,64,64,62,60]],
 ['first-performance','Your First Musical Performance','Connect familiar notes into a complete musical phrase.','Read the opening before starting. Keep an even pulse, let held notes last, and listen for the final return to C. Try the whole melody; you may retry without losing your best result.',[60,62,64,62],[60,62,64,65,67,65,62,60],[60,62,64,65,67,65,64,62,64,65,67,65,64,62,62,60]],
] as const;
const foundations:Lesson[]=specs.map((s,i)=>({id:s[0],title:s[1],objective:s[2],prerequisites:i?[specs[i-1][0]]:[],difficulty:1,position:'Right hand C4–G4',instruction:s[3],limitation:i===1?'Finger choice is self-checked, not MIDI-assessed.':i>=4?'Rhythm and expression are self-checked, not MIDI-assessed.':'Untimed pitch identification; no penalty for time spent finding notes.',skill:`${s[0]}-pitch`,activities:([['try','Try: find the notes',0,s[4]],['practice','Practice: reinforce the idea',i<2?0:75,s[5]],['apply','Apply: play a complete study',i<2?0:i===5?85:80,s[6]]] as const).map(([id,title,accuracy,pitches])=>({id,title,accuracy,exercise:score(`${s[1]} · ${title}`, [...pitches],i===4?[1,1,2]:[2,2])})),...(i>=2?{recipe:{...starter(),learningStep:i===2?'novice-1-v1':'novice-3-v1',hands:'right' as const}}:{})}));
export const lessons:Lesson[]=[...foundations,...beginnerLessons];
export type LessonProgress={lastLesson?:string;records:Record<string,{accuracy:number;correct:number;attempts:number;rhythm?:number;mastered?:boolean}>};
export const emptyLessons=():LessonProgress=>({records:{}});
export const activityPassed=(a:Activity,r:LessonProgress["records"][string]|undefined)=>!!r&&(r.mastered===true||a.rhythm===undefined&&r.correct>0&&r.accuracy>=a.accuracy);
export const completed=(lesson:Lesson,p:LessonProgress)=>lesson.activities.every(a=>activityPassed(a,p.records[`${lesson.id}:${a.id}`]));
// Owner-requested testing access: keep prerequisites as curriculum metadata only.
export const openLessonAccess=true;
export const available=(lesson:Lesson,p:LessonProgress)=>openLessonAccess||lesson.prerequisites.every(id=>completed(lessons.find(l=>l.id===id)!,p));
export const nextLesson=(p:LessonProgress)=>lessons.find(l=>!completed(l,p))??lessons[lessons.length-1];

export const curriculum={id:"piano-foundations-v1",levels:levels.map((level,i)=>({...level,id:`level-${i+1}`,units:level.units.map((title,j)=>({id:`level-${i+1}-unit-${j+1}`,title,lessonIds:lessons.filter(l=>(l.level??1)===i+1&&(l.unit??0)===j).map(l=>l.id),implemented:i===0&&j===0||i===1}))}))};
