import { useEffect, useMemo, useRef, useState } from "react";
import { assessPractice, musicXml, noteGroups, soundingNotes } from "../hosted/sight-library";
import { NotationViewer, type NoteFeedback } from "../src/components/music/notation";
import { midiBus } from "../src/domains/midi/engine";
import { AudioEngine } from "../src/domains/music/audio";
import { generateClassicalExercise } from "../src/domains/music-generator/classical-generator";
import { musicalTiers } from "../src/domains/music-generator/difficulty-profiles";
import { keys } from "../src/domains/music-generator/music-theory";
import type { ClassicalExercise, GeneratorSettings } from "../src/domains/music-generator/types";
import "./classical-practice.css";

type Status = "ready" | "playing" | "paused" | "complete";
export function ClassicalPractice({ connected, onClose }: { connected: boolean; onClose: () => void }) {
  const [settings, setSettings] = useState<GeneratorSettings>({ difficulty: 1, key: "C", mode: "major", tempoBpm: musicalTiers[0].tempo, measures: 8, hands: "both", seed: 1, curriculumVersion:2 });
  const [exercise, setExercise] = useState<ClassicalExercise>();
  const [status, setStatus] = useState<Status>("ready");
  const [played, setPlayed] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [click, setClick] = useState(false);
  const [ready, setReady] = useState(false);
  const toolbar = useRef<HTMLDivElement>(null);
  const active = useRef(false), buffer = useRef<number[]>([]);
  const busy = status === "playing" || status === "paused";
  const changeStatus = (next: Status) => { active.current = next === "playing"; setStatus(next); };
  const generate = (next = settings) => {
    active.current = false;
    try {
      const generated = generateClassicalExercise(next);
      setExercise(generated); setSettings(next); setPlayed([]); buffer.current = [];
      setStatus("ready"); setError("");
      requestAnimationFrame(() => toolbar.current?.scrollIntoView({block:"start"}));
    } catch (e) { changeStatus("ready"); setError((e as Error).message); }
  };
  const another = (difficulty = settings.difficulty) => {
    let seed = crypto.getRandomValues(new Uint32Array(1))[0];
    if (seed === exercise?.generated.settings.seed) seed = (seed + 1) >>> 0;
    generate({ ...settings, seed, difficulty,tempoBpm:difficulty===settings.difficulty?settings.tempoBpm:musicalTiers[difficulty-1].tempo });
  };
  const repeat = () => { active.current = false; buffer.current = []; setPlayed([]); setStatus("ready"); setError(""); requestAnimationFrame(() => toolbar.current?.scrollIntoView({block:"start"})); };
  const hands = exercise?.generated.settings.hands ?? "both";
  const groups = useMemo(() => exercise ? noteGroups(exercise, hands) : [], [exercise, hands]);
  const result = useMemo(() => exercise ? assessPractice(exercise, hands, played) : undefined, [exercise, hands, played]);
  const xml = useMemo(() => exercise ? musicXml(exercise) : undefined, [exercise]);
  const beat = groups[Math.min(result?.cursor ?? 0, groups.length - 1)]?.beat ?? 0;
  const feedback = useMemo<NoteFeedback[]>(() => {
    if (!exercise || !result) return [];
    const marks = new Map(result.feedback.map(n => [`${n.beat}:${n.pitch}`, n.status]));
    return soundingNotes(exercise, hands).flatMap(n => {
      const status = marks.get(`${n.beat}:${n.pitch}`) ?? (n.beat === beat && !result.complete ? "current" : undefined);
      return status ? [{ ...n, status }] : [];
    });
  }, [exercise, hands, result, beat]);
  useEffect(() => {
    if (!exercise) return;
    // Shares the existing MIDI bus and evaluator; this local mode never calls GameClient or reward APIs.
    const unsubscribe = midiBus.subscribe(event => {
      if (!active.current || !connected || event.type !== "NOTE_ON" || !event.velocity || event.pitch === undefined) return;
      buffer.current.push(event.pitch);
      const assessed = assessPractice(exercise, hands, buffer.current);
      setPlayed([...buffer.current]);
      if (assessed.complete) { active.current = false; setStatus("complete"); }
    });
    return () => { active.current = false; unsubscribe(); };
  }, [exercise, hands, connected]);
  useEffect(() => {
    if (!connected && status === "playing") { active.current = false; setStatus("paused"); }
  }, [connected, status]);
  useEffect(() => {
    if (status !== "playing" || !click || !exercise) return;
    const audio = new AudioEngine();
    let cancelled = false;
    void audio.metronome(exercise.tempoBpm!).then(() => { if (cancelled) audio.dispose(); }).catch(() => {
      if (!cancelled) { setError("Metronome could not start. Allow audio and try again."); setClick(false); }
    });
    return () => { cancelled = true; audio.dispose(); };
  }, [status, click, exercise]);
  const set = <K extends keyof GeneratorSettings>(key: K, value: GeneratorSettings[K]) => setSettings(s => ({ ...s, [key]: value }));
  return <section className="classical-practice setup-section" aria-label="Infinite Classical Practice">
    <header><div><span className="eyebrow">A NEW PIECE, EVERY PRACTICE</span><h1>Infinite Classical Practice</h1><p>Related phrases, clear cadences, and music shaped to your level.</p></div><button onClick={onClose}>Back to battles</button></header>
    <fieldset disabled={busy} hidden={busy} className="classical-settings"><legend>Compose your exercise</legend>
      <label>Difficulty<select aria-label="Difficulty" value={settings.difficulty} onChange={e => setSettings(s=>({...s,difficulty:+e.target.value,tempoBpm:musicalTiers[+e.target.value-1].tempo}))}>{musicalTiers.map((p, i) => <option key={p.name} value={i + 1}>Level {i + 1} · {p.name}</option>)}</select></label>
      <label>Mode<select aria-label="Mode" value={settings.mode} onChange={e => {
        const mode = e.target.value as "major" | "minor", signature = keys.find(k => k[settings.mode] === settings.key)!;
        setSettings(s => ({ ...s, mode, key: signature[mode] }));
      }}><option value="major">Major</option><option value="minor">Minor</option></select></label>
      <label>Key<select aria-label="Key" value={settings.key} onChange={e => set("key", e.target.value)}>{keys.map(k => <option key={k.fifths} value={k[settings.mode]}>{k[settings.mode]}</option>)}</select></label>
      <label>Tempo (BPM)<input type="number" min={40} max={160} value={settings.tempoBpm} onChange={e => set("tempoBpm", +e.target.value)}/></label>
      <label>Measures<select aria-label="Measures" value={settings.measures} onChange={e => set("measures", +e.target.value)}>{[8, 16, 32, 64].map(n => <option key={n}>{n}</option>)}</select></label>
      <label>Hands<select aria-label="Hands" value={settings.hands} onChange={e => set("hands", e.target.value as GeneratorSettings["hands"])}><option value="both">Both hands</option><option value="right">Right hand</option><option value="left">Left hand</option></select></label>
      <label>Seed<input type="number" min={0} max={4294967295} value={settings.seed} onChange={e => set("seed", +e.target.value)}/></label>
      <button className="primary" onClick={() => generate()}>Generate Exercise</button>
    </fieldset>
    <p className="classical-note">{musicalTiers[settings.difficulty-1].description} Suggested {musicalTiers[settings.difficulty-1].range[0]}–{musicalTiers[settings.difficulty-1].range[1]} BPM.</p>
    <p className="classical-note">Self-paced pitch accuracy · 4/4 · Results stay in this session; no XP or battle records. Use the same seed and settings to reproduce a piece.</p>
    {error && <p role="alert">{error}</p>}
    {exercise && <>
      <div className="classical-toolbar" ref={toolbar}>
        <div><strong>{exercise.title}</strong><small>Level {exercise.generated.settings.difficulty} · {exercise.generated.settings.measures} measures · {exercise.tempoBpm} BPM · {hands} hands · Seed {exercise.generated.settings.seed}</small></div>
        <label className="classical-click"><input type="checkbox" checked={click} onChange={e => setClick(e.target.checked)}/>Metronome</label>
        {status === "ready" && <button className="primary" disabled={!connected || !ready} onClick={() => changeStatus("playing")}>Start Practice</button>}
        {status === "playing" && <button onClick={() => changeStatus("paused")}>Pause</button>}
        {status === "paused" && <button disabled={!connected} onClick={() => changeStatus("playing")}>Resume</button>}
        {busy && <button onClick={repeat}>End Practice</button>}
        {!busy && <><button onClick={repeat}>Repeat Exercise</button><button onClick={() => another()}>New Exercise</button></>}
      </div>
      <p role="status">{status === "complete" ? `Complete · ${result!.accuracy}% accuracy · ${result!.correct} correct notes · ${result!.mistakes} mistakes`
        : !connected ? "Connect your MIDI piano to start or resume." : !ready ? "Preparing sheet music…" : status === "paused" ? "Paused. Your place is saved."
        : status === "playing" ? `Measure ${Math.floor(beat / 4) + 1} of ${exercise.generated.settings.measures} · ${result!.accuracy}% accuracy` : "Ready. Press Start Practice when you are ready."}</p>
      <p className="classical-note" aria-label="Starting fingers">Suggested starting fingers: {(["right", "left"] as const).flatMap(hand => {
        const note = exercise[hand].flat().find(n => !n.rest);
        if (!note?.finger || !note.spelling) return [];
        const {step, alter, octave} = note.spelling;
        return [`${hand === "right" ? "Right" : "Left"} ${note.finger} on ${step}${alter > 0 ? "♯".repeat(alter) : "♭".repeat(-alter)}${octave}`];
      }).join(" · ")}. 1 = thumb, 2 = index, 3 = middle, 4 = ring, 5 = little finger.</p>
      <div className="classical-score"><NotationViewer xml={xml} presentationId={xml} onReadyChange={setReady}
        activeMeasure={status === "ready" ? undefined : Math.floor(beat / 4)} activeBeat={beat} noteFeedback={feedback}
        compact consistentScale engravingScale={60} hideTitle
        followOptions={{ enabled: status === "playing", topPercent: 12, bottomPercent: 0, visibleSystems: 2, fitViewport: true }}/></div>
      {status === "complete" && <div className="classical-results" aria-label="Practice result"><h2>{result!.accuracy}% note accuracy</h2><p>Pitch groups use the same grading as your exercise library. Timing and key-release duration are not scored.</p>
        <button onClick={repeat}>Try Again</button><button disabled={settings.difficulty === 5} onClick={() => another(settings.difficulty + 1)}>Increase Difficulty</button><button disabled={settings.difficulty === 1} onClick={() => another(settings.difficulty - 1)}>Decrease Difficulty</button>
      </div>}
    </>}
  </section>;
}
