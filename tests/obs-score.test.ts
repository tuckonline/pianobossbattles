import {test,expect} from "vitest";
import {encodeScoreFeedback,decodeScoreFeedback,chainScoreSnapshot} from "../hosted/obs-score-state";
import {soundingNotes} from "../hosted/sight-library";
import {practiceLibrary} from "../hosted/practice-library";
import {overlaySnapshot} from "../hosted/obs-state";
test("compact feedback preserves hand and repeated pitch occurrences, including corrections",()=>{
 const e=practiceLibrary[0], notes=soundingNotes(e,"both");
 const feedback=notes.slice(0,50).map((n,i)=>({...n,status:(["correct","incorrect","current"] as const)[i%3]}));
 expect(decodeScoreFeedback(e,"both",encodeScoreFeedback(e,"both",feedback))).toEqual(feedback);
 const corrected=feedback.map(n=>({...n,status:"correct" as const}));
 expect(decodeScoreFeedback(e,"both",encodeScoreFeedback(e,"both",corrected))).toEqual(corrected);
 expect(decodeScoreFeedback(e,"both",[])).toEqual([]);
});
test("older OBS snapshots remain valid while invalid feedback is rejected",()=>{
 const old={exerciseNumber:1001,title:"Hanon",hand:"both",status:"ready",accuracy:null,mistakes:0,measure:1,totalMeasures:30};
 expect(overlaySnapshot.safeParse(old).success).toBe(true);
 expect(overlaySnapshot.safeParse({...old,score:{activeBeat:0,listening:false,compact:true,follow:true,size:{mode:"auto",percent:100},feedback:[[0,5]]}}).success).toBe(false);
});


test("chain publication never combines an advanced battle with a stale score or loop",()=>{
 const old={exerciseNumber:2007,title:"Schmitt 7",hand:"both",status:"practicing",accuracy:100,mistakes:0,measure:2,totalMeasures:2,
  score:{presentationId:"2007:1",activeMeasure:1,activeBeat:4,listening:false,compact:true,follow:true,size:{mode:"auto",percent:100},feedback:[[31,2]]}} as const;
 const snapshot=overlaySnapshot.parse(old);
 const game={battle:{chain:{exerciseNumber:2008,pass:1}}} as unknown as NonNullable<import('../hosted/obs-state').OverlaySnapshot['game']>;
 const next=chainScoreSnapshot(snapshot,game);
 expect(next.exerciseNumber).toBe(2008);expect(next.score?.presentationId).toBe('2008:1');expect(next.score?.feedback).toEqual([]);expect(next.score?.activeMeasure).toBe(0);
 expect(next.game).toBe(game);expect(snapshot.score?.feedback).toEqual([[31,2]]);
 const loop=chainScoreSnapshot(snapshot,{...game,battle:{...game.battle!,chain:{...game.battle!.chain!,exerciseNumber:2007,pass:2}}});
 expect(loop.score?.presentationId).toBe('2007:2');expect(loop.score?.feedback).toEqual([]);
 expect(chainScoreSnapshot(next,game).score).toBe(next.score);
});
