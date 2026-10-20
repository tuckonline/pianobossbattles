import {useCallback,useEffect,useRef,useState} from "react";
import {battleAnimationLibrary,canonicalCharacters,type BattleAnimationDefinition,type CharacterId} from "./battle-animation-library";
import {BattleAnimationPlayer} from "./battle-animation-player";
import {spriteProgress} from "./battle-timeline";

// Inspection uses the real contact-locked sprite clock. It never dispatches a
// battle event, starts audio, or installs a MIDI listener.
export function inspectionPoseTimes(clip:BattleAnimationDefinition){
  if(clip.poseTimesMs&&!clip.loop)return [...clip.poseTimesMs];
  const count=clip.asset.type==='spriteSheet'?clip.asset.frames.length:clip.asset.type==='frameSequence'?clip.asset.paths.length:1;
  const contact=clip.loop?undefined:clip.contact;
  return Array.from({length:count},(_,i)=>contact
    ? i<=contact.impactFrame
      ? i/Math.max(1,contact.impactFrame)*contact.impactTimeMs
      : contact.impactTimeMs+(i-contact.impactFrame)/(count-contact.impactFrame)*(clip.durationMs-contact.impactTimeMs)
    : i/count*clip.durationMs);
}

export function BattleAnimationInspector({clip}:{clip:BattleAnimationDefinition}){
  const [playing,setPlaying]=useState(false),[loop,setLoop]=useState(false),[speed,setSpeed]=useState(1);
  const [nextId,setNextId]=useState(""),[position,setPosition]=useState({segment:0,time:0});
  const positionRef=useRef(position);
  const next=battleAnimationLibrary.find(c=>c.id===nextId);
  const active=position.segment===1&&next?next:clip;
  const setAt=useCallback((value:typeof position)=>{positionRef.current=value;setPosition(value);},[]);
  useEffect(()=>{
    if(!playing)return;
    let raf=0,last=performance.now();
    const tick=(now:number)=>{
      const current=positionRef.current,currentClip=current.segment===1&&next?next:clip;
      let time=current.time+(now-last)*speed,segment=current.segment;
      last=now;
      if(time>=currentClip.durationMs){
        if(segment===0&&next){time-=currentClip.durationMs;segment=1;}
        else if(loop){time=0;segment=0;}
        else {time=currentClip.durationMs-.001;setPlaying(false);}
      }
      setAt({segment,time});raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(raf);
  },[playing,loop,speed,clip,next,setAt]);
  const times=inspectionPoseTimes(active);
  const frame=Math.min(times.length-1,Math.floor(spriteProgress(active,{startedAt:0,contactMs:active.contact?.impactTimeMs},position.time)*times.length));
  const step=(delta:number)=>{
    setPlaying(false);
    setAt({...position,time:times[Math.max(0,Math.min(times.length-1,frame+delta))]+.001});
  };
  const phase=active.posePhases?.[frame]??(active.contact?(frame<active.contact.impactFrame?'anticipation':frame===active.contact.impactFrame?'contact':'follow-through / recovery'):active.category);
  return <section aria-label="Pose continuity inspector">
    <div className="boss-options">
      <button type="button" onClick={()=>{setAt({segment:0,time:0});setPlaying(true);}}>Play from start</button>
      <button type="button" onClick={()=>setPlaying(p=>!p)}>{playing?'Pause poses':'Resume poses'}</button>
      <button type="button" onClick={()=>step(-1)}>Previous pose</button>
      <button type="button" onClick={()=>step(1)}>Next pose</button>
      <label><input type="checkbox" checked={loop} onChange={e=>setLoop(e.target.checked)}/> Loop preview</label>
      <label>Playback speed <select value={speed} onChange={e=>setSpeed(Number(e.target.value))}>
        <option value={1}>100%</option><option value={.5}>50%</option><option value={.25}>25%</option>
      </select></label>
      <label>Then transition to <select value={nextId} onChange={e=>{setNextId(e.target.value);setAt({segment:0,time:0});setPlaying(false);}}>
        <option value="">No following clip</option>
        {battleAnimationLibrary.filter(c=>c.characterId===clip.characterId).map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
      </select></label>
    </div>
    <div className="battle-library-preview" aria-label="Animation preview" style={{width:'min(100%,600px)',height:360}}>
      <div style={{width:'44%'}}>
      <BattleAnimationPlayer id={active.characterId as CharacterId} side={canonicalCharacters[active.characterId as CharacterId].side}
        playback={{clip:active,startedAt:0,serial:position.segment,contactMs:active.contact?.impactTimeMs}}
        paused inspectionTimeMs={position.time}/>
      </div>
    </div>
    <label>Pose time <input aria-label="Pose time" type="range" min={0} max={active.durationMs-.001} step={1} value={position.time}
      onChange={e=>{setPlaying(false);setAt({...position,time:Number(e.target.value)});}}/></label>
    <output aria-label="Pose inspection readout" style={{display:'block'}}>
      {active.id} · pose {frame+1}/{times.length} · {phase} · {Math.round(position.time)}/{active.durationMs} ms
      {active.contact?` · contact pose ${active.contact.impactFrame+1} at ${active.contact.impactTimeMs} ms`:' · no contact event'}
    </output>
  </section>;
}
