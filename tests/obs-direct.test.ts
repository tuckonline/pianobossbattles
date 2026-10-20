import {it,expect} from "vitest";
import {OverlayReceiver} from "../hosted/obs-direct";
import type {OverlayState} from "../hosted/obs-state";
const source=crypto.randomUUID(),other=crypto.randomUUID();
const snapshot={exerciseNumber:1001,title:"Hanon",hand:"both" as const,status:"practicing" as const,accuracy:100,mistakes:0,measure:1,totalMeasures:30};
const cloud=(sequence:number,sourceId=source,updatedAt=sequence):OverlayState=>({sourceId,sequence,snapshot:{...snapshot,measure:sequence},updatedAt,best:99,attempts:2});
const frame=(sequence:number,sourceId=source)=>({sourceId,sequence,updatedAt:sequence,snapshot:{...snapshot,measure:sequence}});
it("accepts peer frames only after the server identifies the active source",()=>{
  const r=new OverlayReceiver();expect(r.direct(frame(2))).toBeNull();
  r.cloud(cloud(1));expect(r.direct(frame(2,other))).toBeNull();
  expect(r.direct(frame(2))?.snapshot?.measure).toBe(2);
});
it("old cloud snapshots and out-of-order/duplicate peer frames cannot roll back the score",()=>{
  const r=new OverlayReceiver();r.cloud(cloud(1));r.direct(frame(5));
  expect(r.direct(frame(4))).toBeNull();expect(r.direct(frame(5))).toBeNull();
  const next=r.cloud({...cloud(3),best:100,attempts:3});
  expect(next).toMatchObject({sequence:5,snapshot:{measure:5},best:100,attempts:3});
  expect(r.cloud(cloud(2))?.sequence).toBe(5);
});
it("server-approved source changes retire the old connection and restart its sequence",()=>{
  const r=new OverlayReceiver();r.cloud(cloud(1));r.direct(frame(5));
  r.cloud(cloud(1,other,10));expect(r.direct(frame(6))).toBeNull();
  expect(r.direct(frame(2,other))?.snapshot?.measure).toBe(2);
  expect(r.cloud(cloud(6,source,9))?.sourceId).toBe(other);
});
it("unchanged cloud heartbeats preserve score references instead of repainting note feedback",()=>{
  const r=new OverlayReceiver(),initial=r.cloud(cloud(1));
  expect(r.cloud(cloud(1))).toBe(initial);
  const updated=r.direct(frame(3));
  expect(r.cloud(cloud(2))).toBe(updated);
});
it("rejects invalid note data and never accepts durable XP/records through the peer",()=>{
  const r=new OverlayReceiver();r.cloud(cloud(1));
  expect(r.direct({...frame(2),snapshot:{...snapshot,measure:-1}})).toBeNull();
  expect(r.direct({...frame(2),gamePlayer:{xp:999999},best:1,attempts:99})).toMatchObject({best:99,attempts:2});
  expect(r.state?.gamePlayer).toBeUndefined();
});
it("an exercise change clears scoped records until the matching cloud result arrives",()=>{
  const r=new OverlayReceiver();r.cloud(cloud(1));
  const next={...frame(2),snapshot:{...snapshot,exerciseNumber:11001,title:'C major'}};
  expect(r.direct(next)).toMatchObject({best:null,attempts:0,snapshot:{exerciseNumber:11001}});
  expect(r.cloud({...cloud(1),best:100})).toMatchObject({best:null,snapshot:{exerciseNumber:11001}});
  expect(r.cloud({...cloud(2),snapshot:next.snapshot,best:92,attempts:4})).toMatchObject({best:92,attempts:4,snapshot:{exerciseNumber:11001}});
});
