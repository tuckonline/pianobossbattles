import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import type {Pool} from 'pg';
import {createApi} from '../public-app/api';
import {handleMusic,authorizeMusicCommand,musicAdmin} from '../public-app/music-service';
const a='a0000000-0000-4000-8000-000000000001',b='b0000000-0000-4000-8000-000000000002';
const {auth}=vi.hoisted(()=>({auth:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{getUser:auth}})}));
const db=new PGlite(),pool=db as unknown as Pool;
const api=createApi('http://localhost','https://example.supabase.co','fixture');
const token=(id:string)=>`fixture.${Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.fixture`;
const request=(id:string,path:string,body?:unknown)=>api(new Request('http://localhost'+path,{method:body?'POST':'GET',headers:{cookie:`pbb_session=${token(id)}`,origin:'http://localhost'},body:body?JSON.stringify(body):undefined}),pool);
beforeAll(async()=>{
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;`);
 for(const name of ['202610200001_public_players','202610200002_music_catalog'])await db.exec(readFileSync(`supabase/migrations/${name}.sql`,'utf8'));
 const original=await db.query<{number:number;definition:string}>('SELECT number,definition FROM practice_exercises ORDER BY number');
 expect(original.rows).toHaveLength(228);
 for(const name of ['202610200003_music_publication','202610200004_existing_music_visibility'])await db.exec(readFileSync(`supabase/migrations/${name}.sql`,'utf8'));
 expect((await db.query('SELECT number,definition FROM practice_exercises WHERE number=ANY($1::bigint[]) ORDER BY number',[original.rows.map(r=>r.number)])).rows).toEqual(original.rows);
 await db.query('INSERT INTO auth.users VALUES($1,$2,$3),($4,$5,$6)',[a,'admin@example.test','{}',b,'player@example.test','{"role":"MUSIC_ADMIN","isAdmin":true}']);
 expect(await musicAdmin(pool,a)).toBe(false);expect(await musicAdmin(pool,b)).toBe(false);
 await db.query("INSERT INTO roles(id,user_id,role) VALUES($1,$2,'MUSIC_ADMIN')",[crypto.randomUUID(),a]);
 auth.mockImplementation(async(t:string)=>{const id=JSON.parse(Buffer.from(t.split('.')[1],'base64url').toString()).sub;return {data:{user:{id,email:id===a?'admin@example.test':'player@example.test',email_confirmed_at:new Date().toISOString(),user_metadata:{role:'MUSIC_ADMIN'}}},error:null};});
},30000);
afterAll(()=>db.close());
describe('Protected publication with real SQL and separate authenticated identities',()=>{
 it('preserves all definitions and denies direct client access to publication, scores and role grants',async()=>{
  expect((await db.query('SELECT count(*)::int AS n FROM practice_exercises')).rows).toEqual([{n:404}]);
  expect((await db.query('SELECT count(*)::int AS n FROM music_scores')).rows).toEqual([{n:40}]);
  for(const table of ['practice_exercises','music_collections','music_scores']){
   expect((await db.query<{relrowsecurity:boolean}>('SELECT relrowsecurity FROM pg_class WHERE relname=$1',[table])).rows[0].relrowsecurity).toBe(true);
  }
  await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${b}'`);
  for(const sql of ['SELECT * FROM music_scores','SELECT * FROM practice_exercises',"UPDATE music_collections SET published=true","INSERT INTO roles(user_id,role) VALUES('"+b+"','MUSIC_ADMIN')"]){await expect(db.exec(sql)).rejects.toThrow(/permission denied/);}
  await db.exec('RESET ROLE');
 });
 it('denies unsigned and ordinary requests despite forged profile metadata',async()=>{
  expect((await api(new Request('http://localhost/api/admin/music'),pool)).status).toBe(401);
  expect((await request(b,'/api/admin/music')).status).toBe(403);
  expect((await request(b,'/api/admin/music',{kind:'piece',id:2001,published:false})).status).toBe(403);
  expect((await request(a,'/api/admin/music')).status).toBe(200);
 });
 it('revalidates an unchanged catalog with two reads and no account/progression writes',async()=>{
  const first=await request(b,'/api/music');
  const query=vi.fn((sql:string,values?:unknown[])=>db.query(sql,values));
  const observed={query} as unknown as Pool;
  const response=await api(new Request('http://localhost/api/music',{headers:{cookie:`pbb_session=${token(b)}`,'if-none-match':first.headers.get('etag')!}}),observed);
  expect(response.status).toBe(304);
  expect(query).toHaveBeenCalledTimes(2);
  expect(query.mock.calls.every(([sql])=>sql.startsWith('SELECT '))).toBe(true);
 });
 it('keeps individual flags through collection toggles, protects content and direct battle starts, and allows admin preview',async()=>{
  const patch=(body:unknown)=>request(a,'/api/admin/music',body);
  expect((await patch({kind:'piece',id:2002,published:false})).status).toBe(200);
  const initial=await request(b,'/api/music');const etag=initial.headers.get('etag')!;
  expect((await initial.json()).pieces.some((e:{number:number})=>e.number===2002)).toBe(false);
  const unchanged=await handleMusic(new Request('http://localhost/api/music',{headers:{'if-none-match':etag}}),pool,b);expect(unchanged.status).toBe(304);
  await patch({kind:'collection',id:'schmitt-op16',published:false});
  const hidden=await request(b,'/api/music?queued=[2001,2002]');const data=await hidden.json();
  expect(hidden.headers.get('etag')).not.toBe(etag);
  expect(data.pieces.filter((e:{collection:string})=>e.collection==='schmitt-op16')).toEqual(expect.arrayContaining([expect.objectContaining({number:2001,available:false,right:[],left:[]}),expect.objectContaining({number:2002,available:false})]));
  const entries={entries:[{number:2001,loops:5}],hand:'both'};
  expect((await request(b,'/api/music/authorize',entries)).status).toBe(403);
  for(const action of ['practiceExercise','sightAttempt','gameSync'])expect((await request(b,'/api/platform',{action,exerciseNumber:2001,attemptId:crypto.randomUUID()})).status).toBe(403);
  expect((await request(a,'/api/music/authorize',entries)).status).toBe(200);
  expect((await request(a,'/api/platform',{action:'practiceExercise',exerciseNumber:2001})).status).toBe(200);
  await patch({kind:'collection',id:'schmitt-op16',published:true});
  expect((await request(b,'/api/music/authorize',entries)).status).toBe(200);
  expect((await request(b,'/api/music/authorize',{...entries,entries:[{number:2001,loops:1},{number:2002,loops:1}]})).status).toBe(403);
  expect((await db.query('SELECT published FROM practice_exercises WHERE number=2002')).rows).toEqual([{published:false}]);
 });
 it('serves private XML through authorized reads and preserves archived defaults',async()=>{
  const result=await request(b,'/api/platform',{action:'practiceExercise',exerciseNumber:4001});
  const e=await result.json();expect(result.status).toBe(200);expect(e.notationXml).toContain('<score-partwise');expect(e.notationUrl).toBeUndefined();
  const rows=(await request(b,'/api/music')).json();expect((await rows).pieces.some((e:{collection:string})=>e.collection==='repertoire-archived')).toBe(false);
 });
 it('returns only catalog metadata and loads exact scores through permission-checked detail requests',async()=>{
  const response=await request(a,'/api/music');
  const text=await response.text();
  expect(text.length).toBeLessThan(400000);
  const pieces=JSON.parse(text).pieces;
  expect(pieces).toHaveLength(404);
  for(const piece of pieces){
   expect(piece.right).toEqual([]);expect(piece.left).toEqual([]);
   expect(piece.notationXml).toBeUndefined();expect(piece.polyphony).toBeUndefined();
   expect(piece.detailsRequired).toBe(true);
  }
  for(const number of [2001,2007,2008,4001,5021]){
   const detail=await request(a,'/api/platform',{action:'practiceExercise',exerciseNumber:number});
   expect(detail.status).toBe(200);
   const actual=await detail.json();
   const stored=(await db.query<{definition:string;xml:string}>('SELECT e.definition,s.xml FROM practice_exercises e LEFT JOIN music_scores s ON s.exercise_number=e.number WHERE e.number=$1',[number])).rows[0];
   const original=JSON.parse(stored.definition);
   expect(actual).toEqual({...original,notationUrl:undefined,sourceUrl:undefined,notationXml:stored.xml??original.notationXml});
  }
  expect((await api(new Request('http://localhost/api/platform',{method:'POST',headers:{origin:'http://localhost'},body:JSON.stringify({action:'practiceExercise',exerciseNumber:4001})}),pool)).status).toBe(401);
  expect((await request(b,'/api/platform',{action:'practiceExercise',exerciseNumber:2002})).status).toBe(403);
 });
 it('preserves existing progress and revokes administrator privileges without relying on cached metadata',async()=>{
  const before=(await request(b,'/api/profile')).json();
  await request(a,'/api/admin/music',{kind:'collection',id:'schmitt-op16',published:false});
  expect(await (await request(b,'/api/profile')).json()).toEqual(await before);
  await expect(authorizeMusicCommand(pool,b,{action:'battleStorySave',challenge:{exercises:[{number:2001}]},passes:[]})).rejects.toThrow(/unavailable/);
  await db.query("DELETE FROM roles WHERE user_id=$1 AND role='MUSIC_ADMIN'",[a]);
  expect((await request(a,'/api/admin/music')).status).toBe(403);
 });
});
