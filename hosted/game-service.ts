import { z } from "zod";
import type { D1Platform } from "./service";
import type { Exercise } from "./sight-library";
import { practicePass } from "./sight-library";
import { DomainError } from "../src/domains/auth/permissions";
import {
  GAME_RULES,
  achievements,
  evaluateGame,
  replayEvents,
  accuracyBonus,
  accuracyPB,
  practiceDay,
  levelInfo,
  type GameSettings,
  type Celebration,
  type GameEvent,
} from "./game-core";
import { gameSyncSchema, type GameSync } from "./game-sync";
import { normalizeGameSettings } from "./game-settings";
export { gameSyncSchema, type GameSync } from "./game-sync";
export { gameSettingsSchema } from "./game-settings";

export type GameState = {
  streak?: number;
  userId?: string;
  xp: number;
  curveVersion: number;
  settings: GameSettings;
  best: number;
  sessionBest: number;
  exerciseBest: number;
  unlocks: { achievementId: string; unlockedAt: string }[];
  celebrations: Celebration[];
  summary?: GameSummary;
};
export type GameSummary = {
  sessionId: string;
  startingXP: number;
  curveVersion: number;
  endingXP: number;
  earnedXP: number;
  correct: number;
  incorrect: number;
  scored: number;
  accuracy: number;
  best: number;
  completed: number;
  activeMs: number;
  personalBests: number;
  achievements: string[];
  ended: boolean;
};
export async function readGame(
  p: D1Platform,
  user: string,
  session?: string,
  exercise?: number,
  options: { summary?: boolean; unlocks?: boolean } = {},
): Promise<GameState> {
  const player = await p.one<{
    totalXp: number;
    curveVersion: number;
    settings: string;
  }>(
    "SELECT total_xp,curve_version,settings FROM game_players WHERE user_id=?",
    user,
  );
  const records = await p.all<{ scope: string; scopeId: string; best: number }>(
    "SELECT scope,scope_id,best FROM game_combo_records WHERE user_id=? AND (scope IN ('global','continuity') OR (scope='session' AND scope_id=?) OR (scope='exercise' AND scope_id=?))",
    user,
    session ?? "",
    String(exercise ?? ""),
  );
  const unlocks =
    options.unlocks === false
      ? []
      : await p.all<{ achievementId: string; unlockedAt: string }>(
          "SELECT achievement_id,unlocked_at FROM game_unlocks WHERE user_id=? ORDER BY unlocked_at",
          user,
        );
  let summary: GameSummary | undefined;
  if (session && options.summary !== false) {
    const s = await p.one<{
      startingXp: number;
      curveVersion: number;
      endedAt: string | null;
    }>(
      "SELECT starting_xp,curve_version,ended_at FROM game_sessions WHERE user_id=? AND id=?",
      user,
      session,
    );
    if (s) {
      const a = await p.all<{
        result: string;
        status: string;
        activeMs: number;
      }>(
        "SELECT result,status,active_ms FROM game_attempts WHERE user_id=? AND session_id=?",
        user,
        session,
      );
      const sums = a.reduce(
        (v, row) => {
          const r = JSON.parse(row.result);
          return {
            correct: v.correct + r.correct,
            incorrect: v.incorrect + r.incorrect,
            best: Math.max(v.best, r.best),
            completed: v.completed + Number(row.status === "completed"),
            activeMs: v.activeMs + row.activeMs,
          };
        },
        { correct: 0, incorrect: 0, best: 0, completed: 0, activeMs: 0 },
      );
      const ledger = await p.one<{ xp: number; pbs: number }>(
        "SELECT COALESCE(SUM(amount),0) AS xp, COALESCE(SUM(CASE WHEN category='accuracy_pb' THEN 1 ELSE 0 END),0) AS pbs FROM game_xp_ledger WHERE user_id=? AND session_id=?",
        user,
        session,
      );
      const unlocked = await p.all<{ achievementId: string }>(
        "SELECT achievement_id FROM game_unlocks WHERE user_id=? AND session_id=?",
        user,
        session,
      );
      summary = {
        sessionId: session,
        startingXP: s.startingXp,
        curveVersion: s.curveVersion,
        endingXP: s.startingXp + (ledger?.xp ?? 0),
        earnedXP: ledger?.xp ?? 0,
        ...sums,
        best: Math.max(sums.best, records.find(r => r.scope === "session")?.best ?? 0),
        scored: sums.correct + sums.incorrect,
        accuracy:
          (100 * sums.correct) / Math.max(1, sums.correct + sums.incorrect),
        personalBests: ledger?.pbs ?? 0,
        achievements: unlocked.map((x) => x.achievementId),
        ended: !!s.endedAt,
      };
    }
  }
  return {
    userId: user,
    streak: records.find((r) => r.scope === "continuity")?.best ?? 0,
    xp: player?.totalXp ?? 0,
    curveVersion: player?.curveVersion ?? GAME_RULES.curveVersion,
    settings: normalizeGameSettings(JSON.parse(player?.settings ?? "{}")),
    best: records.find((r) => r.scope === "global")?.best ?? 0,
    sessionBest: records.find((r) => r.scope === "session")?.best ?? 0,
    exerciseBest: records.find((r) => r.scope === "exercise")?.best ?? 0,
    unlocks,
    celebrations: [],
    summary,
  };
}
export async function syncGame(
  p: D1Platform,
  user: string,
  c: GameSync,
  source: Exercise,
): Promise<GameState> {
  const now = Date.now(),
    stamp = new Date(now).toISOString();
  const exercise = practicePass(source, c.omitClosing);
  if (
    (source.singleHand && source.singleHand !== c.hand) ||
    (source.bothHandsOnly && c.hand !== "both")
  )
    throw new DomainError("Invalid hand configuration");
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(exercise)),
      ),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  const condition = `v1:${source.number}:${c.hand}:${Number(c.omitClosing)}:${hash}`;
  await p
    .stmt(
      "INSERT INTO game_players(user_id,updated_at,curve_version) VALUES (?,?,2) ON CONFLICT DO NOTHING",
      user,
      stamp,
    )
    .run();
  for (let retry = 0; retry < 5; retry++) {
    const player = (await p.one<{
      totalXp: number;
      revision: number;
      rulesVersion: number;
      curveVersion: number;
      settings: string;
    }>("SELECT * FROM game_players WHERE user_id=?", user))!;
    if (
      player.rulesVersion !== 1 ||
      player.curveVersion !== GAME_RULES.curveVersion
    )
      throw new DomainError("Progression rules require migration", 409);
    const settings = normalizeGameSettings(JSON.parse(player.settings));
    const old = await p.one<{
      sequence: number;
      played: string;
      status: string;
      conditionKey: string;
      sessionId: string;
      result: string;
      activeMs: number;
      startedAt: string;
    }>(
      "SELECT * FROM game_attempts WHERE user_id=? AND id=?",
      user,
      c.attemptId,
    );
    if (
      old &&
      (old.sequence >= c.sequence ||
        ["completed", "abandoned"].includes(old.status))
    )
      return readGame(p, user, c.sessionId, c.exerciseNumber);
    if (
      old &&
      (old.conditionKey !== condition || old.sessionId !== c.sessionId)
    )
      throw new DomainError("Attempt configuration changed", 409);
    const priorPlayed: number[] = JSON.parse(old?.played ?? "[]");
    if (priorPlayed.some((pitch, i) => c.played[i] !== pitch))
      throw new DomainError("Evaluated input cannot be rewritten", 409);
    const session = await p.one<{ endedAt: string | null }>(
      "SELECT ended_at FROM game_sessions WHERE user_id=? AND id=?",
      user,
      c.sessionId,
    );
    if (session?.endedAt)
      throw new DomainError("Recording session has ended", 409);
    const r = evaluateGame(exercise, c.hand, c.played, {
      playerId: user,
      sessionId: c.sessionId,
      attemptId: c.attemptId,
      timestamp: now,
    });
    if (c.status === "completed" && !r.complete)
      throw new DomainError("Complete the scored exercise first");
    const complete = c.status === "completed";
    const triggerId = complete
      ? `${c.attemptId}:state:${c.sequence}`
      : c.played.length
        ? `${c.attemptId}:note:${c.played.length - 1}`
        : `${c.attemptId}:started`;
    const day = practiceDay(now, settings.timezone);
    const prior = await p.one<{ best: number | null }>(
      "SELECT MAX(json_extract(result,'$.accuracy')) AS best FROM game_attempts WHERE user_id=? AND condition_key=? AND status='completed' AND id<>?",
      user,
      condition,
      c.attemptId,
    );
    const priorBest = prior?.best ?? null;
    const unlocked = await p.all<{ achievementId: string }>(
      "SELECT achievement_id FROM game_unlocks WHERE user_id=?",
      user,
    );
    const days = await p.one<{ count: number; today: number }>(
      "SELECT COUNT(*) AS count, COALESCE(MAX(day=?),0) AS today FROM game_days WHERE user_id=?",
      day,
      user,
    );
    const exercises = await p.one<{ count: number; current: number }>(
      "SELECT COUNT(DISTINCT exercise_number) AS count,COALESCE(MAX(exercise_number=?),0) AS current FROM game_attempts WHERE user_id=? AND status='completed'",
      c.exerciseNumber,
      user,
    );
    const priorCombo = await p.one<{ best: number }>(
      "SELECT best FROM game_combo_records WHERE user_id=? AND scope='global' AND scope_id='all'",
      user,
    );
    // Continuity is separate from per-attempt grading. Only newly accepted
    // evaluator results advance it; lifecycle events and retries cannot reset it.
    const continuity = await p.one<{best:number}>(
      "SELECT best FROM game_combo_records WHERE user_id=? AND scope='continuity' AND scope_id='all'", user);
    const streak = replayEvents(r.events.slice(priorPlayed.length), continuity?.best ?? 0);
    const rewards: {
      id: string;
      source: string;
      category: string;
      amount: number;
    }[] = [];
    const add = (suffix: string, category: string, amount: number) => {
      if (amount)
        rewards.push({
          id: suffix,
          source: triggerId,
          category,
          amount,
        });
    };
    for (const e of r.events.slice(priorPlayed.length))
      if (e.payload.outcome === "correct")
        rewards.push({
          id: `${c.attemptId}:note:${e.payload.occurrence}`,
          source: e.id,
          category: "correct_note",
          amount: GAME_RULES.noteXP,
        });
    if (complete) {
      add(`${c.attemptId}:complete`, "completion", GAME_RULES.completionXP);
      add(`${c.attemptId}:accuracy`, "accuracy", accuracyBonus(r.accuracy));
      if (accuracyPB(r.accuracy, priorBest))
        add(`${c.attemptId}:pb`, "accuracy_pb", 50);
      add(`daily:${day}`, "daily", 50);
    }
    const existing = await p.all<{ rewardId: string }>(
      "SELECT reward_id FROM game_xp_ledger WHERE user_id=? AND (attempt_id=? OR reward_id=?)",
      user,
      c.attemptId,
      `daily:${day}`,
    );
    const seen = new Set(existing.map((x) => x.rewardId));
    let xp =
      player.totalXp +
      rewards.filter((x) => !seen.has(x.id)).reduce((s, x) => s + x.amount, 0);
    const context = {
      complete,
      accuracy: r.accuracy,
      best: streak.best,
      prior: priorBest,
      days: (days?.count ?? 0) + (r.correct > 0 && !days?.today ? 1 : 0),
      exercises:
        (exercises?.count ?? 0) + (complete && !exercises?.current ? 1 : 0),
      xp,
    };
    const newUnlocks = achievements.filter(
      (a) =>
        a.id !== "level_10_pianist" &&
        !unlocked.some((u) => u.achievementId === a.id) &&
        a.test(context),
    );
    xp += newUnlocks.reduce((s, a) => s + a.reward, 0);
    const levelAchievement = achievements.find(
      (a) => a.id === "level_10_pianist",
    )!;
    if (
      !unlocked.some((u) => u.achievementId === levelAchievement.id) &&
      levelAchievement.test({ ...context, xp })
    )
      newUnlocks.push(levelAchievement);
    for (const a of newUnlocks)
      add(`achievement:${a.id}`, "achievement", a.reward);
    const effective = rewards.filter((x) => !seen.has(x.id));
    const total = player.totalXp + effective.reduce((s, x) => s + x.amount, 0);
    const events = r.events
      .slice(priorPlayed.length)
      .map((e) => ({ ...e, sequence: c.sequence * 100000 + e.sequence }));
    const lifecycle = (type: GameEvent["type"], suffix: string): GameEvent => ({
      id: `${c.attemptId}:${suffix}`,
      version: 1,
      playerId: user,
      sessionId: c.sessionId,
      attemptId: c.attemptId,
      exerciseId: c.exerciseNumber,
      sequence:
        type === "attempt.started"
          ? -1
          : type === "session.started"
            ? -2
            : type === "attempt.resumed"
              ? c.sequence * 100000 - 1
              : c.sequence * 100000 + c.played.length + 1,
      timestamp: now,
      type,
      payload: {},
    });
    if (!session)
      events.push({
        ...lifecycle("session.started", "session"),
        id: `${c.sessionId}:started`,
      });
    if (!old) events.push(lifecycle("attempt.started", "started"));
    if (!old || old.status !== c.status)
      events.push(
        lifecycle(
          complete
            ? "attempt.completed"
            : c.status === "abandoned"
              ? "attempt.abandoned"
              : c.status === "paused"
                ? "attempt.paused"
                : "attempt.resumed",
          `state:${c.sequence}`,
        ),
      );
    const activeMs = Math.max(
      old?.activeMs ?? 0,
      Math.min(
        c.activeMs,
        old ? Math.max(0, now - Date.parse(old.startedAt)) : c.activeMs,
      ),
    );
    const statements = [
      p.stmt(
        "INSERT INTO game_sessions(id,user_id,started_at,starting_xp,curve_version) VALUES (?,?,?,?,2) ON CONFLICT DO NOTHING",
        c.sessionId,
        user,
        stamp,
        player.totalXp,
      ),
      p.stmt(
        "INSERT INTO game_attempts(id,user_id,session_id,exercise_number,condition_key,status,sequence,played,result,active_ms,started_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET status=excluded.status,sequence=excluded.sequence,played=excluded.played,result=excluded.result,active_ms=excluded.active_ms,updated_at=excluded.updated_at",
        c.attemptId,
        user,
        c.sessionId,
        c.exerciseNumber,
        condition,
        c.status,
        c.sequence,
        JSON.stringify(c.played),
        JSON.stringify({
          correct: r.correct,
          incorrect: r.incorrect,
          accuracy: r.accuracy,
          combo: r.combo,
          best: r.best,
        }),
        activeMs,
        stamp,
        stamp,
      ),
      p.stmt(
        "INSERT INTO game_xp_ledger(user_id,reward_id,source_event_id,attempt_id,session_id,category,amount,rules_version,created_at) SELECT ?,json_extract(value,'$.id'),json_extract(value,'$.source'),?,?,json_extract(value,'$.category'),json_extract(value,'$.amount'),1,? FROM json_each(?) WHERE true ON CONFLICT DO NOTHING",
        user,
        c.attemptId,
        c.sessionId,
        stamp,
        JSON.stringify(rewards),
      ),
      p.stmt(
        "INSERT INTO game_events(user_id,id,session_id,attempt_id,sequence,event) SELECT ?,json_extract(value,'$.id'),?,?,json_extract(value,'$.sequence'),value FROM json_each(?) WHERE true ON CONFLICT DO NOTHING",
        user,
        c.sessionId,
        c.attemptId,
        JSON.stringify(events),
      ),
      ...newUnlocks.map((a) =>
        p.stmt(
          "INSERT INTO game_unlocks VALUES (?,?,?,?,?,?) ON CONFLICT DO NOTHING",
          user,
          a.id,
          triggerId,
          c.sessionId,
          stamp,
          a.reward,
        ),
      ),
      ...(["global", "session", "exercise"] as const).map((scope) =>
        p.stmt(
          "INSERT INTO game_combo_records VALUES (?,?,?,?,?) ON CONFLICT(user_id,scope,scope_id) DO UPDATE SET best=MAX(best,excluded.best),updated_at=excluded.updated_at",
          user,
          scope,
          scope === "global"
            ? "all"
            : scope === "session"
              ? c.sessionId
              : String(c.exerciseNumber),
          scope === "exercise" ? r.best : streak.best,
          stamp,
        ),
      ),
      p.stmt(
        "INSERT INTO game_combo_records VALUES (?,'continuity','all',?,?) ON CONFLICT(user_id,scope,scope_id) DO UPDATE SET best=excluded.best,updated_at=excluded.updated_at",
        user, streak.combo, stamp,
      ),
      ...(r.correct
        ? [
            p.stmt(
              "INSERT INTO game_days VALUES (?,?) ON CONFLICT DO NOTHING",
              user,
              day,
            ),
          ]
        : []),
      p.stmt(
        "UPDATE game_players SET total_xp=(SELECT COALESCE(SUM(amount),0) FROM game_xp_ledger WHERE user_id=?),revision=revision+1,updated_at=? WHERE user_id=?",
        user,
        stamp,
        user,
      ),
    ];
    try {
      await p.atomic(
        "EXISTS(SELECT 1 FROM game_players WHERE user_id=? AND revision=?)",
        [user, player.revision],
        statements,
      );
    } catch (e) {
      if (e instanceof DomainError && e.status === 409 && retry < 4) continue;
      throw e;
    }
    const state = await readGame(p, user, c.sessionId, c.exerciseNumber);
    state.celebrations = newUnlocks.map((a) => ({
      id: `achievement:${a.id}`,
      kind: "achievement",
      title: a.title,
      description: a.description,
      xp: a.reward,
      priority: 80 + a.priority,
      createdAt: now,
    }));
    // Each newly accepted crossing gets its own identity, even after a mistake.
    // Checkpoint retries cannot replay it or award additional XP.
    for (const milestone of streak.crossings) {
        state.celebrations.push({id:`streak:${milestone.eventId}:${milestone.at}`,kind:"milestone",
          title:milestone.title,description:"",priority:milestone.at >= 50 ? 50 : 20,createdAt:now});
    }
    if (levelInfo(total).level > levelInfo(player.totalXp).level)
      state.celebrations.push({
        id: `level:${c.attemptId}:${c.sequence}`,
        kind: "level",
        title: `LEVEL UP! · ${levelInfo(total).level}`,
        description: levelInfo(total).title,
        priority: 100,
        createdAt: now,
      });
    if (complete && accuracyPB(r.accuracy, priorBest))
      state.celebrations.push({
        id: `pb:${c.attemptId}`,
        kind: "record",
        title: "New accuracy personal best",
        description: `${r.accuracy.toFixed(1)}% · ${c.hand} hand mode`,
        xp: 50,
        priority: 70,
        createdAt: now,
      });
    if (
      streak.best >= 10 &&
      priorCombo &&
      streak.best > priorCombo.best &&
      (complete || streak.best - (priorCombo.best ?? 0) >= 10)
    )
      state.celebrations.push({
        id: `combo-record:${c.attemptId}`,
        kind: "record",
        title: "New lifetime combo record",
        description: `${streak.best} correctly evaluated notes in a row`,
        priority: 65,
        createdAt: now,
      });
    return state;
  }
  throw new DomainError("Progress save conflict; retry", 409);
}
