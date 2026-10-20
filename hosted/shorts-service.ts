import type {D1Database} from '@cloudflare/workers-types';
import {shortsSessionSchema} from './shorts-core';
import {DomainError} from '../src/domains/auth/permissions';
export async function handleShorts(request:Request,db:D1Database,user:string){
  const url=new URL(request.url),id=url.searchParams.get('id');
  const headers={'Cache-Control':'private, no-store'};
  if(request.method==='GET'){
    if(id){const row=await db.prepare('SELECT payload FROM shorts_sessions WHERE user_id=? AND id=?').bind(user,id).first<{payload:string}>();
      if(!row)throw new DomainError('Recording not found',404);return Response.json(JSON.parse(row.payload),{headers});}
    const rows=await db.prepare("SELECT id,revision,updated_at,json_extract(payload,'$.title') AS title,json_extract(payload,'$.status') AS status,json_extract(payload,'$.startedAt') AS startedAt FROM shorts_sessions WHERE user_id=? ORDER BY updated_at DESC LIMIT 100").bind(user).all();
    return Response.json(rows.results,{headers});
  }
  if(request.method!=='POST')throw new DomainError('Method not allowed',405);
  const reader=request.body?.getReader();let size=0;const chunks:Uint8Array[]=[];
  if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1900000){await reader.cancel();throw new DomainError('Recording metadata is too large',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
  let input:unknown;
  try{input=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new DomainError('Invalid recording metadata');}
  const parsed=shortsSessionSchema.safeParse(input&&typeof input==='object'&&'session' in input?input.session:undefined);
  if(!parsed.success)throw new DomainError('Invalid recording metadata');const s=parsed.data;
  if(s.events.some((e,i)=>!s.segments.some(p=>p.id===e.segment)||(i>0&&e.atMs<s.events[i-1].atMs)))throw new DomainError('Invalid recording timeline');
  const payload=JSON.stringify(s);
  await db.prepare(`INSERT INTO shorts_sessions(user_id,id,revision,payload,updated_at) VALUES(?,?,?,?,?)
    ON CONFLICT(user_id,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,updated_at=excluded.updated_at WHERE excluded.revision>shorts_sessions.revision`).bind(user,s.id,s.revision,payload,new Date().toISOString()).run();
  const latest=await db.prepare('SELECT revision,payload FROM shorts_sessions WHERE user_id=? AND id=?').bind(user,s.id).first<{revision:number;payload:string}>();
  if(latest?.revision!==s.revision||latest.payload!==payload)throw new DomainError('This recording changed in another tab. Reload it before editing.',409);
  return Response.json({saved:true,revision:s.revision},{headers});
}
