import type { Pool } from 'pg';
import {z} from 'zod';
import {DomainError} from '../src/domains/auth/permissions';
import type {Exercise} from '../hosted/sight-library';
import {collectionName} from './music-labels';
export type MusicRow={number:number;collection:string;title:string;published:boolean;collectionPublished:boolean;available:boolean};
export async function musicAdmin(pool:Pick<Pool,'query'>,userId:string){
 return !!(await pool.query("SELECT 1 FROM roles WHERE user_id=$1 AND role='MUSIC_ADMIN'",[userId])).rows.length;
}
export async function requireMusic(pool:Pick<Pool,'query'>,userId:string,numbers:number[],admin=false){
 if(!numbers.length)return;
 const rows=(await pool.query('SELECT e.number,e.published AND c.published AS available FROM practice_exercises e JOIN music_collections c ON c.id=e.collection WHERE e.number=ANY($1::bigint[])',[numbers])).rows;
 if(numbers.some(n=>!rows.some(r=>Number(r.number)===n&&(admin||r.available))))throw new DomainError('A piece in your queue is unavailable. Refresh the library or remove it before starting.',403);
}
const entriesSchema=z.object({entries:z.array(z.object({number:z.number().int().positive().max(1000000),loops:z.number().int().min(1).max(100)})).min(1).max(213),hand:z.enum(['both','left','right'])});
export async function handleMusic(request:Request,pool:Pick<Pool,'query'>,userId:string):Promise<Response>{
 const url=new URL(request.url),admin=await musicAdmin(pool,userId);
 if(url.pathname.startsWith('/api/admin/music')){
  if(!admin)throw new DomainError('Administrator access required.',403);
  if(request.method==='POST'){
   const input=z.discriminatedUnion('kind',[
    z.object({kind:z.literal('collection'),id:z.string().min(1).max(100),published:z.boolean()}),
    z.object({kind:z.literal('piece'),id:z.number().int().positive(),published:z.boolean()}),
   ]).parse(await request.json());
   const table=input.kind==='collection'?'music_collections':'practice_exercises',key=input.kind==='collection'?'id':'number';
   const result=await pool.query(`UPDATE ${table} SET published=$1 WHERE ${key}=$2 RETURNING ${key}`,[input.published,input.id]);
   if(!result.rows.length)throw new DomainError('Music not found.',404);
  }else if(request.method!=='GET')throw new DomainError('Method not allowed.',405);
  const collections=(await pool.query('SELECT c.id,c.published,count(e.number)::int AS total,count(e.number) FILTER(WHERE e.published AND c.published)::int AS available FROM music_collections c LEFT JOIN practice_exercises e ON e.collection=c.id GROUP BY c.id ORDER BY c.id')).rows.map(c=>({...c,name:collectionName(c.id)}));
  const pieces=(await pool.query('SELECT e.number,e.collection,e.title,e.published,c.published AS "collectionPublished",e.published AND c.published AS available FROM practice_exercises e JOIN music_collections c ON c.id=e.collection ORDER BY e.collection,e.source_number,e.number')).rows;
  return Response.json({collections,pieces});
 }
 if(url.pathname==='/api/music/authorize'&&request.method==='POST'){
  const input=entriesSchema.parse(await request.json());
  await requireMusic(pool,userId,input.entries.map(e=>e.number),admin);
  const rows=(await pool.query('SELECT definition FROM practice_exercises WHERE number=ANY($1::bigint[])',[input.entries.map(e=>e.number)])).rows;
  if(rows.some(r=>{const e=JSON.parse(r.definition) as Exercise;return (e.singleHand&&e.singleHand!==input.hand)||(e.bothHandsOnly&&input.hand!=='both');}))throw new DomainError('Choose pieces compatible with the selected hands.',400);
  return Response.json({authorized:true});
 }
 if(url.pathname==='/api/music'&&request.method==='GET'){
  const queued=z.array(z.number().int().positive().max(1000000)).max(213).parse(JSON.parse(url.searchParams.get('queued')??'[]'));
  const version=(await pool.query("SELECT md5(string_agg(e.number::text || ':' || e.published::text || ':' || c.published::text,',' ORDER BY e.number)) AS version FROM practice_exercises e JOIN music_collections c ON c.id=e.collection")).rows[0].version;
  const etag=`"${userId}:${version}:${admin}:${queued.join(',')}"`;
  if(request.headers.get('if-none-match')===etag)return new Response(null,{status:304,headers:{ETag:etag}});
  const rows=(await pool.query(`SELECT e.number,e.collection,e.title,e.definition,e.published AND c.published AS available,s.xml FROM practice_exercises e JOIN music_collections c ON c.id=e.collection LEFT JOIN music_scores s ON s.exercise_number=e.number WHERE $1::boolean OR (e.published AND c.published) OR e.number=ANY($2::bigint[]) ORDER BY e.collection,e.source_number,e.number`,[admin,queued])).rows;
  return Response.json({admin,pieces:rows.map(r=>{
   if(!admin&&!r.available)return {number:Number(r.number),collection:r.collection,title:r.title,right:[],left:[],available:false};
   const e=JSON.parse(r.definition) as Exercise;
   return {...e,number:Number(r.number),collection:r.collection,title:r.title,notationUrl:undefined,sourceUrl:undefined,notationXml:r.xml??e.notationXml,available:true,published:r.available};
  })},{headers:{ETag:etag}});
 }
 throw new DomainError('Not found.',404);
}
// Check legacy gameplay endpoints too. A recorded attempt can finish syncing
// after an admin hides its music; publication cannot erase already-earned progress.
export async function authorizeMusicCommand(pool:Pick<Pool,'query'>,userId:string,input:Record<string,unknown>){
 if(!['practiceExercise','gameSync','sightAttempt','battleStorySave'].includes(String(input.action)))return;
 if(await musicAdmin(pool,userId))return;
 if(input.action==='battleStorySave'){
  const parsed=z.object({challenge:z.object({exercises:z.array(z.object({number:z.number().int().positive()})).max(213)}),passes:z.array(z.object({id:z.string().uuid()})).max(100000)}).parse(input);
  const numbers=parsed.challenge.exercises.map(e=>e.number);
  const prior=(await pool.query('SELECT exercise_number FROM game_attempts WHERE user_id=$1 AND id=ANY($2::text[])',[userId,parsed.passes.map(p=>p.id)])).rows.map(r=>Number(r.exercise_number));
  await requireMusic(pool,userId,numbers.filter(n=>!prior.includes(n)));return;
 }
 const number=z.number().int().positive().max(1000000).parse(input.exerciseNumber);
 if(input.action==='gameSync'){
  const id=z.string().uuid().parse(input.attemptId);
  if((await pool.query('SELECT 1 FROM game_attempts WHERE user_id=$1 AND id=$2 AND exercise_number=$3',[userId,id,number])).rows.length)return;
 }
 await requireMusic(pool,userId,[number]);
}
export async function readMusicExercise(pool:Pick<Pool,'query'>,number:number){
 const row=(await pool.query('SELECT e.definition,s.xml FROM practice_exercises e LEFT JOIN music_scores s ON s.exercise_number=e.number WHERE e.number=$1',[number])).rows[0];
 if(!row)throw new DomainError('Exercise not found.',404);
 const e=JSON.parse(row.definition) as Exercise;
 return {...e,notationUrl:undefined,sourceUrl:undefined,notationXml:row.xml??e.notationXml};
}
