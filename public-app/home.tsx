/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element -- Independent Vite SPA. */
import { useEffect } from "react";
import { useAccount, AccountForm } from "./auth";
import { bossProfiles } from "../hosted/boss-registry";
import { ObsOverlay } from "../hosted/obs";
import { AdminMusic } from "./admin-music";
import { PlayerHome } from "./player-home";
import "./public.css";
import "./player-home.css";
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
    <div className={`public-app ${account.session&&!account.recovery?"authenticated-app":""}`}>{(!account.session||account.recovery)&&<header className="public-header"><a href="/" className="brand"><span className="brand-mark">Ⅱ</span>Piano Boss Battles</a><span className="header-caption">PLAY MUSIC. BECOME THE HERO.</span></header>}
      <main id="main">
        {!account.ready?<p role="status">Connecting your account…</p>:account.recovery?<AccountForm recovery onRecovered={account.finishRecovery}/>:
        account.session?(location.pathname==="/admin/music"?<AdminMusic/>:<PlayerHome user={account.session.user}/>):
        <><section className="welcome"><div><span className="eyebrow">YOUR PIANO. YOUR POWER.</span><h1>Turn every note<br/>into a <em>battle cry.</em></h1><p>Connect your piano, choose your challenge, and let the music do the fighting. Your next great performance starts here.</p><div className="welcome-fighters"><img src={hero} alt="Piano Blade, the cyan sword-wielding pianist"/><span>VS</span><img src={bossProfiles.grinwick.portrait} alt="Grinwick, the chaos gremlin"/></div></div><AccountForm/></section>
        <div className="public-steps"><p><b>01</b> Connect your MIDI piano</p><p><b>02</b> Choose your musical challenge</p><p><b>03</b> Play. Battle. Level up.</p></div></>}
        {account.error&&<p role="alert" className="error">{account.error} <a href="/">Return to sign in</a></p>}
      </main><footer>Original music battles. Real piano progress.</footer>
    </div>}</>;
}
