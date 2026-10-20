/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element -- Independent Vite SPA, no Next image/router runtime. */
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, syncServerSession } from "./supabase";
import { useAccount, AccountForm } from "./auth";
import { catalog } from "./catalog";
import { MidiSetup } from "../src/components/midi/setup";
import { SightReading, type PracticeControls } from "../hosted/sight-reading";
import { gameClient, useGame } from "../hosted/game-client";
import { levelInfo } from "../hosted/game-core";
import { bossProfiles, type BossId } from "../hosted/boss-registry";
import { bossDifficulties, type BossBattleConfig } from "../hosted/boss-config";
import { BossBattlePanel } from "../hosted/boss-ui";
import { battleView } from "../hosted/boss-battle";
import { usePracticeCinematicActive } from "../hosted/battle-cinematic-ui";
import { useBattleAudioOutput } from "../hosted/battle-audio-ui";
import type { Exercise, Hand } from "../hosted/sight-library";
import type { ChainEntry } from "../hosted/schmitt-chain";
import type { StoryResult } from "../hosted/battle-story";
import { ObsOverlay } from "../hosted/obs";
import "./public.css";

const modes = [
  {id:"practice", title:"Practice", description:"Find your flow. No battle pressure."},
  {id:"survival", title:"Survival", description:"Finish the music. Protect your HP."},
  {id:"timeAttack", title:"Time Attack", description:"Every phrase races the clock."},
  {id:"ultimateBoss", title:"Ultimate Boss", description:"Survive the ultimate challenge."},
] as const;
const title=(e:Exercise)=>e.title??`Exercise ${e.number}`;
const hero="/battle/cinematics/hero-finish.png";
export function PublicApp() {
  const account=useAccount();
  const obs=location.pathname.startsWith("/obs");
  useEffect(()=>{
    document.documentElement.classList.toggle("obs-mode",obs&&!!account.session);
    document.documentElement.classList.toggle("obs-score-mode",obs&&!!account.session&&location.pathname==="/obs/score");
    const back=new URLSearchParams(location.search).get("return_to");
    if(account.session&&back&&/^\/obs(?:\/(?:recording|shorts|score|streaks|celebrations))?$/.test(back))location.replace(back);
  },[obs,account.session]);
  return <>{obs&&account.session&&!account.recovery?<ObsOverlay
    unified={location.pathname==="/obs/recording"} shorts={location.pathname==="/obs/shorts"}
    scoreOnly={location.pathname==="/obs/score"} streaksOnly={location.pathname==="/obs/streaks"}
    celebrationsOnly={location.pathname==="/obs/celebrations"}/>:
    <div className="public-app"><header className="public-header"><a href="/" className="brand"><span className="brand-mark">Ⅱ</span>Piano Boss Battles</a><span className="header-caption">PLAY MUSIC. BECOME THE HERO.</span></header>
      <main id="main">
        {!account.ready?<p role="status">Connecting your account…</p>:account.recovery?<AccountForm recovery onRecovered={account.finishRecovery}/>:
        account.session?<PlayerHome user={account.session.user}/>:
        <><section className="welcome"><div><span className="eyebrow">YOUR PIANO. YOUR POWER.</span><h1>Turn every note<br/>into a <em>battle cry.</em></h1><p>Connect your piano, choose your challenge, and let the music do the fighting. Your next great performance starts here.</p><div className="welcome-fighters"><img src={hero} alt="Piano Blade, the cyan sword-wielding pianist"/><span>VS</span><img src={bossProfiles.grinwick.portrait} alt="Grinwick, the chaos gremlin"/></div></div><AccountForm/></section>
        <div className="public-steps"><p><b>01</b> Connect your MIDI piano</p><p><b>02</b> Choose your musical challenge</p><p><b>03</b> Play. Battle. Level up.</p></div></>}
        {account.error&&<p role="alert" className="error">{account.error} <a href="/">Return to sign in</a></p>}
      </main><footer>Original music battles. Real piano progress.</footer>
    </div>}</>;
}

