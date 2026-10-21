import {defaultBossBattleConfig} from '../hosted/boss-config';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import type {Pool} from 'pg';
import {handleCreatorControl,handleCreatorView,creatorBattleConfig} from '../public-app/creator-service';
import {defaultCreatorPreferences} from '../public-app/creator-config';
const db=new PGlite(),pool=db as unknown as Pool;
const admin='a0000000-0000-4000-8000-000000000001',player='b0000000-0000-4000-8000-000000000002';
const request=(path:string,body?:unknown,cookie?:string)=>new Request('https://example.test'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
let cookie='';
beforeAll(async()=>{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE TABLE roles(user_id uuid,role text);CREATE TABLE practice_exercises(number bigint PRIMARY KEY,definition text);CREATE TABLE music_scores(exercise_number bigint,xml text);CREATE TABLE obs_sessions(user_id uuid,snapshot text);ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;`);
 await db.exec(readFileSync('supabase/migrations/202610200005_creator_studio.sql','utf8'));
 await db.query('INSERT INTO auth.users VALUES($1),($2)',[admin,player]);await db.query("INSERT INTO roles VALUES($1,'MUSIC_ADMIN')",[admin]);
 await db.query('INSERT INTO practice_exercises VALUES(2001,$1),(2002,$1),(2003,$1)',[JSON.stringify({number:2001,title:'Fixture',right:[],left:[]})]);
});
afterAll(()=>db.close());
it('denies ordinary players and direct Supabase table access',async()=>{
 await expect(handleCreatorControl(request('/api/creator'),pool,player)).rejects.toMatchObject({status:403});
 const r=await db.query<{relrowsecurity:boolean;read:boolean;write:boolean}>("SELECT relrowsecurity,has_table_privilege('anon',oid,'SELECT') AS read,has_table_privilege('authenticated',oid,'INSERT,UPDATE,DELETE') AS write FROM pg_class WHERE relname IN ('creator_sessions','creator_peers')");
 expect(r.rows).toHaveLength(2);for(const row of r.rows)expect(row).toEqual({relrowsecurity:true,read:false,write:false});
});
it('stores separate validated preferences and hashes viewing secrets',async()=>{
 await handleCreatorControl(request('/api/creator'),pool,admin);
 await handleCreatorControl(request('/api/creator',{action:'preferences',preferences:{...defaultCreatorPreferences,notation:'night'}}),pool,admin);
 const {token}=await (await handleCreatorControl(request('/api/creator',{action:'rotate'}),pool,admin)).json();
 expect(token).toHaveLength(43);
 const row=(await db.query<{view_hash:string}>('SELECT view_hash FROM creator_sessions')).rows[0];expect(row.view_hash).not.toBe(token);
 const r=await handleCreatorView(request('/api/creator/view/exchange',{token}),pool);cookie=r.headers.get('set-cookie')!.split(';')[0];expect(r.headers.get('set-cookie')).toContain('HttpOnly');expect(r.headers.get('set-cookie')).toContain('Path=/api/creator/view');
});
it('viewer restores the creator snapshot without records and cannot publish or read arbitrary scores',async()=>{
 const sourceId='c0000000-0000-4000-8000-000000000003';
 const snapshot={exerciseNumber:2001,title:'Fixture',hand:'both',status:'ready',accuracy:null,mistakes:0,measure:1,totalMeasures:1};
 await handleCreatorControl(request('/api/creator/stream',{sourceId,sequence:1,claim:true,snapshot}),pool,admin);
 const state=await(await handleCreatorView(request('/api/creator/view',undefined,cookie),pool)).json();
 expect(state.snapshot).toEqual(snapshot);expect(state.creator.notation).toBe('night');expect(state).not.toHaveProperty('gamePlayer');expect(state).not.toHaveProperty('user_id');
 expect((await db.query('SELECT * FROM obs_sessions')).rows).toHaveLength(0);
 await expect(handleCreatorView(request('/api/creator/view',{snapshot},cookie),pool)).rejects.toMatchObject({status:403});
 await expect(handleCreatorView(request('/api/creator/view/score?number=2003',undefined,cookie),pool)).rejects.toMatchObject({status:403});
 expect((await handleCreatorView(request('/api/creator/view/score?number=2001',undefined,cookie),pool)).status).toBe(200);
 await expect(handleCreatorView(request(`/api/creator/view?rtc=1&sourceId=${sourceId}`,undefined,cookie),pool)).rejects.toMatchObject({status:403});
 await expect(handleCreatorView(request(`/api/creator/view?rtc=1&sourceId=${sourceId}`,{type:'answer'},cookie),pool)).rejects.toMatchObject({status:403});
});
it('revokes existing viewer cookies immediately and rejects expired links',async()=>{
 await handleCreatorControl(request('/api/creator',{action:'revoke'}),pool,admin);
 await expect(handleCreatorView(request('/api/creator/view',undefined,cookie),pool)).rejects.toMatchObject({status:401});
 const {token}=await(await handleCreatorControl(request('/api/creator',{action:'rotate'}),pool,admin)).json();
 await db.query('UPDATE creator_sessions SET view_expires=0');
 await expect(handleCreatorView(request('/api/creator/view/exchange',{token}),pool)).rejects.toMatchObject({status:401});
});

it('creator battle choices are separate and require trusted administrator access',async()=>{
 const config={...defaultBossBattleConfig,gameMode:'ultimateBoss',selectedBpm:90};
 await creatorBattleConfig(pool,admin,defaultBossBattleConfig,config);
 expect(await creatorBattleConfig(pool,admin,defaultBossBattleConfig)).toMatchObject({gameMode:'ultimateBoss',selectedBpm:90});
 await expect(creatorBattleConfig(pool,player,defaultBossBattleConfig,config)).rejects.toMatchObject({status:403});
});
