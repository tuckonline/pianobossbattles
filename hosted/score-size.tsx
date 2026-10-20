import {useEffect, useState} from 'react';

type ScoreSize = {mode:'auto'|'custom'|'fit-width'; percent:number};
const automatic:ScoreSize={mode:'auto',percent:100};
// Start existing installations in the new viewport-fit mode. Future manual
// overrides still persist per collection; the old fixed percentages stay in v1.
const storageKey='pianopath-score-size-v2';
const clamp=(n:number)=>Math.max(60,Math.min(300,Math.round(n/10)*10));

export function useScoreSize(collection:string) {
  const [preferences,setPreferences]=useState<Record<string,ScoreSize>>(()=>{
    try {
      const saved=JSON.parse(localStorage.getItem(storageKey)??'{}');
      return Object.fromEntries(Object.entries(saved).filter(([,v]:[string,any])=>
        v && ['auto','custom','fit-width'].includes(v.mode) && Number.isFinite(v.percent))
        .map(([k,v]:[string,any])=>[k,{mode:v.mode,percent:clamp(v.percent)}]));
    } catch {return {};}
  });
  const size=preferences[collection]??automatic;
  const [renderSize,setRenderSize]=useState(size);
  // Avoid engraving intermediate slider positions while the user is dragging.
  useEffect(()=>{const timer=setTimeout(()=>setRenderSize(size),120);return()=>clearTimeout(timer);},[size]);
  useEffect(()=>{try {localStorage.setItem(storageKey,JSON.stringify(preferences));} catch {/* Storage can be unavailable. */}},[preferences]);
  return {size,renderSize,setSize:(next:ScoreSize)=>setPreferences(previous=>({...previous,[collection]:next}))};
}

export function ScoreSizeControls({size,effectivePercent,onChange}: {size:ScoreSize;effectivePercent:number;onChange:(size:ScoreSize)=>void}) {
  const resize=(percent:number)=>onChange({mode:'custom',percent:clamp(percent)});
  const percent=size.mode==='custom'?size.percent:clamp(effectivePercent);
  return <div className="score-size-controls" role="group" aria-label="Score display size">
    <strong>Score size</strong>
    <button type="button" className="secondary score-size-step" aria-label="Make score smaller" disabled={percent<=60} onClick={()=>resize(percent-10)}>−</button>
    <input aria-label="Score size" type="range" min="60" max="300" step="10" value={percent} aria-valuetext={`${percent}%`} onChange={e=>resize(Number(e.target.value))} />
    <button type="button" className="secondary score-size-step" aria-label="Make score larger" disabled={percent>=300} onClick={()=>resize(percent+10)}>+</button>
    <output aria-live="polite">{size.mode==='auto'?'Auto fit':size.mode==='fit-width'?'Fit width':`${size.percent}%`}</output>
    <button type="button" className="secondary" aria-pressed={size.mode==='fit-width'} onClick={()=>onChange({mode:'fit-width',percent:100})}>Fit width</button>
    <button type="button" className="secondary" aria-pressed={size.mode==='auto'} onClick={()=>onChange(automatic)}>Fit viewing area</button>
    <small>Auto fit fills the available width and height for one-line scores. Longer scores keep their usual size, fitting two lines above the reserved OBS camera area. Manual changes are saved for this collection.</small>
  </div>;
}
