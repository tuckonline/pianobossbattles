import {BattleIntro} from './battle-intro';
import {useEffect, useMemo, useState, type CSSProperties} from "react";
import {NotationViewer} from "../src/components/music/notation";
import {command} from "../src/components/ui/actions";
import {musicXml, type Exercise} from "./sight-library";
import {decodeScoreFeedback} from "./obs-score-state";
import type {OverlaySnapshot} from "./obs-state";
import {BossBattlePanel} from "./boss-ui";
import {battleLayout} from "./battle-layout";
import type {ShortsDisplay} from './shorts-display';

// Reuse prepared definitions across chain transitions; prefetch the next score
// while the current exercise plays. MIDI/cursor transport stays unchanged.
const scoreCache=new Map<number,Promise<{exercise:Exercise;xml:string}>>();
function loadScore(number:number){
 if(!scoreCache.has(number))scoreCache.set(number,(location.pathname.startsWith('/creator/obs/')?fetch(`/api/creator/view/score?number=${number}`).then(async r=>{if(!r.ok)throw Error('Score access unavailable');return r.json() as Promise<Exercise>;}):command<Exercise>({action:'practiceExercise',exerciseNumber:number})).then(async exercise=>{
  let xml=exercise.notationXml;
  if(!xml&&exercise.notationUrl){const r=await fetch(exercise.notationUrl);if(!r.ok)throw new Error('Unable to load score');xml=await r.text();}
  return {exercise,xml:xml??musicXml(exercise)};
 }).catch(e=>{scoreCache.delete(number);throw e;}));
 return scoreCache.get(number)!;
}
// A read-only renderer. Exercise definitions are loaded once per selection;
// live messages carry cursor/feedback only, never full MusicXML or MIDI events.
export function ObsScore({snapshot:s,offline=false,transport="cloud",embedded=false,cinematicActive=false,cinematicHolding=false,notationOnly=false,shortsDisplay}: {snapshot:OverlaySnapshot;offline?:boolean;transport?:"direct"|"cloud";embedded?:boolean;cinematicActive?:boolean;cinematicHolding?:boolean;notationOnly?:boolean;shortsDisplay?:ShortsDisplay}) {
  const Root=embedded?"section":"main";
  const canvasClass=`obs-score-canvas${embedded?" obs-score-embedded":""}`;
  const [loaded,setLoaded] = useState<{exercise:Exercise;xml:string}>();
  const [error,setError] = useState("");
  const [retry,setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;

    let timer:ReturnType<typeof setTimeout>;
    window.scrollTo(0,0);
    void loadScore(s.exerciseNumber).then(value=>{
      if(!cancelled){setLoaded(value);setError('');}
    }).catch(() => {
      if(!cancelled) {setError("Score reconnecting…");timer=setTimeout(()=>setRetry(n=>n+1),5000);}
    });
    return () => {cancelled=true;clearTimeout(timer);};
  },[s.exerciseNumber,retry]);
  const nextExercise=s.game?.battle?.chain?.nextExerciseNumber;
  useEffect(()=>{if(nextExercise)void loadScore(nextExercise).catch(()=>{});},[nextExercise]);
  const feedback = useMemo(() => loaded?.exercise.number===s.exerciseNumber && s.score ? decodeScoreFeedback(loaded.exercise,s.hand,s.score.feedback) : undefined,[loaded,s.exerciseNumber,s.hand,s.score]);
  if(!loaded) return <Root className={canvasClass}>{error && <p role="status">{error}</p>}</Root>;
  const {exercise,xml} = loaded;
  const score = s.score;
  const schmitt = exercise.collection === "schmitt-op16";
  const moonlight = exercise.collection === "moonlight";
  const battle=s.game?.battle;
  const bossEnabled=!notationOnly&&!!battle?.config.enabled;
  return <Root data-score-transport={transport} className={`${canvasClass}${bossEnabled ? " boss-mode" : ""}`} style={bossEnabled?{"--battle-width":`${battleLayout.panelWidthPercent}%`} as CSSProperties:undefined} aria-label={`${embedded?"Recording score":"OBS score only"}: ${s.title}`}>
    {bossEnabled && <BossBattlePanel battle={battle!} offline={offline} combo={s.game?.live.combo??0} recording={embedded} suppressResult={cinematicActive} suspendAnimation={cinematicHolding} audioOutput={embedded?'obs':undefined}/>}
    <div data-notation-scale={shortsDisplay?.notationScale} data-notation-view={shortsDisplay?.notationView} data-broadcast-focus={notationOnly?"measure":undefined} data-broadcast-systems={notationOnly?"1":undefined} data-broadcast-spacing={!notationOnly&&embedded ? "adaptive" : undefined} data-broadcast-viewport={notationOnly?"shorts":bossEnabled ? "battle" : embedded ? "recording" : undefined} className={`sight-score${moonlight ? " moonlight-score" : ""}`}>
      <NotationViewer xml={xml} presentationId={score?.presentationId??String(s.exerciseNumber)} pending={exercise.number!==s.exerciseNumber} compact={score?.compact ?? true}
        activeMeasure={score ? score.activeMeasure : s.measure-1} activeBeat={score?.activeBeat}
        consistentScale={schmitt || moonlight} engravingScale={schmitt ? 75 : 50}
        broadcastFit hideTitle
        followOptions={{enabled:score?.follow ?? true,topPercent:0,bottomPercent:0,visibleSystems:2,fitViewport:true}}
        noteFeedback={score?.listening ? undefined : feedback}/>
      {battle&&<BattleIntro battle={battle} audience={embedded} offline={offline}/>}
    </div>
  </Root>;
}
