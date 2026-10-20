/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element -- Independent Vite SPA. */
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, syncServerSession } from "./supabase";
import { useMusicCatalog, type CatalogExercise } from "./catalog";
import { collectionName } from "./music-labels";
import { MidiSetup } from "../src/components/midi/setup";
import { SightReading, type PracticeControls } from "../hosted/sight-reading";
import { gameClient, useGame } from "../hosted/game-client";
import { levelInfo } from "../hosted/game-core";
import { bossProfiles, bossProfile, type BossId } from "../hosted/boss-registry";
import { type BossBattleConfig } from "../hosted/boss-config";
import { BattleSettings, modeSettingSummary, modeTimePreview } from "./battle-settings";
import { BossBattlePanel } from "../hosted/boss-ui";
import { battleLayout, type BossBattleLayoutConfig } from "../hosted/battle-layout";
import { battleView } from "../hosted/boss-battle";
import { usePracticeCinematicActive } from "../hosted/battle-cinematic-ui";
import { useBattleAudioOutput } from "../hosted/battle-audio-ui";
import type { Exercise, Hand } from "../hosted/sight-library";
import type { ChainEntry } from "../hosted/schmitt-chain";
import type { StoryResult } from "../hosted/battle-story";


const modes = [
  {id:"timeAttack", title:"Time Attack", icon:"clock", description:"Every phrase races the clock."},
  {id:"practice", title:"Practice", icon:"bars", description:"Find your flow. No battle pressure."},
  {id:"survival", title:"Survival", icon:"heart", description:"Finish the music. Protect your HP."},
  {id:"ultimateBoss", title:"Ultimate Boss", icon:"crown", description:"Survive the music. Beat the clock."},
] as const;
const title=(e:Exercise)=>e.title??`Exercise ${e.number}`;
const hero="/battle/cinematics/hero-finish.png";
const previewLayout:BossBattleLayoutConfig={...battleLayout,referencePanelWidthPercent:22,
  hudHeightPercent:0,arenaHeightPercent:100,statusHeightPercent:0,
  heroScale:1,bossScale:1.1,characterScale:1.75,
  heroIdleZone:{x:.03,y:.06,width:.44,height:.92},bossIdleZone:{x:.53,y:.06,width:.44,height:.92},
  heroAnchor:{x:.26,y:.55},bossAnchor:{x:.76,y:.55}};
