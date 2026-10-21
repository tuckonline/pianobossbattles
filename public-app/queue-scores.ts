import {useEffect,useMemo,useState} from 'react';
import type {Exercise} from '../hosted/sight-library';
import type {ChainEntry} from '../hosted/schmitt-chain';
import type {CatalogExercise} from './catalog';

// Load exact scores only for the setlist, before an attempt can start. All chain
// entries are ready up front, so loop/exercise transitions never wait on HTTP.
export function useQueueScores(draft:ChainEntry[],catalog:CatalogExercise[]){
 const [scores,setScores]=useState<Record<number,Exercise>>({});
 const [error,setError]=useState(''),[retry,setRetry]=useState(0);
 const queue=useMemo(()=>draft.map(entry=>{
  const current=catalog.find(p=>p.number===entry.exercise.number&&p.available);
  const piece=current??entry.exercise;
  const loaded=scores[piece.number];
  return {...entry,exercise:loaded?{...piece,...loaded}:piece};
 }),[draft,catalog,scores]);
 const needed=JSON.stringify([...new Set(draft.filter(entry=>catalog.some(p=>p.number===entry.exercise.number&&p.available&&p.detailsRequired)&&!scores[entry.exercise.number]).map(e=>e.exercise.number))]);
 useEffect(()=>{
  const numbers=JSON.parse(needed) as number[];
  if(!numbers.length)return;
  const controller=new AbortController();
  setError('');
  const load=async()=>{
   const loaded:Record<number,Exercise>={};
   let next=0;
   await Promise.all(Array.from({length:Math.min(3,numbers.length)},async()=>{
    while(next<numbers.length){
     const number=numbers[next++];
     const r=await fetch('/api/platform',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]),body:JSON.stringify({action:'practiceExercise',exerciseNumber:number})});
     const data=await r.json().catch(()=>null);
     if(!r.ok||!data||data.number!==number||!Array.isArray(data.right)||!Array.isArray(data.left))throw Error(data?.error??'Could not load the selected sheet music. Please retry.');
     loaded[number]=data;
    }
   }));
   if(!controller.signal.aborted)setScores(previous=>({...previous,...loaded}));
  };
  void load().catch(e=>{if(!controller.signal.aborted){setError(e.name==='TimeoutError'?'Loading the selected sheet music took too long. Please retry.':e.message);controller.abort();}});
  return()=>controller.abort();
 },[needed,retry]);
 return {queue,ready:needed==='[]',error:needed==='[]'?'':error,retry:()=>setRetry(n=>n+1)};
}
