import type { GeneratorSettings } from "./types";
const half = [[2,2]];
const quarters = [[1,1,2],[2,1,1]];
const eighths = [[1,.5,.5,2],[2,1,.5,.5]];
// Stable v1 IDs are part of the seed recipe. No step means the original composer.
export const learningSteps = [
  {id:"novice-1-v1",difficulty:1,name:"1 · Three-note pulse",tempo:50,span:2,rhythms:half,bassAttacks:1,movingBass:false,change:"Starting step: half-note melody and one held bass note per bar."},
  {id:"novice-2-v1",difficulty:1,name:"2 · Quarter-note melody",tempo:52,span:2,rhythms:quarters,bassAttacks:1,movingBass:false,change:"Rhythm only: add melody quarter notes."},
  {id:"novice-3-v1",difficulty:1,name:"3 · Five-note position",tempo:54,span:4,rhythms:quarters,bassAttacks:1,movingBass:false,change:"Range only: open the melody to all five position notes; keep the same leap limit."},
  {id:"beginner-1-v1",difficulty:2,name:"1 · Two bass attacks",tempo:56,span:4,rhythms:quarters,bassAttacks:2,movingBass:false,change:"Coordination only: repeat the same bass pitch twice per bar."},
  {id:"beginner-2-v1",difficulty:2,name:"2 · Moving bass",tempo:58,span:4,rhythms:quarters,bassAttacks:2,movingBass:true,change:"Accompaniment movement only: alternate two chord tones within the fixed position."},
  {id:"beginner-3-v1",difficulty:2,name:"3 · First eighth notes",tempo:60,span:4,rhythms:eighths,bassAttacks:2,movingBass:true,change:"Rhythm only: introduce paired melody eighth notes."},
] as const;
export function learningStep(s: GeneratorSettings) {
  if (s.learningStep === undefined) return undefined;
  const step=learningSteps.find(step=>step.id===s.learningStep);
  if (!step || step.difficulty!==s.difficulty || s.curriculumVersion!==2 || s.positionVersion!==1 || s.rhythmFocus)
    throw Error("Choose a learning step belonging to this difficulty and the current fixed-position curriculum.");
  return step;
}
