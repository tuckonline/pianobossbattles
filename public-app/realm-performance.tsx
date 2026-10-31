import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NotationViewer,
  type NoteFeedback,
} from "../src/components/music/notation";
import { midiBus } from "../src/domains/midi/engine";
import { AudioEngine } from "../src/domains/music/audio";
import { musicXml, soundingNotes } from "../hosted/sight-library";
import { summarize, performanceEnd } from "../src/domains/realms/performance";
import { clockworkTiming } from "../src/domains/scoring/timing";
import type { MidiEvent } from "../src/domains/blocks/schema";
import type {
  Challenge,
  PerformanceResult,
  RealmScore,
} from "../src/domains/realms/types";
import { ClockworkPortrait } from "./realm-cinematic";
export function RealmPerformance({
  score,
  challenge,
  connected,
  practice,
  onFinish,
  onExit,
}: {
  score: RealmScore;
  challenge: Challenge;
  connected: boolean;
  practice: boolean;
  onFinish: (
    events: MidiEvent[],
    elapsedMs: number,
    result: PerformanceResult,
  ) => void;
  onExit: () => void;
}) {
  const [state, setState] = useState<
      "ready" | "counting" | "playing" | "paused"
    >("ready"),
    [ready, setReady] = useState(false);
  const [elapsed, setElapsed] = useState(-1),
    [events, setEvents] = useState<MidiEvent[]>([]),
    [metronome, setMetronome] = useState(true),
    [error, setError] = useState("");
  const clock = useRef({
    origin: 0,
    elapsed: 0,
    running: false,
    done: false,
    epoch: 0,
  });
  const buffer = useRef<MidiEvent[]>([]),
    audio = useRef<AudioEngine | null>(null),
    stateRef = useRef(state);
  stateRef.current = state;
  const finish = useRef(onFinish);
  finish.current = onFinish;
  const connectedRef = useRef(connected);
  connectedRef.current = connected;
  const ms = 60000 / score.exercise.tempoBpm!,
    duration = score.exercise.durationBeats! * ms;
  const end = useMemo(() => performanceEnd(score), [score]);
  // Freeze line breaks for this attempt; resizing only refits the existing SVG.
  const [narrow] = useState(() => window.innerWidth < 1000);
  const xml = useMemo(
    () => musicXml({ ...score.exercise, measuresPerSystem: narrow ? 2 : 4 }),
    [score, narrow],
  );
  const result = useMemo(
    () => summarize(score, events, challenge, elapsed, 2),
    [score, events, challenge, elapsed],
  );
  const beat = Math.max(0, Math.min(duration, elapsed) / ms),
    measure = Math.min(score.exercise.right.length - 1, Math.floor(beat / 4));
  const phase = score.phases.find((p) => measure >= p.start && measure < p.end);
  const schedule = async (origin: number, start: number) => {
    const engine = audio.current;
    if (!engine) return;
    const first = Math.ceil(start / ms),
      at = origin + first * ms;
    await engine.metronome(score.exercise.tempoBpm!, undefined, {
      startAtMs: at,
      beatOffset: first,
    });
  };
  const begin = async (resume = false) => {
    if (!connected || !ready) return;
    const token = ++clock.current.epoch;
    try {
      if (metronome) await audio.current?.unlock();
      if (token !== clock.current.epoch) return;
      const offset = resume ? clock.current.elapsed : -4 * ms;
      const origin = performance.now() + 100 - offset;
      clock.current = {
        origin,
        elapsed: offset,
        running: true,
        done: false,
        epoch: token,
      };
      setElapsed(offset);
      setState(offset >= 0 ? "playing" : "counting");
      if (metronome) await schedule(origin, offset);
    } catch {
      setError(
        "Allow audio for this site, or turn off the metronome and retry.",
      );
      clock.current.running = false;
      setState("ready");
    }
  };
  const pause = useCallback(() => {
    clock.current.epoch++;
    clock.current.elapsed = Math.max(
      -4 * ms,
      performance.now() - clock.current.origin,
    );
    clock.current.running = false;
    audio.current?.stop();
    setState("paused");
  },[ms]);
  const restart = () => {
    clock.current.epoch++;
    clock.current.running = false;
    clock.current.done = false;
    clock.current.elapsed = 0;
    buffer.current = [];
    setEvents([]);
    setElapsed(-1);
    setState("ready");
    audio.current?.stop();
    setError("");
  };
  useEffect(() => {
    const engine = new AudioEngine();
    audio.current = engine;
    const unsub = midiBus.subscribe((e) => {
      const c = clock.current;
      if (!c.running || c.done || !connectedRef.current) return;
      const timestamp = e.timestamp - c.origin;
      if (
        timestamp < -clockworkTiming(score.exercise.tempoBpm!).matchWindowMs ||
        timestamp > end
      )
        return;
      buffer.current.push({ ...e, timestamp });
      buffer.current.sort((a, b) => a.timestamp - b.timestamp);
      setEvents([...buffer.current]);
    });
    let frame = 0,
      last = -Infinity,
      epoch = -1;
    const tick = () => {
      const c = clock.current;
      if (epoch !== c.epoch) {
        epoch = c.epoch;
        last = -Infinity;
      }
      if (c.running && !c.done) {
        const at = performance.now() - c.origin;
        c.elapsed = at;
        if (at >= 0 && stateRef.current === "counting") setState("playing");
        if (at >= duration) engine.stop();
        if (at >= end) {
          c.done = true;
          c.running = false;
          engine.stop();
          setElapsed(end);
          finish.current(
            [...buffer.current],
            end,
            summarize(score, buffer.current, challenge, Infinity, 2),
          );
        } else if (at - last >= 50) {
          last = at;
          setElapsed(at);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      clock.current.epoch++;
      clock.current.running = false;
      unsub();
      cancelAnimationFrame(frame);
      engine.dispose();
    };
  }, [score, challenge, duration, end]);
  useEffect(() => {
    if (!connected && clock.current.running) pause();
  }, [connected,pause]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden && clock.current.running) pause();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, [pause]);
  const feedback = useMemo<NoteFeedback[]>(
    () => [
      ...result.feedback,
      ...soundingNotes(score.exercise).flatMap((n) => {
        if (elapsed < 0) return [];
        const due = n.beat * ms;
        // The authoritative summary supplies timing results; current note highlight follows the clock.
        if (
          due <= elapsed &&
          due + n.beats * ms > elapsed &&
          !result.feedback.some((f) => f.beat === n.beat && f.pitch === n.pitch)
        )
          return [{ ...n, status: "current" as const }];
        return [];
      }),
    ],
    [score, elapsed, ms, result.feedback],
  );
  const indicator =
    challenge.kind === "streak"
      ? `Streak ${result.streak} / ${challenge.streak} · best ${result.bestStreak}`
      : challenge.kind === "coordination"
        ? `Right staff ${result.right ?? 0}% · Left staff ${result.left ?? 0}%`
        : challenge.kind === "phrase"
          ? `${result.crystals} / ${challenge.crystals} phrase crystals`
          : challenge.kind === "boss"
            ? `${result.phases.filter((p) => p.passed).length} / 4 phases mastered`
            : `Rhythm ${result.rhythm}% · Pitch ${result.pitch}%`;
  return (
    <section className="realm-playing" aria-label="Musical performance">
      <header className="realm-playing-header">
        <div>
          {challenge.kind === "boss" && (
            <>
              <ClockworkPortrait />
              <span className="realm-eyebrow">
                THE CLOCKWORK KING · {phase?.title ?? "Prepare"}
              </span>
            </>
          )}
          <h1>{practice ? score.exercise.title : challenge.title}</h1>
          <p>
            {practice
              ? "Practice this passage. Stars and unlocks are awarded in the full trial."
              : challenge.objective}
          </p>
        </div>
        <div className="realm-controls">
          {state === "ready" ? (
            <button
              className="primary"
              disabled={!connected || !ready}
              onClick={() => void begin()}
            >
              Start performance
            </button>
          ) : state === "paused" ? (
            <button disabled={!connected} onClick={() => void begin(true)}>
              Resume
            </button>
          ) : (
            <button onClick={pause}>Pause</button>
          )}
          <button onClick={restart}>Restart</button>
          <button onClick={onExit}>Return to realm</button>
        </div>
      </header>
      <div className="realm-hud">
        <span>{score.exercise.tempoBpm} BPM · 4/4</span>
        <span>
          Measure {measure + 1} / {score.exercise.right.length}
        </span>
        <strong>{elapsed < 0 ? "Four beats to prepare" : indicator}</strong>
        <label>
          <input
            type="checkbox"
            checked={metronome}
            onChange={(e) => {
              setMetronome(e.target.checked);
              if (!e.target.checked) audio.current?.stop();
              else if (clock.current.running)
                void schedule(
                  clock.current.origin,
                  clock.current.elapsed,
                ).catch(() => setError("Metronome unavailable."));
            }}
          />
          Metronome
        </label>
        <span>Focus mode</span>
      </div>
      <p className="realm-play-status" role="status">
        {!connected
          ? "Connect your MIDI piano to begin or resume."
          : state === "paused"
            ? "Paused — your place is preserved."
            : state === "counting"
              ? `Ready · ${Math.min(4, Math.max(1, Math.ceil(-elapsed / ms)))}`
              : state === "ready"
                ? "Set your hands on the starting notes, then begin."
                : `${result.wrong ?? 0} wrong · ${result.missed} missed · ${result.extra} extra · ${result.early} early · ${result.late} late${result.timing?.samples.length ? ` · Last onset: ${result.timing.samples.at(-1)!.deltaMs} ms` : ""}`}
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="realm-score" data-broadcast-viewport="realm">
        <NotationViewer
          xml={xml}
          onReadyChange={setReady}
          presentationId={xml}
          activeMeasure={measure}
          activeBeat={beat}
          noteFeedback={feedback}
          broadcastFit
          broadcastPageWidth={narrow ? 1100 : 1700}
          hideTitle
          compact
          followOptions={{ enabled: true, topPercent: 0, bottomPercent: 0 }}
        />
      </div>
      <p className="realm-playing-note">
        Play to the pulse. Early and late notes are measured against the
        selected tempo. Fingering: 1 thumb · 2 index · 3 middle · 4 ring · 5
        little finger.
      </p>
    </section>
  );
}
