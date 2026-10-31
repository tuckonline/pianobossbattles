/* eslint-disable @next/next/no-html-link-for-pages -- Independent Vite SPA. */
import { useEffect } from "react";
import { useAccount, AccountForm } from "./auth";
import { ClockworkPortrait } from "./realm-cinematic";
import { ObsOverlay } from "../hosted/obs";
import { AdminMusic } from "./admin-music";
import { PlayerHome } from "./player-home";
import { RealmHome } from "./realm-home";
import { BrandEmblem } from "./brand-emblem";
import "./public.css";
import "./player-home.css";
import "./compact-dashboard.css";


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
    <div className={`public-app ${account.session&&!account.recovery?"authenticated-app":""}`}>{(!account.session||account.recovery)&&<header className="public-header"><a href="/" className="brand"><BrandEmblem className="brand-mark"/>Piano Boss Battles</a><span className="header-caption">PLAY MUSIC. BECOME THE HERO.</span></header>}
      <main id="main">
        {!account.ready?<p role="status">Connecting your account…</p>:account.recovery?<AccountForm recovery onRecovered={account.finishRecovery}/>:
        account.session?(location.pathname==="/admin/music"?<AdminMusic/>:location.pathname==="/legacy-battles"?<PlayerHome user={account.session.user}/>:<RealmHome key={account.session.user.id} user={account.session.user}/>):
        <><section className="welcome"><div><span className="eyebrow">YOUR PIANO. YOUR ADVENTURE.</span><h1>Find your rhythm.<br/><em>Restore a kingdom.</em></h1><p>Read real music, master the pulse, and restore the Clockwork Kingdom. A musical adventure begins at your piano.</p><div className="welcome-fighters"><ClockworkPortrait/></div></div><AccountForm/></section>
        <div className="public-steps"><p><b>01</b> Connect your MIDI piano</p><p><b>02</b> Choose your musical challenge</p><p><b>03</b> Play. Master. Explore.</p></div></>}
        {account.error&&<p role="alert" className="error">{account.error} <a href="/">Return to sign in</a></p>}
      </main><footer>Musical mastery. Real piano progress.</footer>
    </div>}</>;
}
