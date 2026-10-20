import {schmittLibrary} from "./schmitt-library";
import type { NoteFeedback } from "../src/components/music/notation";
import { soundingNotes, type Exercise, type Hand } from "./sight-library";
import type { OverlaySnapshot } from "./obs-state";
const statuses = ["correct", "incorrect", "current"] as const;
const key = (n: {pitch:number;beat:number;hand:string}) => `${n.hand}:${n.pitch}:${n.beat}`;
export function encodeScoreFeedback(exercise:Exercise, hand:Hand, feedback:NoteFeedback[]): NonNullable<OverlaySnapshot["score"]>["feedback"] {
  const lookup = new Map(feedback.map(n => [key(n), statuses.indexOf(n.status)]));
  return soundingNotes(exercise,hand).flatMap((n,index) => {
    const code = lookup.get(key(n));
    return code === undefined ? [] : [[index,code as 0|1|2]];
  });
}
export function decodeScoreFeedback(exercise:Exercise, hand:Hand, feedback:NonNullable<OverlaySnapshot["score"]>["feedback"]):NoteFeedback[] {
  const notes = soundingNotes(exercise,hand);
  return feedback.flatMap(([index,code]) => notes[index] ? [{...notes[index],status:statuses[code]}] : []);
}

// The evaluator advances synchronously; React may still hold the previous pass.
// Never pair its old cursor/feedback with a new authoritative chain position.
export function chainScoreSnapshot(snapshot:OverlaySnapshot,game:OverlaySnapshot['game']):OverlaySnapshot {
  const chain=game?.battle?.chain,id=chain?`${chain.exerciseNumber}:${chain.pass}`:undefined;
  if(!chain||snapshot.score?.presentationId===id)return {...snapshot,game};
  const exercise=schmittLibrary.find(e=>e.number===chain.exerciseNumber);
  // Public builds load protected definitions through the API. Even before that
  // fetch completes, invalidate the previous pass rather than freezing its note.
  return {...snapshot,game,exerciseNumber:chain.exerciseNumber,title:exercise?.title??`Exercise ${chain.exerciseNumber}`,
    measure:1,totalMeasures:exercise?.right.length??1,accuracy:null,mistakes:0,
    score:snapshot.score?{...snapshot.score,presentationId:id,activeMeasure:0,activeBeat:0,feedback:[]}:undefined};
}