const icons:Record<string,string>={
  clock:"M9 2h6M12 6v3m6-5 2 2M12 10v5l3 2M20 14a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  bars:"M4 13h3v8H4zM11 4h3v17h-3zM18 9h3v12h-3z",
  heart:"M12 21S2 15 2 8a5 5 0 0 1 10-1A5 5 0 0 1 22 8c0 7-10 13-10 13Z",
  crown:"m2 6 5 5 5-8 5 8 5-5-3 13H5ZM5 22h14",
  swords:"m4 3 14 14m-3 0 5-5m-3 5 4 4M20 3 6 17m3 0-5-5m3 5-4 4M4 3l1 5 3-3Zm16 0-1 5-3-3Z",
  music:"M9 18V5l11-2v13M9 8l11-2M9 18c0 2-2 3-4 3s-3-1-3-2 2-3 4-3 3 1 3 2Zm11-2c0 2-2 3-4 3s-3-1-3-2 2-3 4-3 3 1 3 2Z",
  list:"M8 5h13M8 12h13M8 19h13M3 5h.1M3 12h.1M3 19h.1",
  check:"m5 12 4 4L19 6",arrow:"M4 12h16m-6-6 6 6-6 6",cup:"M7 3h10v7a5 5 0 0 1-10 0ZM7 5H3v3c0 3 2 4 5 4m9-7h4v3c0 3-2 4-5 4M12 15v6m-4 0h8"
};
function Icon({name}:{name:string}){return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[name]??icons.music}/></svg>;}
function PianoMark(){return <svg className="piano-mark" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="piano-cyan" x2="0" y2="1"><stop stopColor="#7eeeff"/><stop offset="1" stopColor="#04bde9"/></linearGradient></defs><path fill="url(#piano-cyan)" d="M3 8h7v33H3zm9-4h7v37h-7zm9-3h7v40h-7zm9 3h7v37h-7zm9 4h6v33h-6z"/><path fill="#061323" d="M8 1h5v24H8zm9 0h5v24h-5zm18 0h5v24h-5z"/></svg>;}
type Draft={hand:Hand;entries:{number:number;loops:number}[]};
function readDraft(userId:string,catalog:CatalogExercise[]):{hand:Hand;queue:ChainEntry[]}{
  const requested=catalog.find(e=>e.number===Number(new URLSearchParams(location.search).get("music"))&&e.available);
  if(requested)return {hand:requested.singleHand??"both",queue:[{exercise:requested,loops:1}]};
  const first=catalog.find(e=>e.number===2001&&e.available)??catalog.find(e=>e.available);
  const fallback={hand:"both" as Hand,queue:first?[{exercise:first,loops:1}]:[]};
  try{const raw=JSON.parse(localStorage.getItem(`pbb:setup:v2:${userId}`)??"null") as Draft|null;
    if(!raw||!["both","left","right"].includes(raw.hand)||!Array.isArray(raw.entries))return fallback;
    return {hand:raw.hand,queue:raw.entries.flatMap(e=>{const exercise=catalog.find(x=>x.number===e.number);return exercise&&(!exercise.singleHand||exercise.singleHand===raw.hand)&&(!exercise.bothHandsOnly||raw.hand==="both")?[{exercise,loops:Math.max(1,Math.min(100,Math.round(Number(e.loops)||1)))}]:[];})};
  }catch{return fallback;}
}
const currentView=()=>new URLSearchParams(location.search).get("view")==="preview"?"preview":"setup";
export function PlayerHome({user}:{user:User}) {
  const {catalog,admin,error,refresh}=useMusicCatalog(user.id);
  if(!catalog)return <section className="setup-section"><h1>Music library</h1><p role={error?"alert":"status"}>{error||"Loading your music…"}</p>{error&&<button onClick={()=>void refresh().catch(()=>{})}>Retry</button>}</section>;
  return <LoadedPlayerHome user={user} catalog={catalog} admin={admin} libraryError={error} refreshLibrary={refresh}/>;
}
function LoadedPlayerHome({user,catalog,admin,libraryError,refreshLibrary}:{user:User;catalog:CatalogExercise[];admin:boolean;libraryError:string;refreshLibrary:()=>Promise<void>}) {
  const game=useGame();
  const [draft]=useState(()=>readDraft(user.id,catalog));
  const [initialLibrary]=useState(catalog);
  const [connected,setConnected]=useState(false),[theatre,setTheatre]=useState(false),[view,setView]=useState(currentView);
  const [search,setSearch]=useState(""),[category,setCategory]=useState("");
  const [queueDraft,setQueue]=useState<ChainEntry[]>(draft.queue),[hand,setHand]=useState<Hand>(draft.hand),[notice,setNotice]=useState("");
  const queue=useMemo(()=>queueDraft.map(entry=>{const current=catalog.find(p=>p.number===entry.exercise.number&&p.available);return current?{...entry,exercise:current}:entry;}),[queueDraft,catalog]);
  const [history,setHistory]=useState<StoryResult[]>([]),[victories,setVictories]=useState(0),[practiced,setPracticed]=useState(0);
  const [bests,setBests]=useState<{exerciseNumber:number;accuracy:number}[]>([]);
  const [profileError,setProfileError]=useState(""),[draftError,setDraftError]=useState("");
  const [authorizing,setAuthorizing]=useState(false);
  const [logoutBusy,setLogoutBusy]=useState(false);
  const settings=game.player.settings, config=settings.bossBattle;
  useBattleAudioOutput(config,game.player.userId,"practice");
  const mode=config.enabled?config.gameMode:"practice", level=levelInfo(game.player.xp,game.player.curveVersion);
  const selectedMode=modes.find(m=>m.id===mode)!, opponent=bossProfile(config.bossId);
  const cinematic=usePracticeCinematicActive(),midiSupported=typeof navigator.requestMIDIAccess==="function";
  const categories=useMemo(()=>[...new Set(catalog.filter(e=>e.available).map(e=>e.collection??"sight-reading"))].sort(),[catalog]);
  const filtered=useMemo(()=>catalog.filter(e=>e.available&&(!category||e.collection===category)&&`${title(e)} ${e.composer??""} ${e.collection??""}`.toLowerCase().includes(search.toLowerCase())),[category,search,catalog]);
  const settingSummary=modeSettingSummary(config,hand);
  const unavailable=queue.some(e=>!catalog.find(p=>p.number===e.exercise.number)?.available);
  // Keep the currently mounted score's definition across publication refreshes.
  // Only the fresh catalog/authorization response decides what may start next.
  const scoreLibrary=useMemo(()=>[...new Map([...initialLibrary,...catalog,...queue.map(e=>e.exercise)].map(e=>[e.number,e])).values(),...(initialLibrary.length||catalog.length||queue.length?[]:[{number:0,title:'No available music',right:[],left:[]}])],[initialLibrary,catalog,queue]);
  const timePreview=useMemo(()=>unavailable?undefined:modeTimePreview(config,queue,hand),[config,queue,hand,unavailable]);
  const performances=queue.reduce((sum,e)=>sum+e.loops,0);
  useEffect(()=>{const back=()=>setView(currentView());window.addEventListener("popstate",back);return()=>window.removeEventListener("popstate",back);},[]);
  useEffect(()=>{try{localStorage.setItem(`pbb:setup:v2:${user.id}`,JSON.stringify({hand,entries:queue.map(e=>({number:e.exercise.number,loops:e.loops}))}));setDraftError("");}catch{setDraftError("This browser could not save your setlist locally. Keep this tab open to retain it.");}},[hand,queue,user.id]);
  useEffect(()=>{
    if(!game.ready)return;
    const controller=new AbortController();
    fetch("/api/profile",{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error("Could not refresh your battle history.");return r.json();})
    .then(p=>{setHistory(p.history.map((h:{result:string})=>JSON.parse(h.result)));setVictories(Number(p.victories?.count??0));setPracticed(Number(p.practiced?.count??0));setBests(p.bests??[]);setProfileError("");})
    .catch(e=>{if(!controller.signal.aborted)setProfileError(e.message);});
    return()=>controller.abort();
  },[game.ready,game.lastSaved]);
  function navigate(next:"setup"|"preview",replace=false){const url=new URL(location.href);if(next==="preview")url.searchParams.set("view",next);else url.searchParams.delete("view");window.history[replace?"replaceState":"pushState"]({},"",url);setView(next);}
  function update(patch:Partial<BossBattleConfig>) { void gameClient.settings({...settings,bossBattle:{...config,...patch}}); }
  function add(exercise:Exercise) {
    if((exercise.singleHand&&exercise.singleHand!==hand)||(exercise.bothHandsOnly&&hand!=="both")) {setNotice(`This piece requires ${exercise.singleHand??"both"} hands. Select matching hands before adding it.`);return;}
    setQueue(q=>[...q,{exercise,loops:1}]);setNotice("");
  }
  function move(index:number,direction:number){setQueue(q=>{const next=[...q],at=index+direction;if(at<0||at>=q.length)return q;[next[index],next[at]]=[next[at],next[index]];return next;});}
  async function logout(){setLogoutBusy(true);try{gameClient.abandon();await supabase.auth.signOut();await syncServerSession();location.reload();}catch(e){setNotice((e as Error).message);setLogoutBusy(false);}}
  const render=(c:PracticeControls)=>{
    const missing=!midiSupported?"Web MIDI is unavailable here. Open this page in Chrome or Edge on a computer.":!connected?"Connect your MIDI piano to begin.":libraryError?libraryError:unavailable?"Remove unavailable pieces from your queue before starting.":!queue.length?"Add a piece to your battle queue.":!game.ready?"Waiting for your saved progress connection.":game.recoveryError?"Recover unsaved progress before starting.":"";
    const start=async()=>{
      if(authorizing)return;setAuthorizing(true);setNotice("");
      try{const r=await fetch("/api/music/authorize",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({entries:queue.map(e=>({number:e.exercise.number,loops:e.loops})),hand})});const data=await r.json();if(!r.ok)throw Error(data.error??"Music is unavailable.");c.start();if(gameClient.state.live.status==="playing"||gameClient.state.battle.countdown)setTheatre(true);}
      catch(e){setNotice((e as Error).message);void refreshLibrary().catch(()=>{});}finally{setAuthorizing(false);}
    };
    const preview=view==="preview"||c.running;
    return <div className={`player-home ${theatre?"in-theatre":"v2-builder"}`}>
      <header className="player-header">
        <a href="/" className="player-brand" onClick={e=>{e.preventDefault();if(!c.running){setTheatre(false);navigate("setup");}}}><PianoMark/><span>Piano Boss Battles<small>PRACTICE MUSIC. DEFEAT BOSSES.</small></span></a>
        <section className="player-strip" aria-label="Player profile">
          <img className="player-avatar" src={hero} alt=""/>
          <div className="player-identity"><b>{String(user.user_metadata.name??"Pianist")}</b><small>Level {level.level} <span>{level.title}</span></small>{admin&&<a className="music-admin-link" href="/admin/music" target="_blank" rel="noopener" title="Manage music library (opens in a new tab)">Music Library</a>}</div>
          <div className="player-xp"><span>{game.player.xp.toLocaleString()} / {level.upper.toLocaleString()} XP</span><progress aria-label="Level progress" max={100} value={level.percent}/><small role="status">{game.error||game.recoveryError?"Progress needs attention":game.saving||game.pending?"Saving progress…":game.lastSaved?"All progress saved":"Connected to your profile"}</small></div>
          <div className="profile-stat"><b>{victories}</b><small>Bosses defeated</small></div><div className="profile-stat"><b>{practiced}</b><small>Pieces practiced</small></div><button className="quiet" disabled={c.running||logoutBusy} onClick={()=>void logout()}>Log out</button>
        </section>
      </header>
      {notice&&<p role="alert" className="error">{notice}</p>}
      {game.error&&<p role="alert" className="error">{game.error}</p>}
      <nav className="builder-steps" aria-label="Battle setup steps" hidden={theatre}>
        <button aria-current={!preview?"step":undefined} disabled={c.running} onClick={()=>navigate("setup")}><span className="step-orb">{preview?<Icon name="check"/>:"1"}</span><span><b>Build Your Battle</b><small>Connect piano · mode · boss · setlist</small></span></button><i/>
        <button aria-current={preview?"step":undefined} disabled={!queue.length||c.running} onClick={()=>navigate("preview")}><span className="step-orb">2</span><span><b>Preview &amp; Start</b><small>Review your setup. Get ready for battle.</small></span></button>
      </nav>
      <section className="midi-ribbon" hidden={theatre} aria-label="Piano connection">
        <span className={`connection-light ${connected?"connected":""}`}/><div><b>{connected?"Your piano is connected":"Connect your MIDI piano"}</b><small>{connected?"Ready to play. Your piano is the controller.":"USB MIDI · Chrome or Edge · allow access when asked"}</small></div>
        {midiSupported?<MidiSetup compact onConnectionChange={setConnected}/>:<p role="status">Web MIDI is unavailable in this browser. Use desktop Chrome or Edge.</p>}
      </section>
      <div className="setup-columns" hidden={theatre||preview}>
        <section className="setup-section challenge-panel">
          <div className="panel-title"><Icon name="swords"/><div><h1>Build your battle.</h1><p>Choose a game mode, set your difficulty, and pick your boss.</p></div></div>
          <fieldset disabled={c.running||authorizing}><legend><span className="section-number">1</span>Game mode<small>Pick how you want to play.</small></legend>
            <div className="mode-grid">{modes.map(m=><button key={m.id} aria-pressed={mode===m.id} onClick={()=>update(m.id==="practice"?{enabled:false}:{enabled:true,gameMode:m.id})}><Icon name={m.icon}/><b>{m.title}</b><small>{m.description}</small></button>)}</div>
            <BattleSettings config={config} hand={hand} update={update} onHandChange={next=>{setHand(next);setQueue(q=>q.filter(({exercise:x})=>(!x.singleHand||x.singleHand===next)&&(!x.bothHandsOnly||next==="both")));}}/>
            <div className="section-label boss-label"><span className="section-number">3</span><b>Choose your boss</b><small>{mode==="practice"?"Choose your next opponent. Practice has no battle pressure.":"Your opponent awaits."}</small></div>
            <div className="boss-grid">{Object.entries(bossProfiles).map(([id,b])=><button className={`boss-choice boss-${id}`} key={id} aria-pressed={config.bossId===id} onClick={()=>update({bossId:id as BossId})}><img src={b.portrait} alt=""/>{config.bossId===id&&<span className="boss-check"><Icon name="check"/></span>}<div><b>{id==="grinwick"?"Grinwick":b.name}</b><small>{b.description}</small></div></button>)}</div>
          </fieldset>
        </section>
        <section className="setup-section setlist-panel"><fieldset disabled={c.running||authorizing}>
          <div className="setlist-title"><Icon name="music"/><div><h2>Build your setlist.</h2><small>Choose the pieces you’ll play in this battle.</small></div><label>Collection<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">All collections</option>{categories.map(x=><option key={x} value={x}>{collectionName(x)}</option>)}</select></label></div>
          <label className="library-search"><span className="sr-only">Search pieces</span><input type="search" placeholder="Search pieces (Schmitt, Hanon, Beethoven…)" value={search} onChange={e=>setSearch(e.target.value)}/></label>
          <div className="music-list" aria-label="Song and exercise library">{filtered.map(e=><div key={e.number}><div><strong>{title(e)}</strong><small>{[e.composer,collectionName(e.collection??"sight-reading")].filter(Boolean).join(" · ")}</small></div><button aria-label={`Add ${title(e)} to queue`} onClick={()=>add(e)}>＋</button></div>)}{!filtered.length&&<p>No matching pieces. Try another search or collection.</p>}</div>
          <div className="queue-heading"><h3><Icon name="list"/>Your battle queue</h3><span>{queue.length} {queue.length===1?"piece":"pieces"} · {performances} performances</span></div>
          <ol className="battle-queue">{queue.map((entry,i)=><li key={`${entry.exercise.number}:${i}`}><span className="queue-number">{i+1}</span><span>{title(entry.exercise)}{!catalog.find(p=>p.number===entry.exercise.number)?.available&&<small className="error">Unavailable</small>}</span><label>Loops<input type="number" min={1} max={100} value={entry.loops} onChange={e=>setQueue(q=>q.map((x,n)=>n===i?{...x,loops:Math.max(1,Math.min(100,Math.round(Number(e.target.value)||1)))}:x))}/></label><button aria-label={`Move item ${i+1} up`} disabled={i===0} onClick={()=>move(i,-1)}>↑</button><button aria-label={`Move item ${i+1} down`} disabled={i===queue.length-1} onClick={()=>move(i,1)}>↓</button><button aria-label={`Remove item ${i+1}`} onClick={()=>setQueue(q=>q.filter((_,n)=>n!==i))}>×</button></li>)}</ol>
          {!queue.length&&<p className="empty-queue">Add a piece above to build your setlist.</p>}
        </fieldset>
        {draftError&&<p role="alert">{draftError}</p>}
        <button className="primary continue-button" disabled={!queue.length||!game.ready||!!game.recoveryError} onClick={()=>navigate("preview")}>Continue to Battle Preview <Icon name="arrow"/></button>
        {(!queue.length||!game.ready||game.recoveryError)&&<small role="status">{!queue.length?"Add at least one piece to continue.":game.recoveryError||"Waiting for your saved settings…"}</small>}
        </section>
      </div>
      <div className={`preview-columns ${theatre?"playing":""}`} hidden={!theatre&&!preview}>
        <section className={`theatre ${!theatre?"battle-preview":""}`} aria-label="Battle preview and Theatre Mode">
          <div className="theatre-heading"><div><span className="eyebrow">{theatre?"THEATRE MODE":"BATTLE PREVIEW"}</span><h2>{title(c.exercise)}</h2>{theatre?<small>Loop {c.pass}/{c.total} · {game.live.combo} note combo · {game.live.correct+game.live.incorrect?Math.round(100*game.live.correct/(game.live.correct+game.live.incorrect)):0}% accuracy</small>:<div className="preview-meta"><span><Icon name={selectedMode.icon}/>{selectedMode.title}</span>{settingSummary.map(s=><span key={s.label}>{s.value}{s.label==="Time Pressure"?" time pressure":""}</span>)}</div>}</div>
            {!theatre&&<div className="opponent-caption"><span className="eyebrow">{mode==="practice"?"NEXT CHALLENGER":"YOUR OPPONENT"}</span><b>{opponent.id==="grinwick"?"Grinwick":opponent.name}</b><small>{opponent.description}</small></div>}
            <div className="theatre-controls" hidden={!theatre}>{!c.running?<button className="primary" disabled={!!missing||c.saving||authorizing} onClick={start}>Start Battle</button>:<><button onClick={c.pause}>{c.paused?"Resume":"Pause"}</button><button onClick={c.stop}>End Battle</button></>}<button onClick={()=>{if(c.running&&!c.paused)c.pause();setTheatre(false);navigate("preview",true);}}>Return to preview</button></div>
          </div>
          <div className="theatre-stage" data-battle={config.enabled}>
            {(config.enabled||!theatre)&&<BossBattlePanel battle={battleView(game.battle)} combo={game.live.combo} audioOutput="practice" suppressResult={cinematic||!theatre} suspendAnimation={cinematic||(!theatre&&!preview)} layoutOverride={!theatre?previewLayout:undefined}/>}
            {c.score}
          </div>
          {!theatre&&<span className="preview-versus" aria-hidden="true">VS</span>}
          {!theatre&&<div className="score-caption"><span>PIECE PREVIEW · {hand==="both"?"BOTH HANDS":`${hand.toUpperCase()} HAND`}</span><span>{queue.length} {queue.length===1?"piece":"pieces"} · {performances} performances</span></div>}
          {c.message&&<p role="status">{c.message}</p>}
        </section>
        <aside className="setup-section battle-summary" hidden={theatre} aria-label="Your battle setup">
          <div className="summary-heading"><span className="eyebrow">YOUR BATTLE SETUP</span><button disabled={c.running} onClick={()=>navigate("setup")}>Edit Setup</button></div>
          <dl><div><dt><Icon name={selectedMode.icon}/>Game mode</dt><dd>{selectedMode.title}<small>{selectedMode.description}</small></dd></div><div><dt><img src={opponent.portrait} alt=""/>Boss</dt><dd>{opponent.id==="grinwick"?"Grinwick":opponent.name}<small>{mode==="practice"?"No battle in Practice mode":opponent.description}</small></dd></div><div><dt><Icon name="music"/>Music</dt><dd>{queue.length===1?title(queue[0].exercise):`${queue.length} pieces in your chain`}<small>{queue.length===1?collectionName(queue[0].exercise.collection??"sight-reading"):"Play in your chosen order"}</small></dd></div>{settingSummary.map(s=><div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}{timePreview&&<div><dt>{timePreview.label}</dt><dd>{timePreview.value}</dd></div>}<div><dt>Setlist</dt><dd>{queue.length} {queue.length===1?"piece":"pieces"}<small>{performances} total performances</small></dd></div></dl>
          {queue.length>1&&<details className="sequence-review"><summary>Review full sequence</summary><ol>{queue.map((e,i)=><li key={i}>{title(e.exercise)}<small>{e.loops} {e.loops===1?"loop":"loops"}</small></li>)}</ol></details>}
          {!c.running?<button className="primary start-button" disabled={!!missing||c.saving||authorizing} onClick={start}><Icon name="swords"/>Start Battle<Icon name="arrow"/></button>:<><button className="primary start-button" onClick={()=>{if(c.paused)c.pause();setTheatre(true);}}>Return to Battle</button><button className="end-preview" onClick={c.stop}>End Battle</button></>}
          <p className="readiness" role="status">{c.running?"Your battle is paused here. Return when you’re ready.":missing||"Everything looks good. Start Battle when you’re ready."}</p>
        </aside>
      </div>
      <div className="progress-disclosures" hidden={theatre||!preview}>
        <details className="setup-section history"><summary><Icon name="bars"/>Recent Battles</summary>{profileError&&<p role="alert">{profileError}</p>}{!history.length?<p>Your completed battles will appear here.</p>:<ul>{history.map(h=><li key={h.attemptId}><strong>{h.result.toUpperCase()}</strong><span>{h.accuracy.toFixed(1)}% accuracy · {h.bestCombo} best combo · {h.completed}/{h.total} pieces</span></li>)}</ul>}</details>
        <details className="setup-section history"><summary><Icon name="cup"/>Personal Bests</summary><p>{game.player.unlocks.length} achievements unlocked · Best note combo: {game.player.best}</p>{profileError&&<p role="alert">{profileError}</p>}{bests.length?<ul>{bests.map(b=><li key={b.exerciseNumber}><span>{catalog.find(e=>e.number===b.exerciseNumber)?.title??`Exercise ${b.exerciseNumber}`}</span><strong>{Number(b.accuracy).toFixed(1)}%</strong></li>)}</ul>:<p>Finish a piece to set your first personal best.</p>}</details>
      </div>
      <details className="setup-section audio-settings" hidden={theatre}><summary>Battle sound settings</summary><label className="check"><input type="checkbox" checked={config.soundEnabled} onChange={e=>update({soundEnabled:e.target.checked})}/>Battle sounds</label><label>Output<select value={config.audioOutput} onChange={e=>update({audioOutput:e.target.value as "practice"|"obs"})}><option value="practice">This browser</option><option value="obs">Audience only (OBS)</option></select></label><label>Effects volume<input type="range" min={0} max={0.2} step={0.01} value={config.volume} onChange={e=>update({volume:Number(e.target.value)})}/></label></details>
    </div>;
  };
  return <SightReading library={scoreLibrary} attempts={[]} practice hideHeading experience={{entries:queue,hand,canStart:connected&&queue.length>0&&!unavailable&&!libraryError&&game.ready&&!game.recoveryError,render}}/>;
}
