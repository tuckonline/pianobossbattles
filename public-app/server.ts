import "dotenv/config";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { Pool, types } from "pg";
import { createClient, type User } from "@supabase/supabase-js";
import { D1Platform } from "../hosted/service";
import { handleOverlay } from "../hosted/obs-service";
import { handleScoreSignaling } from "../hosted/obs-signaling";
import { handleShorts } from "../hosted/shorts-service";
import { DomainError } from "../src/domains/auth/permissions";
import { PostgresBridge } from "./postgres";
import { z } from "zod";

types.setTypeParser(20, Number);
types.setTypeParser(1700, Number);
const origin = process.env.APP_ORIGIN ?? "http://localhost:5173";
const secure = new URL(origin).protocol === "https:";
const auth = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
// OBS polls rapidly. Verify with the provider once per token/minute, bounded by
// JWT expiry; never cache failures, trust decoded claims, or log session tokens.
const verified = new Map<string,{user:User;until:number}>();
async function verifiedUser(token:string) {
  const cached=verified.get(token);
  if(cached&&cached.until>Date.now())return cached.user;
  const {data,error}=await auth.auth.getUser(token);
  if(error||!data.user?.email_confirmed_at)throw new DomainError("Your session expired. Verify your email and sign in.",401);
  const claims=JSON.parse(Buffer.from(token.split(".")[1],"base64url").toString());
  const until=Math.min(Date.now()+60000,Number(claims.exp)*1000);
  if(!Number.isFinite(until)||until<=Date.now())throw new DomainError("Your session expired. Sign in again.",401);
  if(verified.size>=500)verified.delete(verified.keys().next().value!);
  verified.set(token,{user:data.user,until});
  return data.user;
}
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL, max: 10, ssl: {
    rejectUnauthorized: true,
    ...(process.env.DATABASE_SSL_CA_FILE ? { ca: readFileSync(process.env.DATABASE_SSL_CA_FILE, "utf8") } : {}),
  },
}) : null;
const actions = new Set(["gameState", "gameSync", "gameSettings", "gameSessionEnd",
  "battleStoryRecords", "battleStorySave", "practiceExercise", "sightAttempt", "resetStreamStats", "gameBackup"]);
export async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  try {
    if (!["GET", "POST", "HEAD"].includes(request.method)) throw new DomainError("Method not allowed", 405);
    if (request.method === "POST" && request.headers.get("origin") !== origin) throw new DomainError("Invalid request origin", 403);
    if (url.pathname === "/api/health") return Response.json({ service: "Piano Boss Battles", configured: !!pool });
    if (!url.pathname.startsWith("/api/")) {
      const root = resolve("dist/client");
      const path = resolve(root, "." + decodeURIComponent(url.pathname));
      if (!path.startsWith(root + sep) && path !== root) return new Response("Not found", { status: 404 });
      const extensions: Record<string,string> = { ".js":"text/javascript", ".css":"text/css", ".png":"image/png", ".webp":"image/webp", ".svg":"image/svg+xml", ".woff2":"font/woff2", ".mp3":"audio/mpeg", ".wav":"audio/wav", ".ogg":"audio/ogg", ".pdf":"application/pdf", ".wasm":"application/wasm", ".json":"application/json" };
      try { return new Response(await readFile(path), { headers: { "Content-Type": extensions[extname(path)] ?? "application/octet-stream" } }); }
      catch { if(extname(path))return new Response("Not found",{status:404}); return new Response(await readFile(resolve(root, "index.html")), { headers: { "Content-Type": "text/html; charset=utf-8" } }); }
    }
    if (url.pathname === "/api/auth/session" && request.method === "POST") {
      const { accessToken } = z.object({ accessToken: z.string().max(12000).optional() }).parse(await request.json());
      if (accessToken) {
        await verifiedUser(accessToken);
      }
      return Response.json({ signedIn: !!accessToken }, { headers: {
        "Set-Cookie": `pbb_session=${accessToken ?? ""}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${accessToken ? 3600 : 0}${secure ? "; Secure" : ""}`,
      } });
    }
    const token = request.headers.get("cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith("pbb_session="))?.slice(12);
    if (!token) throw new DomainError("Sign in to Piano Boss Battles.", 401);
    const user = await verifiedUser(token);
    if (!pool) throw new DomainError("Player storage is not configured yet. Follow SUPABASE_SETUP.md before starting a battle.", 503);
    const db = new PostgresBridge(pool, undefined, user.id).asD1();
    const service = new D1Platform(db);
    const actor = await service.ensureUser(user.id, user.email!, String(user.user_metadata.name ?? "Pianist").slice(0,80));
    if (url.pathname === "/api/obs") return url.searchParams.get("rtc") === "1"
      ? handleScoreSignaling(request, db, user.id) : handleOverlay(request, db, user.id);
    if (url.pathname === "/api/shorts") return handleShorts(request, db, user.id);
    if (url.pathname === "/api/profile" && request.method === "GET") return Response.json({
      actor,
      history: await service.all("SELECT challenge,result FROM battle_story_attempts WHERE user_id=? ORDER BY json_extract(result,'$.finishedAt') DESC LIMIT 12",user.id),
      attempts: await service.all("SELECT exercise_number,hand,accuracy,created_at FROM sight_attempts WHERE user_id=? ORDER BY created_at DESC LIMIT 100",user.id),
      victories: await service.one("SELECT COUNT(*) AS count FROM battle_story_attempts WHERE user_id=? AND json_extract(result,'$.result')='victory'",user.id),
      practiced: await service.one("SELECT COUNT(DISTINCT exercise_number) AS count FROM game_attempts WHERE user_id=? AND json_extract(result,'$.correct')>0",user.id),
      bests: await service.all("SELECT exercise_number,MAX(json_extract(result,'$.accuracy')) AS accuracy FROM game_attempts WHERE user_id=? AND status='completed' GROUP BY exercise_number ORDER BY accuracy DESC LIMIT 6",user.id),
    });
    if (url.pathname === "/api/platform" && request.method === "POST") {
      const input = await request.json();
      if (!actions.has(input?.action)) throw new DomainError("Command unavailable in the public application.", 403);
      return Response.json(await service.command(actor, input));
    }
    throw new DomainError("Not found",404);
  } catch (error) {
    if (error instanceof DomainError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid request." }, { status: 400 });
    console.error("Public API request failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Player storage is unavailable. Your unsaved gameplay stays queued locally. Please retry." }, { status: 503 });
  }
}
createServer(async (req, res) => {
  try {
    const chunks: Buffer[] = []; let bytes = 0;
    for await (const chunk of req) { bytes += chunk.length; if (bytes > 2000000) { res.writeHead(413).end(); return; } chunks.push(chunk); }
    const abort = new AbortController();
    res.on("close", () => abort.abort());
    const request = new Request(new URL(req.url ?? "/", origin), {
      method: req.method, headers: new Headers(req.headers as Record<string,string>),
      body: chunks.length ? Buffer.concat(chunks) : undefined, signal: abort.signal,
    });
    const response = await handle(request);
    res.writeHead(response.status, {
      "Cache-Control":"private, no-store", "X-Content-Type-Options":"nosniff",
      "Permissions-Policy":"midi=(self)", "Referrer-Policy":"same-origin",
      ...Object.fromEntries(response.headers),
    });
    if (response.body) Readable.fromWeb(response.body as never).pipe(res); else res.end();
  } catch { if (!res.headersSent) res.writeHead(500); res.end(); }
}).listen(Number(process.env.PORT ?? 8788), "127.0.0.1", () => console.log("Piano Boss Battles API: http://localhost:8788 (local only)"));
