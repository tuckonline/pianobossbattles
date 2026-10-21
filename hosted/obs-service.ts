import {D1Platform} from "./service";
import {readGame,gameSettingsSchema} from "./game-service";
import type { D1Database } from "@cloudflare/workers-types";
import {
  overlayUpdate,
  OVERLAY_REFRESH_MS,
  OVERLAY_SCORE_REFRESH_MS,
  OVERLAY_RECONNECT_MS,
  type OverlaySnapshot,
  type OverlayState,
} from "./obs-state";
import { DomainError } from "../src/domains/auth/permissions";

// Request-local only: never share player records, sockets or promises between
// users/Workers requests. Poll the live snapshot at the existing cadence, but
// bound repeat durable-stat reads while its source/sequence/content are unchanged.
type OverlayReadCache = { key?: string; serialized?: string; value?: OverlayState; readAt?: number };
async function readOverlay(
  db: D1Database,
  userId: string,
  scoreOnly = false,
  cache?: OverlayReadCache,
): Promise<OverlayState> {
  const row = await db
    .prepare(`SELECT snapshot, updated_at, source_id, sequence FROM obs_sessions WHERE user_id=?`)
    .bind(userId)
    .first<{ snapshot: string; updated_at: number; source_id:string; sequence:number }>();
  const cacheKey = JSON.stringify([row?.source_id,row?.sequence,row?.updated_at]);
  if(!scoreOnly&&cache?.value&&cache.key===cacheKey&&cache.serialized===row?.snapshot&&Date.now()-(cache.readAt??0)<2000)return cache.value;
  const snapshot = row ? (JSON.parse(row.snapshot) as OverlaySnapshot) : null;
  if(scoreOnly) return {snapshot,sourceId:row?.source_id,sequence:row?.sequence,updatedAt:row?.updated_at??null,best:null,attempts:0};
  const stats = snapshot
    ? await db
        .prepare(
          `SELECT MAX(accuracy) AS best, COUNT(*) AS attempts FROM sight_attempts WHERE user_id=? AND exercise_number=? AND hand=?
         AND created_at > COALESCE((SELECT started_at FROM practice_stream_stats WHERE user_id=sight_attempts.user_id), '')`,
        )
        .bind(userId, snapshot.exerciseNumber, snapshot.hand)
        .first<{ best: number | null; attempts: number }>()
    : null;
  const result: OverlayState = {
    sourceId:row?.source_id,
    sequence:row?.sequence,
    snapshot,
    updatedAt: row?.updated_at ?? null,
    best: stats?.best ?? null,
    attempts: stats?.attempts ?? 0,
  };
  if(snapshot?.game){
    result.gamePlayer=await readGame(new D1Platform(db),userId,snapshot.game.sessionId,snapshot.exerciseNumber,{summary:!!snapshot.game.summary,unlocks:false});
    // OBS presentation never accepts client-supplied persistent XP or records.
    snapshot.game.settings=gameSettingsSchema.parse(result.gamePlayer.settings);
    if(snapshot.game.summary) snapshot.game.summary=result.gamePlayer.summary;
  }
  if(cache){cache.key=cacheKey;cache.serialized=row?.snapshot;cache.value=result;cache.readAt=Date.now();}
  return result;
}

// Only the authenticated account's current session can be read or updated.
export async function handleOverlay(
  request: Request,
  db: D1Database,
  userId: string,
) {
  if (request.method === "GET") {
    const scoreOnly=new URL(request.url).searchParams.get("score")==="1";
    const refreshMs=scoreOnly?OVERLAY_SCORE_REFRESH_MS:OVERLAY_REFRESH_MS;
    if (new URL(request.url).searchParams.get("stream") === "1") {
      // Network events keep the banner current without background-tab timers.
      const cache: OverlayReadCache = {};
      const initial = await readOverlay(db, userId, scoreOnly, cache);
      const encoder = new TextEncoder();
      let cancelled = false;
      let wake: (() => void) | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const stop = () => {
        cancelled = true;
        clearTimeout(timer);
        wake?.();
      };
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          request.signal.addEventListener("abort", stop, { once: true });
          try {
            controller.enqueue(encoder.encode(`retry: ${OVERLAY_RECONNECT_MS}\n\n`));
            // Rotate connections to bound D1 subrequests; EventSource reconnects.
            for (let i = 0; i < (scoreOnly ? 40 : initial.snapshot?.game?.summary ? 4 : 10) && !cancelled; i++) {
              const value = i === 0 ? initial : await readOverlay(db, userId, scoreOnly, cache);
              if (cancelled) break;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(value)}\n\n`),
              );
              await new Promise<void>((resolve) => {
                wake = resolve;
                timer = setTimeout(resolve, refreshMs);
              });
            }
            if (!cancelled) controller.close();
          } catch (error) {
            if (!cancelled) controller.error(error);
          } finally {
            clearTimeout(timer);
            request.signal.removeEventListener("abort", stop);
          }
        },
        cancel: stop,
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "private, no-cache, no-store, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    }
    const result = await readOverlay(db, userId, scoreOnly);
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (request.method !== "POST")
    throw new DomainError("Method not allowed", 405);
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  if (reader)
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 262144) {
        await reader.cancel();
        throw new DomainError("Overlay update too large", 413);
      }
      chunks.push(value);
    }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const update = overlayUpdate.parse(
    JSON.parse(new TextDecoder().decode(bytes)),
  );
  const result = await db
    .prepare(
      `INSERT INTO obs_sessions(user_id,source_id,sequence,snapshot,updated_at) VALUES(?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET source_id=excluded.source_id,sequence=excluded.sequence,snapshot=excluded.snapshot,updated_at=excluded.updated_at
    WHERE (obs_sessions.source_id=excluded.source_id AND excluded.sequence>obs_sessions.sequence)
       OR (obs_sessions.source_id<>excluded.source_id AND ?=1)`,
    )
    .bind(
      userId,
      update.sourceId,
      update.sequence,
      JSON.stringify(update.snapshot),
      Date.now(),
      update.claim ? 1 : 0,
    )
    .run();
  return Response.json(
    { accepted: result.meta.changes > 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
