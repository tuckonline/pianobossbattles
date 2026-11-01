export type MusicalMotif = { degrees: number[]; beats: number[]; rests: boolean[] };
export type MotifUse = { bar: number; source: number; technique: "repeat" | "sequence" | "rhythm" | "variation" | "answer" | "fallback" | "introduce" | "cadence" | "prepare"; motif: MusicalMotif };
export function transformMotif(source: MusicalMotif, technique: MotifUse["technique"], amount=1, rhythm?: readonly number[]): MusicalMotif {
  const next={degrees:[...source.degrees],beats:[...source.beats],rests:[...source.rests]};
  if(technique === "sequence") next.degrees=next.degrees.map(d=>d+amount);
  if(technique === "rhythm" && rhythm?.length===next.beats.length) next.beats=[...rhythm];
  if(technique === "variation" || technique === "answer") {
    const index=technique === "answer" ? next.degrees.length-1 : Math.min(1,next.degrees.length-1);
    next.degrees[index]+=amount;
  }
  return next;
}
export function motifCandidates(source:MusicalMotif,bar:number,harmonyDegree:number,rhythms:readonly (readonly number[])[],direction:number,registerShift=direction) {
  const result:{technique:MotifUse["technique"];motif:MusicalMotif}[]=[];
  const add=(technique:MotifUse["technique"],amount=1,rhythm?:readonly number[])=>result.push({technique,motif:transformMotif(source,technique,amount,rhythm)});
  if(bar%8===4 || bar%16===0) add("repeat"); // Consequent recall / larger-scale return.
  if(bar%8===5) add("answer",-1);
  if(bar%8===1) {
    if(Math.floor(bar/8)%2===0) add("repeat");
    for(const rhythm of rhythms) if(rhythm.length===source.beats.length && rhythm.some((b,i)=>b!==source.beats[i]))add("rhythm",1,rhythm);
    add("variation",direction);
  }
  for(const shift of [registerShift,harmonyDegree,direction,-direction]) if(shift) add("sequence",shift);
  add("repeat");
  return result;
}
export function validateMotifUses(uses:MotifUse[]) {
  for(const use of uses) {
    if(use.motif.beats.reduce((a,b)=>a+b,0)!==4 || use.motif.degrees.length!==use.motif.beats.length)throw Error("Invalid motif measure");
    if(["introduce","cadence","fallback","prepare"].includes(use.technique))continue;
    const source=uses[use.source]?.motif;
    if(!source || source.degrees.length!==use.motif.degrees.length)throw Error("Missing motif source");
    const deltas=use.motif.degrees.map((d,i)=>d-source.degrees[i]);
    if(use.technique==="repeat" && (deltas.some(Boolean)||JSON.stringify(source)!==JSON.stringify(use.motif)))throw Error("Inexact motif repetition");
    if(use.technique==="sequence" && (deltas.some(d=>d!==deltas[0]) || JSON.stringify(source.beats)!==JSON.stringify(use.motif.beats)))throw Error("Broken diatonic sequence");
    if(use.technique==="rhythm" && deltas.some(Boolean))throw Error("Rhythm variation changed pitches");
    if(["variation","answer"].includes(use.technique) && (deltas.filter(Boolean).length>1 || JSON.stringify(source.beats)!==JSON.stringify(use.motif.beats)))throw Error("Excessive motif mutation");
  }
}
