import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {catalog} from '../public-app/server-catalog';
const quote=(value:string)=>"'"+value.replaceAll("'","''")+"'";
const out=['-- Versioned existing built-ins and private score assets; preserve all 228 original rows.','BEGIN;'];
for(const id of new Set(catalog.map(e=>e.collection??'sight-reading')))out.push(`INSERT INTO music_collections(id,published) VALUES(${quote(id)},${id==='repertoire-archived'?'false':'true'}) ON CONFLICT(id) DO NOTHING;`);
for(const e of catalog){
 out.push(`INSERT INTO practice_exercises(number,collection,source_number,title,source_url,source_page,definition) VALUES(${e.number},${quote(e.collection??'sight-reading')},${e.number},${quote(e.title??`Exercise ${e.number}`)},${quote(e.sourceUrl??'')},${e.sourcePage??0},${quote(JSON.stringify(e))}) ON CONFLICT(number) DO NOTHING;`);
 if(e.notationUrl){
  if(!e.notationUrl.startsWith('/scores/'))throw Error('Unexpected score source');
  const path=resolve('hosted/public','.'+e.notationUrl);
  if(!existsSync(path))throw Error(`Missing notation ${e.number}`);
  out.push(`INSERT INTO music_scores(exercise_number,xml) VALUES(${e.number},${quote(readFileSync(path,'utf8'))}) ON CONFLICT(exercise_number) DO NOTHING;`);
 }
}
out.push('-- Preserve current playable catalog; archived material remains hidden. Future inserts default hidden.',`UPDATE practice_exercises SET published=true WHERE number IN (${catalog.filter(e=>e.collection!=='repertoire-archived').map(e=>e.number).join(',')});`,'COMMIT;');
writeFileSync('supabase/migrations/202610200004_existing_music_visibility.sql',out.join('\n')+'\n');
console.log('Prepared migration for',catalog.length,'definitions; existing definitions are insert-only.');
