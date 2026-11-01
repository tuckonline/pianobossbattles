import { readPracticeSettings, starter, type PracticeResult } from "../src/domains/music-generator/practice-session";

import { learningSteps } from "../src/domains/music-generator/learning-steps";

import { FingeringControl, useFingering } from "./fingering-assistance";

import { filterFingerings } from "../src/domains/notation/fingering-assistance";

import { useEffect, useMemo, useRef, useState } from "react";

import { assessPractice, musicXml, noteGroups, soundingNotes, type Exercise, type Hand } from "../hosted/sight-library";

import { NotationViewer, type NoteFeedback } from "../src/components/music/notation";

import { midiBus } from "../src/domains/midi/engine";

import { AudioEngine } from "../src/domains/music/audio";

import { generateClassicalExercise } from "../src/domains/music-generator/classical-generator";

import { musicalTiers } from "../src/domains/music-generator/difficulty-profiles";

import { keys } from "../src/domains/music-generator/music-theory";

import type { ClassicalExercise, GeneratorSettings } from "../src/domains/music-generator/types";

import "./classical-practice.css";

import { usePracticeActivity } from "./practice-gold";

import { HandPositionGuide } from "./hand-position-guide";

import { supportsNovicePosition } from "../src/domains/music-generator/hand-positions";



const supportedSettings = (s: GeneratorSettings): GeneratorSettings =>

  (s.difficulty === 1 || !!s.learningStep) && s.positionVersion === 1 && !supportsNovicePosition(s.key, s.mode)

    ? { ...s, key: s.mode === "major" ? "C" : "A" } : s;



type Status = "ready" | "playing" | "paused" | "complete";

