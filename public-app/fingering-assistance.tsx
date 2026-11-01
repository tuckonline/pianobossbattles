import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { lowerFingering, resolveFingering, type FingeringPreference } from "../src/domains/notation/fingering-assistance";
const Context = createContext<{preference:FingeringPreference;setPreference:(value:FingeringPreference)=>void}>({preference:"recommended",setPreference:()=>{}});
export function FingeringProvider({userId,children}:{userId:string;children:ReactNode}) {
  const key=`pbb:fingering-assistance:v1:${userId}`;
  const [preference,setPreference]=useState<FingeringPreference>(()=>{try{const value=localStorage.getItem(key);return ["full","light","minimal","off"].includes(value??"")?value as FingeringPreference:"recommended";}catch{return "recommended";}});
  useEffect(()=>{try{localStorage.setItem(key,preference);}catch{/* Keep session preference when storage is unavailable. */}},[key,preference]);
  return <Context.Provider value={{preference,setPreference}}>{children}</Context.Provider>;
}
export function useFingering(difficulty:number) {
  const context=useContext(Context), level=resolveFingering(context.preference,difficulty);
  return {...context,level,next:lowerFingering(level)};
}
export function FingeringControl({difficulty,disabled=false}:{difficulty:number;disabled?:boolean}) {
  const {preference,setPreference,level}=useFingering(difficulty);
  const descriptions={full:"All available valid finger numbers. Missing fingerings are not guessed.",light:"Starting fingers, first use of each finger, and explicitly marked changes.",minimal:"Starting fingers and explicitly marked essential changes only.",off:"Finger numbers hidden. Original annotations are preserved."};
  return <div className="classical-note"><label>Fingering Assistance <select aria-label="Fingering Assistance" disabled={disabled} value={preference} onChange={e=>setPreference(e.target.value as FingeringPreference)}>
    <option value="recommended">Use Recommended</option><option value="full">Full</option><option value="light">Light</option><option value="minimal">Minimal</option><option value="off">Off</option>
  </select></label><p>{preference==="recommended"?`Recommended: ${level}. `:""}{descriptions[level]}</p></div>;
}
