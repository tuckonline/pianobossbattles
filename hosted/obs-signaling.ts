import { z } from "zod";
import type { D1Database } from "@cloudflare/workers-types";
import { DomainError } from "../src/domains/auth/permissions";

const key = z.string().uuid();
const message = z.discriminatedUnion("type", [
  z.object({type:z.literal("offer"),sourceId:key,viewerId:key,sdp:z.string().min(1).max(24000)}),
  z.object({type:z.literal("answer"),sourceId:key,viewerId:key,sdp:z.string().min(1).max(24000)}),
]);
const json = (value:unknown) => Response.json(value,{headers:{"Cache-Control":"private, no-store"}});

// Authentication and POST Origin validation are shared with /api/obs in worker.ts.
// No SDP or candidates are exposed to another account, or another active source.
export async function handleScoreSignaling(request:Request,db:D1Database,userId:string) {
  const url=new URL(request.url),sourceId=key.parse(url.searchParams.get("sourceId"));
  const owner=await db.prepare("SELECT source_id FROM obs_sessions WHERE user_id=?").bind(userId).first<{source_id:string}>();
  if(owner?.source_id!==sourceId) return json({active:false,offers:[]});
  const cutoff=Date.now()-60000;
  if(request.method==="GET") {
    const viewer=url.searchParams.get("viewerId");
    if(viewer) {
      const row=await db.prepare("SELECT answer FROM obs_score_peers WHERE user_id=? AND source_id=? AND viewer_id=? AND created_at>?")
        .bind(userId,sourceId,key.parse(viewer),cutoff).first<{answer:string|null}>();
      return json({active:true,answer:row?.answer??null});
    }
    const rows=await db.prepare("SELECT viewer_id AS viewerId,offer AS sdp FROM obs_score_peers WHERE user_id=? AND source_id=? AND answer IS NULL AND created_at>? ORDER BY created_at DESC LIMIT 8")
      .bind(userId,sourceId,cutoff).all();
    return json({active:true,offers:rows.results});
  }
  if(request.method!=="POST") throw new DomainError("Method not allowed",405);
  const reader=request.body?.getReader();let text="",size=0;const decoder=new TextDecoder();
  if(reader) while(true) {
    const {done,value}=await reader.read();if(done)break;
    size+=value.byteLength;if(size>32768){await reader.cancel();throw new DomainError("Handshake too large",413);}
    text+=decoder.decode(value,{stream:true});
  }
  const data=message.parse(JSON.parse(text+decoder.decode()));
  if(data.sourceId!==sourceId) throw new DomainError("Invalid source",400);
  await db.prepare("DELETE FROM obs_score_peers WHERE user_id=? AND created_at<=?").bind(userId,cutoff).run();
  if(data.type==="offer") {
    // Bound handshake storage even when a browser keeps reconnecting.
    await db.prepare("DELETE FROM obs_score_peers WHERE user_id=? AND viewer_id IN (SELECT viewer_id FROM obs_score_peers WHERE user_id=? ORDER BY created_at DESC LIMIT -1 OFFSET 7)").bind(userId,userId).run();
    await db.prepare("INSERT INTO obs_score_peers(user_id,viewer_id,source_id,offer,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM obs_sessions WHERE user_id=? AND source_id=?) ON CONFLICT(user_id,viewer_id) DO NOTHING")
      .bind(userId,data.viewerId,sourceId,data.sdp,Date.now(),userId,sourceId).run();
  } else {
    await db.prepare("UPDATE obs_score_peers SET answer=? WHERE user_id=? AND source_id=? AND viewer_id=? AND answer IS NULL AND created_at>? AND EXISTS(SELECT 1 FROM obs_sessions WHERE user_id=? AND source_id=?)")
      .bind(data.sdp,userId,sourceId,data.viewerId,cutoff,userId,sourceId).run();
  }
  return json({active:true});
}
