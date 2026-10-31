import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import type { Pool } from "pg";
import { realmCommand } from "../public-app/realm-service";
import { realmScore } from "../src/domains/realms/content";
import { referenceEvents,performanceEnd } from "../src/domains/realms/performance";
import { clockworkKingdom } from "../src/domains/realms/registry";
import type { RunConfig } from "../src/domains/realms/types";
const db = new PGlite(),
  a = "a0000000-0000-4000-8000-000000000001",
  b = "b0000000-0000-4000-8000-000000000002";
const pool = {
  query: db.query.bind(db),
  connect: async () => ({ query: db.query.bind(db), release: () => {} }),
} as unknown as Pool;
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  await db.exec(
    readFileSync("supabase/migrations/202610200001_public_players.sql", "utf8"),
  );
  await db.query(
    "INSERT INTO auth.users VALUES($1,'a@example.test','{}'),($2,'b@example.test','{}')",
    [a, b],
  );
});
afterAll(() => db.close());
it("persists progression independently by difficulty and retains untiered records",async()=>{
 const before=(await realmCommand(pool,a,{action:"state",expectedUserId:a})).progress;
 const attempt=(difficulty:number)=>{
   const config:RunConfig={version:1,challengeId:"steady-pulse",seed:1,key:"C",tempo:difficulty===1?50:130,difficulty,curriculumVersion:2,gradingVersion:2};
   const score=realmScore(config);
   return {id:crypto.randomUUID(),config,events:referenceEvents(score),elapsedMs:performanceEnd(score)};
 };
 const novice=attempt(1);
 await realmCommand(pool,a,{action:"finish",expectedUserId:a,receipt:novice});
 await realmCommand(pool,a,{action:"finish",expectedUserId:a,receipt:novice});
 expect((await realmCommand(pool,a,{action:"state",expectedUserId:a,difficulty:1})).progress.challenges["steady-pulse"]).toMatchObject({completed:true,attempts:1});
 expect((await realmCommand(pool,a,{action:"state",expectedUserId:a,difficulty:5})).progress.challenges).toEqual({});
 await realmCommand(pool,a,{action:"finish",expectedUserId:a,receipt:attempt(5)});
 expect((await realmCommand(pool,a,{action:"state",expectedUserId:a,difficulty:5})).progress.challenges["steady-pulse"].attempts).toBe(1);
 expect((await realmCommand(pool,a,{action:"state",expectedUserId:a,difficulty:1})).progress.challenges["steady-pulse"].attempts).toBe(1);
 expect((await realmCommand(pool,a,{action:"state",expectedUserId:a})).progress).toEqual(before);
 await expect(realmCommand(pool,a,{action:"finish",expectedUserId:a,receipt:{...attempt(1),config:{...attempt(1).config,difficulty:6}}})).rejects.toThrow();
});
function receipt(challengeId: string) {
  const config: RunConfig = {
      version: 1,
      challengeId,
      seed: 1,
      key: "C",
      tempo: 80,
    },
    score = realmScore(config);
  return {
    id: crypto.randomUUID(),
    config,
    events: referenceEvents(score),
    elapsedMs: score.exercise.durationBeats! * 750,
  };
}
it("rejects bypassed locks, account swaps and malformed timelines", async () => {
  await expect(
    realmCommand(pool, a, {
      action: "finish",
      expectedUserId: a,
      receipt: receipt("clockwork-king"),
    }),
  ).rejects.toThrow(/prerequisite/);
  await expect(
    realmCommand(pool, b, { action: "state", expectedUserId: a }),
  ).rejects.toThrow(/Account changed/);
  await expect(
    realmCommand(pool, a, {
      action: "finish",
      expectedUserId: a,
      receipt: { ...receipt("steady-pulse"), elapsedMs: 0 },
    }),
  ).rejects.toThrow(/timeline/);
});
it("persists six trials, deduplicates replay and keeps progress private without modifying old XP", async () => {
  for (const c of clockworkKingdom.challenges) {
    const r = receipt(c.id),
      command = { action: "finish", expectedUserId: a, receipt: r };
    const saved = await realmCommand(pool, a, command);
    expect(saved.progress.challenges[c.id].completed).toBe(true);
    await realmCommand(pool, a, command);
    const restored = await realmCommand(pool, a, {
      action: "state",
      expectedUserId: a,
    });
    expect(restored.progress.challenges[c.id].attempts).toBe(1);
    await expect(
      realmCommand(pool, a, { ...command, receipt: { ...r, events: [] } }),
    ).rejects.toThrow(/different notes/);
  }
  const saved = await realmCommand(pool, a, {
    action: "state",
    expectedUserId: a,
  });
  expect(saved.progress.bossDefeated).toBe(true);
  expect(saved.progress.rewards).toHaveLength(6);
  expect(
    (await realmCommand(pool, b, { action: "state", expectedUserId: b }))
      .progress.challenges,
  ).toEqual({});
  expect((await db.query("SELECT * FROM game_xp_ledger")).rows).toHaveLength(0);
  await db.exec(`SET ROLE authenticated;SET request.jwt.claim.sub='${b}'`);
  expect((await db.query("SELECT * FROM game_events")).rows).toHaveLength(0);
  await expect(
    db.query(
      "INSERT INTO game_events(user_id,id,session_id,sequence,event) VALUES($1,'fake','fake',0,'{}')",
      [b],
    ),
  ).rejects.toThrow(/permission/);
  await db.exec("RESET ROLE");
});
