import {normalizeGameSettings,gameSettingsSchema} from '../hosted/game-settings';
import {defaultBossBattleConfig} from '../hosted/boss-config';
import {handleCreatorControl,handleCreatorView,creatorBattleConfig} from './creator-service';
import { types, type Pool } from "pg";
import { createClient, type User } from "@supabase/supabase-js";
import { D1Platform } from "../hosted/service";
import { handleOverlay } from "../hosted/obs-service";
import { handleScoreSignaling } from "../hosted/obs-signaling";
import { handleShorts } from "../hosted/shorts-service";
import { DomainError } from "../src/domains/auth/permissions";
import { PostgresBridge } from "./postgres";
import { handleMusic, authorizeMusicCommand, readMusicExercise } from "./music-service";
import { z } from "zod";

types.setTypeParser(20, Number);
types.setTypeParser(1700, Number);
export function createApi(origin: string, supabaseUrl: string, publishableKey: string) {
const secure = new URL(origin).protocol === "https:";
const auth = createClient(supabaseUrl, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
// OBS polls rapidly. Verify with the provider once per token/minute, bounded by
// JWT expiry; never cache failures, trust decoded claims, or log session tokens.
const verified = new Map<string,{user:User;until:number}>();
async function verifiedUser(token:string) {
  const cached=verified.get(token);
  if(cached&&cached.until>Date.now())return cached.user;
  const {data,error}=await auth.auth.getUser(token);
  if(error) {
    if(!error.status || error.status>=500 || error.status===429)
      throw new DomainError("Account verification is temporarily unavailable. Your progress remains queued.",503);
    throw new DomainError("Your session expired. Sign in again to save queued progress.",401);
  }
  if(!data.user?.email_confirmed_at)throw new DomainError("Confirm your email and sign in to save queued progress.",401);
  const claims=JSON.parse(Buffer.from(token.split(".")[1],"base64url").toString());
  const until=Math.min(Date.now()+60000,Number(claims.exp)*1000);
  if(!Number.isFinite(until)||until<=Date.now())throw new DomainError("Your session expired. Sign in again.",401);
  if(verified.size>=500)verified.delete(verified.keys().next().value!);
  verified.set(token,{user:data.user,until});
  return data.user;
}
const actions = new Set(["gameState", "gameSync", "gameSettings", "gameSessionEnd",
  "battleStoryRecords", "battleStorySave", "practiceExercise", "sightAttempt", "resetStreamStats", "gameBackup"]);
return async function handleApi(request: Request, pool: Pool | null): Promise<Response> {
  const url = new URL(request.url);
  try {
    if (!["GET", "POST", "HEAD"].includes(request.method)) throw new DomainError("Method not allowed", 405);
    if (request.method === "POST" && request.headers.get("origin") !== origin) throw new DomainError("Invalid request origin", 403);
    if (url.pathname === "/api/health") return Response.json({ service: "Piano Boss Battles", configured: !!pool });
    if (url.pathname === "/api/auth/session" && request.method === "POST") {
      const { accessToken } = z.object({ accessToken: z.string().max(12000).optional() }).parse(await request.json());
      if (accessToken) {
        await verifiedUser(accessToken);
      }
      return Response.json({ signedIn: !!accessToken }, { headers: {
        "Set-Cookie": `pbb_session=${accessToken ?? ""}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${accessToken ? 3600 : 0}${secure ? "; Secure" : ""}`,
      } });
    }
    if(url.pathname.startsWith('/api/creator/view')){
      if(!pool)throw new DomainError('Creator storage unavailable',503);
      return await handleCreatorView(request,pool);
    }
    const token = request.headers.get("cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith("pbb_session="))?.slice(12);
    if (!token) throw new DomainError("Sign in to Piano Boss Battles.", 401);
    const user = await verifiedUser(token);
    if (!pool) throw new DomainError("Player storage is not configured yet. Follow SUPABASE_SETUP.md before starting a battle.", 503);
    if(url.pathname==='/api/creator'||url.pathname==='/api/creator/stream')return await handleCreatorControl(request,pool,user.id);
    // Auth's profile trigger creates public users. Catalog/recording requests
    // already enforce their own owner/role checks; they must not upsert the
    // account and take a progression transaction lock on every background poll.
    if (url.pathname === "/api/music" || url.pathname === "/api/music/authorize" || url.pathname === "/api/admin/music") return await handleMusic(request,pool,user.id);
    const db = new PostgresBridge(pool, undefined, user.id).asD1();
    const service = new D1Platform(db);
    if (url.pathname === "/api/obs") return url.searchParams.get("rtc") === "1"
      ? handleScoreSignaling(request, db, user.id) : handleOverlay(request, db, user.id);
    if (url.pathname === "/api/shorts") return handleShorts(request, db, user.id);
    const actor = await service.ensureUser(user.id, user.email!, String(user.user_metadata.name ?? "Pianist").slice(0,80));
    if (url.pathname === "/api/profile" && request.method === "GET") return Response.json({
      actor,
      history: await service.all("SELECT challenge,result FROM battle_story_attempts WHERE user_id=? ORDER BY json_extract(result,'$.finishedAt') DESC LIMIT 12",user.id),
      attempts: await service.all("SELECT exercise_number,hand,accuracy,created_at FROM sight_attempts WHERE user_id=? ORDER BY created_at DESC LIMIT 100",user.id),
      victories: await service.one("SELECT COUNT(*) AS count FROM battle_story_attempts WHERE user_id=? AND json_extract(result,'$.result')='victory'",user.id),
      practiced: await service.one("SELECT COUNT(DISTINCT exercise_number) AS count FROM game_attempts WHERE user_id=? AND json_extract(result,'$.correct')>0",user.id),
      bests: await service.all("SELECT exercise_number,MAX(json_extract(result,'$.accuracy')) AS accuracy FROM game_attempts WHERE user_id=? AND status='completed' GROUP BY exercise_number ORDER BY accuracy DESC LIMIT 6",user.id),
    });
    if ((url.pathname === "/api/platform" || url.pathname === "/api/creator/game") && request.method === "POST") {
      const input = await request.json();
      if (!actions.has(input?.action)) throw new DomainError("Command unavailable in the public application.", 403);
      const creatorGame=url.pathname === "/api/creator/game";
      const creatorConfig=creatorGame?await creatorBattleConfig(pool,user.id,defaultBossBattleConfig,input.action==="gameSettings"?gameSettingsSchema.parse(input.settings).bossBattle:undefined):undefined;
      await authorizeMusicCommand(pool,user.id,input);
      if(input.action === "practiceExercise")return Response.json(await readMusicExercise(pool,z.number().int().positive().parse(input.exerciseNumber)));
      const result=await service.command(actor,creatorGame&&input.action==='gameSettings'?{action:'gameState'}:input);
      if(creatorConfig&&result&&typeof result==='object'&&'settings' in result)return Response.json({...result,settings:{...normalizeGameSettings(result.settings),bossBattle:creatorConfig}});
      return Response.json(result);
    }
    throw new DomainError("Not found",404);
  } catch (error) {
    if (error instanceof DomainError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid request." }, { status: 400 });
    console.error("Public API request failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Player storage is unavailable. Your unsaved gameplay stays queued locally. Please retry." }, { status: 503 });
  }
}
}
