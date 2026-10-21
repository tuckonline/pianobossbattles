import {bossConfigSchema,type BossBattleConfig} from '../hosted/boss-config';
import type {Pool} from 'pg';
import {createHash,randomBytes} from 'node:crypto';
import {z} from 'zod';
import {DomainError} from '../src/domains/auth/permissions';
import {musicAdmin,readMusicExercise} from './music-service';
import {PostgresBridge} from './postgres';
import {handleOverlay} from '../hosted/obs-service';
import {handleScoreSignaling} from '../hosted/obs-signaling';
import {creatorPreferencesSchema} from './creator-config';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const json=(x:unknown)=>Response.json(x,{headers:{'Cache-Control':'no-store'}});
function bridge(pool:Pool,user:string){return new PostgresBridge({query:(sql,values)=>pool.query(sql.replace(/\bobs_sessions\b/g,'creator_sessions').replace(/\bobs_score_peers\b/g,'creator_peers'),values)},undefined,user).asD1();}
export async function handleCreatorControl(request:Request,pool:Pool,user:string){
 if(!await musicAdmin(pool,user))throw new DomainError('Creator access requires an administrator account.',403);
 const url=new URL(request.url);
 if(url.pathname==='/api/creator/stream')return url.searchParams.get('rtc')==='1'?handleScoreSignaling(request,bridge(pool,user),user):handleOverlay(request,bridge(pool,user),user);
 await pool.query('INSERT INTO creator_sessions(user_id) VALUES($1) ON CONFLICT DO NOTHING',[user]);
 if(request.method==='POST'){
  const input=z.discriminatedUnion('action',[
   z.object({action:z.literal('preferences'),preferences:creatorPreferencesSchema}),
   z.object({action:z.literal('rotate')}),z.object({action:z.literal('revoke')})
  ]).parse(await request.json());
  if(input.action==='preferences')await pool.query('UPDATE creator_sessions SET preferences=$2 WHERE user_id=$1',[user,JSON.stringify(input.preferences)]);
  else {
   const token=input.action==='rotate'?randomBytes(32).toString('base64url'):null;
   await pool.query('UPDATE creator_sessions SET view_hash=$2,view_expires=$3 WHERE user_id=$1',[user,token?hash(token):null,token?Date.now()+30*86400000:null]);
   await pool.query('DELETE FROM creator_peers WHERE user_id=$1',[user]);
   return json({token});
  }
 }
 const row=(await pool.query('SELECT preferences,view_expires,view_hash IS NOT NULL AS linked FROM creator_sessions WHERE user_id=$1',[user])).rows[0];
 return json({preferences:creatorPreferencesSchema.parse(row.preferences),linked:row.linked,expiresAt:row.view_expires});
}
export async function handleCreatorView(request:Request,pool:Pool){
 const url=new URL(request.url),exchange=url.pathname==='/api/creator/view/exchange';
 const token=exchange?z.object({token:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).parse(await request.json()).token:request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('pbb_creator_view='))?.slice(17);
 if(!token)throw new DomainError('A valid Creator Studio viewing link is required.',401);
 const row=(await pool.query('SELECT user_id,preferences,snapshot,source_id,sequence,updated_at FROM creator_sessions WHERE view_hash=$1 AND view_expires>$2',[hash(token),Date.now()])).rows[0];
 if(!row||!await musicAdmin(pool,row.user_id))throw new DomainError('This viewing link has expired or was revoked.',401);
 if(exchange){if(request.method!=='POST')throw new DomainError('Method not allowed',405);return new Response('{}',{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':`pbb_creator_view=${token}; HttpOnly; SameSite=Strict; Path=/api/creator/view; Max-Age=2592000${url.protocol==='https:'?'; Secure':''}`}});}
 if(url.searchParams.get('rtc')==='1'){
  // Viewers can create an offer/read its answer, never read other offers or
  // impersonate the publisher by submitting an answer.
  if(request.method==='GET'&&!url.searchParams.get('viewerId'))throw new DomainError('Viewer identity required',403);
  if(request.method==='POST'&&(await request.clone().json()).type!=='offer')throw new DomainError('Read-only viewer',403);
  return handleScoreSignaling(request,bridge(pool,row.user_id),row.user_id);
 }
 if(request.method!=='GET')throw new DomainError('Read-only viewer',403);
 if(url.pathname==='/api/creator/view/score'){
  const number=z.coerce.number().int().positive().parse(url.searchParams.get('number'));
  const s=row.snapshot?JSON.parse(row.snapshot):null;
  if(!s||![s.exerciseNumber,s.game?.battle?.chain?.nextExerciseNumber].includes(number))throw new DomainError('Score is outside this live session.',403);
  return json(await readMusicExercise(pool,number));
 }
 // No profile, account ID, email, history, or private progress reads. This is
 // the existing live snapshot, without persistent player records.
 return json({snapshot:row.snapshot?JSON.parse(row.snapshot):null,sourceId:row.source_id,sequence:Number(row.sequence),updatedAt:Number(row.updated_at),best:null,attempts:0,creator:creatorPreferencesSchema.parse(row.preferences),viewerKey:hash(token).slice(0,16)});
}

// Only presentation/game selection preferences are scoped here. Evaluation,
// rewards, attempt identity and checkpoints still use the original service.
export async function creatorBattleConfig(pool:Pool,user:string,fallback:BossBattleConfig,save?:unknown){
 if(!await musicAdmin(pool,user))throw new DomainError('Creator access requires an administrator account.',403);
 await pool.query('INSERT INTO creator_sessions(user_id) VALUES($1) ON CONFLICT DO NOTHING',[user]);
 if(save!==undefined)await pool.query('UPDATE creator_sessions SET battle_config=$2 WHERE user_id=$1',[user,JSON.stringify(bossConfigSchema.parse(save))]);
 const row=(await pool.query('SELECT battle_config FROM creator_sessions WHERE user_id=$1',[user])).rows[0];
 return bossConfigSchema.parse(row.battle_config??{...fallback,enabled:true});
}
