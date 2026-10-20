import type { Exercise, ScoreNote } from './sight-library';

// Original preparatory drills and standard C-major scales. IDs remain stable
// when further keys are added; all notes feed the existing score/MIDI pipeline.
const semitones = [0, 2, 4, 5, 7, 9, 11];
function line(degrees: number[], fingers: number[], base: number): ScoreNote[][] {
  if (degrees.length !== fingers.length) throw new Error('Scale fingering mismatch');
  const notes = degrees.map((degree, i) => ({
    pitch: base + Math.floor(degree / 7) * 12 + semitones[((degree % 7) + 7) % 7],
    beats: 1, tie: false, finger: fingers[i],
  }));
  // Complete the final 4/4 bar by holding the final tonic, not adding attacks.
  notes[notes.length - 1].beats += (4 - notes.length % 4) % 4;
  const bars: ScoreNote[][] = [];
  for (let i = 0; i < notes.length; i += 4) bars.push(notes.slice(i, i + 4));
  return bars;
}
const up = [0,1,2,3,4,5,6,7];
const rh = [1,2,3,1,2,3,4,5], lh = [5,4,3,2,1,3,2,1];
const down = [...up].reverse();
const round = [...up, ...up.slice(0,-1).reverse()];
const roundRh = [...rh,...rh.slice(0,-1).reverse()];
const roundLh = [...lh,...lh.slice(0,-1).reverse()];
function lesson(step:number, title:string, degrees:number[], rf:number[], lf:number[],
  focus:string, tip:string, leftDegrees=degrees):Exercise {
  return {number:11000+step, title:`${step}. C major · ${title}`, collection:'scales',
    composer:'PianoPath scale studies', arrangement:'Standard scale fingerings with original preparatory patterns.',
    difficulty:step===8?'Optional extension':'Beginner · C major',
    description:'C major uses only white keys. Practise right hand, then left hand, then both hands when comfortable. MIDI checks correct notes at your own pace.',
    learningFocus:focus, practiceTip:tip, beatsPerMeasure:4, measuresPerSystem:4, tempoBpm:60,
    right:line(degrees,rf,60), left:line(leftDegrees,lf,48)};
}
const two = Array.from({length:15},(_,i)=>i);
const twoRh=[1,2,3,1,2,3,4,1,2,3,1,2,3,4,5];
const twoLh=[5,4,3,2,1,3,2,1,4,3,2,1,3,2,1];
export const scalesLibrary:Exercise[] = [
  lesson(1,'Five-finger preparation',[0,1,2,3,4,3,2,1,0,1,2,3,2,1,0],
    [1,2,3,4,5,4,3,2,1,2,3,4,3,2,1], [5,4,3,2,1,2,3,4,5,4,3,2,3,4,5],
    'Find C–G and play connected steps without moving position.',
    'Start with RH thumb on middle C (C4), LH little finger on C3. Keep the hand relaxed. This five-finger drill uses a different F fingering from the full scale.'),
  lesson(2,'Right-hand thumb passage',[0,1,2,3,4,3,2,1,0,1,2,3,2,1,0],
    [1,2,3,1,2,1,3,2,1,2,3,1,3,2,1], [5,4,3,2,1,2,3,4,5,4,3,2,3,4,5],
    'RH: move from finger 3 on E to thumb on F, then return.',
    'Select Right hand first. Move the hand sideways as the thumb passes under; coming down, finger 3 crosses over from F to E. Add the simple left-hand line later.'),
  lesson(3,'Left-hand finger crossing',[4,5,6,7,6,5,4,3,4,5,6,7,6,5,4],
    [2,3,4,5,4,3,2,1,2,3,4,5,4,3,2], [1,3,2,1,2,3,1,2,1,3,2,1,2,3,1],
    'LH: finger 3 crosses over the thumb from G to A.',
    'Select Left hand first. Start LH thumb on G3. Return from A to G with the thumb passing under. RH starts finger 2 on G4.'),
  lesson(4,'One octave ascending',up,rh,lh,
    'Connect C to the next C using each hand’s own crossing.',
    'RH: 1-2-3, 1-2-3-4-5. LH: 5-4-3-2-1, 3-2-1. The hands cross at different places; learn each alone first.'),
  lesson(5,'One octave descending',down,[...rh].reverse(),[...lh].reverse(),
    'Reverse the scale smoothly from upper C to lower C.',
    'RH starts finger 5 on C5; LH starts thumb on C4. RH finger 3 crosses at F–E; LH thumb passes under at A–G.'),
  lesson(6,'One octave up and down',round,roundRh,roundLh,
    'Join ascending and descending motion without repeating the top C.',
    'Play the upper C once, then change direction. Aim for comfortable, even movement before trying to go faster.'),
  lesson(7,'Contrary motion',round,roundRh,roundRh,
    'Move the hands apart and back together with matching finger numbers.',
    'Begin RH thumb on C4 and LH thumb on C3. RH rises to C5 while LH descends to C2, then both return. Practise each hand separately before combining.',round.map(d=>-d)),
  lesson(8,'Two-octave extension',[...two,...two.slice(0,-1).reverse()],
    [...twoRh,...twoRh.slice(0,-1).reverse()],[...twoLh,...twoLh.slice(0,-1).reverse()],
    'Continue through the middle C of each hand’s two-octave range.',
    'Try this after step 6 feels comfortable. RH uses thumb on the middle C; LH crosses finger 4 to the following D. Play the highest C once. Work one hand at a time.'),
];
