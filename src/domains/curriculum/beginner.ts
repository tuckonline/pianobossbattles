import type {Activity,Lesson} from './catalog';
import type {Exercise,Hand,ScoreNote} from '../../../hosted/sight-library';
import {musicXml} from '../../../hosted/sight-library';
import {noviceHandPositions,assignPositionFingers} from '../music-generator/hand-positions';
import {tonality} from '../music-generator/music-theory';
import {generateClassicalExercise} from '../music-generator/classical-generator';
import {starter} from '../music-generator/practice-session';
// Degrees 0..4 are always relative to one explicit five-finger position.
function authored(title:string,degrees:number[][],rhythms:readonly number[][]=[[2,2]],hand:Hand='right',key='C'):Exercise{
 const positions=noviceHandPositions(key,'major',hand),tone=tonality(key,'major');
 const melody=degrees.map((bar,i)=>bar.map((d,j)=>({...tone.note(d,hand==='left'?3:4),beats:rhythms[i%rhythms.length][j],tie:false} as ScoreNote)));
 const rest=()=>[{pitch:0,beats:4,tie:false,rest:true}];
 const right=hand==='left'?degrees.map(rest):melody;
 const left=hand==='left'?melody:hand==='both'?degrees.map((_,i)=>[{...tone.note(i%4===2||i%4===3&&i!==degrees.length-1?4:0,3),beats:4,tie:false}]):degrees.map(rest);
 if(positions.right)assignPositionFingers(right,positions.right);if(positions.left)assignPositionFingers(left,positions.left);
 return {number:0,title,right,left,singleHand:hand==='both'?undefined:hand,bothHandsOnly:hand==='both',tempoBpm:56,beatsPerMeasure:4,durationBeats:degrees.length*4,keySignature:{fifths:tone.fifths,mode:'major'},handPositions:positions,generatedFingering:'fixed-position'};
}
const half=[[0,1],[2,1],[2,3],[1,0]],varied=[[2,0],[1,2],[3,1],[1,0]];
const quarter=[[0,1,2],[2,1,0],[0,2,1],[1,0,0]];
const eighth=[[0,0,0,0],[0,1,2,1],[2,2,1,0],[1,1,0,0]];
const rhythm=[[1,.5,.5,2],[2,1,.5,.5]];
const units=['Reading Music with Confidence','Rhythm & Musical Patterns','Exploring the Keyboard','Becoming a Pianist'];
const definitions=[
 ['treble-explorer','Treble Clef Explorer','Read C4 through G4 on the treble staff.','The treble clef curls around the G4 line. Lines and spaces alternate as notes rise. Middle C sits on a short ledger line below the staff; D is below the bottom line, E on it, F in the first space and G on the next line. Find each note at your own pace.'],
 ['bass-explorer','Bass Clef Explorer','Read C3 through G3 with the left hand.','The two bass-clef dots surround the F3 line. C3 is in the second space from the bottom; D3 is on the middle line, E3 in the next space, F3 on the next line and G3 in the next space. Put left finger 5 on C3 and thumb on G3.'],
 ['steps-skips','Steps, Skips & Repeats','Recognize repeated notes, steps and skips.','C–C repeats. C–D steps to the next letter. C–E skips D: on the staff it moves from a line to the next line, or a space to the next space. Follow whether the pattern rises or falls before finding each key.'],
 ['both-staves','Reading Both Staves','Read a melody and sustained bass together.','The brace joins two staves. Here the upper staff is right hand and the lower staff is left hand. First read each part alone. Then hold each bass note while the melody moves; simultaneous notes belong together.'],
 ['eighth-notes','Meet Eighth Notes','Play two even eighth notes within one quarter-note beat.','Count 1-and-2-and-3-and-4-and evenly. Each number or “and” is one eighth note. Two eighths often share a beam. Begin on repeated C before adding familiar D and E; do not rush the second eighth.'],
 ['mixed-rhythms','Combining Rhythms','Count mixed durations in complete 4/4 measures.','A quarter takes one beat, a half two, and an eighth half a beat. In quarter–eighth–eighth–half, count 1, 2-and, 3–4. Keep counting while the half note sounds. Beat 1 begins each new bar.'],
 ['rhythm-motifs','Recognizing Rhythm Motifs','Recognize the same rhythmic idea at different pitches.','A motif is a short recognizable idea. These studies reuse quarter–eighth–eighth–half and answer it with half–quarter–eighth–eighth. Read the durations first; changed pitches need not change the pulse.'],
 ['rhythm-check','Rhythm Challenge','Keep a steady pulse through an eight-bar musical period.','An opening four-bar question leads to a four-bar answer. Look for the recurring rhythm before starting. Keep eighth notes even and let the final whole note settle. Pitch and timing are measured separately in the final check.'],
 ['new-positions','New Hand Positions','Locate G and F five-finger positions before playing.','G major position uses G–A–B–C–D. F major position uses F–G–A–B-flat–C: right finger 4 plays B-flat. The F key signature shows B-flat. Each activity stays in one position; stop and set the new position before starting.'],
 ['intervals','Understanding Intervals','Read and play seconds, thirds, fourths and fifths.','An interval counts letter names including both ends: C–D is a second, C–E a third, C–F a fourth and C–G a fifth. Reversing the direction keeps the interval number. Try each pair without shifting your C position.'],
 ['triads','Introduction to Chords','Recognize root, third and fifth in major broken triads.','A triad has three notes. C–E–G is C major, F–A–C is F major, and G–B–D is G major. Root names the chord; third and fifth count from it. Here you play one note at a time: a broken chord. Set the indicated hand position before each new chord.'],
 ['accompaniment','Simple Accompaniment','Combine a melody with tonic and dominant bass support.','Tonic is the home note C; dominant is G, the fifth note of the key. A G bass creates expectation and a C bass settles it. First play the bass alone, then hold it under the familiar melody. Keep the left hand in C position.'],
 ['phrases','Playing in Phrases','Recognize returning motifs and question-and-answer endings.','A phrase is a musical sentence. Notice a short opening idea returning later. The question pauses on less-settled harmony; the answer returns home. A cadence is that closing gesture. Listen for it; the score cannot measure your expressive intention.'],
 ['articulation','Legato & Staccato','Explore connected and detached notes in a familiar melody.','A curved slur groups notes to play smoothly (legato); dots near noteheads ask for detached notes (staccato). Connect without forcing the hand. For detached notes, release sooner while keeping the next onset on the beat. Articulation is self-checked, not graded.'],
 ['classical-study','Your First Classical Study','Prepare and perform a complete sixteen-bar study.','Read the right hand, then the left, before combining them. Find the returning opening idea and the cadences. Practice slowly with finger guidance if helpful. The final performance uses the same study so preparation carries into performance.'],
 ['graduation','Beginner Graduation','Integrate reading, rhythm and two-hand coordination.','Preview the key, position, rhythms and phrase endings. This assessment is a different study from the preparation passage. Use a comfortable tempo. The result measures pitch and onset timing, not artistry or all aspects of Beginner competence.'],
] as const;
function generated(seed:number,measures=8,hand:Hand='both'){
 return generateClassicalExercise({...starter(2),learningStep:'beginner-3-v1',tempoBpm:56,seed,measures,hands:hand});
}
function isolate(ex:Exercise,hand:'right'|'left'):Exercise{return {...ex,singleHand:hand,bothHandsOnly:false,[hand==='right'?'left':'right']:ex.right.map(()=>[{pitch:0,beats:4,tie:false,rest:true}])};}
export const beginnerLessons:Lesson[]=definitions.map((d,i)=>{
 let discover=authored(d[1],half),practice=authored(d[1],varied),apply=authored(d[1],[...half,...varied]),master=authored(d[1],[...varied,...half]);
 if(i===0){practice=authored(d[1],[[2,3],[4,3],[2,1],[1,0]]);apply=authored(d[1],[...half,[2,3],[4,3],[2,1],[1,0]]);master=authored(d[1],[[0,2],[3,4],[4,2],[1,0]]);}
 if(i===1){discover=authored(d[1],half,[[2,2]],'left');practice=authored(d[1],[[2,3],[4,3],[2,1],[1,0]],[[2,2]],'left');apply=authored(d[1],[...half,[2,3],[4,3],[2,1],[1,0]],[[2,2]],'left');master=authored(d[1],[[0,2],[3,4],[4,2],[1,0]],[[2,2]],'left');}
 if(i===2){discover=authored(d[1],[[0,0],[0,1],[0,2],[2,0]]);practice=authored(d[1],[[0,1,2],[2,2,0],[0,2,1],[1,0,0]],[[1,1,2]]);}
 if(i===3||i===11){apply=generateClassicalExercise({...starter(2),learningStep:i===3?'beginner-1-v1':'beginner-2-v1',seed:2100+i});master=generateClassicalExercise({...starter(2),learningStep:i===3?'beginner-1-v1':'beginner-2-v1',seed:2150+i});discover=isolate(apply,'right');practice=isolate(apply,'left');}
 if(i>=4&&i<=7){discover=authored(d[1],[[0,0,0,0],[0,0,0,0]],[[1,.5,.5,2]]);practice=authored(d[1],eighth,i===4?[[1,.5,.5,2]]:rhythm);apply=generated(2200+i,8,'right');master=generated(2300+i,8,'right');}
 if(i===8){discover=authored('G position',half,[[2,2]],'right','G');practice=authored('F position',[[0,1],[2,3],[4,3],[1,0]],[[2,2]],'right','F');apply=authored('G position melody',[...half,...varied],[[2,2]],'right','G');master=authored('F position melody',[[0,1],[2,3],[4,3],[2,1],[0,2],[3,4],[3,1],[1,0]],[[2,2]],'right','F');}
 if(i===9){discover=authored(d[1],[[0,1],[0,2],[0,3],[0,4]]);practice=authored(d[1],[[4,0],[3,0],[2,0],[1,0]]);apply=authored(d[1],[[0,2],[1,3],[0,4],[1,0]]);master=authored(d[1],[[0,3],[4,0],[0,2],[1,0]]);}
 if(i===10){const triad=[[0,2,4],[4,2,0]];discover=authored('C major broken triad',triad,[[1,1,2]]);practice=authored('F major broken triad',triad,[[1,1,2]],'right','F');apply=authored('G major broken triad',triad,[[1,1,2]],'right','G');master=authored('C major broken-chord melody',[[0,2,4],[4,2,0],[0,4,2],[2,0,0]],[[1,1,2]]);}
 if(i===12){discover=generated(2401,8,'right');practice=generated(2401,8,'left');apply=generated(2401);master=generated(2402);}
 if(i===13){discover=authored('Connected notes',quarter,[[1,1,2]]);practice=authored('Detached notes',quarter,[[1,1,2]]);let index=0;const count=discover.right.flat().length;discover.notationXml=musicXml(discover).replace(/<\/notations>/g,()=>`${index++===0?'<slur type="start" number="1"/>':index===count?'<slur type="stop" number="1"/>':''}</notations>`);practice.notationXml=musicXml(practice).replace(/<\/notations>/g,'<articulations><staccato/></articulations></notations>');apply={...practice,title:'Apply detached articulation',notationXml:practice.notationXml};master={...discover,title:'Return to connected playing'};}
 if(i>=14){const study=generated(i===14?2501:2601,16);discover=isolate(study,'right');practice=isolate(study,'left');apply=study;master=i===14?study:generated(2603,16);}
 const rhythmGoal=i>=4&&i<=7||i===15;
 const activities:Activity[]=[{id:'try',title:'Discover · take your time',accuracy:0,exercise:discover},{id:'practice',title:'Practice · isolate the skill',accuracy:i===13?0:75,exercise:practice},{id:'apply',title:'Apply · make music',accuracy:80,exercise:apply},{id:'master',title:i%4===3?'Unit assessment':'Independent check',accuracy:i%4===3?85:80,exercise:master,...(rhythmGoal?{rhythm:70}: {})}];
 return {id:`beginner-${d[0]}-v1`,title:d[1],level:2,unit:Math.floor(i/4),objective:d[2],instruction:d[3],prerequisites:[i?`beginner-${definitions[i-1][0]}-v1`:'first-performance'],difficulty:2,position:'Use the position shown for each activity; never shift unexpectedly.',skill:`beginner-${d[0]}`,limitation:rhythmGoal?'Final assessment measures pitch and onset timing separately. Finger choice and expression are not graded.':'Pitch evidence only. Rhythm, articulation, finger choice and expression remain self-checked.',activities,...([0,1,4,5,6,7,12,14,15].includes(i)?{recipe:{...starter(2),learningStep:i<4?'beginner-1-v1':'beginner-3-v1',hands:i===1?'left' as const:i<8?'right' as const:'both' as const}}:{})};
});
export const beginnerUnits=units;
