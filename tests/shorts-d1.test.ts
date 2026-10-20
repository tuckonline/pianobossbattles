import {beforeAll,afterAll,it,expect} from 'vitest';
import {Miniflare} from 'miniflare';
import {readFileSync} from 'node:fs';
const mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-05-01',d1Databases:['DB']});
beforeAll(async()=>{const db=await mf.getD1Database('DB');for(const sql of readFileSync('drizzle/0022_shorts_sessions.sql','utf8').split('--> statement-breakpoint'))await db.prepare(sql).run();});
afterAll(()=>mf.dispose());
const session={version:1,id:crypto.randomUUID(),revision:1,title:'Recording',startedAt:new Date().toISOString(),status:'stopped',profile:'vertical-1080x1920',events:[],segments:[],anchors:[],edits:[],targetSeconds:30,maxSeconds:180};
const headers={'oai-authenticated-user-id':'shorts-owner','oai-authenticated-user-email':'shorts@example.test',origin:'https://example.test','Content-Type':'application/json'};
it('requires sign-in and same-origin writes',async()=>{expect((await mf.dispatchFetch('https://example.test/api/shorts')).status).toBe(401);expect((await mf.dispatchFetch('https://example.test/api/shorts',{method:'POST',headers:{...headers,origin:'https://attacker.test'},body:JSON.stringify({session})})).status).toBe(403);});
it('persists metadata idempotently, isolates accounts and rejects stale edits',async()=>{
  for(const body of ['{','null','{}'])expect((await mf.dispatchFetch('https://example.test/api/shorts',{method:'POST',headers,body})).status).toBe(400);
  const put=(value:unknown)=>mf.dispatchFetch('https://example.test/api/shorts',{method:'POST',headers,body:JSON.stringify({session:value})});
  expect((await put(session)).status).toBe(200);expect((await put(session)).status).toBe(200);
  expect((await mf.dispatchFetch(`https://example.test/api/shorts?id=${session.id}`,{headers:{...headers,'oai-authenticated-user-id':'other'}})).status).toBe(404);
  expect((await put({...session,revision:2,title:'Edited'})).status).toBe(200);expect((await put({...session,title:'Stale'})).status).toBe(409);
  const read=await mf.dispatchFetch(`https://example.test/api/shorts?id=${session.id}`,{headers});expect((await read.json() as {title:string}).title).toBe('Edited');
});
