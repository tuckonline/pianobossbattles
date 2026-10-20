import {useCallback,useEffect,useRef,useState} from 'react';
import type {Exercise} from '../hosted/sight-library';
export type CatalogExercise=Exercise&{available:boolean;published?:boolean};
export function useMusicCatalog(userId:string){
 const [catalog,setCatalog]=useState<CatalogExercise[]>(),[error,setError]=useState('');
 const [admin,setAdmin]=useState(false);
 const version=useRef('');
 const refresh=useCallback(async()=>{
  let queued:number[]=[];
  try{const saved=JSON.parse(localStorage.getItem(`pbb:setup:v2:${userId}`)??'null');queued=(saved?.entries??[]).map((e:{number:number})=>e.number).filter(Number.isInteger).slice(0,213);}catch{}
  const r=await fetch(`/api/music?queued=${encodeURIComponent(JSON.stringify(queued))}`,{cache:'no-store',headers:version.current?{'If-None-Match':version.current}:undefined});
  if(r.status===304){setError('');return;}
  const data=await r.json();if(!r.ok)throw Error(data.error??'Could not load the music library.');
  version.current=r.headers.get('etag')??'';
  setAdmin(data.admin===true);
  setCatalog(previous=>data.pieces.map((e:CatalogExercise)=>!e.available&&previous?.find(p=>p.number===e.number&&p.right.length)?{...previous.find(p=>p.number===e.number),...e,right:previous.find(p=>p.number===e.number)!.right,left:previous.find(p=>p.number===e.number)!.left}:e));
  setError('');
 },[userId]);
 useEffect(()=>{let active=true;const load=()=>{if(active)void refresh().catch(e=>{if(active)setError(e.message);});};load();window.addEventListener('focus',load);const interval=setInterval(load,15000);return()=>{active=false;window.removeEventListener('focus',load);clearInterval(interval);};},[refresh]);
 return {catalog,admin,error,refresh};
}
