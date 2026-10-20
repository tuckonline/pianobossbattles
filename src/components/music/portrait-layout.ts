import type {ScoreBounds} from './notation-bounds';
export type PortraitMeasure={bounds:ScoreBounds;staffY:number;notes:number};
export function portraitWindow(measures:PortraitMeasure[],at:number,view:string,width:number,height:number,requested:number,baseline:number){
  const first=Math.max(0,Math.min(measures.length-1,at)),current=measures[first];
  const dense=current.notes>16||(current.bounds.right-current.bounds.left)/(current.bounds.bottom-current.bounds.top)>2.4;
  const count=view==='current'||view==='automatic'&&dense?1:2;
  // Keep a short terminal cadence attached to its preceding musical phrase.
  // Otherwise measure-follow isolates the final chord while it is still playable.
  const last=measures.length-1,tail=measures[last],previous=measures[last-1];
  const closingPair=!!previous && tail.notes>0 && tail.notes<=Math.max(4,previous.notes/4) &&
    (tail.notes<previous.notes || tail.bounds.right-tail.bounds.left<(previous.bounds.right-previous.bounds.left)*.6);
  const keepClosing=closingPair && first>=last-1;
  let indices=measures.map((_,i)=>i).filter(i=>i>=first&&i<first+count);
  if(keepClosing)indices=[last-1,last];
  const fit=(ids:number[])=>{
    const top=Math.min(...ids.map(i=>measures[i].bounds.top-measures[i].staffY));
    const bottom=Math.max(...ids.map(i=>measures[i].bounds.bottom-measures[i].staffY));
    const gap=12,span=ids.reduce((n,i)=>n+measures[i].bounds.right-measures[i].bounds.left,0)+gap*(ids.length-1);
    return {top,bottom,gap,span,safe:Math.min(width/Math.max(1,span),height/Math.max(1,bottom-top))};
  };
  let box=fit(indices);
  if(!keepClosing&&view==='automatic'&&indices.length>1&&box.safe<baseline*requested/100*.85){indices=[first];box=fit(indices);}
  const scale=Math.max(0,Math.min(baseline*requested/100,box.safe));
  return {...box,indices,scale,effective:baseline>0?Math.round(scale/baseline*100):0};
}
