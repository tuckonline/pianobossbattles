import { PracticeHome } from "./practice-home";
import { FingeringProvider, FingeringControl, useFingering } from "./fingering-assistance";
import { filterFingerings } from "../src/domains/notation/fingering-assistance";
/* eslint-disable @next/next/no-html-link-for-pages -- Public Vite application. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { MidiSetup } from "../src/components/midi/setup";
import { BrandEmblem } from "./brand-emblem";
import { ClassicalPractice } from "./classical-practice";
import { supabase, syncServerSession } from "./supabase";
import {
  clockworkKingdom,
  challengeById,
  challengeAtDifficulty,
  unlocked,
} from "../src/domains/realms/registry";
import { realmScore, sliceStudy } from "../src/domains/realms/content";
import type {
  AttemptReceipt,
  PerformanceResult,
  RealmScore,
  RunConfig,
} from "../src/domains/realms/types";
import { RealmPerformance } from "./realm-performance";
import { ClockworkPortrait, RealmCinematic } from "./realm-cinematic";
import { useRealmProgress } from "./realm-progress";
import { NotationViewer } from "../src/components/music/notation";
import { musicXml } from "../hosted/sight-library";
import "./realm.css";
import { musicalTiers } from "../src/domains/music-generator/difficulty-profiles";
import { PracticeStudio, RoyalMusicShop, useMusicRoom } from "./music-room";
import { PracticeGoldContext, usePracticeGold } from "./practice-gold";
import { HandPositionGuide } from "./hand-position-guide";
import { RealmClock, RealmTransition, useRealmAnimations } from "./realm-animation";
import { clockRestoration, type RealmAnimation, type AnimationPreference } from "../src/domains/realms/presentation";

export function RealmHome({ user }: { user: User }) {
  return <FingeringProvider userId={user.id}><RealmContent user={user}/></FingeringProvider>;
}
function RealmContent({ user }: { user: User }) {
  const animations = useRealmAnimations(user.id);
  const markPresentationFinished = animations.finish;
  const [presentation, setPresentation] = useState<RealmAnimation | null>(null);
  const [pendingReveal, setPendingReveal] = useState<string | null>(null);
  const entranceStarted = useRef(false), home = useRef<HTMLDivElement>(null), wasPresenting = useRef(false);
  const [difficulty, setDifficulty] = useState(() => {
    try {
      const saved = Number(
        localStorage.getItem(`pbb:realm-difficulty:v1:${user.id}`),
      );
      return Number.isInteger(saved) && saved >= 1 && saved <= 5 ? saved : 1;
    } catch {
      return 1;
    }
  });
  const fingering = useFingering(difficulty);
  const tier = musicalTiers[difficulty - 1];
  const storage = useRealmProgress(user.id, difficulty);
  const room = useMusicRoom(user.id);
  const practiceGold = usePracticeGold(user.id, room.accept);
  const acceptEconomy = room.accept;
  useEffect(() => { acceptEconomy(storage.economy); }, [storage.economy, acceptEconomy]);
  const [studioPiece, setStudioPiece] = useState<string>();
  const [starting, setStarting] = useState(false), startingRef = useRef(false);
  const saveAttempt = storage.save;
  const [connected, setConnected] = useState(false),
    [screen, setScreen] = useState<
      | "home"
      | "session"
      | "progress"
      | "map"
      | "details"
      | "play"
      | "results"
      | "intro"
      | "victory"
      | "defeat"
      | "free"
      | "studio"
      | "shop"
    >(new URLSearchParams(location.search).get("mode")==="adventure"?"map":"home");
  const [config, setConfig] = useState<RunConfig>({
    version: 1,
    challengeId: "steady-pulse",
    seed: 1,
    key: "C",
    tempo: tier.tempo,
    curriculumVersion: 2,
    studyVersion: 2,
    positionVersion: 1,
    difficulty,
  });
  const [run, setRun] = useState<{
      score: RealmScore;
      practice: boolean;
      id: string;
      config: RunConfig;
    } | null>(null),
    [result, setResult] = useState<PerformanceResult | null>(null);
  const [error, setError] = useState("");
  const originalChallenge = challengeById(config.challengeId);
  const c = useMemo(
      () => challengeAtDifficulty(originalChallenge, difficulty),
      [difficulty, originalChallenge],
    ),
    realm = clockworkKingdom;
  const prepared = useMemo(() => {
    try {
      return { score: realmScore(config), error: "" };
    } catch (e) {
      return { score: null, error: (e as Error).message };
    }
  }, [config]);
  const completed = realm.challenges.filter(
    (c) => storage.progress.challenges[c.id]?.completed,
  ).length;
  const restored = clockRestoration(storage.progress);
  useEffect(() => {
    if (!storage.ready || screen !== "map" || entranceStarted.current) return;
    entranceStarted.current = true;
    setPresentation({ type: "realm-enter", firstVisit: !animations.metadata.seen.includes("realm:clockwork-kingdom") });
  }, [storage.ready, screen, animations.metadata.seen]);
  useEffect(() => {
    if (!pendingReveal || screen !== "results" || run?.id !== pendingReveal) return;
    const saved = storage.confirmed[pendingReveal], award = storage.awards[pendingReveal];
    if (!saved || !award) return;
    setPendingReveal(null);
    setResult(saved.result);
    setPresentation(saved.result.passed ? {
      type: "trial-complete", trialId: run.config.challengeId, difficulty: run.config.difficulty ?? 1,
      firstClear: saved.firstClear && !animations.metadata.seen.includes(`clear:${run.config.difficulty ?? 1}:${run.config.challengeId}`),
      stars: saved.result.stars, goldEarned: award.amount, accuracy: saved.result.accuracy, improved: saved.improved,
    } : { type: "trial-failed", trialId: run.config.challengeId });
  }, [pendingReveal, screen, run, storage.confirmed, storage.awards, animations.metadata.seen]);
  useEffect(() => {
    if (wasPresenting.current && !presentation) {
      const heading = home.current?.querySelector<HTMLElement>("h1");
      heading?.setAttribute("tabindex", "-1");
      heading?.focus({ preventScroll: true });
    }
    wasPresenting.current = !!presentation;
  }, [presentation]);
  const finishPresentation = useCallback(() => {
    if (presentation) markPresentationFinished(presentation);
    setPresentation(null);
  }, [presentation, markPresentationFinished]);
  const returnMap = () => {
    setPendingReveal(null);
    setRun(null);
    setScreen("map");
    if (screen !== "map") setPresentation({ type: "realm-enter", firstVisit: false });
  };
  const cinematicDone = useCallback(
    () => setScreen((s) => (s === "intro" ? "details" : "results")),
    [],
  );
  const finish = useCallback(
    (
      events: AttemptReceipt["events"],
      elapsedMs: number,
      next: PerformanceResult,
    ) => {
      if (!run) return;
      setResult(next);
      if (!run.practice && c.kind !== "boss") {
        if (next.passed) setPendingReveal(run.id);
        else setPresentation({ type: "trial-failed", trialId: run.config.challengeId });
      }
      if (!run.practice)
        void saveAttempt({ id: run.id, config: run.config, events, elapsedMs });
      setScreen(
        c.kind === "boss" && !run.practice
          ? next.passed
            ? "victory"
            : "defeat"
          : "results",
      );
    },
    [run, c.kind, saveAttempt],
  );
  const start = async (
    practice = false,
    section?: PerformanceResult["weak"],
    hand?: "left" | "right",
    repeatScore?: RealmScore,
  ) => {
    if (
      startingRef.current || !prepared.score ||
      !storage.ready ||
      (!practice && !unlocked(c.id, storage.progress))
    )
      return;
    const score = repeatScore ?? (section
      ? sliceStudy(
          prepared.score,
          section,
          Math.max(40, config.tempo - 15),
          hand,
        )
      : prepared.score);
    startingRef.current = true; setStarting(true); setError("");
    setPendingReveal(null);
    setPresentation(null);
    try {
      const id = crypto.randomUUID(), runConfig: RunConfig = { ...config, gradingVersion: 2 };
      if (!practice) await storage.begin(id, runConfig);
      setRun({ score, practice, id, config: runConfig });
      setResult(null); setScreen("play");
    } catch (e) { setError((e as Error).message); }
    finally { startingRef.current = false; setStarting(false); }
  };
  return (
    <PracticeGoldContext.Provider value={practiceGold.record}>
    <div ref={home} className="realm-home" data-notation-preset="studio" data-animation-preference={animations.metadata.preference}>
      <header className="realm-header">
        <a href="/" className="realm-brand">
          <BrandEmblem className="realm-emblem" />{" "}
          <span>
            Piano Boss Battles<small>PLAY MUSIC. BECOME THE HERO.</small>
          </span>
        </a>
        <div className="realm-account">
          <span>{String(user.user_metadata.name ?? "Pianist")}</span>
          <small role="status">
            {storage.saving
              ? "Saving your progress…"
              : storage.error
                ? "Progress needs attention"
                : storage.ready
                  ? "Realm progress saved"
                  : "Loading your progress…"}
          </small>
        </div>
        {screen !== "play" && screen !== "session" && <label className="realm-animation-setting">Animations
          <select aria-label="Animation preference" value={animations.metadata.preference}
            onChange={e => animations.setPreference(e.target.value as AnimationPreference)}>
            <option value="balanced">Balanced</option><option value="cinematic">Cinematic</option><option value="minimal">Minimal</option>
          </select>
        </label>}
        <button disabled={starting || !!presentation || (screen === "play" || screen === "session")} onClick={() => { setPendingReveal(null); setScreen("free"); }}>
          Free practice
        </button>
        <button
          disabled={starting || (screen === "play" || screen === "session")}
          onClick={() =>
            void (async () => {
              try {
                await supabase.auth.signOut();
                await syncServerSession();
                location.reload();
              } catch {
                setError("Could not sign out. Please retry.");
              }
            })()
          }
        >
          Log out
        </button>
      </header>
      {!["play", "session", "intro", "victory", "defeat", "free"].includes(screen) && !(screen === "studio" && studioPiece) && <nav className="realm-navigation" aria-label="Main destinations">
        <button disabled={!!presentation} onClick={()=>setScreen("home")}>Home</button>
        <button disabled={!!presentation} onClick={()=>setScreen("free")}>Infinite Practice</button>
        <button disabled={!!presentation} onClick={()=>setScreen("progress")}>Progress</button>
        <button disabled={starting || !!presentation} aria-current={screen === "map" || screen === "details" || screen === "results" ? "page" : undefined} onClick={returnMap}>Adventure Mode</button>
        <button disabled={starting || !!presentation} aria-current={screen === "studio" ? "page" : undefined} onClick={() => { setPendingReveal(null); setStudioPiece(undefined); setScreen("studio"); void room.refresh(); }}>Practice Studio</button>
        <button disabled={starting || !!presentation} aria-current={screen === "shop" ? "page" : undefined} onClick={() => { setPendingReveal(null); setScreen("shop"); void room.refresh(); }}>Royal Music Shop</button>
        <span className="music-gold" aria-label="Gold balance">{room.economy?.gold ?? "—"} gold</span>
        <small aria-label="Progress toward next gold">{Math.floor(((room.economy?.practiceMs ?? 0) % 72000) / 1000)} / 72 seconds toward next gold</small>
      </nav>}
      {(screen === "shop" || screen === "studio") && room.error && <p className="realm-alert" role="alert">{room.error} <button onClick={() => void room.refresh()}>Retry music library</button></p>}
      {practiceGold.error && <p className="realm-alert" role="status">{practiceGold.error}</p>}
      <div
        className="realm-midi"
        hidden={
          screen === "intro" || screen === "victory" || screen === "defeat"
        }
      >
        <div>
          <strong>
            {connected ? "Piano connected" : "Connect your MIDI piano"}
          </strong>
          <small>One keyboard. Your musical adventure.</small>
        </div>
        <MidiSetup compact onConnectionChange={setConnected} />
      </div>
      {(storage.error || error) && (
        <div className="realm-alert" role="alert">
          {storage.error || error}{" "}
          <button onClick={() => void storage.retry()}>
            Retry saving / loading
          </button>
          <span>Unsaved attempts stay queued in this browser.</span>
        </div>
      )}
      {(screen === "intro" || screen === "victory" || screen === "defeat") && (
        <RealmCinematic kind={screen} onDone={cinematicDone} minimal={animations.metadata.preference === "minimal"} />
      )}
      {screen === "map" && !presentation && <button onClick={() => setPresentation({type:"realm-enter",firstVisit:true})}>Replay Cinematic</button>}
      {presentation && screen !== "play" && <RealmTransition event={presentation} preference={animations.metadata.preference}
        reduced={animations.reduced} difficulty={difficulty} restored={restored} onDone={finishPresentation}/>}
      {(screen === "home" || screen === "session") && <PracticeHome userId={user.id} difficulty={difficulty} connected={connected} active={screen === "session"} onStart={()=>setScreen("session")} onHome={()=>setScreen("home")} accept={room.accept}/>}
      {screen === "progress" && <section className="practice-home"><h1>Your progress</h1><p>{tier.name}: {completed} of 6 adventure challenges completed.</p><p>{storage.progress.rewards.length} adventure keepsakes earned at this difficulty.</p><button onClick={()=>setScreen("home")}>View recent practice on Home</button></section>}
      {screen === "free" && (
        <ClassicalPractice userId={user.id} connected={connected} onClose={()=>setScreen("home")} />
      )}
      {screen === "shop" && <RoyalMusicShop room={room} onPractice={id => { setStudioPiece(id); setScreen("studio"); }}/ >}
      {screen === "studio" && <PracticeStudio room={room} connected={connected} selectedId={studioPiece} onOpenPiece={setStudioPiece} onClosePiece={() => setStudioPiece(undefined)} onGenerate={() => setScreen("free")}/>}
      {!presentation && (screen === "map" || screen === "details") && (
        <section
          className="realm-difficulty"
          aria-label="Musical difficulty settings"
        >
          <label>
            Musical difficulty
            <select
              value={difficulty}
              disabled={starting || storage.saving}
              onChange={(e) => {
                const next = Number(e.target.value);
                setDifficulty(next);
                setConfig({
                  ...config,
                  difficulty: next,
                  curriculumVersion: 2,
                  studyVersion: 2,
                  positionVersion: 1,
                  tempo: musicalTiers[next - 1].tempo,
                  seed: 1,
                });
                setRun(null);
                setScreen("map");
                try {
                  localStorage.setItem(
                    `pbb:realm-difficulty:v1:${user.id}`,
                    String(next),
                  );
                } catch {
                  setError(
                    "Difficulty will be remembered for this visit only.",
                  );
                }
              }}
            >
              {musicalTiers.map((t, i) => (
                <option key={t.name} value={i + 1}>
                  {t.name} · {t.tempo} BPM
                </option>
              ))}
            </select>
          </label>
          <div>
            <p>{tier.description}</p>
            <small>
              Suggested {tier.range[0]}–{tier.range[1]} BPM. Progress is saved
              separately by difficulty. MIDI timing thresholds are unchanged.
            </small>
          </div>
        </section>
      )}
      {screen === "map" && !presentation && (
        <>
          <section className="realm-hero">
            <RealmClock {...restored}/>
            <div className="realm-hero-copy">
              <span className="realm-eyebrow">
                CHAPTER I · RHYTHM & COORDINATION
              </span>
              <h1>
                The Clockwork
                <br />
                <em>Kingdom</em>
              </h1>
              <p>{realm.description}</p>
              <div className="realm-progress-bar">
                <span>{completed} / 6 mechanisms restored</span>
                <progress value={completed} max={6} />
              </div>
            </div>
            <div className="realm-hero-king">
              <ClockworkPortrait />
              <span>The throne of time awaits.</span>
            </div>
          </section>
          <section
            className="realm-map"
            aria-label="Clockwork Kingdom challenges"
          >
            {realm.challenges.map((challenge, i) => {
              const trial = challengeAtDifficulty(challenge, difficulty);
              const record = storage.progress.challenges[trial.id],
                available =
                  storage.ready && unlocked(trial.id, storage.progress);
              return (
                <button
                  className={`realm-node ${trial.kind === "boss" ? "boss-node" : ""}`}
                  key={trial.id}
                  disabled={!available}
                  data-complete={record?.completed ?? false}
                  onClick={() => {
                    setConfig({
                      ...(record?.lastConfig ?? {
                        ...config,
                        challengeId: trial.id,
                        seed: 1,
                      }),
                      // A new attempt uses the current lessons. Saved receipts
                      // retain their original version for authoritative regrading.
                      curriculumVersion: 2,
                      studyVersion: 2,
                      positionVersion: 1,
                      difficulty,
                    });
                    setPendingReveal(null);
                    if (trial.kind !== "boss") setPresentation({ type: "trial-enter", trialId: trial.id,
                      firstVisit: !animations.metadata.seen.includes(`entry:${trial.id}`) });
                    setScreen(trial.kind === "boss" ? "intro" : "details");
                  }}
                >
                  <span className="realm-node-number">
                    {record?.completed
                      ? "✓"
                      : available
                        ? String(i + 1).padStart(2, "0")
                        : "Locked"}
                  </span>
                  <div>
                    <span className="realm-eyebrow">
                      {trial.kind === "boss"
                        ? "FINAL ENCOUNTER"
                        : `TRIAL ${i + 1}`}
                    </span>
                    <h2>{trial.title}</h2>
                    <p>
                      {trial.subtitle}
                    </p>
                    <span
                      className="realm-stars"
                      aria-label={`${record?.bestStars ?? 0} of 3 stars`}
                    >
                      {"★".repeat(record?.bestStars ?? 0)}
                      {"☆".repeat(3 - (record?.bestStars ?? 0))}
                    </span>
                  </div>
                  <span className="realm-node-reward">
                    {trial.reward}
                    <small>
                      {record?.completed
                        ? "Earned"
                        : available
                          ? "Begin trial →"
                          : "Complete the previous trials"}
                    </small>
                  </span>
                </button>
              );
            })}
          </section>
          <section className="realm-rewards">
            <h2>Your keepsakes</h2>
            <p>
              {storage.progress.rewards.length
                ? storage.progress.rewards.join(" · ")
                : "Complete your first trial to earn the Pulse Spark."}
            </p>
          </section>
          {storage.progress.bossDefeated && (
            <section className="realm-next">
              <span className="realm-eyebrow">NEXT CHAPTER UNLOCKED</span>
              <h2>The Singing Forest</h2>
              <p>
                Your next destination is revealed. This realm is not playable
                yet.
              </p>
            </section>
          )}
          <footer className="realm-legacy">
            <a href="/legacy-battles">Legacy battles & saved records</a>
            <span>Your earlier progress is preserved.</span>
          </footer>
        </>
      )}
      {screen === "details" && !presentation && (
        <section className="realm-details">
          <button className="quiet" disabled={starting} onClick={returnMap}>
            ← Return to realm
          </button>
          <span className="realm-eyebrow">
            {c.kind === "boss" ? "FINAL ENCOUNTER" : c.subtitle}
          </span>
          <h1>{c.title}</h1>
          <p className="realm-objective">{c.objective}</p>
          <p>
            Stars use the lower of pitch and rhythm accuracy: 70% ★ · 85% ★★ ·
            95% ★★★. Finish the entire score; mistakes never end a trial early.
          </p>
          <details><summary>Gold rewards</summary><p>Earn 1 gold per 72 seconds of active MIDI practice (about 50 per hour), in trials, focused practice, or Practice Studio. Partial progress carries over. Mistakes still count; paused time and idle gaps of more than 10 seconds do not.</p><p>First clear: +2 gold per trial, +5 for the King, once across all difficulties. Replays earn the same practice rate without extra completion payouts.</p></details>
          <div className="realm-settings">
            <label>
              Tempo (BPM)
              <input
                type="number"
                min={40}
                max={160}
                step={1}
                value={config.tempo}
                disabled={starting}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    tempo: Math.max(
                      40,
                      Math.min(160, Math.round(+e.target.value || 40)),
                    ),
                  })
                }
              />
            </label>
            <label>
              Key
              <select
                value={config.key}
                disabled={starting}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    key: e.target.value as RunConfig["key"],
                  })
                }
              >
                {["C", "G", "F"].map((key) => (
                  <option key={key}>{key}</option>
                ))}
              </select>
            </label>
            <label>
              Variation seed
              <input
                type="number"
                min={0}
                max={4294967295}
                value={config.seed}
                disabled={starting}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    seed: Math.max(
                      0,
                      Math.min(0xffffffff, Math.round(+e.target.value || 0)),
                    ),
                  })
                }
              />
            </label>
            <button
              disabled={starting}
              onClick={() =>
                setConfig({
                  ...config,
                  seed: crypto.getRandomValues(new Uint32Array(1))[0],
                })
              }
            >
              New variation
            </button>
            <button
              className="primary"
              disabled={
                starting || !prepared.score ||
                !connected ||
                !storage.ready ||
                !!storage.error
              }
              onClick={() => start()}
            >
              {starting ? "Preparing trial…" : "Enter trial"}
            </button>
          </div>
          {c.kind === "coordination" && (
            <div className="realm-preparation">
              <p>
                Warm up either staff first, then return to the full two-hand
                trial.
              </p>
              <button
                onClick={() =>
                  start(
                    true,
                    {
                      start: 0,
                      end: c.measures,
                      title: "Right-hand preparation",
                    },
                    "right",
                  )
                }
              >
                Prepare right hand
              </button>
              <button
                onClick={() =>
                  start(
                    true,
                    {
                      start: 0,
                      end: c.measures,
                      title: "Left-hand preparation",
                    },
                    "left",
                  )
                }
              >
                Prepare left hand
              </button>
            </div>
          )}
          {c.kind === "boss" && (
            <ol className="realm-phases">
              {prepared.score?.phases.map((p) => (
                <li key={p.start}>
                  {p.title}
                  <small>
                    Measures {p.start + 1}–{p.end}
                  </small>
                </li>
              ))}
            </ol>
          )}
          {!connected && (
            <p>
              Connect your MIDI piano to enter the trial. You can read the score
              now.
            </p>
          )}
          {prepared.error && <p role="alert">{prepared.error}</p>}
          <FingeringControl difficulty={difficulty}/>
          {prepared.score && fingering.level !== "off" && <HandPositionGuide key={JSON.stringify(config)} exercise={prepared.score.exercise}/>}
          {prepared.score && (
            <div className="realm-preview" data-broadcast-viewport="realm">
              <NotationViewer
                xml={filterFingerings(musicXml(prepared.score.exercise),fingering.level)}
                activeMeasure={0}
                broadcastFit
                hideTitle
                followOptions={{
                  enabled: true,
                  topPercent: 0,
                  bottomPercent: 0,
                }}
              />
            </div>
          )}
        </section>
      )}
      {screen === "play" && run && (
        <RealmPerformance
          key={run.id}
          score={run.score}
          fingeringLevel={fingering.level}
          challenge={c}
          connected={connected}
          practice={run.practice}
          onFinish={finish}
          onExit={returnMap}
        />
      )}
      {screen === "results" && result && !presentation && (
        <section className="realm-results">
          <span className="realm-eyebrow">
            {run?.practice
              ? "FOCUSED PRACTICE"
              : result.passed
                ? "MECHANISM RESTORED"
                : "KEEP THE MUSIC MOVING"}
          </span>
          <h1>{c.title}</h1>
          <div
            className="realm-result-stars"
            aria-label={`${result.stars} stars`}
          >
            {"★".repeat(result.stars)}
            {"☆".repeat(3 - result.stars)}
          </div>
          <p className="realm-overall">
            Overall accuracy: <strong>{result.accuracy}%</strong>
          </p>
          {!run?.practice && <div className="realm-gold-reward" role="status">
            {run && storage.awards[run.id] ? <><strong>Milestone gold: +{storage.awards[run.id].amount}</strong><p>Total gold: {room.economy?.gold ?? storage.economy?.gold ?? "—"}</p><p>{storage.awards[run.id].reason}</p></> : <p>{storage.error ? "Your milestone bonus will be confirmed when this attempt saves. Retry saving above." : "Confirming your milestone bonus…"}</p>}
          </div>}
          <p>
            {run?.practice
              ? "Practice complete. Return to the full trial when you are ready."
              : result.passed
                ? !run || !storage.confirmed[run.id] ? "Your completion is waiting to save."
                  : storage.confirmed[run.id].firstClear ? `You earned ${c.reward}.` : `${c.reward} is already restored.`
                : "The trial is complete. A few passages need another visit."}
          </p>
          <div className="realm-result-metrics">
            <div>
              <strong>{result.pitch}%</strong>Pitch accuracy
            </div>
            <div>
              <strong>{result.rhythm}%</strong>Rhythm accuracy
            </div>
            <div>
              <strong>{result.bestStreak}</strong>Best timed streak
            </div>
            <div>
              <strong>
                {result.crystals} / {result.phrases.length}
              </strong>
              Phrase crystals
            </div>
          </div>
          {c.kind === "coordination" && (
            <p>
              Right staff: {result.right ?? 0}% · Left staff: {result.left ?? 0}
              %. Staff assignment follows the score’s separate registers; MIDI
              does not identify the physical hand used.
            </p>
          )}
          <p>
            {result.early} early · {result.late} late · {result.wrong ?? 0}{" "}
            wrong · {result.missed} missed · {result.extra} extra notes. Timing
            is measured against the selected tempo, not shifted to your first
            note.
          </p>
          {result.timing && (
            <details className="realm-diagnostics">
              <summary>Timing diagnostics</summary>
              <p>
                Rhythm tolerance ±{result.timing.rhythmToleranceMs} ms · pitch
                match window ±{result.timing.matchWindowMs} ms. Mean signed
                error: {result.timing.meanOffsetMs ?? "—"} ms · mean absolute
                error: {result.timing.meanAbsoluteMs ?? "—"} ms.
              </p>
              <p>
                Negative means early; positive means late. These compare MIDI
                timestamps to the score clock. They cannot distinguish playing
                tendency from hardware/audio delay, and do not measure screen
                latency. No offset compensation is applied.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Measure</th>
                    <th>MIDI pitch</th>
                    <th>Deviation</th>
                    <th>Rhythm</th>
                  </tr>
                </thead>
                <tbody>
                  {result.timing.samples.map((s, i) => (
                    <tr key={i}>
                      <td>{Math.floor(s.beat / 4) + 1}</td>
                      <td>{s.pitch}</td>
                      <td>
                        {s.deltaMs > 0 ? "+" : ""}
                        {s.deltaMs} ms
                      </td>
                      <td>
                        {s.onTime
                          ? "On time"
                          : s.deltaMs < 0
                            ? "Early"
                            : "Late"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
          <div className="realm-phrase-results">
            {result.phrases.map((p) => (
              <div key={p.start}>
                <strong>
                  {p.passed ? "◆" : "◇"} {p.title}
                </strong>
                <span>
                  Measures {p.start + 1}–{p.end}
                </span>
                <small>
                  Pitch {p.pitch}% · rhythm {p.rhythm}%
                </small>
              </div>
            ))}
          </div>
          {!result.passed && (
            <p>
              Start with measures {result.weak.start + 1}–{result.weak.end},
              your lowest-scoring phrase.{" "}
              {result.rhythm < 70
                ? "Focus on matching each note to the metronome."
                : result.pitch < 70
                  ? "Read the pitches slowly before increasing tempo."
                  : "Work toward the trial's streak, coordination or crystal objective."}
            </p>
          )}
          <p>
            {run?.practice
              ? "Practice does not change your mastery records."
              : storage.saving
                ? "Saving your result…"
                : storage.error
                  ? "Your result is queued. Retry saving before continuing."
                  : `Best: ${storage.progress.challenges[c.id]?.bestStars ?? 0} stars · ${storage.progress.challenges[c.id]?.attempts ?? 0} attempts`}
          </p>
          <div className="realm-result-actions">
            {fingering.next && <button onClick={() => { fingering.setPreference(fingering.next!); void start(run?.practice ?? false, undefined, undefined, run?.score); }}>Try Again {fingering.next === "off" ? "Without Finger Numbers" : `with ${fingering.next === "light" ? "Light" : "Minimal"} Guidance`}</button>}
            <button className="primary" onClick={() => start()}>
              Retry full trial
            </button>
            <button onClick={() => start(true, result.weak)}>
              Practice weak measures at {Math.max(40, config.tempo - 15)} BPM
            </button>
            <button
              disabled={storage.saving || !!storage.error}
              onClick={returnMap}
            >
              Continue
            </button>
            <button onClick={returnMap}>Return to realm</button>
          </div>
        </section>
      )}
    </div>
    </PracticeGoldContext.Provider>
  );
}
