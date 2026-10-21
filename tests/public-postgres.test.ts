import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { PostgresBridge } from "../public-app/postgres";
import { D1Platform } from "../hosted/service";
import { catalog } from "../public-app/server-catalog";
import { noteGroups } from "../hosted/sight-library";
import { defaultGameSettings } from "../hosted/game-core";
import { handleOverlay } from "../hosted/obs-service";
import { handleShorts } from "../hosted/shorts-service";
import type { Pool } from "pg";
import { exerciseChain } from "../hosted/schmitt-chain";
import { storyChallenge, type StoryRecord } from "../hosted/battle-story";

const a="a0000000-0000-4000-8000-000000000001",b="b0000000-0000-4000-8000-000000000002";
const db=new PGlite(), bridge=new PostgresBridge(db as unknown as Pool), service=new D1Platform(bridge.asD1());
const actor={id:a,email:"a@example.test",name:"Alice",roles:["STUDENT" as const]};
beforeAll(async()=>{
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;`);
  await db.exec(readFileSync("supabase/migrations/202610200001_public_players.sql","utf8"));
  await db.exec(readFileSync("supabase/migrations/202610200002_music_catalog.sql","utf8"));
  await db.query("INSERT INTO auth.users VALUES($1,$2,$3),($4,$5,$6)",[a,"a@example.test",'{"name":"Alice"}',b,"b@example.test",'{"name":"Bob"}']);
});
afterAll(()=>db.close());
describe("Public PostgreSQL persistence with the original evaluator",()=>{
  it("locks down every table and trigger even with Supabase's permissive default grants",async()=>{
    const tables=await db.query<{name:string;rls:boolean;policies:number;anon_read:boolean;client_write:boolean}>(`SELECT c.relname AS name,c.relrowsecurity AS rls,
      (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid=c.oid) AS policies,
      has_table_privilege('anon',c.oid,'SELECT') AS anon_read,
      has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE') AS client_write
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'`);
    expect(tables.rows).toHaveLength(19);
    for(const t of tables.rows){expect(t.rls,t.name).toBe(true);expect(t.anon_read,t.name).toBe(false);expect(t.client_write,t.name).toBe(false);expect(t.policies,t.name).toBe(['mutation_guards','practice_exercises'].includes(t.name)?0:1);}
    expect((await db.query("SELECT has_function_privilege('authenticated','public.create_player_profile()','EXECUTE') AS allowed")).rows).toEqual([{allowed:false}]);
  });
  it("synchronizes Auth profile changes and supports deletion of a populated account",async()=>{
    const id='c0000000-0000-4000-8000-000000000003';
    await db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[id,'before@example.test','{"name":"Before"}']);
    await service.ensureUser(id,'before@example.test','Before');
    await service.command({id,email:'before@example.test',name:'Before',roles:['STUDENT']},{action:'gameSettings',settings:defaultGameSettings});
    await db.query('UPDATE auth.users SET email=$2,raw_user_meta_data=$3 WHERE id=$1',[id,'after@example.test','{"name":"After"}']);
    expect((await db.query('SELECT email,name FROM public.users WHERE id=$1',[id])).rows).toEqual([{email:'after@example.test',name:'After'}]);
    await db.query('DELETE FROM auth.users WHERE id=$1',[id]);
    expect((await db.query('SELECT * FROM game_players WHERE user_id=$1',[id])).rows).toHaveLength(0);
    expect((await db.query('SELECT * FROM roles WHERE user_id=$1',[id])).rows).toHaveLength(0);
  });
  it("creates profiles on signup and denies cross-player reads and all direct XP writes",async()=>{
    await service.ensureUser(a,actor.email,actor.name);
    await service.command(actor,{action:"gameSettings",settings:defaultGameSettings});
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${b}';`);
    expect((await db.query("SELECT id FROM users")).rows).toEqual([{id:b}]);
    expect((await db.query("SELECT * FROM game_players")).rows).toHaveLength(0);
    await expect(db.exec("UPDATE game_players SET total_xp=99999")).rejects.toThrow(/permission denied/i);
    await expect(db.exec(`INSERT INTO game_unlocks VALUES('${b}','fake','fake','fake','now',500)`)).rejects.toThrow(/permission denied/i);
    await db.exec("RESET ROLE");
  });
  it("evaluates notes, persists XP once, and rejects rewritten checkpoints and wrong account IDs",async()=>{
    const exercise=catalog.find(e=>e.number===2001)!;
    const played=noteGroups(exercise,"both").flatMap(g=>g.pitches);
    const payload={action:"gameSync",expectedUserId:a,sessionId:crypto.randomUUID(),attemptId:crypto.randomUUID(),sequence:1,exerciseNumber:exercise.number,hand:"both",played,status:"completed",activeMs:30000,omitClosing:false};
    const first=await service.command(actor,payload) as {xp:number;unlocks:unknown[]};
    expect(first.xp).toBeGreaterThan(0);
    const retry=await service.command(actor,payload) as {xp:number};
    expect(retry.xp).toBe(first.xp);
    const next=await service.command(actor,{...payload,sequence:2}) as {xp:number};
    expect(next.xp).toBe(first.xp);
    await expect(service.command({...actor,id:b},payload)).rejects.toThrow(/account changed/);
    const partial={...payload,attemptId:crypto.randomUUID(),played:played.slice(0,4),status:"playing"};
    await service.command(actor,partial);
    await expect(service.command(actor,{...partial,sequence:2,played:[1,2,3,4,5]})).rejects.toThrow(/rewritten/);
    await service.command(actor,{action:"gameSessionEnd",sessionId:payload.sessionId});
    const saved=await service.command(actor,{action:"gameState",sessionId:payload.sessionId}) as {summary:{ended:boolean}};
    expect(saved.summary.ended).toBe(true);
  });
  it("keeps settings complete and rejects unauthorized actions via existing role checks",async()=>{
    const saved=await service.command(actor,{action:"gameSettings",settings:{...defaultGameSettings,bossBattle:{...defaultGameSettings.bossBattle,enabled:true}}}) as {settings:typeof defaultGameSettings};
    expect(saved.settings.bossBattle.enabled).toBe(true);
    await expect(service.command(actor,{action:"createCourse",title:"Not permitted"})).rejects.toThrow();
  });
  it("persists notation appearance independently of gameplay and other players",async()=>{
    for(const notationPreset of ['classic','studio','slate','night'] as const){
      await service.command(actor,{action:'gameSettings',settings:{...defaultGameSettings,notationPreset}});
      const restored=await service.command(actor,{action:'gameState'}) as {settings:typeof defaultGameSettings};
      expect(restored.settings.notationPreset).toBe(notationPreset);
      expect(restored.settings.bossBattle).toEqual(defaultGameSettings.bossBattle);
    }
    const other=await service.command({...actor,id:b},{action:'gameState'}) as {settings:typeof defaultGameSettings};
    expect(other.settings.notationPreset).toBe('studio');
  });
  it("saves player audio presets without changing the audience mix",async()=>{
    const bossBattle={...defaultGameSettings.bossBattle,audioOutput:'obs' as const,soundEnabled:true,volume:.13};
    for(const mode of ['focus','immersive','cinematic'] as const){
      await service.command(actor,{action:'gameSettings',settings:{...defaultGameSettings,bossBattle,playerAudio:{mode,volume:.06}}});
      const restored=await service.command(actor,{action:'gameState'}) as {settings:typeof defaultGameSettings};
      expect(restored.settings.playerAudio).toEqual({mode,volume:.06});
      expect(restored.settings.bossBattle).toEqual(bossBattle);
    }
  });
  it("uses actual mixed music and accounts for every loop without changing battle notes",()=>{
    const plan=exerciseChain([{exercise:catalog.find(e=>e.number===2001)!,loops:3},{exercise:catalog.find(e=>e.number===4001)!,loops:2}],"both");
    expect(plan.loops).toBe(5);expect(plan.notes).toBeGreaterThan(100);
  });
  it("stores battle history idempotently and never replaces a better personal best with a worse result",async()=>{
    const exercise=catalog.find(e=>e.number===2002)!;
    const notes=noteGroups(exercise,"both").flatMap(g=>g.pitches);
    const challenge=storyChallenge({...defaultGameSettings.bossBattle,enabled:true},"both",[{number:exercise.number,loops:1}]);
    const save=async(count:number,finishedAt:number)=>{
      const attemptId=crypto.randomUUID();
      await service.command(actor,{action:"gameSync",expectedUserId:a,attemptId,sessionId:crypto.randomUUID(),sequence:1,exerciseNumber:exercise.number,hand:"both",played:notes.slice(0,count),status:"playing",activeMs:5000});
      const receipt={action:"battleStorySave",expectedUserId:a,challenge,result:{attemptId,finishedAt,result:"defeat",correct:count,mistakes:0,bestCombo:count,completed:0,total:1,accuracy:100},passes:[{id:attemptId,notes:count}]};
      const records=await service.command(actor,receipt) as StoryRecord[];
      expect(await service.command(actor,receipt)).toEqual(records);
      return records;
    };
    expect((await save(10,100))[0].best.correct).toBe(10);
    const second=await save(4,200);
    expect(second[0].best.correct).toBe(10);
    expect(second[0].last.correct).toBe(4);
    expect(await service.command({...actor,id:b},{action:"battleStoryRecords"})).toEqual([]);
  });
  it("preserves OBS reads and isolates one user's snapshot from another",async()=>{
    const response=await handleOverlay(new Request("http://localhost/api/obs"),bridge.asD1(),b);
    expect((await response.json()).snapshot).toBeNull();
    const shorts=await handleShorts(new Request("http://localhost/api/shorts"),bridge.asD1(),b);
    expect(await shorts.json()).toEqual([]);
    const snapshot={exerciseNumber:2001,title:"Schmitt 1",hand:"both",status:"practicing",accuracy:100,mistakes:0,measure:1,totalMeasures:3};
    const sourceId=crypto.randomUUID();
    const post=()=>handleOverlay(new Request("http://localhost/api/obs",{method:"POST",body:JSON.stringify({sourceId,sequence:1,claim:true,snapshot})}),bridge.asD1(),a);
    expect(await (await post()).json()).toEqual({accepted:true});
    expect(await (await post()).json()).toEqual({accepted:false});
    expect((await (await handleOverlay(new Request("http://localhost/api/obs"),bridge.asD1(),a)).json()).snapshot).toEqual(snapshot);
  });
});
