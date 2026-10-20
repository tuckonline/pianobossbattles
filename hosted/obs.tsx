import {chainScoreSnapshot} from "./obs-score-state";
import {shortsRecorder} from './shorts-recorder';
import {ShortsPresentation} from './shorts-view';
import { BattleCinematicOverlay, useBattleCinematic } from './battle-cinematic-ui';
import { obsCinematicAudio, useObsAudioOutput } from './battle-audio-ui';
import { defaultCinematicSettings } from './cinematic-config';
import { ObsScore } from "./obs-score";
import { StreakOverlay } from "./streak-overlay";
import {gameClient} from "./game-client";
import {GameHUD,GameCelebrations,GameSummaryView} from "./game-ui";
import { useEffect, useRef, useState } from "react";
import { DirectScorePublisher, DirectScoreViewer, OverlayReceiver, type ScoreFrame } from "./obs-direct";
import { OVERLAY_PUBLISH_MS, OVERLAY_REFRESH_MS, OVERLAY_SCORE_REFRESH_MS, OVERLAY_STALL_MS,
  type OverlaySnapshot, type OverlayState } from "./obs-state";
import "./obs.css";

// Direct frames follow committed UI state immediately. Cloud writes remain
// serialized/coalesced and keep the recoverable snapshot for reconnects.
export function useOverlayPublisher(snapshot: OverlaySnapshot, enabled: boolean) {
  const current=useRef(snapshot);current.current=snapshot;
  const notify=useRef(()=>{});
  const [error,setError]=useState(false);
  useEffect(()=>{
    if(!enabled)return;
    const sourceId=crypto.randomUUID(),direct=new DirectScorePublisher(sourceId);
    let sequence=0,serialized="",lastCreated=0,busy=false,disposed=false,retryAt=0,lastPresentation="";
    let pending:(ScoreFrame & {claim:boolean})|undefined;
    let captureTimer:ReturnType<typeof setTimeout>|undefined;
    const flush=async()=>{
      if(busy||!pending||Date.now()<retryAt)return;
      const next=pending;busy=true;
      try {
        const response=await fetch("/api/obs",{method:"POST",headers:{"Content-Type":"application/json"},
          // Keepalive has a shared 64 KiB budget. Reserve it for the final
          // page-exit snapshot; ordinary live frames must not consume it.
          body:JSON.stringify(next),keepalive:disposed,signal:AbortSignal.timeout(8000)});
        await response.text(); // Drain the response, including final keepalives.
        if(!response.ok)throw new Error("Overlay sync failed");
        if(pending===next)pending=undefined;
        if(!disposed)setError(false);
      } catch {retryAt=Date.now()+3000;if(!disposed)setError(true);}
      finally {busy=false;if(pending && pending!==next)void flush();}
    };
    const capture=()=>{
      clearTimeout(captureTimer);captureTimer=undefined;
      const next={...chainScoreSnapshot(current.current,gameClient.overlay()),shorts:shortsRecorder.broadcast(),...(disposed?{status:"stopped" as const}:{})};
      lastPresentation=next.score?.presentationId??"";
      const value=JSON.stringify(next),changed=value!==serialized;
      if(!changed&&Date.now()-lastCreated<10000)return;
      serialized=value;lastCreated=Date.now();
      pending={sourceId,sequence:++sequence,snapshot:next,updatedAt:lastCreated,claim:!disposed&&changed};
      direct.publish(pending);void flush();
    };
    const schedule=()=>{
      if(disposed)return;
      const chain=gameClient.state.battle.chain;
      // A boundary is published in the same MIDI callback, before React paints.
      if(chain&&`${chain.exerciseNumber}:${chain.pass}`!==lastPresentation){capture();return;}
      if(captureTimer===undefined)captureTimer=setTimeout(capture,0);
    };
    notify.current=schedule;
    const unsubscribe=gameClient.subscribe(schedule);
    const unsubscribeShorts=shortsRecorder.subscribe(schedule);
    schedule();
    const timer=setInterval(()=>{if(Date.now()-lastCreated>=10000)schedule();void flush();},OVERLAY_PUBLISH_MS);
    return ()=>{
      notify.current=()=>{};unsubscribe();unsubscribeShorts();clearInterval(timer);clearTimeout(captureTimer);
      disposed=true;capture();direct.close();
    };
  },[enabled]);
  useEffect(()=>notify.current(),[snapshot]);
  return error;
}
const handNames = {
  both: "Both hands",
  left: "Left hand",
  right: "Right hand",
};
export function ObsOverlay({celebrationsOnly=false,scoreOnly=false,streaksOnly=false,unified=false,shorts=false}: {celebrationsOnly?:boolean;scoreOnly?:boolean;streaksOnly?:boolean;unified?:boolean;shorts?:boolean}) {
  const [data, setData] = useState<OverlayState | null>(null);
  const [connection, setConnection] = useState("Connecting");
  const [transport,setTransport]=useState<"direct"|"cloud">("cloud");
  const [now, setNow] = useState(()=>Date.now());
  useEffect(() => {
    document.title = shorts ? "Learn Piano Fast · Shorts" : unified ? "@Learnpianofast · OBS Recording" : streaksOnly ? "@Learnpianofast · OBS Streaks" : scoreOnly ? "@Learnpianofast · OBS Score" : celebrationsOnly ? "@Learnpianofast · OBS Celebrations" : "@Learnpianofast · OBS Overlay";
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    let busy = false;
    let lastStreamEvent = 0;
    let directConnected=false;
    const receiver=new OverlayReceiver();
    // One receiver feeds the whole composition. Full cloud snapshots provide
    // authoritative XP/PBs; the existing peer connection supplies live notes.
    const direct=scoreOnly||unified||shorts?new DirectScoreViewer(frame=>{
      const next=receiver.direct(frame);
      if(!disposed&&next){setData(next);setNow(Date.now());setConnection("Connected");}
    },connected=>{directConnected=connected;if(!disposed)setTransport(connected?"direct":"cloud");}):undefined;
    const accept=(next:OverlayState)=>{
      const accepted=receiver.cloud(next);
      if(accepted){setData(accepted);direct?.sourceChanged(accepted.sourceId??"");}
    };
    const refreshMs=scoreOnly?OVERLAY_SCORE_REFRESH_MS:OVERLAY_REFRESH_MS;
    const scoreQuery=scoreOnly?"&score=1":"";
    const stream = new EventSource(`/api/obs?stream=1${scoreQuery}`);
    stream.onmessage = (event) => {
      if (disposed) return;
      try {
        const next = JSON.parse(event.data) as OverlayState;
        lastStreamEvent = Date.now();
        accept(next);
        setNow(lastStreamEvent);
        setConnection("Connected");
      } catch {
        /* The HTTP fallback retries malformed or interrupted streams. */
      }
    };
    const poll = async () => {
      if (disposed || busy) return;
      clearTimeout(timer);
      if (Date.now() - lastStreamEvent < OVERLAY_STALL_MS) {
        timer = setTimeout(poll, refreshMs);
        return;
      }
      busy = true;
      controller = new AbortController();
      // OBS can embed an older Chromium without AbortSignal.any/timeout.
      const timeout = setTimeout(() => controller?.abort(), 8000);
      try {
        const response = await fetch(`/api/obs?refresh=${Date.now()}${scoreQuery}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (disposed || Date.now() - lastStreamEvent < OVERLAY_STALL_MS) return;
        if (!response.ok) {
          if (response.status === 401) {
            location.replace(`/?return_to=${encodeURIComponent(location.pathname)}`);
            return;
          }
          if(!directConnected)setConnection(
            response.status === 401
              ? "Sign in through OBS Interact"
              : "Reconnecting",
          );
        } else {
          const next = (await response.json()) as OverlayState;
          if (!disposed) {
            accept(next);
            setConnection("Connected");
          }
        }
      } catch {
        if (!disposed&&!directConnected) setConnection("Reconnecting");
      } finally {
        clearTimeout(timeout);
        busy = false;
        if (!disposed) {
          setNow(Date.now());
          timer = setTimeout(poll, refreshMs);
        }
      }
    };
    stream.onerror = () => {
      if (disposed) return;
      lastStreamEvent = 0;
      void poll();
    };
    const refresh = () => void poll();
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);
    void poll();
    return () => {
      disposed = true;
      controller?.abort();
      stream.close();
      direct?.close();
      clearTimeout(timer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [celebrationsOnly,scoreOnly,streaksOnly,unified,shorts]);
  const s = data?.snapshot;
  const stale = !data?.updatedAt || now - data.updatedAt > 30000;
  const active =
    !!s && !stale && connection === "Connected" && s.status === "practicing";
  const status =
    connection !== "Connected"
      ? connection
      : !s
        ? "Waiting for practice"
        : stale
          ? "Practice page offline"
          : {
              ready: "Ready to play",
              practicing: "Practice in progress",
              listening: "Listening",
              complete: "Attempt complete",
              stopped: "Practice paused",
            }[s.status];
  const cinematic=useBattleCinematic({battle:s?.game?.battle,exerciseId:s?.exerciseNumber??0,bestCombo:s?.game?.live.attemptBest??s?.game?.live.best??0,
    settings:s?.game?.settings.cinematics??defaultCinematicSettings,enabled:(unified||shorts)&&(s?.game?.settings.cinematics?.enabled??true),
      offline:stale||connection!=="Connected",dismissedId:s?.game?.cinematicDismissedId},`${new URLSearchParams(location.search).has('displayPreview')?'display-preview':'recording'}:${data?.gamePlayer?.userId??'waiting'}`,true);
  useObsAudioOutput(s?.game?.settings.bossBattle,data?.gamePlayer?.userId,(unified||shorts)&&!new URLSearchParams(location.search).has('displayPreview'));
  if(shorts) return <ShortsPresentation data={data} transport={transport} offline={stale||connection!=="Connected"} cinematic={cinematic}/>;
  if(scoreOnly) return s ? <ObsScore snapshot={s} transport={transport} offline={stale || connection!=="Connected"} /> : <main className="obs-score-canvas" aria-label="OBS score only" />;
  if(streaksOnly) return <StreakOverlay game={s?.game} stale={stale} userId={data?.gamePlayer?.userId} />;
  if(celebrationsOnly) return <main className="obs-canvas obs-celebrations-canvas" aria-label="OBS achievement celebrations">
    {s?.game && <GameCelebrations alerts={stale ? [] : s.game.alerts.filter(e => e.kind !== "milestone")} settings={s.game.settings} scene={s.game.live.attemptId} preview={s.game.preview} receiptKey={data?.gamePlayer?.userId ? `obs:${data.gamePlayer.userId}` : undefined} standalone />}
  </main>;
  if(unified) return <main className="obs-canvas obs-recording" data-score-transport={transport} aria-label="Learn Piano Fast recording view">
    <PerformanceBanner data={data} active={active} status={s?.status==="complete" ? "Attempt completed" : s?.status==="stopped" ? "Paused" : ""}/>
    <div className="obs-recording-content">
      {s ? <ObsScore snapshot={s} transport={transport} offline={stale||connection!=="Connected"} embedded cinematicActive={cinematic.phase!=="hidden"} cinematicHolding={cinematic.phase==="holding"}/> : <div className="obs-recording-waiting">Waiting for your practice page</div>}
      <BattleCinematicOverlay playback={cinematic.playback} onAudioCue={obsCinematicAudio}/>
    </div>
    {/* One priority queue avoids overlapping celebrations and never touches
        progression. Notifications stay over the banner, clear of notation. */}
    <div className="obs-recording-celebrations" aria-label="Recording notifications">
      {s?.game && <GameCelebrations alerts={stale ? [] : s.game.alerts} settings={s.game.settings} scene={`${s.game.sessionId}:${s.exerciseNumber}`} preview={s.game.preview} blocked={cinematic.phase!=="hidden"}
        receiptKey={data?.gamePlayer?.userId ? `obs-recording:${data.gamePlayer.userId}` : undefined}/>}
    </div>
    {s?.game?.summary && cinematic.phase==="hidden" && <GameSummaryView summary={s.game.summary} preview={s.game.preview}/>}
  </main>;
  return (
    <main className="obs-canvas" aria-label="Learnpianofast streaming overlay">
      <PerformanceBanner data={data} active={active} status={status} inlineCelebrations={new URLSearchParams(location.search).get("celebrations")==="inline"}/>
      {s?.game?.summary && <GameSummaryView summary={s.game.summary} preview={s.game.preview} />}
    </main>
  );
}

function PerformanceBanner({data,active,status,inlineCelebrations=false}: {data:OverlayState|null;active:boolean;status:string;inlineCelebrations?:boolean}) {
  const s=data?.snapshot;
  return (
      <section className="obs-panel">
        <header className="obs-brand">
          <svg
            className="obs-youtube"
            viewBox="0 0 32 24"
            role="img"
            aria-label="YouTube"
          >
            <rect x="0" y="1" width="32" height="22" rx="6" fill="#c94751" />
            <path d="M13 7v10l9-5z" fill="#fff" />
          </svg>
          <span>@PianoBossBattles</span>
        </header>
        <div className="obs-piece">
          <div className="obs-label">Now playing</div>
          <h1 title={s?.title ?? "Your next piece"}>{s?.title ?? "Your next piece"}</h1>
          <div className="obs-hands">
            <span className="obs-label">Hands</span>
            <strong>{s ? handNames[s.hand] : "—"}</strong>
            {s?.game?.battle?.config.enabled && <span className="boss-indicator">BOSS BATTLE</span>}
          </div>
        </div>
        <div className="obs-best">
          <div>
            <div className="obs-label">Best score</div>
            <strong className="obs-score">
              {data?.best == null ? "—" : `${data.best}%`}
            </strong>
          </div>
          <p>
            {data?.attempts ?? 0} completed{" "}
            {data?.attempts === 1 ? "attempt" : "attempts"}
          </p>
        </div>
        <div className="obs-attempt">
          <div className="obs-label">Current attempt</div>
          <div className="obs-metrics">
            <div>
              <strong>{s?.accuracy == null ? "—" : `${s.accuracy}%`}</strong>
              <span>Note accuracy</span>
            </div>
            <div>
              <strong className={s?.mistakes ? "obs-errors" : ""}>
                {s?.mistakes ?? 0}
              </strong>
              <span>Incorrect notes</span>
            </div>
          </div>
        </div>
        {active && s && (
          <div className="obs-progress">
            <div>
              <span className="obs-label">Progress</span>
              <strong>
                Measure {s.measure} / {s.totalMeasures}
              </strong>
            </div>
            <div className="obs-track">
              <div
                style={{ width: `${(100 * s.measure) / s.totalMeasures}%` }}
              />
            </div>
          </div>
        )}
        {status && <footer className="obs-status">
          <span className={active ? "obs-live-dot" : "obs-idle-dot"} />
          {status}
        </footer>}
        {s?.game && data?.gamePlayer && <GameHUD player={data.gamePlayer} live={s.game.live} settings={s.game.settings} preview={s.game.preview} />}
        {s?.game && inlineCelebrations && <GameCelebrations alerts={s.game.alerts} settings={s.game.settings} scene={s.game.live.attemptId} preview={s.game.preview} />}
      </section>
  );
}