function PlayerHome({user}:{user:User}) {
  const game=useGame();
  const [connected,setConnected]=useState(false),[theatre,setTheatre]=useState(false),[search,setSearch]=useState(""),[category,setCategory]=useState("");
  const [queue,setQueue]=useState<ChainEntry[]>([{exercise:catalog.find(e=>e.number===2001)??catalog[0],loops:1}]);
  const [hand,setHand]=useState<Hand>("both"),[notice,setNotice]=useState("");
  const [history,setHistory]=useState<StoryResult[]>([]),[victories,setVictories]=useState(0),[practiced,setPracticed]=useState(0);
  const [bests,setBests]=useState<{exerciseNumber:number;accuracy:number}[]>([]);
  const [profileError,setProfileError]=useState("");
  const [logoutBusy,setLogoutBusy]=useState(false);
  const settings=game.player.settings, config=settings.bossBattle;
  useBattleAudioOutput(config,game.player.userId,"practice");
  const mode=config.enabled?config.gameMode:"practice", level=levelInfo(game.player.xp,game.player.curveVersion);
  const cinematic=usePracticeCinematicActive();
  const categories=useMemo(()=>[...new Set(catalog.map(e=>e.collection??"sight-reading"))].sort(),[]);
  const filtered=useMemo(()=>catalog.filter(e=>(!category||e.collection===category)&&`${title(e)} ${e.composer??""}`.toLowerCase().includes(search.toLowerCase())),[category,search]);
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
  async function logout(){
    setLogoutBusy(true);
    try{gameClient.abandon();await supabase.auth.signOut();await syncServerSession();location.reload();}
    catch(e){setNotice((e as Error).message);setLogoutBusy(false);}
  }
  const render=(c:PracticeControls)=>{
    const missing=!connected?"Connect your MIDI piano to begin.":!queue.length?"Add a piece to your battle queue.":!game.ready?"Waiting for your saved progress connection.":game.recoveryError?"Recover unsaved progress before starting.":"";
    return <div className={`player-home ${theatre?"in-theatre":""}`}>
      <section className="player-strip"><div><span className="eyebrow">WELCOME, {String(user.user_metadata.name??"PIANIST")}</span><h2>Level {level.level} <small>{level.title}</small></h2></div><div className="player-xp"><span>{game.player.xp.toLocaleString()} XP <small>{level.remaining.toLocaleString()} to next level</small></span><progress max={100} value={level.percent}/><small role="status">{game.error||game.recoveryError? "Progress needs attention":game.saving||game.pending?"Saving progress…":game.lastSaved?"All progress saved":"Connected to your profile"}</small></div><div><b>{victories}</b><small>Bosses defeated</small></div><div><b>{practiced}</b><small>Pieces practiced</small></div><button className="quiet" disabled={c.running||logoutBusy} onClick={()=>void logout()}>Log out</button></section>
      {game.error&&<p role="alert" className="error">{game.error}</p>}
      <section className="setup-section midi-card" hidden={theatre}><div><span className="eyebrow">01 / GET CONNECTED</span><h2>Your piano is the controller.</h2><p>Use a USB MIDI piano with Chrome or Edge. Allow MIDI access when asked.</p></div><MidiSetup onConnectionChange={setConnected}/></section>
      <div className="setup-columns" hidden={theatre}>
        <section className="setup-section"><span className="eyebrow">02 / CHOOSE YOUR CHALLENGE</span><h2>Make it your battle.</h2>
          <fieldset disabled={c.running}><legend>Game mode</legend><div className="mode-grid">{modes.map(m=><button key={m.id} aria-pressed={mode===m.id} onClick={()=>update(m.id==="practice"?{enabled:false}:{enabled:true,gameMode:m.id})}><b>{m.title}</b><small>{m.description}</small></button>)}</div>
          <div className="compact-fields"><label>Difficulty<select value={config.bossDamagePerMistake} onChange={e=>update({bossDamagePerMistake:Number(e.target.value)})}>{bossDifficulties.map(d=><option key={d.damage} value={d.damage}>{d.label}</option>)}</select></label>
          <label>Hands<select value={hand} onChange={e=>{setHand(e.target.value as Hand);setQueue(q=>q.filter(({exercise:x})=>(!x.singleHand||x.singleHand===e.target.value)&&(!x.bothHandsOnly||e.target.value==="both")));}}><option value="both">Both hands</option><option value="right">Right hand</option><option value="left">Left hand</option></select></label>
          {(mode==="timeAttack"||mode==="ultimateBoss")&&<label>Target BPM<input type="number" min={20} max={300} value={config.selectedBpm} onChange={e=>update({selectedBpm:Math.min(300,Math.max(20,Number(e.target.value)||60))})}/></label>}</div>
          {mode==="timeAttack"&&<label className="check"><input type="checkbox" checked={config.progressiveTempo} onChange={e=>update({progressiveTempo:e.target.checked})}/>Easy → Normal → Hard → Expert across loops</label>}
          <legend>Your opponent</legend><div className="boss-grid">{Object.entries(bossProfiles).map(([id,b])=><button key={id} aria-pressed={config.bossId===id} onClick={()=>update({bossId:id as BossId})}><img src={b.portrait} alt=""/><b>{id==="grinwick"?"Grinwick":b.name}</b><small>{b.description}</small></button>)}</div></fieldset>
        </section>
        <section className="setup-section"><span className="eyebrow">03 / BUILD YOUR SETLIST</span><h2>Choose your music.</h2><fieldset disabled={c.running}>
          <div className="compact-fields"><label>Search pieces<input type="search" placeholder="Schmitt, Hanon, Beethoven…" value={search} onChange={e=>setSearch(e.target.value)}/></label><label>Collection<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">All collections</option>{categories.map(x=><option key={x}>{x}</option>)}</select></label></div>
          <div className="music-list" aria-label="Song and exercise library">{filtered.map(e=><div key={e.number}><div><strong>{title(e)}</strong><small>{[e.composer,e.difficulty,e.collection].filter(Boolean).join(" · ")}</small></div><button aria-label={`Add ${title(e)} to queue`} onClick={()=>add(e)}>＋</button></div>)}{!filtered.length&&<p>No matching pieces.</p>}</div>
          <div className="queue-heading"><h3>Your battle queue</h3><span>{queue.reduce((sum,e)=>sum+e.loops,0)} performances</span></div><ol className="battle-queue">{queue.map((entry,i)=><li key={`${entry.exercise.number}:${i}`}><span>{i+1}. {title(entry.exercise)}</span><label>Loops<input type="number" min={1} max={100} value={entry.loops} onChange={e=>setQueue(q=>q.map((x,n)=>n===i?{...x,loops:Math.max(1,Math.min(100,Math.round(Number(e.target.value)||1)))}:x))}/></label><button aria-label={`Move item ${i+1} up`} disabled={i===0} onClick={()=>move(i,-1)}>↑</button><button aria-label={`Move item ${i+1} down`} disabled={i===queue.length-1} onClick={()=>move(i,1)}>↓</button><button aria-label={`Remove item ${i+1}`} onClick={()=>setQueue(q=>q.filter((_,n)=>n!==i))}>×</button></li>)}</ol></fieldset>
          {notice&&<p role="status">{notice}</p>}
        </section>
      </div>
      <section className="theatre" aria-label="Battle preview and Theatre Mode">
        <div className="theatre-heading"><div><span className="eyebrow">{theatre?"THEATRE MODE":"READY WHEN YOU ARE"}</span><h2>{title(c.exercise)}</h2><small>Loop {c.pass}/{c.total} · {game.live.combo} note combo · {game.live.correct+game.live.incorrect?Math.round(100*game.live.correct/(game.live.correct+game.live.incorrect)):0}% accuracy</small></div><div className="theatre-controls">
          {!c.running?<button className="primary" disabled={!!missing||c.saving} onClick={()=>{c.start();if(gameClient.state.live.status==="playing"||gameClient.state.battle.countdown)setTheatre(true);}}>Start Battle</button>:<><button onClick={c.pause}>{c.paused?"Resume":"Pause"}</button><button onClick={c.stop}>End Battle</button></>}
          {theatre&&<button onClick={()=>setTheatre(false)}>Return to setup</button>}
          {!theatre&&c.running&&<button onClick={()=>setTheatre(true)}>Open Theatre Mode</button>}
        </div></div>
        {!c.running&&missing&&<p className="start-hint">{missing}</p>}
        <div className="theatre-stage" data-battle={config.enabled}>
          {config.enabled&&<BossBattlePanel battle={battleView(game.battle)} combo={game.live.combo} audioOutput="practice" suppressResult={cinematic} suspendAnimation={cinematic}/>}
          {c.score}
        </div>
        {c.message&&<p role="status">{c.message}</p>}
      </section>
      <details className="setup-section audio-settings"><summary>Battle sound settings</summary><label className="check"><input type="checkbox" checked={config.soundEnabled} onChange={e=>update({soundEnabled:e.target.checked})}/>Battle sounds</label><label>Output<select value={config.audioOutput} onChange={e=>update({audioOutput:e.target.value as "practice"|"obs"})}><option value="practice">This browser</option><option value="obs">Audience only (OBS)</option></select></label><label>Effects volume<input type="range" min={0} max={0.2} step={0.01} value={config.volume} onChange={e=>update({volume:Number(e.target.value)})}/></label></details>
      <section className="setup-section history" hidden={theatre}><span className="eyebrow">YOUR JOURNEY</span><h2>Recent battles</h2>{profileError&&<p role="alert">{profileError}</p>}{!history.length?<p>Your completed battles will appear here.</p>:<ul>{history.map(h=><li key={h.attemptId}><strong>{h.result.toUpperCase()}</strong><span>{h.accuracy.toFixed(1)}% accuracy · {h.bestCombo} best combo · {h.completed}/{h.total} pieces</span></li>)}</ul>}<p>{game.player.unlocks.length} achievements unlocked · Best note combo: {game.player.best}</p>{bests.length>0&&<><h3>Personal bests</h3><ul>{bests.map(b=><li key={b.exerciseNumber}><span>{catalog.find(e=>e.number===b.exerciseNumber)?.title??`Exercise ${b.exerciseNumber}`}</span><strong>{Number(b.accuracy).toFixed(1)}%</strong></li>)}</ul></>}</section>
    </div>;
  };
  return <SightReading library={catalog} attempts={[]} practice hideHeading experience={{entries:queue,hand,canStart:connected&&queue.length>0&&game.ready&&!game.recoveryError,render}}/>;
}
