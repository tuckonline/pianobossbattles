import 'dotenv/config';
import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
const [action,email,project]=process.argv.slice(2);
const expected='huxmltjtovpxxxupuxdg';
if(!['grant','revoke'].includes(action)||!email||project!==expected)throw Error('Usage: npx tsx scripts/music-admin.ts grant|revoke player-email huxmltjtovpxxxupuxdg');
const url=new URL(process.env.DATABASE_URL??'');
if(new URL(process.env.VITE_SUPABASE_URL??'').hostname!==`${expected}.supabase.co`||!decodeURIComponent(url.username).endsWith('.'+expected))throw Error('Refusing: local Supabase project and database pooler do not match the expected project.');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:true,...(process.env.DATABASE_SSL_CA_FILE?{ca:readFileSync(process.env.DATABASE_SSL_CA_FILE,'utf8')}:{})}});
try{
 const rows=(await pool.query('SELECT p.id FROM public.users p JOIN auth.users a ON a.id=p.id::uuid WHERE lower(p.email)=lower($1) AND a.email_confirmed_at IS NOT NULL',[email])).rows;
 if(rows.length!==1)throw Error('Exactly one confirmed, existing player account is required. No role was changed.');
 if(action==='grant')await pool.query("INSERT INTO public.roles(id,user_id,role) VALUES($1,$2,'MUSIC_ADMIN') ON CONFLICT(user_id,role) DO NOTHING",[crypto.randomUUID(),rows[0].id]);
 else await pool.query("DELETE FROM public.roles WHERE user_id=$1 AND role='MUSIC_ADMIN'",[rows[0].id]);
 console.log(`Music Library Administrator ${action==='grant'?'granted':'revoked'} for the specified confirmed account in ${expected}.`);
}finally{await pool.end();}
