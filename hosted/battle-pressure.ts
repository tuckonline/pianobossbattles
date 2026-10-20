import {noteGroups,soundingNotes,type Exercise,type Hand} from './sight-library';
export type BattlePressure={id:string;dueAt:number;stage:0|1|2|3;at:number;pausedAt?:number};
export const pressureDelays=[1500,3000,5000] as const;
export const pressureDuration=1400;
// Beat gaps include written rests and tied/sustained durations. Chord tones
// still missing at the same onset get grace, not an invented beat delay.
export function pressureWaitMs(exercise:Exercise,hand:Hand,cursor:number,previousCursor:number|null,bpm:number){
 const groups=noteGroups(exercise,hand),next=groups[cursor];if(!next)return null;
 const beats=previousCursor===null?Math.max(1,next.beat):Math.max(0,next.beat-(groups[previousCursor]?.beat??next.beat));
 return beats*60000/Math.max(20,Math.min(bpm,exercise.tempoBpm??bpm));
}
export function loopTailMs(exercise:Exercise,hand:Hand,bpm:number){
 const notes=soundingNotes(exercise,hand),last=Math.max(0,...notes.map(n=>n.beat));
 return Math.max(0,(exercise.durationBeats??0)-last,...notes.map(n=>n.beat+n.beats-last))*60000/Math.max(20,Math.min(bpm,exercise.tempoBpm??bpm));
}
export function advancePressure(p:BattlePressure,now:number):BattlePressure{
 if(p.pausedAt!==undefined||p.stage===3)return p;
 const next=(p.stage+1) as 1|2|3;
 if(now<p.dueAt+pressureDelays[next-1])return p;
 // If a tab was suspended, collapse stale stages instead of replaying a queue.
 const stage=(now>=p.dueAt+5000?3:now>=p.dueAt+3000?2:1) as 1|2|3;
 return {...p,stage,at:now};
}
export function resumePressure(p:BattlePressure,now:number):BattlePressure{
 if(p.pausedAt===undefined)return p;
 return {...p,dueAt:p.dueAt+Math.max(0,now-p.pausedAt),pausedAt:undefined};
}
