/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element -- Independent Vite SPA. */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { User } from "@supabase/supabase-js";
import {notationPresets,defaultNotationPreset,type NotationPreset} from "../src/components/music/notation-presets";
import "./notation-appearance.css";
import { supabase, syncServerSession } from "./supabase";
import { useMusicCatalog, type CatalogExercise } from "./catalog";
import { useQueueScores } from "./queue-scores";
import { BrandEmblem } from "./brand-emblem";
import { collectionName } from "./music-labels";
import { MidiSetup } from "../src/components/midi/setup";
import { SightReading, type PracticeControls } from "../hosted/sight-reading";
import { gameClient, useGame } from "../hosted/game-client";
import { levelInfo } from "../hosted/game-core";
import { bossProfiles, type BossId } from "../hosted/boss-registry";
import { type BossBattleConfig } from "../hosted/boss-config";
import { BattleSettings, modeTimePreview } from "./battle-settings";
import { BattleCinematicSurface } from "../hosted/cinematic-controls";
import { BossBattlePanel } from "../hosted/boss-ui";
import { shortsBattleLayout } from "../hosted/shorts-layout";
import { battleView } from "../hosted/boss-battle";
import { usePracticeCinematicActive } from "../hosted/battle-cinematic-ui";
import {BattleAudioSettings} from "./battle-audio-settings";
import {playerAudioConfig} from "../hosted/player-audio";
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
const arenaLayout={...shortsBattleLayout,idleArrangement:'side-by-side' as const,
  referenceArenaHeightPercent:77,characterScale:1.1,
  heroIdleZone:{x:.08,y:.04,width:.41,height:.92},bossIdleZone:{x:.51,y:.04,width:.41,height:.92},
  heroAnchor:{x:.34,y:.51},bossAnchor:{x:.66,y:.51}};
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
function PianoMark(){return <BrandEmblem className="piano-mark"/>;}
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
export function PlayerHome({user}:{user:User}) {
  const {catalog,admin,error,refresh}=useMusicCatalog(user.id);
  if(!catalog)return <section className="player-loading" aria-label="Preparing your dashboard" aria-busy={!error}><div className="player-brand"><PianoMark/><span>Piano Boss Battles<small>PRACTICE MUSIC. DEFEAT BOSSES.</small></span></div><p role={error?"alert":"status"}>{error||"Preparing your dashboard…"}</p>{error&&<button onClick={()=>void refresh().catch(()=>{})}>Retry</button>}</section>;
  return <LoadedPlayerHome user={user} catalog={catalog} admin={admin} libraryError={error} refreshLibrary={refresh}/>;
}
function LoadedPlayerHome({user,catalog,admin,libraryError,refreshLibrary}:{user:User;catalog:CatalogExercise[];admin:boolean;libraryError:string;refreshLibrary:()=>Promise<void>}) {
  const game=useGame();
  const [draft]=useState(()=>readDraft(user.id,catalog));
  const [initialLibrary]=useState(catalog);
  const [cinematicSurface,setCinematicSurface]=useState<HTMLDivElement|null>(null);
  const [connected,setConnected]=useState(false),[theatre,setTheatre]=useState(false);
  const [search,setSearch]=useState(""),[category,setCategory]=useState("");
  const [queueDraft,setQueue]=useState<ChainEntry[]>(draft.queue),[hand,setHand]=useState<Hand>(draft.hand),[notice,setNotice]=useState("");
  const {queue,ready:scoresReady,error:scoreError,retry:retryScores}=useQueueScores(queueDraft,catalog);
  const [history,setHistory]=useState<StoryResult[]>([]),[victories,setVictories]=useState(0),[practiced,setPracticed]=useState(0);
  const [bests,setBests]=useState<{exerciseNumber:number;accuracy:number}[]>([]);
  const [profileError,setProfileError]=useState(""),[draftError,setDraftError]=useState("");
  const [authorizing,setAuthorizing]=useState(false);
  const [logoutBusy,setLogoutBusy]=useState(false);
  const settings=game.player.settings, config=settings.bossBattle;
  const localAudio=useMemo(()=>playerAudioConfig(config,settings.playerAudio),[config,settings.playerAudio]);
  useBattleAudioOutput(localAudio,game.player.userId,"practice");
  const notationPreset=settings.notationPreset??defaultNotationPreset, palette=notationPresets[notationPreset];
  const notationStyle={'--notation-paper':palette.paper,'--notation-ink':palette.ink,'--notation-current':palette.current,'--notation-correct':palette.correct,'--notation-incorrect':palette.incorrect} as CSSProperties;
  const mode=config.enabled?config.gameMode:"practice", level=levelInfo(game.player.xp,game.player.curveVersion);
  const dialog=useRef<HTMLDialogElement>(null);
  const cinematic=usePracticeCinematicActive(),midiSupported=typeof navigator.requestMIDIAccess==="function";
  const categories=useMemo(()=>[...new Set(catalog.filter(e=>e.available&&e.published!==false).map(e=>e.collection??"sight-reading"))].sort(),[catalog]);
  const activeCategory=categories.includes(category)?category:"";
  const filtered=useMemo(()=>catalog.filter(e=>e.available&&e.published!==false&&(!activeCategory||e.collection===activeCategory)&&`${title(e)} ${e.composer??""} ${e.collection??""}`.toLowerCase().includes(search.toLowerCase())),[activeCategory,search,catalog]);
  const unavailable=queue.some(e=>!catalog.find(p=>p.number===e.exercise.number)?.available);
  // Keep the currently mounted score's definition across publication refreshes.
  // Only the fresh catalog/authorization response decides what may start next.
  const scoreLibrary=useMemo(()=>[...new Map([...initialLibrary,...catalog,...queue.map(e=>e.exercise)].map(e=>[e.number,e])).values(),...(initialLibrary.length||catalog.length||queue.length?[]:[{number:0,title:'No available music',right:[],left:[]}])],[initialLibrary,catalog,queue]);
  const timePreview=useMemo(()=>unavailable||!scoresReady?undefined:modeTimePreview(config,queue,hand),[config,queue,hand,unavailable,scoresReady]);
  const performances=queue.reduce((sum,e)=>sum+e.loops,0);
  useEffect(()=>{const url=new URL(location.href);if(url.searchParams.has('view')){url.searchParams.delete('view');window.history.replaceState(null,'',url);}},[]);
  useEffect(()=>{const node=dialog.current;if(theatre&&!node?.open)node?.showModal();else if(!theatre&&node?.open)node.close();
    if(!theatre)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};
  },[theatre]);
  useEffect(()=>{try{localStorage.setItem(`pbb:setup:v2:${user.id}`,JSON.stringify({hand,entries:queue.map(e=>({number:e.exercise.number,loops:e.loops}))}));setDraftError("");}catch{setDraftError("This browser could not save your setlist locally. Keep this tab open to retain it.");}},[hand,queue,user.id]);
  useEffect(()=>{
    if(!game.ready)return;
    const controller=new AbortController();
    fetch("/api/profile",{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error("Could not refresh your battle history.");return r.json();})
    .then(p=>{setHistory(p.history.map((h:{result:string})=>JSON.parse(h.result)));setVictories(Number(p.victories?.count??0));setPracticed(Number(p.practiced?.count??0));setBests(p.bests??[]);setProfileError("");})
    .catch(e=>{if(!controller.signal.aborted)setProfileError(e.message);});
    return()=>controller.abort();
  },[game.ready,game.lastSaved]);
  function update(patch:Partial<BossBattleConfig>) { void gameClient.settings({...settings,bossBattle:{...config,...patch}}); }
  function add(exercise:Exercise) {
    if((exercise.singleHand&&exercise.singleHand!==hand)||(exercise.bothHandsOnly&&hand!=="both")) {setNotice(`This piece requires ${exercise.singleHand??"both"} hands. Select matching hands before adding it.`);return;}
    setQueue(q=>[...q,{exercise,loops:1}]);setNotice("");
  }
  function move(index:number,direction:number){setQueue(q=>{const next=[...q],at=index+direction;if(at<0||at>=q.length)return q;[next[index],next[at]]=[next[at],next[index]];return next;});}
  async function logout(){setLogoutBusy(true);try{gameClient.abandon();await supabase.auth.signOut();await syncServerSession();location.reload();}catch(e){setNotice((e as Error).message);setLogoutBusy(false);}}
  const render=(c:PracticeControls)=>{
    const missing=!midiSupported?"Web MIDI is unavailable here. Open this page in Chrome or Edge on a computer.":!connected?"Connect your MIDI piano to begin.":libraryError?libraryError:unavailable?"Remove unavailable pieces from your queue before starting.":!queue.length?"Add a piece to your battle queue.":!scoresReady?scoreError||"Preparing your selected sheet music...":!game.ready?"Waiting for your saved progress connection.":game.recoveryError?"Recover unsaved progress before starting.":"";
    const start=async()=>{
      if(authorizing||!scoresReady)return;setAuthorizing(true);setNotice("");
      try{const r=await fetch("/api/music/authorize",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({entries:queue.map(e=>({number:e.exercise.number,loops:e.loops})),hand})});const data=await r.json();if(!r.ok)throw Error(data.error??"Music is unavailable.");c.start();if(gameClient.state.live.status==="playing"||gameClient.state.battle.countdown)setTheatre(true);}
      catch(e){setNotice((e as Error).message);void refreshLibrary().catch(()=>{});}finally{setAuthorizing(false);}
    };
    const leaveArena=()=>{if(c.running&&!c.paused)c.pause();setTheatre(false);};
    return <div className={`player-home ${theatre?"in-theatre":"v2-builder"}`} data-notation-preset={notationPreset} style={notationStyle}>
      <header className="player-header">
        <a href="/" className="player-brand" onClick={e=>{e.preventDefault();if(!c.running){setTheatre(false);}}}><PianoMark/><span>Piano Boss Battles<small>PRACTICE MUSIC. DEFEAT BOSSES.</small></span></a>
        <section className="player-strip" aria-label="Player profile">
          <img className="player-avatar" src={hero} alt=""/>
          <div className="player-identity"><b>{String(user.user_metadata.name??"Pianist")}</b><small>Level {level.level} <span>{level.title}</span></small>{admin&&<a className="music-admin-link" href="/admin/music" target="_blank" rel="noopener" title="Manage music library (opens in a new tab)">Music Library</a>}</div>
          <div className="player-xp"><span>{game.player.xp.toLocaleString()} / {level.upper.toLocaleString()} XP</span><progress aria-label="Level progress" max={100} value={level.percent}/><small role="status">{game.error||game.recoveryError?"Progress needs attention":game.saving||game.pending?"Saving progress…":game.lastSaved?"All progress saved":"Connected to your profile"}</small></div>
          <div className="profile-stat"><b>{victories}</b><small>Bosses defeated</small></div><div className="profile-stat"><b>{practiced}</b><small>Pieces practiced</small></div><button className="quiet" disabled={c.running||logoutBusy} onClick={()=>void logout()}>Log out</button>
        </section>
      </header>
      {scoreError&&<p role="alert" className="error">{scoreError} <button onClick={retryScores}>Retry sheet music</button></p>}
      {notice&&<p role="alert" className="error">{notice}</p>}
      {game.error&&<p role="alert" className="error">{game.error}</p>}
      <section className="midi-ribbon" hidden={theatre} aria-label="Piano connection">
        <span className={`connection-light ${connected?"connected":""}`}/><div><b>{connected?"Your piano is connected":"Connect your MIDI piano"}</b><small>{connected?"Ready to play. Your piano is the controller.":"USB MIDI · Chrome or Edge · allow access when asked"}</small></div>
        {midiSupported?<MidiSetup compact onConnectionChange={setConnected}/>:<p role="status">Web MIDI is unavailable in this browser. Use desktop Chrome or Edge.</p>}
      </section>
      <div className="setup-columns" hidden={theatre}>
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
          <div className="setlist-title"><Icon name="music"/><div><h2>Build your setlist.</h2><small>Choose the pieces you’ll play in this battle.</small></div><label>Collection<select value={activeCategory} onChange={e=>setCategory(e.target.value)}><option value="">All collections</option>{categories.map(x=><option key={x} value={x}>{collectionName(x)}</option>)}</select></label></div>
          <label className="library-search"><span className="sr-only">Search pieces</span><input type="search" placeholder="Search pieces (Schmitt, Hanon, Beethoven…)" value={search} onChange={e=>setSearch(e.target.value)}/></label>
          <div className="music-list" aria-label="Song and exercise library">{filtered.map(e=><div key={e.number}><div><strong>{title(e)}</strong><small>{[e.composer,collectionName(e.collection??"sight-reading")].filter(Boolean).join(" · ")}</small></div><button aria-label={`Add ${title(e)} to queue`} onClick={()=>add(e)}>＋</button></div>)}{!filtered.length&&<p>No matching pieces. Try another search or collection.</p>}</div>
          <div className="queue-heading"><h3><Icon name="list"/>Your battle queue</h3><span>{queue.length} {queue.length===1?"piece":"pieces"} · {performances} performances</span></div>
          <ol className="battle-queue">{queue.map((entry,i)=><li key={`${entry.exercise.number}:${i}`}><span className="queue-number">{i+1}</span><span>{title(entry.exercise)}{!catalog.find(p=>p.number===entry.exercise.number)?.available&&<small className="error">Unavailable</small>}</span><label>Loops<input type="number" min={1} max={100} value={entry.loops} onChange={e=>setQueue(q=>q.map((x,n)=>n===i?{...x,loops:Math.max(1,Math.min(100,Math.round(Number(e.target.value)||1)))}:x))}/></label><button aria-label={`Move item ${i+1} up`} disabled={i===0} onClick={()=>move(i,-1)}>↑</button><button aria-label={`Move item ${i+1} down`} disabled={i===queue.length-1} onClick={()=>move(i,1)}>↓</button><button aria-label={`Remove item ${i+1}`} onClick={()=>setQueue(q=>q.filter((_,n)=>n!==i))}>×</button></li>)}</ol>
          {!queue.length&&<p className="empty-queue">Add a piece above to build your setlist.</p>}
        </fieldset>
        {draftError&&<p role="alert">{draftError}</p>}
          <fieldset className="notation-appearance" disabled={!game.ready}><legend>Notation Appearance</legend><div>{Object.entries(notationPresets).map(([id,p])=><button type="button" key={id} aria-pressed={notationPreset===id} onClick={()=>void gameClient.notationAppearance(id as NotationPreset)}><span aria-hidden="true" style={{background:p.paper,color:p.ink}}>♫</span>{p.label}</button>)}</div><small>Your display only. OBS appearance stays unchanged.</small></fieldset>
        {timePreview&&<p className="setup-time-preview">{timePreview.label}: <strong>{timePreview.value}</strong></p>}
        {!c.running?<button className="primary continue-button" disabled={!!missing||c.saving||authorizing} onClick={start}><Icon name="swords"/>{authorizing?'Preparing battle…':'Start Battle'}<Icon name="arrow"/></button>:<><button className="primary continue-button" onClick={()=>{if(c.paused)c.pause();setTheatre(true);}}>Resume Battle</button><button onClick={c.stop}>End Battle</button></>}
        <small role="status">{c.running?'Your battle is paused. Resume when ready.':missing||'Ready when you are.'}</small>
        </section>
      </div>
      <dialog ref={dialog} className="battle-dialog" aria-label="Battle arena" onCancel={e=>{e.preventDefault();leaveArena();}}>
        <section className="theatre" aria-label="Theatre Mode">
          <div className="theatre-heading"><div><span className="eyebrow">PIANO BOSS BATTLES</span><h2>{title(c.exercise)}</h2><small>Loop {c.pass}/{c.total}{!config.enabled&&<> · {game.live.combo} note combo · {game.live.correct+game.live.incorrect?Math.round(100*game.live.correct/(game.live.correct+game.live.incorrect)):0}% accuracy</>}</small></div>
            <div className="theatre-controls">{!c.running?<button className="primary" disabled={!!missing||c.saving||authorizing} onClick={start}>Start Battle</button>:<><button onClick={c.pause}>{c.paused?'Resume':'Pause'}</button><button onClick={()=>{c.stop();setTheatre(false);}}>End Battle</button></>}<button onClick={leaveArena}>Back to setup</button></div>
          </div>
          <BattleCinematicSurface.Provider value={cinematicSurface}><div ref={setCinematicSurface} className="theatre-stage" data-battle={config.enabled}>
            {config.enabled&&<BossBattlePanel battle={battleView(game.battle)} combo={game.live.combo} hudVariant="music" accuracy={game.live.correct+game.live.incorrect?Math.round(100*game.live.correct/(game.live.correct+game.live.incorrect)):0} audioOutput="practice" suppressResult={cinematic} suspendAnimation={cinematic||!theatre} layoutOverride={arenaLayout}/>}
            {c.score}
          </div></BattleCinematicSurface.Provider>
          {c.message&&<p className="arena-message" role="status">{c.message}</p>}
        </section>
      </dialog>
      <div className="setup-extras" hidden={theatre}>
      <div className="progress-disclosures">
        <details className="setup-section history"><summary><Icon name="bars"/>Recent Battles</summary>{profileError&&<p role="alert">{profileError}</p>}{!history.length?<p>Your completed battles will appear here.</p>:<ul>{history.map(h=><li key={h.attemptId}><strong>{h.result.toUpperCase()}</strong><span>{h.accuracy.toFixed(1)}% accuracy · {h.bestCombo} best combo · {h.completed}/{h.total} pieces</span></li>)}</ul>}</details>
        <details className="setup-section history"><summary><Icon name="cup"/>Personal Bests</summary><p>{game.player.unlocks.length} achievements unlocked · Best note combo: {game.player.best}</p>{profileError&&<p role="alert">{profileError}</p>}{bests.length?<ul>{bests.map(b=><li key={b.exerciseNumber}><span>{catalog.find(e=>e.number===b.exerciseNumber)?.title??`Exercise ${b.exerciseNumber}`}</span><strong>{Number(b.accuracy).toFixed(1)}%</strong></li>)}</ul>:<p>Finish a piece to set your first personal best.</p>}</details>
      </div>
      <details className="audio-disclosure"><summary>Battle Audio <small>{settings.playerAudio.mode==='focus'?'Focus Mode':settings.playerAudio.mode==='immersive'?'Immersive Mode':'Cinematic Mode'}</small></summary><BattleAudioSettings settings={settings}/></details>
      </div>
    </div>;
  };
  return <SightReading library={scoreLibrary} attempts={[]} practice hideHeading experience={{entries:queue,hand,canStart:scoresReady&&connected&&queue.length>0&&!unavailable&&!libraryError&&game.ready&&!game.recoveryError,render}}/>;
}
