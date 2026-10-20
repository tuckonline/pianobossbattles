import {it,expect} from "vitest";
import {battleView,createBattle,type BattleView} from "../hosted/boss-battle";
import {defaultBossBattleConfig} from "../hosted/boss-config";
import {BattleFinisherTracker,FINISHER_DURATION_MS} from "../hosted/battle-finisher";
const active=():BattleView=>({...battleView(createBattle({...defaultBossBattleConfig,enabled:true},50)),attemptId:"a",status:"active"});
const win=():BattleView=>({...active(),status:"victory",bossHp:0,lastAt:1000});
const loss=():BattleView=>({...active(),status:"defeat",playerHp:0,result:"knockout",lastAt:1000});
it("victory engulfs only the defeated boss in blue and never mutates HP",()=>{
  const tracker=new BattleFinisherTracker(active()),b=win(),saved=structuredClone(b);
  expect(tracker.receive(b,1000)).toMatchObject({target:"boss",tone:"blue"});expect(b).toEqual(saved);
});
it("knockout engulfs only the defeated player in red",()=>{
  expect(new BattleFinisherTracker(active()).receive(loss(),1000)).toMatchObject({target:"player",tone:"red"});
});
it("duplicate snapshots neither restart nor replay the ending",()=>{
  const t=new BattleFinisherTracker(active()),cue=t.receive(win(),1000);
  expect(t.receive(win(),1100)).toBe(cue);expect(t.receive(win(),1000+FINISHER_DURATION_MS)).toBeUndefined();
  expect(t.receive({...win(),lastAt:6000,revision:100},6000)).toBeUndefined();
});
it("an OBS reconnect restores results without old flames",()=>{
  expect(new BattleFinisherTracker(win()).receive(win(),1050)).toBeUndefined();
  expect(new BattleFinisherTracker(loss()).receive(loss(),1050)).toBeUndefined();
});
it("abandonment and unfinished attempts never get a knockout ending",()=>{
  for(const result of ["abandoned","unfinished"] as const)expect(new BattleFinisherTracker(active()).receive({...loss(),result},1000)).toBeUndefined();
});
it("stale and disconnected results are consumed without replay",()=>{
  const t=new BattleFinisherTracker(active());expect(t.receive(win(),1000,true)).toBeUndefined();expect(t.receive(win(),1100)).toBeUndefined();
  expect(new BattleFinisherTracker(active()).receive(win(),4000)).toBeUndefined();
});
it("new attempts cancel existing flames and may have their own ending",()=>{
  const t=new BattleFinisherTracker(active());t.receive(win(),1000);
  expect(t.receive({...active(),attemptId:"b"},1100)).toBeUndefined();
  expect(t.receive({...loss(),attemptId:"b",lastAt:1200},1200)).toMatchObject({target:"player",tone:"red"});
});
it("a disconnect cancels an in-progress ending",()=>{
  const t=new BattleFinisherTracker(active());t.receive(win(),1000);expect(t.receive(win(),1100,true)).toBeUndefined();expect(t.receive(win(),1200)).toBeUndefined();
});
