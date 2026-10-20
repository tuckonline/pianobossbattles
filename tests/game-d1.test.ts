import { beforeAll, afterAll, it, expect } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import type { D1Database } from "@cloudflare/workers-types";
import { D1Platform } from "../hosted/service";
import { scalesLibrary } from "../hosted/scales-library";
import { noteGroups } from "../hosted/sight-library";
import type { GameState, GameSync } from "../hosted/game-service";
import { defaultGameSettings } from "../hosted/game-core";
import { defaultBossBattleConfig } from "../hosted/boss-config";
import {storyChallenge,type StoryReceipt,type StoryRecord} from '../hosted/battle-story';
const mf = new Miniflare({
  modules: true,
  scriptPath: "dist/server/index.js",
  compatibilityDate: "2026-05-01",
  d1Databases: ["DB"],
});
let p: D1Platform;
beforeAll(async () => {
  const db = await mf.getD1Database("DB");
  for (const file of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    for (const sql of readFileSync(`drizzle/${file}`, "utf8").split(
      "--> statement-breakpoint",
    ))
      if (sql.trim()) await db.prepare(sql).run();
  p = new D1Platform(db as unknown as D1Database);
});
afterAll(() => mf.dispose());
async function actor() {
  const id = crypto.randomUUID();
  return p.ensureUser(id, `${id}@example.test`, "Tester");
}
const notes = noteGroups(scalesLibrary[0], "both").flatMap((g) => g.pitches);

it('saves battle records once, validates note receipts, preserves better PBs and keeps challenge conditions separate',async()=>{
 const a=await actor(),sessionId=crypto.randomUUID();
 const make=async(count:number,finishedAt:number)=>{
  const attemptId=crypto.randomUUID(),played=notes.slice(0,count);
  await p.command(a,{action:'gameSync',attemptId,sessionId,sequence:1,exerciseNumber:scalesLibrary[0].number,hand:'both',played,status:'playing',activeMs:1000});
  const r:StoryReceipt={action:'battleStorySave',expectedUserId:a.id,challenge:storyChallenge({...defaultBossBattleConfig,enabled:true},'both',[{number:scalesLibrary[0].number,loops:1}]),
   result:{attemptId,finishedAt,result:count===notes.length?'victory':'defeat',correct:count,mistakes:0,bestCombo:count,completed:count===notes.length?1:0,total:1,accuracy:100},passes:[{id:attemptId,notes:count}]};
  return r;
 };
 const first=await make(10,1);
 await expect(p.command(a,{...first,result:{...first.result,correct:50}})).rejects.toThrow('does not match');
 await p.command(a,first);await p.command(a,first);
 const lower=await make(4,2),tie=await make(10,3);
 await p.command(a,lower);await p.command(a,tie);
 let records=await p.command(a,{action:'battleStoryRecords'}) as StoryRecord[];
 expect(records[0].best.attemptId).toBe(first.result.attemptId);expect(records[0].last.attemptId).toBe(tie.result.attemptId);
 expect((await p.all('SELECT * FROM battle_story_attempts WHERE user_id=?',a.id)).length).toBe(3);
 const win=await make(notes.length,4);await p.command(a,win);
 records=await p.command(a,{action:'battleStoryRecords'}) as StoryRecord[];
 expect(records[0].best.result).toBe('victory');expect(records[0].best.completed).toBe(1);
 const other=await make(5,5);other.challenge={...other.challenge,boss:'grinwick',damage:30};
 expect((await p.command(a,other) as StoryRecord[]).length).toBe(2);
 const outsider=await actor();await expect(p.command(outsider,other)).rejects.toThrow('account changed');
},30000);

it('counts an exercise only after all loops and recovers the same immutable terminal prefix',async()=>{
 const a=await actor(),sessionId=crypto.randomUUID(),ids=[crypto.randomUUID(),crypto.randomUUID()];
 for(const [i,attemptId] of ids.entries())await p.command(a,{action:'gameSync',attemptId,sessionId,sequence:1,exerciseNumber:scalesLibrary[0].number,hand:'both',played:notes,status:i===0?'completed':'playing',activeMs:1000});
 const receipt:StoryReceipt={action:'battleStorySave',expectedUserId:a.id,
  challenge:storyChallenge({...defaultBossBattleConfig,enabled:true},'both',[{number:scalesLibrary[0].number,loops:2}]),
  result:{attemptId:ids[0],finishedAt:1,result:'defeat',correct:notes.length+4,mistakes:0,bestCombo:0,completed:0,total:1,accuracy:100},
  passes:[{id:ids[0],notes:notes.length},{id:ids[1],notes:4}]};
 const records=await p.command(a,receipt) as StoryRecord[];
 expect(records[0].best.completed).toBe(0);expect(records[0].best.bestCombo).toBe(notes.length+4);
 expect((await p.command(a,receipt) as StoryRecord[])[0]).toEqual(records[0]);
},30000);
const input = (): GameSync => ({
  action: "gameSync",
  sessionId: crypto.randomUUID(),
  attemptId: crypto.randomUUID(),
  sequence: 1,
  exerciseNumber: 11001,
  hand: "both",
  omitClosing: false,
  played: notes,
  status: "completed",
  activeMs: 0,
});
it("upgrades an actual pre-V9 saved profile on read without resetting progress or preferences", async () => {
  const a = await actor();
  const before = await p.command(a, input()) as GameState;
  const oldBoss: Record<string, unknown> = {...defaultBossBattleConfig, enabled:true, bossDamagePerMistake:15, multiRoundEnabled:true};
  for (const key of ['gameMode','selectedBpm','allowanceMultiplier','explicitTimeLimitSeconds','powerThreshold','adaptivePower']) delete oldBoss[key];
  const saved = JSON.stringify({...defaultGameSettings, sound:true, volume:0.2, timezone:'America/Los_Angeles', bossBattle:oldBoss});
  // Bypass the current settings-write validator: this is what old production
  // rows contain, not a newly saved row that already has the V9 defaults.
  await p.stmt('UPDATE game_players SET settings=? WHERE user_id=?',saved,a.id).run();
  const restored = await p.command(a,{action:'gameState'}) as GameState;
  expect(restored.settings).toMatchObject({sound:true,volume:0.2,timezone:'America/Los_Angeles',bossBattle:{enabled:true,bossDamagePerMistake:15,multiRoundEnabled:false,gameMode:'survival',selectedBpm:60,powerThreshold:100,adaptivePower:true}});
  expect(restored.xp).toBe(before.xp);expect(restored.unlocks).toEqual(before.unlocks);expect(restored.best).toBe(before.best);
  expect((await p.one<{settings:string}>('SELECT settings FROM game_players WHERE user_id=?',a.id))?.settings).toBe(saved);
  const synced = await p.command(a,{...input(),played:[],status:'abandoned'}) as GameState;
  expect(synced.settings).toEqual(restored.settings);expect(synced.xp).toBe(before.xp);
});
it("carries streaks across loops and exercises; thresholds repeat only after a mistake", async () => {
  const a = await actor();
  const first = input();
  const one = await p.command(a, first) as GameState;
  expect(one.streak).toBe(notes.length);
  expect(one.celebrations.filter(e=>e.kind === 'milestone').map(e=>e.title)).toEqual(['10 notes in a row','25 notes in a row']);
  const loop = {...input(),sessionId:first.sessionId,played:notes.slice(0,4),status:'playing' as const};
  let two = await p.command(a,loop) as GameState;
  expect(two.streak).toBe(notes.length+4);
  two = await p.command(a,{...loop,sequence:2,status:'paused'}) as GameState;
  expect(two.streak).toBe(notes.length+4);
  two = await p.command(a,{...loop,sequence:3,status:'abandoned'}) as GameState;
  expect(two.streak).toBe(notes.length+4);
  expect(two.celebrations.filter(e=>e.kind==='milestone')).toEqual([]);
  const other = {...input(),sessionId:first.sessionId,exerciseNumber:scalesLibrary[1].number,played:noteGroups(scalesLibrary[1],'both').flatMap(g=>g.pitches)};
  const three = await p.command(a,other) as GameState;
  expect(three.streak).toBe(notes.length+4+other.played.length);
  expect(three.celebrations.filter(e=>e.kind==='milestone').map(e=>e.title)).toContain('50 notes in a row');
  expect((await p.command(a,other) as GameState).celebrations).toEqual([]);
  expect((await p.command(a,{action:'gameState'}) as GameState).streak).toBe(three.streak);
  const wrong = {...input(),played:[1],status:'playing' as const};
  expect((await p.command(a,wrong) as GameState).streak).toBe(0);
  const again = await p.command(a,{...wrong,sequence:2,played:[1,...notes],status:'completed'}) as GameState;
  expect(again.streak).toBe(notes.length);
  const repeated = again.celebrations.filter(e=>e.kind==='milestone');
  expect(repeated.map(e=>e.title)).toEqual(['10 notes in a row','25 notes in a row']);
  expect(repeated.every(e=>!one.celebrations.some(old=>old.id === e.id))).toBe(true);
  expect(again.celebrations.filter(e=>e.kind==='achievement')).toEqual([]);
});
it("announces each crossing within a batch and never duplicates checkpoint retries", async () => {
  const a = await actor();
  const c = {...input(),played:[...notes.slice(0,10),1,...notes.slice(10)]};
  const r = await p.command(a,c) as GameState;
  const alerts = r.celebrations.filter(e=>e.kind==='milestone');
  expect(alerts.map(e=>e.title)).toEqual(['10 notes in a row','10 notes in a row']);
  expect(new Set(alerts.map(e=>e.id)).size).toBe(2);
  expect((await p.command(a,c) as GameState).celebrations).toEqual([]);
});
it("announces precisely at a new threshold, not on every later checkpoint", async () => {
  const a = await actor();
  const c = {...input(),status:'playing' as const,played:notes.slice(0,9)};
  expect((await p.command(a,c) as GameState).celebrations).toEqual([]);
  const ten = await p.command(a,{...c,sequence:2,played:notes.slice(0,10)}) as GameState;
  expect(ten.celebrations.filter(e=>e.kind==='milestone').map(e=>e.title)).toEqual(['10 notes in a row']);
  const eleven = await p.command(a,{...c,sequence:3,played:notes.slice(0,11)}) as GameState;
  expect(eleven.celebrations.filter(e=>e.kind==='milestone')).toEqual([]);
});
it("awards each note once, exclusive bonuses and unique achievements atomically across duplicate retries", async () => {
  const a = await actor(),
    c = input();
  const results = await Promise.all([p.command(a, c), p.command(a, c)]);
  const state = results[1] as GameState;
  // 30 notes × 2 + completion30 + accuracy75 + daily50 + first25 + combo25 + precision75 + flawless125
  expect(state.xp).toBe(notes.length * 2 + 405);
  expect(state.unlocks.map((x) => x.achievementId).sort()).toEqual([
    "finding_my_rhythm",
    "first_steps",
    "flawless_victory",
    "precision_player",
  ]);
  const again = (await p.command(a, c)) as GameState;
  expect(again.xp).toBe(state.xp);
  const ledger = await p.all<{ rewardId: string }>(
    "SELECT reward_id FROM game_xp_ledger WHERE user_id=?",
    a.id,
  );
  expect(new Set(ledger.map((r) => r.rewardId)).size).toBe(ledger.length);
  expect(
    (
      await p.one<{ count: number }>(
        `SELECT COUNT(*) AS count FROM game_xp_ledger l LEFT JOIN game_events e ON e.user_id=l.user_id AND e.id=l.source_event_id WHERE l.user_id=? AND e.id IS NULL`,
        a.id,
      )
    )?.count,
  ).toBe(0);

  expect(
    (
      (await p.command(a, {
        action: "gameState",
        sessionId: c.sessionId,
      })) as GameState
    ).xp,
  ).toBe(state.xp);
});
it("persists legitimate partial notes but no completion bonus on abandonment; rejects forged completion", async () => {
  const a = await actor(),
    c = { ...input(), played: notes.slice(0, 4), status: "playing" as const };
  expect(((await p.command(a, c)) as GameState).xp).toBe(8);
  await expect(
    p.command(a, { ...c, sequence: 2, status: "completed" }),
  ).rejects.toThrow("Complete");
  const abandoned = (await p.command(a, {
    ...c,
    sequence: 3,
    status: "abandoned",
  })) as GameState;
  expect(abandoned.xp).toBe(8);
  expect(
    ((await p.command(a, { ...c, sequence: 2, played: notes })) as GameState)
      .xp,
  ).toBe(8);
  expect(abandoned.summary).toMatchObject({
    completed: 0,
    correct: 4,
    earnedXP: 8,
  });
});
it("ignores stale checkpoint sequences and validates immutable note prefixes", async () => {
  const a = await actor(),
    c = {
      ...input(),
      status: "playing" as const,
      played: notes.slice(0, 8),
      sequence: 3,
    };
  const first = (await p.command(a, c)) as GameState;
  expect(
    (
      (await p.command(a, {
        ...c,
        sequence: 2,
        played: notes.slice(0, 2),
      })) as GameState
    ).xp,
  ).toBe(first.xp);
  await expect(
    p.command(a, { ...c, sequence: 4, played: [61, ...c.played] }),
  ).rejects.toThrow("rewritten");
  const finished = (await p.command(a, {
    ...c,
    sequence: 5,
    played: notes,
    status: "completed",
  })) as GameState;
  expect(finished.xp).toBe(notes.length * 2 + 405);
});
it("qualifies PBs only after a baseline in the same configuration and grants daily rewards once", async () => {
  const a = await actor(),
    first = input();
  await p.command(a, { ...first, played: [61, ...notes] });
  const next = { ...first, attemptId: crypto.randomUUID() };
  await p.command(a, next);
  const pb = await p.all<{ amount: number }>(
    "SELECT amount FROM game_xp_ledger WHERE user_id=? AND category='accuracy_pb'",
    a.id,
  );
  expect(pb).toEqual([{ amount: 50 }]);
  await p.command(a, {
    ...next,
    attemptId: crypto.randomUUID(),
    hand: "right",
    played: noteGroups(scalesLibrary[0], "right").flatMap((g) => g.pitches),
  });
  expect(
    (
      await p.all(
        "SELECT * FROM game_xp_ledger WHERE user_id=? AND category='accuracy_pb'",
        a.id,
      )
    ).length,
  ).toBe(1);
  expect(
    (
      await p.all(
        "SELECT * FROM game_xp_ledger WHERE user_id=? AND category='daily'",
        a.id,
      )
    ).length,
  ).toBe(1);
  const ended = (await p.command(a, {
    action: "gameSessionEnd",
    sessionId: first.sessionId,
  })) as GameState;
  expect(ended.summary).toMatchObject({
    ended: true,
    completed: 3,
    personalBests: 1,
  });
});
it("never trusts client XP or unlock claims, and reconnect reads cannot issue rewards", async () => {
  const a = await actor();
  await p.command(a, {
    action: "gameState",
    xp: 99999,
    achievement: "unstoppable",
  });
  expect(((await p.command(a, { action: "gameState" })) as GameState).xp).toBe(
    0,
  );
  expect(
    await p.all("SELECT * FROM game_xp_ledger WHERE user_id=?", a.id),
  ).toHaveLength(0);
});
it("unlocks seven practice days, ten exercises and level 10 once, with a bounded achievement pass", async () => {
  const a = await actor(),
    stamp = new Date().toISOString();
  await p
    .stmt(
      "INSERT INTO game_players(user_id,total_xp,updated_at,curve_version) VALUES (?,99900,?,2)",
      a.id,
      stamp,
    )
    .run();
  await p
    .stmt(
      "INSERT INTO game_xp_ledger VALUES (?,?,?,?,?,?,?,?,?)",
      "seed",
      a.id,
      "seed",
      null,
      "history",
      "history",
      99900,
      1,
      stamp,
    )
    .run();
  for (let i = 1; i <= 6; i++)
    await p
      .stmt("INSERT INTO game_days VALUES (?,?)", a.id, `2020-01-0${i}`)
      .run();
  for (let i = 1; i <= 9; i++)
    await p
      .stmt(
        "INSERT INTO game_attempts VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        `old${i}`,
        a.id,
        "old",
        i,
        "old",
        "completed",
        1,
        "[]",
        '{"correct":1,"incorrect":0,"accuracy":100,"combo":1,"best":1}',
        0,
        stamp,
        stamp,
      )
      .run();
  const c = input(),
    state = (await p.command(a, c)) as GameState;
  expect(state.unlocks.map((u) => u.achievementId)).toEqual(
    expect.arrayContaining([
      "dedicated_student",
      "exercise_explorer",
      "level_10_pianist",
    ]),
  );
  expect(((await p.command(a, c)) as GameState).xp).toBe(state.xp);
  expect(
    await p.all(
      "SELECT * FROM game_xp_ledger WHERE user_id=? AND reward_id='achievement:level_10_pianist'",
      a.id,
    ),
  ).toHaveLength(1);
});

it("migrates v1 players without losing XP or unlocks and keeps closed session levels historical", async () => {
  const legacy = new Miniflare({
    modules: true,
    scriptPath: "dist/server/index.js",
    compatibilityDate: "2026-05-01",
    d1Databases: ["DB"],
  });
  try {
    const db = await legacy.getD1Database("DB");
    const sql = async (file: string) => {
      for (const statement of readFileSync(`drizzle/${file}`, "utf8").split(
        "--> statement-breakpoint",
      ))
        if (statement.trim()) await db.prepare(statement).run();
    };
    for (const file of readdirSync("drizzle")
      .filter((f) => f.endsWith(".sql") && f < "0020")
      .sort())
      await sql(file);
    const old = new D1Platform(db as unknown as D1Database),
      user = await old.ensureUser(
        "legacy-curve",
        "legacy@example.test",
        "Legacy",
      );
    await old
      .stmt(
        "INSERT INTO game_players(user_id,total_xp,updated_at) VALUES (?,465,'2026-10-17')",
        user.id,
      )
      .run();
    await old
      .stmt(
        "INSERT INTO game_unlocks VALUES (?,'first_steps','seed','closed','2026-10-17',25)",
        user.id,
      )
      .run();
    await old
      .stmt(
        "INSERT INTO game_sessions VALUES ('closed',?,'2026-10-17','2026-10-17',0)",
        user.id,
      )
      .run();
    await old
      .stmt(
        "INSERT INTO game_sessions VALUES ('active',?,'2026-10-17',NULL,465)",
        user.id,
      )
      .run();
    await sql("0020_long_term_levels.sql");
    expect(
      await old.one(
        "SELECT total_xp,curve_version FROM game_players WHERE user_id=?",
        user.id,
      ),
    ).toEqual({ totalXp: 465, curveVersion: 2 });
    expect(
      await old.all(
        "SELECT achievement_id FROM game_unlocks WHERE user_id=?",
        user.id,
      ),
    ).toEqual([{ achievementId: "first_steps" }]);
    expect(
      await old.one(
        "SELECT curve_version FROM game_sessions WHERE id='closed'",
      ),
    ).toEqual({ curveVersion: 1 });
    expect(
      await old.one(
        "SELECT curve_version FROM game_sessions WHERE id='active'",
      ),
    ).toEqual({ curveVersion: 2 });
    const state = (await old.command(user, {
      action: "gameState",
    })) as GameState;
    expect(state.curveVersion).toBe(2);
    expect(state.xp).toBe(465);
    const settingsUser = await old.ensureUser(
      "settings-first",
      "settings@example.test",
      "Settings",
    );
    await old.command(settingsUser, {
      action: "gameSettings",
      settings: state.settings,
    });
    expect(
      ((await old.command(settingsUser, { action: "gameState" })) as GameState)
        .curveVersion,
    ).toBe(2);
  } finally {
    await legacy.dispose();
  }
});


it("exports an account-scoped, consistent backup without trusting a supplied user or XP", async () => {
  const a = await actor(), other = await actor();
  const attempt = input();
  await p.command(a, attempt);
  await p.command(other, input());
  const backup = await p.command(a, { action: "gameBackup", userId: other.id, xp: 999999 }) as {
    format: string; account: { id: string }; records: Record<string, Record<string, unknown>[]>;
  };
  expect(backup.format).toBe("pianopath-progress-backup");
  expect(backup.account.id).toBe(a.id);
  for (const rows of Object.values(backup.records))
    for (const row of rows) expect(row.user_id).toBe(a.id);
  const total = backup.records.game_xp_ledger.reduce((n, r) => n + Number(r.amount), 0);
  expect(backup.records.game_players[0].total_xp).toBe(total);
  expect(backup.records.game_unlocks).toHaveLength(4);
  expect((await p.command(a, { action: "gameState" }) as GameState).xp).toBe(total);
});


it("rejects recovery sent after the signed-in account changes", async () => {
  const a = await actor(), b = await actor();
  await expect(p.command(b, { ...input(), expectedUserId: a.id })).rejects.toThrow("account changed");
  expect((await p.command(b, { action: "gameState" }) as GameState).xp).toBe(0);
});
