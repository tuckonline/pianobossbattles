import {it,expect} from 'vitest';
import {pressureWaitMs,loopTailMs,advancePressure,resumePressure,type BattlePressure} from '../hosted/battle-pressure';
import type {Exercise} from '../hosted/sight-library';
const ex:Exercise={number:1,right:[],left:[],polyphony:[{pitch:60,beat:2,beats:4,hand:'right'},{pitch:64,beat:2,beats:4,hand:'right'},{pitch:62,beat:8,beats:3,hand:'right'}],durationBeats:12};
it('uses onset gaps including rests, sustained notes and slower tempo',()=>{
 expect(pressureWaitMs(ex,'both',0,null,60)).toBe(2000);
 expect(pressureWaitMs(ex,'both',1,0,60)).toBe(6000);
 expect(pressureWaitMs(ex,'both',1,0,30)).toBe(12000);
 expect(pressureWaitMs({...ex,tempoBpm:30},'both',1,0,60)).toBe(12000);
 expect(pressureWaitMs(ex,'both',0,0,60)).toBe(0);
 expect(pressureWaitMs(ex,'both',2,1,60)).toBeNull();
 expect(loopTailMs(ex,'both',60)).toBe(4000);
});
it('stages occur once after grace, never continuously replay',()=>{
 let p:BattlePressure={id:'attempt:note',dueAt:10000,stage:0,at:0};
 expect(advancePressure(p,11499)).toBe(p);
 p=advancePressure(p,11500);expect(p.stage).toBe(1);expect(advancePressure(p,12999)).toBe(p);
 p=advancePressure(p,13000);expect(p.stage).toBe(2);
 p=advancePressure(p,15000);expect(p.stage).toBe(3);expect(advancePressure(p,99000)).toBe(p);
});
it('paused time is excluded and missed stages collapse after suspension',()=>{
 const p:BattlePressure={id:'attempt:note',dueAt:1000,stage:0,at:0,pausedAt:1500};
 expect(advancePressure(p,100000)).toBe(p);
 const resumed=resumePressure(p,101500);expect(resumed.dueAt).toBe(101000);expect(advancePressure(resumed,102499)).toBe(resumed);
 expect(advancePressure({...p,pausedAt:undefined},100000).stage).toBe(3);
});
