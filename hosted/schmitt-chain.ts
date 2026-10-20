import {battleRunNotes,practiceLoopCount} from './boss-battle';
import {battleMusicalBeats} from './battle-modes';
import type {Exercise,Hand} from './sight-library';
export type ChainEntry={exercise:Exercise;loops:number};
export function schmittChain(entries:ChainEntry[],hand:Hand){
 if(!entries.length||entries.some(e=>e.exercise.collection!=='schmitt-op16'))throw new Error('Choose Schmitt exercises for this chain.');
 return exerciseChain(entries,hand);
}
export function exerciseChain(entries:ChainEntry[],hand:Hand){
 if(!entries.length)throw new Error('Add an exercise to the queue.');
 if(entries.some(({exercise:e})=>(e.singleHand&&e.singleHand!==hand)||(e.bothHandsOnly&&hand!=='both')))throw new Error('Choose pieces compatible with the selected hands.');
 const plan=entries.map(e=>({exercise:e.exercise,loops:practiceLoopCount(e.loops)}));
 const durations=plan.map(e=>battleMusicalBeats(e.exercise,e.loops));
 return {plan,notes:plan.reduce((n,e)=>n+battleRunNotes(e.exercise,hand,e.loops),0),beats:durations.some(n=>n===null)?null:durations.reduce<number>((n,b)=>n+b!,0),loops:plan.reduce((n,e)=>n+e.loops,0)};
}
