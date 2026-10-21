import {useCallback,useEffect,useRef,useState} from 'react';
import {watchMusicPublication} from './music-updates';
import type {Exercise} from '../hosted/sight-library';
export type CatalogExercise=Exercise&{available:boolean;published?:boolean;detailsRequired?:boolean};
export function useMusicCatalog(userId:string){
 const [catalog,setCatalog]=useState<CatalogExercise[]>(),[error,setError]=useState('');
 const [admin,setAdmin]=useState(false);
 const version=useRef('');
 const pending=useRef<Promise<void>|null>(null), refreshAgain=useRef(false);
 const refresh=useCallback(async()=>{
  // Serialize refreshes so an older response cannot overwrite a publication update.
  if(pending.current){refreshAgain.current=true;return pending.current;}
  const load=async()=>{
  let queued:number[]=[];
  try{const saved=JSON.parse(localStorage.getItem(`pbb:setup:v2:${userId}`)??'null');queued=(saved?.entries??[]).map((e:{number:number})=>e.number).filter(Number.isInteger).slice(0,213);}catch{}
  const r=await fetch(`/api/music?queued=${encodeURIComponent(JSON.stringify(queued))}`,{cache:'no-store',signal:AbortSignal.timeout(20000),headers:version.current?{'If-None-Match':version.current}:undefined});
  if(r.status===304){setError('');return;}
  const data=await r.json().catch(()=>null);if(!r.ok||!data)throw Error(data?.error??'Could not load the music library. Please retry.');
  version.current=r.headers.get('etag')??'';
  setAdmin(data.admin===true);
  const testing=Number(new URLSearchParams(location.search).get('music'));
  setCatalog(previous=>data.pieces.map((piece:CatalogExercise)=>{
    // Hidden pieces are testable only via the administrator's explicit preview link.
    const e={...piece,available:piece.available&&(!data.admin||piece.published!==false||piece.number===testing)};
    const prior=previous?.find(p=>p.number===e.number&&p.right.length);
    return !e.available&&prior?{...prior,...e,right:prior.right,left:prior.left}:e;
  }));
  setError('');
  };
  const run=async()=>{do{refreshAgain.current=false;await load();}while(refreshAgain.current);};
  const task=run();pending.current=task;
  try{await task;}finally{if(pending.current===task)pending.current=null;}
 },[userId]);
 useEffect(()=>{let active=true;const load=()=>{if(active)void refresh().catch(e=>{if(active)setError(e.name==='TimeoutError'?'Loading your dashboard took too long. Please retry.':e.message);});};load();const stop=watchMusicPublication(load);return()=>{active=false;stop();};},[refresh]);
 return {catalog,admin,error,refresh};
}
