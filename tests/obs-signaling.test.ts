import {beforeAll,afterAll,it,expect} from "vitest";
import {Miniflare} from "miniflare";
import {readFileSync} from "node:fs";
import type {D1Database} from "@cloudflare/workers-types";
import {handleScoreSignaling} from "../hosted/obs-signaling";
const mf=new Miniflare({modules:true,script:"export default {fetch(){return new Response('ok')}}",d1Databases:["DB"]});
let db:D1Database;
const source=crypto.randomUUID(),viewer=crypto.randomUUID();
beforeAll(async()=>{
  db=await mf.getD1Database("DB") as unknown as D1Database;
  await db.exec("CREATE TABLE obs_sessions(user_id TEXT PRIMARY KEY, source_id TEXT);");
  for(const sql of readFileSync("drizzle/0021_obs_direct_score.sql","utf8").split("--> statement-breakpoint"))await db.prepare(sql).run();
  await db.prepare("INSERT INTO obs_sessions VALUES('owner',?)").bind(source).run();
});
afterAll(()=>mf.dispose());
async function call(user:string,body?:{type:"offer"|"answer";sdp:string},id=viewer,src=source){
  const url=`http://localhost/api/obs?rtc=1&sourceId=${src}${id?`&viewerId=${id}`:""}`;
  return (await handleScoreSignaling(new Request(url,body?{method:"POST",body:JSON.stringify({...body,sourceId:src,viewerId:id})}:{}),db,user)).json();
}
it("pairs only the same authenticated user and active practice source",async()=>{
  expect(await call("other",{type:"offer",sdp:"private offer"})).toMatchObject({active:false});
  expect(await call("owner",{type:"offer",sdp:"private offer"})).toMatchObject({active:true});
  expect(await call("other",undefined,"")).toMatchObject({active:false,offers:[]});
  expect(await call("owner",undefined,"")).toMatchObject({offers:[{viewerId:viewer,sdp:"private offer"}]});
  await call("other",{type:"answer",sdp:"wrong answer"});expect(await call("owner")).toMatchObject({answer:null});
  await call("owner",{type:"answer",sdp:"private answer"});expect(await call("owner")).toMatchObject({answer:"private answer"});
  expect(await call("owner",undefined,"",crypto.randomUUID())).toMatchObject({active:false});
});
it("expires old negotiations and bounds reconnect storage without touching practice data",async()=>{
  await db.prepare("UPDATE obs_score_peers SET created_at=0").run();
  expect(await call("owner")).toMatchObject({answer:null});
  for(let i=0;i<12;i++)await call("owner",{type:"offer",sdp:`offer ${i}`},crypto.randomUUID());
  const count=await db.prepare("SELECT COUNT(*) AS n FROM obs_score_peers").first<{n:number}>();
  expect(count?.n).toBeLessThanOrEqual(8);
  expect((await call("owner",undefined,"")).offers).toHaveLength(8);
});