export function ClassicalPractice({ connected, onClose, piece, pieceDifficulty, userId, guided, onComplete, completedResult, onRepeat, onSlower, onContinue, preparation, metronome, onMetronomeChange }: { connected: boolean; onClose: () => void; piece?: Exercise; pieceDifficulty?: number; userId?:string; guided?:boolean; onComplete?:(result:PracticeResult,pitches:number[])=>void; completedResult?:PracticeResult; onRepeat?:()=>void; onSlower?:()=>void; onContinue?:()=>void; preparation?:React.ReactNode; metronome?:boolean; onMetronomeChange?:(enabled:boolean)=>void }) {

  const [settings, setSettings] = useState<GeneratorSettings>(()=>{try{return userId?readPracticeSettings(localStorage.getItem(`pbb:practice-settings:v1:${userId}`)):starter();}catch{return starter();}});

  const [generated, setExercise] = useState<ClassicalExercise>();

  const [practiceTempo, setPracticeTempo] = useState(piece?.tempoBpm ?? 80);

  const [practiceHand, setPracticeHand] = useState<Hand>(piece?.singleHand ?? "both");

  const exercise = useMemo(() => piece ? { ...piece, tempoBpm: practiceTempo } : generated, [piece, practiceTempo, generated]);

  const assistanceDifficulty = piece ? pieceDifficulty ?? ({ novice:1, beginner:2, intermediate:3, advanced:4, maestro:5 }[piece.difficulty?.toLowerCase() ?? ""] ?? 3) : generated?.generated.settings.difficulty ?? settings.difficulty;

  const fingering = useFingering(assistanceDifficulty);

  const [status, setStatus] = useState<Status>(completedResult ? "complete" : "ready");

  usePracticeActivity(status === "playing" && connected);

  const [played, setPlayed] = useState<number[]>([]);

  const [error, setError] = useState("");

  const [click, setClick] = useState(metronome??false);

  const [ready, setReady] = useState(false);

  const toolbar = useRef<HTMLDivElement>(null);

  const active = useRef(false), buffer = useRef<number[]>([]);

  const busy = status === "playing" || status === "paused";

  const changeStatus = (next: Status) => { active.current = next === "playing"; setStatus(next); };

  const generate = (next = settings) => {

    active.current = false;

    try {

      const generated = generateClassicalExercise(next);

      if(userId){try{localStorage.setItem(`pbb:practice-settings:v1:${userId}`,JSON.stringify(next));}catch{/* Session settings remain usable. */}}

      setExercise(generated); setSettings(next); setPlayed([]); buffer.current = [];

      setStatus("ready"); setError("");

      requestAnimationFrame(() => toolbar.current?.scrollIntoView({block:"start"}));

    } catch (e) { changeStatus("ready"); setError((e as Error).message); }

  };

  const another = (difficulty = settings.difficulty) => {

    let seed = crypto.getRandomValues(new Uint32Array(1))[0];

    if (seed === generated?.generated.settings.seed) seed = (seed + 1) >>> 0;

    generate(supportedSettings({ ...settings, seed, difficulty,learningStep:difficulty===settings.difficulty?settings.learningStep:learningSteps.find(step=>step.difficulty===difficulty)?.id,tempoBpm:difficulty===settings.difficulty?settings.tempoBpm:learningSteps.find(step=>step.difficulty===difficulty)?.tempo ?? musicalTiers[difficulty-1].tempo }));

  };

  const repeat = () => { active.current = false; buffer.current = []; setPlayed([]); setStatus("ready"); setError(""); requestAnimationFrame(() => toolbar.current?.scrollIntoView({block:"start"})); };

  const hands = piece ? practiceHand : generated?.generated.settings.hands ?? "both";

  const meter = exercise?.beatsPerMeasure ?? 4;

  const measures = exercise ? Math.ceil((exercise.durationBeats ?? exercise.right.length * meter) / meter) : 0;

  const groups = useMemo(() => exercise ? noteGroups(exercise, hands) : [], [exercise, hands]);

  const result = useMemo(() => exercise ? assessPractice(exercise, hands, played) : undefined, [exercise, hands, played]);

  const xml = useMemo(() => exercise ? filterFingerings(exercise.notationXml ?? musicXml(exercise),fingering.level) : undefined, [exercise,fingering.level]);

  const notified=useRef(!!completedResult), completion=useRef(onComplete);

  completion.current=onComplete;

  useEffect(()=>{if(status!=="complete"){notified.current=false;return;}if(result&&!notified.current){notified.current=true;completion.current?.({accuracy:result.accuracy,correct:result.correct,mistakes:result.mistakes}, [...buffer.current]);}},[status,result]);

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

    // Shared pitch evaluator; practice-time rewards are observed separately.

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

  return <section className="classical-practice setup-section" aria-label={piece ? "Studio practice" : "Infinite Classical Practice"}>

    {!guided && <header><div><span className="eyebrow">{guided ? "GUIDED PRACTICE" : piece ? "PRACTICE STUDIO" : "A NEW PIECE, EVERY PRACTICE"}</span><h1>{piece?.title ?? "Infinite Classical Practice"}</h1><p>{piece ? piece.composer : "Related phrases, clear cadences, and music shaped to your level."}</p></div><button onClick={onClose}>{guided ? "End Session" : piece ? "Back to Studio" : "Back to battles"}</button></header>}

    {piece && !guided && <fieldset disabled={busy} className="classical-settings"><legend>Practice settings</legend>

      <label>Tempo (BPM)<input type="number" min={40} max={240} value={practiceTempo} onChange={e => setPracticeTempo(Math.max(40, Math.min(240, +e.target.value || 40)))}/></label>

      <label>Hands<select value={practiceHand} onChange={e => { repeat(); setPracticeHand(e.target.value as Hand); }}>

        {!piece.singleHand && <option value="both">Both hands</option>}

        {!piece.bothHandsOnly && piece.singleHand !== "left" && <option value="right">Right hand</option>}

        {!piece.bothHandsOnly && piece.singleHand !== "right" && <option value="left">Left hand</option>}

      </select></label>

    </fieldset>}

    <fieldset disabled={busy} hidden={busy || !!piece} className="classical-settings"><legend>Compose your exercise</legend>

      <label>Difficulty<select aria-label="Difficulty" value={settings.difficulty} onChange={e => setSettings(s=>supportedSettings({...s,difficulty:+e.target.value,learningStep:learningSteps.find(step=>step.difficulty===+e.target.value)?.id,tempoBpm:learningSteps.find(step=>step.difficulty===+e.target.value)?.tempo ?? musicalTiers[+e.target.value-1].tempo}))}>{musicalTiers.map((p, i) => <option key={p.name} value={i + 1}>Level {i + 1} · {p.name}</option>)}</select></label>

      {settings.difficulty <= 2 && <label>Learning step<select aria-label="Learning step" value={settings.learningStep ?? ""} onChange={e=>{const step=learningSteps.find(step=>step.id===e.target.value);setSettings(s=>supportedSettings({...s,learningStep:step?.id,tempoBpm:step?.tempo ?? musicalTiers[s.difficulty-1].tempo}));}}>

        {learningSteps.filter(step=>step.difficulty===settings.difficulty).map((step,i)=><option key={step.id} value={step.id}>{step.name}{i===0?" (Recommended start)":""}</option>)}

        <option value="">Original tier profile</option>

      </select></label>}

      <label>Mode<select aria-label="Mode" value={settings.mode} onChange={e => {

        const mode = e.target.value as "major" | "minor", signature = keys.find(k => k[settings.mode] === settings.key)!;

        setSettings(s => supportedSettings({ ...s, mode, key: signature[mode] }));

      }}><option value="major">Major</option><option value="minor">Minor</option></select></label>

      <label>Key<select aria-label="Key" value={settings.key} onChange={e => set("key", e.target.value)}>{keys.map(k => <option key={k.fifths} value={k[settings.mode]} disabled={(settings.difficulty === 1 || !!settings.learningStep) && !supportsNovicePosition(k[settings.mode], settings.mode)}>{k[settings.mode]}</option>)}</select></label>

      <label>Tempo (BPM)<input type="number" min={40} max={160} value={settings.tempoBpm} onChange={e => set("tempoBpm", +e.target.value)}/></label>

      <label>Measures<select aria-label="Measures" value={settings.measures} onChange={e => set("measures", +e.target.value)}>{[8, 16, 32, 64].map(n => <option key={n}>{n}</option>)}</select></label>

      <label>Hands<select aria-label="Hands" value={settings.hands} onChange={e => set("hands", e.target.value as GeneratorSettings["hands"])}><option value="both">Both hands</option><option value="right">Right hand</option><option value="left">Left hand</option></select></label>

      <label>Seed<input type="number" min={0} max={4294967295} value={settings.seed} onChange={e => set("seed", +e.target.value)}/></label>

      <button className="primary" onClick={() => generate()}>Generate Exercise</button>

    </fieldset>

    {!piece && <p className="classical-note">{learningSteps.find(step=>step.id===settings.learningStep)?.change ?? musicalTiers[settings.difficulty-1].description} Suggested {musicalTiers[settings.difficulty-1].range[0]}–{musicalTiers[settings.difficulty-1].range[1]} BPM.</p>}

    {!piece && (settings.difficulty === 1 || !!settings.learningStep) && <p className="classical-note">Fixed positions: C, G, F or D major; A minor. Other keys are available with the original Beginner profile or higher tiers.</p>}

    {!guided && <p className="classical-note">{piece ? "Self-paced pitch practice. No official realm stars." : "Self-paced pitch accuracy · 4/4 · Use the same seed and settings to reproduce a piece."} Active MIDI practice earns about 50 gold per hour. Mistakes still count as practice; paused and idle time do not.</p>}

    {error && <p role="alert">{error}</p>}

    {exercise && <>

      <div className="classical-toolbar" ref={toolbar}>

        <div><strong>{exercise.title}</strong><small>{measures} measures · {exercise.tempoBpm} BPM · {hands} hands{!piece && generated && ` · Level ${generated.generated.settings.difficulty} · Seed ${generated.generated.settings.seed}${generated.generated.settings.learningStep ? ` · ${learningSteps.find(step=>step.id===generated.generated.settings.learningStep)?.name}` : ""}`}</small></div>

        <label className="classical-click"><input type="checkbox" checked={click} onChange={e => {setClick(e.target.checked);onMetronomeChange?.(e.target.checked);}}/>Metronome</label>

        {status === "ready" && <button className="primary" disabled={!connected || !ready} onClick={() => changeStatus("playing")}>Start Practice</button>}

        {status === "playing" && <button onClick={() => changeStatus("paused")}>Pause</button>}

        {status === "paused" && <button disabled={!connected} onClick={() => changeStatus("playing")}>Resume</button>}

        {busy && !guided && <button onClick={repeat}>End Practice</button>}

        {guided && <><button onClick={onRepeat}>Repeat Exercise</button><button disabled={exercise.tempoBpm!<=40} onClick={onSlower}>Practice Again Slower</button><button className={status === "complete" ? "primary" : ""} disabled={status!=="complete"} onClick={onContinue}>Continue</button><button onClick={onClose}>End Session</button></>}

        {!busy && !guided && <><button onClick={repeat}>Repeat Exercise</button>{!piece && <button onClick={() => another()}>New Exercise</button>}</>}

      </div>

      <p role="status">{status === "complete" ? `Complete · ${result!.accuracy}% accuracy · ${result!.correct} correct notes · ${result!.mistakes} mistakes`

        : !connected ? "Connect your MIDI piano to start or resume." : !ready ? "Preparing sheet music…" : status === "paused" ? "Paused. Your place is saved."

        : status === "playing" ? `Measure ${Math.floor(beat / meter) + 1} of ${measures} · ${result!.accuracy}% accuracy` : "Ready. Press Start Practice when you are ready."}</p>

      {guided && status === "complete" && <div className="guided-completion"><h2>{(completedResult??result)!.accuracy}% pitch accuracy</h2><details><summary>Exercise details</summary><p>{(completedResult??result)!.correct} correct notes · {(completedResult??result)!.mistakes} mistakes. Timing is not scored.</p></details></div>}

      {status === "ready" && preparation}

      {!guided && status !== "playing" && status !== "paused" && <FingeringControl difficulty={assistanceDifficulty}/>}

      {status === "ready" && fingering.level !== "off" && <HandPositionGuide key={xml} exercise={exercise}/>}

      {!piece && !exercise.generatedFingering && <p className="classical-note" aria-label="Starting fingers">Suggested starting fingers: {(["right", "left"] as const).flatMap(hand => {

        const note = exercise[hand].flat().find(n => !n.rest);

        if (!note?.finger || !note.spelling) return [];

        const {step, alter, octave} = note.spelling;

        return [`${hand === "right" ? "Right" : "Left"} ${note.finger} on ${step}${alter > 0 ? "♯".repeat(alter) : "♭".repeat(-alter)}${octave}`];

      }).join(" · ")}. 1 = thumb, 2 = index, 3 = middle, 4 = ring, 5 = little finger.</p>}

      <div className="classical-score"><NotationViewer xml={xml} presentationId={xml} onReadyChange={setReady}

        activeMeasure={status === "ready" ? undefined : Math.floor(beat / meter)} activeBeat={beat} noteFeedback={feedback}

        compact consistentScale engravingScale={60} hideTitle

        followOptions={{ enabled: status === "playing", topPercent: 12, bottomPercent: 0, visibleSystems: 2, fitViewport: true }}/></div>

      {status === "complete" && !guided && <div className="classical-results" aria-label="Practice result"><h2>{result!.accuracy}% note accuracy</h2><p>Pitch groups use the same grading as your exercise library. Timing and key-release duration are not scored.</p>

        <button onClick={repeat}>Try Again</button>{fingering.next && <button onClick={()=>{fingering.setPreference(fingering.next!);repeat();}}>Try Again {fingering.next === "off" ? "Without Finger Numbers" : `with ${fingering.next === "light" ? "Light" : "Minimal"} Guidance`}</button>}{!piece && <><button disabled={settings.difficulty === 5} onClick={() => another(settings.difficulty + 1)}>Increase Difficulty</button><button disabled={settings.difficulty === 1} onClick={() => another(settings.difficulty - 1)}>Decrease Difficulty</button></>}

      </div>}

    </>}

  </section>;

}

