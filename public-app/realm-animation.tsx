import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { animationDuration, completePresentation, readPresentation, type AnimationPreference, type RealmAnimation } from "../src/domains/realms/presentation";
import { challengeAtDifficulty, challengeById } from "../src/domains/realms/registry";
import "./realm-animation.css";
import { CinematicVideo } from "./cinematic-video";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return reduced;
}
export function useRealmAnimations(userId: string) {
  const key = `pbb:realm-presentation:v1:${userId}`;
  const [metadata, setMetadata] = useState(() => {
    try { return readPresentation(localStorage.getItem(key)); } catch { return readPresentation(null); }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(metadata)); } catch { /* Session-only presentation preferences are still usable. */ } }, [key, metadata]);
  const finish = useCallback((event: RealmAnimation) => setMetadata(old => completePresentation(old, event)), []);
  const setPreference = useCallback((preference: AnimationPreference) => setMetadata(old => ({ ...old, preference })), []);
  return { metadata, finish, setPreference, reduced: useReducedMotion() };
}

export function RealmClock({ completedTrials, bossDefeated, className = "" }: { completedTrials: number; bossDefeated: boolean; className?: string }) {
  const glow = useId();
  return <svg className={`realm-mechanism ${className}`} viewBox="0 0 320 320" role="img"
    aria-label={`Kingdom clock: ${completedTrials} of 5 trials restored${bossDefeated ? ", Clockwork King defeated" : ""}`}
    data-restored={completedTrials} data-crowned={bossDefeated}>
    <defs><radialGradient id={glow}><stop stopColor="#59d9da" stopOpacity=".4"/><stop offset="1" stopColor="#061725" stopOpacity="0"/></radialGradient></defs>
    <circle className="clock-glow" cx="160" cy="160" r="158" fill={`url(#${glow})`}/>
    <circle className="clock-activation" cx="160" cy="160" r="140" fill="none" stroke="#e8cd91" strokeWidth="2"/>
    <circle className="clock-rim" cx="160" cy="160" r="140" fill="#071d2b" stroke="#a88a52" strokeWidth="2"/>
    <circle className="clock-teeth" cx="160" cy="160" r="128" fill="none" stroke="#927c4d" strokeWidth="8" strokeDasharray="3 10.4"/>
    <path className="clock-energy" pathLength="100" d="M160 18a142 142 0 1 1-.1 0M160 36v35M36 160h35M284 160h-35M160 284v-35" fill="none" stroke="#75e5df" strokeWidth="3"/>
    {Array.from({ length: 5 }, (_, i) => <circle className="clock-sector" key={i} cx="160" cy="45" r="7"
      transform={`rotate(${i * 72} 160 160)`} data-lit={i < completedTrials} fill="currentColor"/>)}
    <g className="clock-gears" fill="#0c2937" stroke="#c7a660" strokeWidth="5">
      <g className="clock-gear-one"><circle cx="110" cy="188" r="28" strokeDasharray="7 5"/><circle cx="110" cy="188" r="8" strokeWidth="2"/></g>
      <g className="clock-gear-two"><circle cx="203" cy="188" r="21" strokeDasharray="6 4"/><circle cx="203" cy="188" r="6" strokeWidth="2"/></g>
    </g>
    <g className="clock-numerals" fill="#dbbf82" textAnchor="middle" fontFamily="Georgia" fontSize="16">
      <text x="160" y="78">XII</text><text x="247" y="166">III</text><text x="160" y="251">VI</text><text x="73" y="166">IX</text>
    </g>
    <path className="clock-hour" d="M160 160V102" stroke="#e7cb8a" strokeWidth="6" strokeLinecap="round"/>
    <path className="clock-minute" d="M160 160V84" stroke="#83ece5" strokeWidth="3" strokeLinecap="round"/>
    <circle className="clock-heart" cx="160" cy="160" r="9" fill="#e8cd91" stroke="#fff0c8" strokeWidth="2"/>
    {bossDefeated && <path className="clock-crown" d="m137 112-5-19 17 7 11-17 11 17 17-7-5 19Z" fill="#edcb78"/>}
  </svg>;
}

export function RealmTransition({ event, preference, reduced, difficulty, restored, onDone }: {
  event: RealmAnimation; preference: AnimationPreference; reduced: boolean; difficulty: number;
  restored: { completedTrials: number; bossDefeated: boolean }; onDone: () => void;
}) {
  const duration = animationDuration(event, preference, reduced);
  const cinematic = !!duration && event.type === "realm-enter" && event.firstVisit;
  const done = useRef(false), callback = useRef(onDone), skip = useRef<HTMLButtonElement>(null);
  callback.current = onDone;
  const finish = useCallback(() => { if (!done.current) { done.current = true; callback.current(); } }, []);
  useEffect(() => {
    if (!duration) { finish(); return; }
    if (cinematic) return;
    skip.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(finish, duration);
    return () => window.clearTimeout(timer);
  }, [duration, finish, cinematic]);
  if (!duration) return null;
  if (cinematic) return <CinematicVideo src="/cinematics/clockwork-kingdom-intro.mp4" onDone={finish}/>;
  const trial = event.type === "realm-enter" ? undefined : challengeAtDifficulty(challengeById(event.trialId), difficulty);
  const full = event.type === "realm-enter" ? event.firstVisit : event.type === "trial-enter" ? event.firstVisit : event.type === "trial-complete" && event.firstClear;
  const title = event.type === "realm-enter" ? "The Clockwork Kingdom"
    : event.type === "trial-complete" ? event.firstClear ? trial!.reward : "Your music keeps the kingdom moving"
    : event.type === "trial-failed" ? "Every attempt is practice" : trial!.title;
  return <section className="realm-transition" role="region" aria-label="Realm animation"
    data-event={event.type} data-full={full} data-accent={trial?.kind ?? "realm"}
    style={{ "--scene-duration": `${duration}ms` } as CSSProperties}>
    <button className="realm-skip" ref={skip} onClick={finish}>Skip animation</button>
    <div className="realm-transition-art"><RealmClock {...restored}/></div>
    <div className="realm-transition-copy">
      <span className="realm-eyebrow">{event.type === "realm-enter" ? "CHAPTER I · THE HEART OF TIME"
        : event.type === "trial-complete" ? event.firstClear ? "MECHANISM RESTORED · NEW KEEPSAKE" : "PRACTICE RECORDED"
        : event.type === "trial-failed" ? "TAKE YOUR NEXT STEP" : "A MECHANISM AWAITS YOUR MUSIC"}</span>
      <h1>{title}</h1>
      <p className="realm-transition-description">{event.type === "realm-enter" ? event.firstVisit ? "A silent kingdom waits. Let your music set its clocks in motion." : "Welcome back to the kingdom."
        : event.type === "trial-enter" ? trial!.objective
        : event.type === "trial-failed" ? "Your results will show which passage to practise next."
        : event.firstClear ? `${trial!.title} is restored.` : `${trial!.reward} is already restored.`}</p>
      {event.type === "trial-complete" && <>
        <div className="realm-reveal-stars" aria-label={`${event.stars} earned stars`}>
          {[0,1,2].map(i=><span key={i} style={{ "--star-index": i } as CSSProperties}>{i < event.stars ? "★" : "☆"}</span>)}
        </div>
        <div className="realm-reveal-gold"><strong>+{event.goldEarned} milestone gold</strong><small>Practice gold saves separately as you play.</small></div>
        {!event.firstClear && <p className="realm-reveal-score">{event.accuracy}% accuracy{event.improved ? " · New personal best" : ""}</p>}
      </>}
    </div>
  </section>;
}
