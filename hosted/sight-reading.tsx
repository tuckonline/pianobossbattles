import {SchmittChainBuilder,type ChainChoice} from './schmitt-chain-builder';
import type {ChainEntry} from './schmitt-chain';
import {PracticeBattleIntro} from './battle-intro';
import {battleCountingIn} from './boss-battle';
import { PracticeCinematic } from './cinematic-controls';
import { battleAudio } from './battle-audio';
import { ObsLinks } from "./obs-links";
import { encodeScoreFeedback } from "./obs-score-state";
import {gameClient} from "./game-client";
import {GamePanel} from "./game-ui";
import {PracticeBattleStatus} from "./practice-battle-status";
import { progressState, progressLabels, type ProgressMap, type ExerciseProgress } from "./collection-progress";
import { CollectionProgressView } from "./collection-progress-view";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useOverlayPublisher } from "./obs";
import { MidiSetup, VirtualKeyboard } from "../src/components/midi/setup";
import { MoonlightPath } from "./moonlight-path";
import { ClassicalPath } from "./classical-path";
import type { ClassicalLesson } from "./classical-library";
import type { MoonlightLesson } from "./moonlight-library";
import {moonlightRange,type MoonlightRange} from './moonlight-range';
import {ScoreSizeControls, useScoreSize} from './score-size';
import {
  NotationViewer,
  type NoteFeedback,
} from "../src/components/music/notation";
import { midiBus } from "../src/domains/midi/engine";
import { PreviewAudio } from "../src/domains/music/preview-audio";
import { noteName } from "../src/domains/music/model";
import { command } from "../src/components/ui/actions";
import type { MidiEvent } from "../src/domains/blocks/schema";
import {
  assessPractice,
  practicePass,
  musicXml,
  noteGroups,
  sightLibrary,
  soundingNotes,
  type Hand,
  type Exercise,
} from "./sight-library";
export type SightAttempt = {
  progress?: ExerciseProgress;
  id: string;
  exerciseNumber: number;
  hand: Hand;
  accuracy: number;
  mistakes: number;
  createdAt: string;
};

export type PracticeControls = { score: import('react').ReactNode; exercise: Exercise; running: boolean; paused: boolean; saving: boolean; message: string; pass: number; total: number; start: () => void; stop: () => void; pause: () => void };
export function SightReading({
  attempts: initial,
  library = sightLibrary,
  practice = false,
  hideHeading = false,
  selectedNumber,
  onSelectExercise,
  onStreamReset,
  onAttemptSaved,
  progress,
  experience,
}: {
  experience?: { entries: ChainEntry[]; canStart: boolean; hand: Hand; render: (controls: PracticeControls) => import("react").ReactNode };
  attempts: SightAttempt[];
  library?: Exercise[];
  practice?: boolean;
  hideHeading?: boolean;
  selectedNumber?: number;
  onSelectExercise?: (number: number) => void;
  onStreamReset?: () => void;
  onAttemptSaved?: (attempt: SightAttempt) => void;
  progress?: ProgressMap;
}) {
  const [number, updateNumber] = useState(selectedNumber ?? experience?.entries[0]?.exercise.number ?? library[0].number),
    [hand, setHand] = useState<Hand>(library.find(e => e.number === (selectedNumber ?? library[0].number))?.singleHand ?? "both");
  const [measureRange,setMeasureRange]=useState<MoonlightRange|null>(null);
  const [followSettings, setFollowSettings] = useState(() => {
    const defaults = { enabled: true, stream: new URLSearchParams(location.search).get("stream") === "1", top: 0, bottom: 28, dockHints: true, version: 3 };
    try {
      const saved = JSON.parse(localStorage.getItem("pianopath-score-follow") ?? "null");
      return saved ? { version: 3, enabled: saved.enabled !== false, stream: defaults.stream || saved.stream === true,
        top: Math.max(0, Math.min(35, ((!saved.version && saved.top === 20) || (saved.version === 2 && saved.top === 10) ? 0 : Number(saved.top)) || 0)),
        bottom: Math.max(0, Math.min(35, Number(saved.bottom) || 0)), dockHints: saved.dockHints !== false } : defaults;
    } catch { return defaults; }
  });
  useEffect(() => {
    try { localStorage.setItem("pianopath-score-follow", JSON.stringify(followSettings)); } catch { /* Private browsing may disable storage. */ }
  }, [followSettings]);
  const [chainEnabled,setChainEnabled]=useState(false);
  const [chainChoices,setChainChoices]=useState<ChainChoice[]>([]);
  const chainRun=useRef<{entries:ChainEntry[];index:number}|null>(null);
  const [repeatInput, setRepeatInput] = useState("1");
  const [repeatTotal, setRepeatTotal] = useState(1);
  const [repeatPass, setRepeatPass] = useState(1);
  const cancelled = useRef(false);
  const [continuous, setContinuous] = useState(true);
  const pendingPasses = useRef<{ exerciseNumber:number; played: number[]; omitClosing: boolean }[]>([]);
  const passRef = useRef(1);
  const commitRepeats = () => {
    const value = Number(repeatInput);
    const total = Number.isFinite(value)
      ? Math.max(1, Math.min(100, Math.round(value)))
      : 1;
    setRepeatInput(String(total));
    return total;
  };
  const setNumber = (next: number) => {
    setMeasureRange(null);
    if (onSelectExercise) onSelectExercise(next);
    else updateNumber(next);
  };
  const [paused,setPaused]=useState(false);
  const pauseRef=useRef(false);
  const [running, setRunning] = useState(false),
    [played, setPlayed] = useState<number[]>([]),
    [message, setMessage] = useState("");
  const [attempts, setAttempts] = useState(initial),
    [saving, setSaving] = useState(false),
    [showHints, setShowHints] = useState(false);
  const [listening, setListening] = useState(false),
    [listenBeat, setListenBeat] = useState(0);
  const [audioStarting, setAudioStarting] = useState(false);
  const [volume, setVolume] = useState(80);
  const [resettingStats, setResettingStats] = useState(false);
  const audio = useRef<PreviewAudio | null>(null),
    notesRef = useRef<number[]>([]),
    timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedExercise = library.find((e) => e.number === number)!;
  const exercise = useMemo(()=>measureRange ? moonlightRange(...measureRange) : selectedExercise,[selectedExercise,measureRange]);
  const omitClosing = exercise.collection === "schmitt-op16" && repeatPass < repeatTotal;
  const passExercise = useMemo(() => practicePass(exercise, omitClosing), [exercise, omitClosing]);
  const measureBeats = exercise.beatsPerMeasure ?? 4;
  const duration =
    passExercise.durationBeats ?? exercise.right.length * measureBeats;
  const schmitt = exercise.collection === "schmitt-op16";
  const sightReading = exercise.collection === "hannah-smith-part1";
  const supportsLoops = !!experience || schmitt || sightReading;
  const statusLabels = sightReading ? {...progressLabels, due: "Needs review"} : progressLabels;
  const {size:scoreSize,renderSize:scoreRenderSize,setSize:setScoreSize}=useScoreSize(exercise.collection??'sight-reading');
  const customScoreSize=scoreRenderSize.mode!=='auto';
  const [displayedScoreZoom,setDisplayedScoreZoom]=useState(100);
  const appliedExperience = useRef<{entries:ChainEntry[];hand:Hand}|null>(null);
  useEffect(() => {
    if (experience && !running) {
      if(appliedExperience.current?.entries===experience.entries&&appliedExperience.current?.hand===experience.hand)return;
      appliedExperience.current={entries:experience.entries,hand:experience.hand};
      const first = experience.entries[0];
      if (first && first.exercise.number !== number) { updateNumber(first.exercise.number); setPlayed([]); notesRef.current=[]; gameClient.resetBattle(); }
      setHand(experience.hand);
    }
  }, [experience, running, number]);
  const selectedIndex = library.findIndex((e) => e.number === number);
  const groups = useMemo(() => noteGroups(passExercise, hand), [passExercise, hand]);
  useEffect(() => { gameClient.prepareBattle(exercise, hand, supportsLoops ? Number(repeatInput) : 1); }, [exercise, hand, supportsLoops, repeatInput]);
  const state = useMemo(
    () => assessPractice(passExercise, hand, played),
    [passExercise, hand, played],
  );
  const practiceCursor = state.cursor;
  const matching = attempts.filter(
    (a) => a.exerciseNumber === exercise.number && a.hand === hand,
  );
  const countingIn=useSyncExternalStore(gameClient.subscribe,()=>battleCountingIn(gameClient.state.battle));
  const noteFeedback = useMemo<NoteFeedback[]>(
    () =>
      soundingNotes(exercise, hand).flatMap((n) => {
        const result = state.feedback.find(
          (f) => f.pitch === n.pitch && Math.abs(f.beat - n.beat) < 0.000001,
        );
        const status =
          result?.status ??
          (running && !countingIn && groups[practiceCursor]?.beat === n.beat
            ? "current"
            : undefined);
        return status ? [{ ...n, status }] : [];
      }),
    [exercise, hand, state.feedback, running, countingIn, groups, practiceCursor],
  );
  const stopAudio = () => {
    audio.current?.stop();
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setListening(false);
  };
  useEffect(() => {
    const engine = new PreviewAudio();
    audio.current = engine;
    return () => {
      cancelled.current = true;
      gameClient.abandon();
      engine.dispose();
      if (timer.current) clearInterval(timer.current);
    };
  }, []);
  useEffect(() => {
    if (!running) return;
    return midiBus.subscribe((e) => {
      if (!gameClient.acceptsNotes() || pauseRef.current || cancelled.current || e.type !== "NOTE_ON" || e.pitch === undefined || !e.velocity) return;
      // Read the synchronous input buffer, never a render's stale cursor. Chord
      // tones and consecutive notes can arrive together, at any speed.
      const chain=chainRun.current,entry=chain?.entries[chain.index];
      const activeExercise=entry?.exercise??exercise,total=entry?.loops??repeatTotal;
      const omit = activeExercise.collection==='schmitt-op16' && passRef.current < total;
      const currentPass = practicePass(activeExercise, omit);
      if (assessPractice(currentPass, hand, notesRef.current).complete) return;
      notesRef.current = [...notesRef.current, e.pitch];
      const approved=assessPractice(currentPass,hand,notesRef.current);
      gameClient.update(activeExercise,hand,notesRef.current,approved);
      const passComplete=approved.complete;
      if(passComplete) gameClient.finish();
      if (supportsLoops && (continuous || chain) && passComplete) {
        pendingPasses.current.push({ exerciseNumber:activeExercise.number, played: notesRef.current, omitClosing: omit });
        if (passRef.current < total) {
          // Switch passes before the next MIDI event, including events received
          // before React paints. Only Schmitt omits its cadence on earlier passes.
          passRef.current++;
          notesRef.current = [];
          setRepeatPass(passRef.current);
          gameClient.nextLoop(activeExercise,hand);
        } else if(chain&&chain.index+1<chain.entries.length){
          // Advance the synchronous evaluator input before returning to MIDI.
          // React and notation may paint later; no following note sees old data.
          chain.index++;const next=chain.entries[chain.index];
          passRef.current=1;notesRef.current=[];
          updateNumber(next.exercise.number);setRepeatTotal(next.loops);setRepeatPass(1);
          gameClient.nextLoop(next.exercise,hand);
        }
      }
      setPlayed(notesRef.current);
    });
  }, [running, exercise, hand, schmitt, supportsLoops, continuous, repeatTotal]);
  useEffect(() => {
    if (!running || practiceCursor < groups.length) return;
    // Continuous sessions save only after the final note of the final pass.
    // Remove each acknowledged pass so a retry cannot duplicate earlier saves.
    setRunning(false);
    setSaving(true);
    setMessage("Exercise complete. Saving your result…");
    const save = async () => {
      if (!(supportsLoops && (continuous || chainEnabled))) {
        const result = await command<SightAttempt>({
          action: "sightAttempt",
          exerciseNumber: exercise.number,
          hand,
          played: notesRef.current,
          omitClosing,
        });
        setAttempts((a) => [result, ...a]);
        onAttemptSaved?.(result);
        return result;
      }
      let last: SightAttempt | undefined;
      while (pendingPasses.current.length) {
        last = await command<SightAttempt>({
          action: "sightAttempt",
          hand,
          ...pendingPasses.current[0],
        });
        pendingPasses.current.shift();
        const saved = last;
        setAttempts((a) => [saved, ...a]);
        onAttemptSaved?.(saved);
      }
      return last!;
    };
    void save()
      .then((result) => {
        if (cancelled.current) return;
        if (supportsLoops && repeatPass < repeatTotal) {
          notesRef.current = [];
          setPlayed([]);
          passRef.current++;
          setRepeatPass(passRef.current);
          setMessage("");
          gameClient.nextLoop(exercise,hand);
          setRunning(true);
          return;
        }
        setMessage(
          `${supportsLoops && repeatTotal > 1 ? `${repeatTotal} ${sightReading ? "loops" : "passes"} complete · ` : ""}Saved · ${result.accuracy}% note accuracy · ${result.mistakes} incorrect notes`,
        );
      })
      .catch((e: Error) =>
        setMessage(`Result not saved: ${e.message}. Use Save result to retry.`),
      )
      .finally(() => setSaving(false));
  }, [
    running,
    practiceCursor,
    groups.length,
    exercise.number,
    hand,
    supportsLoops,
    sightReading,
    repeatPass,
    repeatTotal,
    continuous,
    chainEnabled,
  ]);
  const reset = () => {
    gameClient.resetBattle();chainRun.current=null;pauseRef.current=false;setPaused(false);
    stopAudio();
    setRunning(false);
    setPlayed([]);
    notesRef.current = [];
    setRepeatPass(1);
    passRef.current = 1;
    pendingPasses.current = [];
    setMessage("");
  };
  const busy = running || saving || listening || audioStarting || resettingStats;
  const startPractice = () => {
    if(gameClient.state.player.settings.bossBattle.soundEnabled&&gameClient.state.player.settings.bossBattle.audioOutput==='practice')battleAudio.unlock();
    if (busy || (experience && !experience.canStart)) return;
    if(!gameClient.state.ready){setMessage("Waiting for progress connection. Please try again in a moment.");return;}
    reset();
    cancelled.current = false;
    const entries=experience?.entries??(schmitt&&chainEnabled?chainChoices.map(c=>({exercise:library.find(e=>e.number===c.number)!,loops:c.loops})):undefined);
    if(entries&&!entries.length){setMessage('Select at least one Schmitt exercise.');return;}
    const first=entries?.[0],total=first?.loops??(supportsLoops ? commitRepeats() : 1);
    if(entries){chainRun.current={entries,index:0};updateNumber(first!.exercise.number);}
    setRepeatTotal(total);
    if(!gameClient.start(first?.exercise??exercise,hand,total,entries)){setMessage(gameClient.state.error);return;}
    setRunning(true);
  };
  const stopPractice = () => {
    gameClient.abandon();pauseRef.current=false;setPaused(false);
    cancelled.current = true;
    setRunning(false);
    setMessage("Practice stopped. Start again when ready.");
  };
  const moveExercise = (direction: number) => {
    if (busy) return;
    const next = library[selectedIndex + direction];
    if (!next) return;
    reset();
    setNumber(next.number);
  };
  useEffect(() => {
    if(experience)return;
    const shortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target instanceof Element ? event.target : null;
      // Preserve native editing, focused controls, and virtual-piano key input.
      if (target?.closest('input, select, textarea, [contenteditable]:not([contenteditable="false"]), a, [role="textbox"], button:not([data-practice-hotkeys])')) return;
      if (!["ArrowLeft", "ArrowRight", "Enter", " "].includes(event.key)) return;
      if (event.key === " " && !running) return;
      event.preventDefault();
      if (event.repeat) return;
      if (event.key === "ArrowLeft") moveExercise(-1);
      else if (event.key === "ArrowRight") moveExercise(1);
      else if (event.key === "Enter") startPractice();
      else stopPractice();
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  });
  const listen = async () => {
    // Listen demonstrates the written rhythm at the piece's reference speed.
    // This is independent of note-only MIDI practice.
    const playbackTempo = exercise.tempoBpm ?? 60;
    setMessage("");
    setAudioStarting(true);
    try {
      const notes = soundingNotes(exercise, hand);
      const events: MidiEvent[] = notes
        .flatMap((n) => [
          {
            type: "NOTE_ON" as const,
            timestamp: n.beat * 1000,
            pitch: n.pitch,
            velocity: 80,
            channel: n.hand === "right" ? 0 : 1,
          },
          {
            type: "NOTE_OFF" as const,
            timestamp: (n.beat + n.beats) * 1000,
            pitch: n.pitch,
            velocity: 0,
            channel: n.hand === "right" ? 0 : 1,
          },
        ])
        .sort(
          (a, b) =>
            a.timestamp - b.timestamp || (a.type === "NOTE_OFF" ? -1 : 1),
        );
      const player = audio.current;
      if (!player)
        throw new Error("Audio is not ready. Please try Listen again.");
      player.setVolume(volume / 100);
      if (!(await player.play(events, playbackTempo / 60, duration * 1000))) return;
      setListening(true);
      setListenBeat(0);
      timer.current = setInterval(() => {
        const beat = (player.currentTime * playbackTempo) / 60;
        setListenBeat(beat);
        if (player.ended) stopAudio();
      }, 80);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setAudioStarting(false);
    }
  };
  const active = listening
    ? Math.floor(listenBeat / measureBeats)
    : running
      ? Math.floor(
          (groups[Math.min(practiceCursor, groups.length - 1)]?.beat ?? 0) /
            measureBeats,
        )
      : undefined;
  const currentBeat = listening
    ? listenBeat
    : (groups[practiceCursor]?.beat ?? duration);
  const offset = practice ? Math.floor((active ?? 0) / 6) * 6 : 0;
  const broadcastFeedback = useMemo(() => encodeScoreFeedback(exercise, hand, noteFeedback), [exercise, hand, noteFeedback]);
  const overlayError = useOverlayPublisher(
    {
      exerciseNumber: exercise.number,
      title: exercise.title ?? `Exercise ${number}`,
      hand,
      status: running
        ? "practicing"
        : listening
          ? "listening"
          : state.complete
            ? "complete"
            : played.length
              ? "stopped"
              : "ready",
      accuracy: played.length ? state.accuracy : null,
      mistakes: state.mistakes,
      measure: Math.min(exercise.right.length, (active ?? 0) + 1),
      totalMeasures: exercise.right.length,
      score: {
        presentationId: `${exercise.number}:${repeatPass}`,
        activeMeasure: active ?? Math.min(exercise.right.length - 1, Math.floor((groups[Math.min(practiceCursor, groups.length - 1)]?.beat ?? 0) / measureBeats)),
        activeBeat: currentBeat,
        listening, compact: practice, follow: followSettings.enabled,
        size: scoreRenderSize,
        feedback: listening ? [] : broadcastFeedback,
      },
    },
    true,
  );
  const xml = useMemo(
    () => exercise.notationXml ?? musicXml(exercise),
    [exercise],
  );
  const highlighted = listening ? soundingNotes(exercise, hand)
    .filter((n) => n.beat <= currentBeat && n.beat + n.beats > currentBeat)
    .map((n) => n.pitch) : state.pending;
  const hintsDocked = followSettings.stream && followSettings.dockHints && followSettings.bottom >= 15 && showHints && (running || listening);
  const score = (<div data-broadcast-viewport={experience?"recording":undefined} data-broadcast-spacing={experience?"adaptive":undefined} className={`panel sight-score practice-cinematic-region${exercise.collection === 'moonlight' ? ' moonlight-score' : ''}`} style={!experience && followSettings.stream ? { paddingBottom: `${followSettings.bottom}vh` } : undefined}>
        <NotationViewer
          presentationId={`${exercise.number}:${repeatPass}`}
          xml={xml}
          activeMeasure={active}
          activeBeat={currentBeat}
          followOptions={{ enabled: followSettings.enabled,
            topPercent: !experience && followSettings.stream ? followSettings.top : 0,
            bottomPercent: !experience && followSettings.stream ? followSettings.bottom : 0,
            visibleSystems: customScoreSize ? 1 : 2, fitViewport: !!experience }}
          compact={practice}
          consistentScale={schmitt || exercise.collection === 'moonlight'}
          engravingScale={schmitt ? 75 : 50}
          displaySize={customScoreSize ? {zoom:scoreRenderSize.percent/100,fitWidth:scoreRenderSize.mode==='fit-width'} : undefined}
          autoFitSingleSystem
          broadcastFit={!!experience}
          hideTitle
          onDisplayedZoom={setDisplayedScoreZoom}
          noteFeedback={listening ? undefined : noteFeedback}
        />
        <PracticeBattleIntro/>
        <PracticeCinematic exerciseNumber={exercise.number} force={!!experience}/>
      </div>);
  if (experience) return experience.render({score,exercise,running,paused,saving,message,pass:repeatPass,total:repeatTotal,start:startPractice,stop:stopPractice,pause:()=>{const next=!pauseRef.current;pauseRef.current=next;setPaused(next);if(next)gameClient.pause();else gameClient.resume();}});


  return (
    <div className="practice-workspace">
      {overlayError && (
        <p className="obs-sync-error" role="status">
          OBS overlay is reconnecting. You can keep practising.
        </p>
      )}
      {!hideHeading && (
        <header className="practice-header">
          <h1>{practice ? "Practice" : "Sight Read"}</h1>
          <ObsLinks />
          <MidiSetup compact />
        </header>
      )}
      {!practice && <p><strong>Hannah Smith Part 1</strong> · 60 sight-reading exercises</p>}
      {sightReading && progress && <div className="panel practice-collection"><CollectionProgressView title="Hannah Smith Part 1" exercises={library} progress={progress} reviewLabel="Needs review" /></div>}
      {exercise.collection === "moonlight" && <MoonlightPath exercise={selectedExercise as MoonlightLesson} disabled={busy} progress={progress} range={measureRange} onRange={next=>{reset();setMeasureRange(next);}} onSelect={(next)=>{reset();setNumber(next);}} />}
      {exercise.collection === "classical-foundations" && <ClassicalPath exercise={exercise as ClassicalLesson} disabled={busy} progress={progress} onSelect={next=>{reset();setNumber(next);}} />}
      {exercise.collection === "scales" && <section className="panel" aria-label="Scale practice guide">
        <strong>C major · Step {library.indexOf(exercise) + 1} of {library.length}</strong>
        <p>{exercise.learningFocus}</p>
        <p>{exercise.practiceTip}</p>
        <small className="muted">Start with each hand separately, then combine. Follow the finger numbers. MIDI checks notes at your own pace.</small>
      </section>}
      <GamePanel busy={busy} exerciseNumber={exercise.number} />
      <details className="practice-intro">
        <summary>
          About this {practice ? "piece" : "collection"} &amp; original score
        </summary>
        {["beginner-pieces", "classical-foundations", "moonlight", "scales"].includes(exercise.collection ?? "") ? (
          <section className="panel" aria-label="About this piece">
            <span className="badge">{exercise.difficulty}</span>
            <h2>{exercise.title}</h2>
            <p>{exercise.composer}</p>
            <p>{exercise.description}</p>
            <p>
              <strong>Learning focus:</strong> {exercise.learningFocus}
            </p>
            <p>{exercise.practiceTip}</p>
            <small>{exercise.arrangement}</small>
            {exercise.sourceUrl && (
              <p>
                <a href={exercise.sourceUrl} target="_blank" rel="noreferrer">
                  Reference score
                </a>
              </p>
            )}
          </section>
        ) : exercise.collection === "burgmuller-op100" ? (
          <>
            <h2>Burgmüller Op. 100</h2>
            <p>25 Easy and Progressive Studies · Friedrich Burgmüller</p>
            <p>
              Both-hands practice transcription. Repeats and ornaments are
              written out; note lengths follow the study MIDI. The practice
              staves group notes by register, not by hand. Use the original
              score for full hand assignments, articulation and expression.
            </p>
            <p className="fingering-guide">
              <strong>
                Printed fingering is shown on the interactive notes.
              </strong>{" "}
              1 = thumb · 2 = index · 3 = middle · 4 = ring · 5 = little finger.
              LH / RH identifies the left / right hand when it crosses onto the
              other staff.
            </p>
            <a
              href={`/scores/burgmuller-op100.pdf#page=${exercise.sourcePage}`}
              target="_blank"
              rel="noreferrer"
            >
              Original score · study {number - 5000} · PDF page{" "}
              {exercise.sourcePage}
            </a>
          </>
        ) : exercise.collection === "repertoire" || exercise.collection === "bach" ? (
          <>
            <h2>{exercise.title}</h2>
            <p>{[exercise.composer, exercise.arrangement && `Arranged by ${exercise.arrangement}`, exercise.difficulty].filter(Boolean).join(" · ")}</p>
            <p>{exercise.description ?? <>Practise either hand or both at your own pace. Tied notes continue without another key press. The ending follows the printed octave-up marking; the printed ritardando is shown for interpretation. Listen demonstrates the written rhythm.</>}</p>
            <a href={exercise.sourceUrl} target="_blank" rel="noreferrer">Original sheet music</a>
            {number === 7003 && <p><a href="/scores/repertoire/carol-page2.png" target="_blank" rel="noreferrer">Original sheet music · page 2</a></p>}
            {number === 7005 && <p>{[2,3,4].map((image,i)=><span key={image}>{i>0 && ' · '}<a href={`/scores/repertoire/bach-prelude-bwv924-source-${image}.png`} target="_blank" rel="noreferrer">Original sheet music · image {image}</a></span>)}</p>}
          </>
        ) : exercise.collection === "czerny-op481" ? (
          <>
            <h2>Czerny Op. 481 · Selected pieces</h2>
            <p>50 Practice Pieces for Beginners · Carl Czerny</p>
            <p>Original Nos. 1 and 2, checked against the printed score. Repeats are written out. Printed fingerings are included where confidently legible; uncertain digits are omitted. Both staves use the original treble clefs. BPM counts quarter notes.</p>
            <p>1 = thumb · 2 = index · 3 = middle · 4 = ring · 5 = little finger.</p>
            <a href="/scores/czerny-op481.pdf#page=2" target="_blank" rel="noreferrer">Original score · No. {number - 6000} · PDF page 2</a>
          </>
        ) : exercise.collection === "czerny-op599" ? (
          <>
            <h2>Czerny Op. 599</h2>
            <p>100 Practical Exercises for Beginners · Carl Czerny</p>
            <p>
              Choose an exercise and practise either hand or both. This practice
              edition writes out repeats and ornament notes. The original PDF
              includes the printed fingering, phrasing and performance
              directions. BPM counts quarter notes, including in compound time.
            </p>
            <a
              href={`/scores/czerny-op599.pdf#page=${exercise.sourcePage}`}
              target="_blank"
              rel="noreferrer"
            >
              Original score · exercise {number - 3000} · PDF page{" "}
              {exercise.sourcePage}
            </a>
          </>
        ) : schmitt ? (
          <>
            <h2>Schmitt Op. 16</h2>
            <p>213 preparatory exercises · Aloys Schmitt</p>
            <p>
              Play one hand or both. Keep the sustained notes down while the
              other fingers move. Choose the number of practice passes below;
              each completed pass is saved as its own attempt.
            </p>
            <a
              href={`/scores/schmitt-op16.pdf#page=${exercise.sourcePage}`}
              target="_blank"
              rel="noreferrer"
            >
              Original score · exercise {number - 2000} · PDF page{" "}
              {exercise.sourcePage}
            </a>
          </>
        ) : practice ? (
          <>
            <h2>{exercise.title}</h2>
            <p>The Virtuoso-Pianist · Part I · C. L. Hanon</p>
            <p>
              Practise the complete ascending and descending patterns.
              Play at your own pace. One pass ends on the closing half note;
              start again to repeat.
            </p>
          </>
        ) : (
          <>
            <p>
              Hannah Smith Part 1: 60 exercises from your sheet music. Read the grand staff,
              connect your keyboard, and practise one hand or both.
            </p>
            <p>
              Consecutive whole notes; skips of a third, fourth and fifth; half,
              quarter and eighth notes in unison.
            </p>
          </>
        )}
      </details>
      {schmitt&&<SchmittChainBuilder library={library} enabled={chainEnabled} setEnabled={setChainEnabled} choices={chainChoices} setChoices={setChainChoices} disabled={busy}/> }
      <div className="panel practice-controls-panel">
        <div className="row sight-controls">
          <label>
            {exercise.collection === "beginner-pieces" ? "Piece" : "Exercise"}
            <select
              aria-label={
                exercise.collection === "beginner-pieces" ? "Piece" : "Exercise"
              }
              value={measureRange ? exercise.number : number}
              disabled={running || saving || listening}
              onChange={(e) => {
                reset();
                setNumber(Number(e.target.value));
              }}
            >
              {measureRange&&exercise.number!==9033&&<option value={exercise.number}>{exercise.title} · Custom passage</option>}
              {library.map((ex) => (
                <option key={ex.number} value={ex.number}>
                  {ex.title ?? `Exercise ${ex.number}`} · {ex.right.length}{" "}
                  measures{progress ? ` · ${statusLabels[progressState(progress[ex.number])]}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hands
            <select
              aria-label="Hands"
              value={hand}
              disabled={running || saving || listening}
              onChange={(e) => {
                reset();
                setHand(e.target.value as Hand);
              }}
            >
              {!exercise.singleHand && <option value="both">Both hands</option>}
              {!exercise.bothHandsOnly && exercise.singleHand !== "left" && (
                <option value="right">Right hand</option>
              )}
              {!exercise.bothHandsOnly && exercise.singleHand !== "right" && (
                <option value="left">Left hand</option>
              )}
            </select>
          </label>
        </div>
        {sightReading && progress && <p aria-label="Exercise learning status">Status: <strong>{statusLabels[progressState(progress[exercise.number])]}</strong></p>}
        <p className="muted">MIDI practice checks notes only. Play at your own pace.</p>
        {supportsLoops && !chainEnabled && (
          <label className="practice-repeat-control">
            {sightReading ? "Practice loops" : "Practice passes"}
            <input
              aria-label={sightReading ? "Practice loops" : "Practice passes"}
              type="number"
              min={1}
              max={100}
              value={repeatInput}
              disabled={running || saving || listening || audioStarting || resettingStats}
              onChange={(e) => setRepeatInput(e.target.value)}
              onBlur={commitRepeats}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
          </label>
        )}
        {supportsLoops && !chainEnabled && (
          <label className="check practice-continuous">
            <input
              type="checkbox"
              checked={continuous}
              disabled={running || saving || listening || audioStarting || resettingStats}
              onChange={(e) => setContinuous(e.target.checked)}
            />
            Continuous · save after all {sightReading ? "loops" : "passes"}
          </label>
        )}
        <div className="practice-action-bar">
          <div className="row practice-actions">
            <button
              disabled={running || saving || listening || audioStarting || resettingStats}
              data-practice-hotkeys
              aria-keyshortcuts="Enter"
              onClick={startPractice}
            >
              Start MIDI practice
            </button>
            <button
              className="secondary"
              disabled={running || saving || audioStarting || resettingStats}
              onClick={() => (listening ? stopAudio() : void listen())}
            >
              {audioStarting
                ? "Starting audio…"
                : listening
                  ? "Stop listening"
                  : "Listen"}
            </button>
            {running && <button className="secondary" onClick={()=>{const next=!pauseRef.current;pauseRef.current=next;setPaused(next);if(next)gameClient.pause();else gameClient.resume();}}>{paused?'Resume practice':'Pause practice'}</button>}
            {(running || (saving && supportsLoops && repeatTotal > 1)) && (
              <button
                className="secondary"
                data-practice-hotkeys
                aria-keyshortcuts="Space"
                onClick={stopPractice}
              >
                Stop practice
              </button>
            )}
          </div>
          <label className="practice-volume">
            <span>
              Volume <span className="practice-volume-value">{volume}%</span>
            </span>
            <input
              aria-label="Playback volume"
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => {
                const next = Number(e.target.value);
                setVolume(next);
                audio.current?.setVolume(next / 100);
              }}
            />
          </label>
        </div>
        <p className="practice-shortcuts"><small>Shortcuts: Left / Right arrow = previous / next exercise · Enter = start · Space = stop. Available when not editing a control.</small></p>
        <div className="practice-results">
          {supportsLoops && !chainEnabled && (running || saving) && (
            <strong className="practice-pass" role="status">
              {sightReading ? "Loop" : "Pass"} {repeatPass} of {repeatTotal}
            </strong>
          )}
          {(practice || matching.length > 0) && (
            <p className="practice-best">
              Best:{" "}
              <strong>{matching.length ? `${Math.max(...matching.map((a) => a.accuracy))}%` : "\u2014"}</strong> ·{" "}
              {matching.length} completed attempts with{" "}
              {hand === "both" ? "both hands" : `${hand} hand`}.
            </p>
          )}
          {practice && (
            <div className="stream-stats-reset">
              <button type="button" disabled={running || saving || listening || audioStarting || resettingStats}
                onClick={async () => {
                  setResettingStats(true);
                  try {
                    await command({ action: "resetStreamStats" });
                    reset();
                    setAttempts([]);
                    onStreamReset?.();
                    setMessage("Stream stats reset. Saved practice history is kept.");
                  } catch (error) {
                    setMessage(`Could not reset stream stats: ${error instanceof Error ? error.message : "Please try again."}`);
                  } finally { setResettingStats(false); }
                }}>
                {resettingStats ? "Resetting..." : "Reset stream stats"}
              </button>
              <small>Start at 0 attempts across all pieces and hands. Saved history is kept.</small>
            </div>
          )}
          {running && (
            <div className="practice-progress" aria-live="polite">
              <strong>
                {measureRange ? `Measure ${measureRange[0]+(active??0)} · ${(active??0)+1} of ${exercise.right.length} in this passage` : `Measure ${(active??0)+1} of ${exercise.right.length}`}
              </strong>{" "}
              · {state.correct} correct · {state.mistakes} incorrect
              <progress
                aria-label="Exercise progress"
                value={practiceCursor}
                max={groups.length}
              />
            </div>
          )}
        </div>
        {message && <p role="status">{message}</p>}
        {!running &&
          state.complete &&
          message.startsWith("Result not saved") && (
            <button
              disabled={saving}
              onClick={() => {
                setRunning(true);
              }}
            >
              Save result
            </button>
          )}
      </div>
      <details className="score-follow-settings">
        <summary>Score following &amp; OBS safe area</summary>
        <p><a href="/obs/score" target="_blank" rel="noreferrer">Score-only OBS source ↗</a> · Add this URL as an OBS Browser Source to show only the music, independently of scrolling here. Start with 1920 × 700; resize to your score area. Keep this practice page open.</p>
        <div className="row">
          <label className="check"><input type="checkbox" checked={followSettings.enabled}
            onChange={(e) => setFollowSettings((s) => ({ ...s, enabled: e.target.checked }))} />Auto-follow score</label>
          <label className="check"><input type="checkbox" checked={followSettings.stream}
            onChange={(e) => setFollowSettings((s) => ({ ...s, stream: e.target.checked }))} />OBS / stream safe area</label>
          {followSettings.stream && <>
            <label>Banner overlap · % of window<input type="number" min={0} max={35} value={followSettings.top}
              onChange={(e) => setFollowSettings((s) => ({ ...s, top: Math.max(0, Math.min(35, Number(e.target.value))) }))} /></label>
            <label>Bottom camera · % of window<input type="number" min={0} max={35} value={followSettings.bottom}
              onChange={(e) => setFollowSettings((s) => ({ ...s, bottom: Math.max(0, Math.min(35, Number(e.target.value))) }))} /></label>
            <label className="check"><input type="checkbox" checked={followSettings.dockHints}
              disabled={followSettings.bottom < 15}
              onChange={e=>setFollowSettings(s=>({...s,dockHints:e.target.checked}))} />Keep note hints in the bottom camera area</label>
          </>}
        </div>
        <small>Quick system changes follow MIDI practice and Listen. Reserve space only for overlays covering the captured page. Leave banner overlap at 0 when the banner sits above it.</small>
        {followSettings.stream && <small>With Show note hints enabled, the keyboard stays in the reserved bottom area during practice and Listen. Keep your OBS camera above the page source and covering this entire area so viewers cannot see the hints. Reserve at least 15% to enable this layout.</small>}
      </details>
      <ScoreSizeControls size={scoreSize} effectivePercent={displayedScoreZoom} onChange={setScoreSize} />
      <PracticeBattleStatus />
      {score}
      <div className={`panel practice-keyboard-panel${hintsDocked ? ' practice-keyboard-docked' : ''}`}
        aria-label="Player keyboard hints"
        style={hintsDocked ? {height:`calc(${followSettings.bottom}vh - 12px)`} : undefined}>
        <div className="practice-keyboard-heading">
        <label className="check">
          <input
            type="checkbox"
            checked={showHints}
            onChange={(e) => setShowHints(e.target.checked)}
          />
          Show note hints
        </label>
        {(running || listening) && showHints && (
          <p>
            Play:{" "}
            {highlighted.map(noteName).join(" + ")}
          </p>
        )}
        </div>
        <VirtualKeyboard
          compact={hintsDocked}
          low={Math.min(
            ...soundingNotes(
              practice
                ? {
                    ...exercise,
                    right: exercise.right.slice(offset, offset + 6),
                    left: exercise.left.slice(offset, offset + 6),
                  }
                : exercise,
              hand,
            ).map((n) => n.pitch),
          )}
          high={Math.max(
            ...soundingNotes(
              practice
                ? {
                    ...exercise,
                    right: exercise.right.slice(offset, offset + 6),
                    left: exercise.left.slice(offset, offset + 6),
                  }
                : exercise,
              hand,
            ).map((n) => n.pitch),
          )}
          expected={(running || listening) && showHints ? highlighted : []}
        />
      </div>
      {(!practice || schmitt) && (
        <div className="row">
          <button
            className="secondary"
            disabled={selectedIndex === 0 || running || saving || listening}
            data-practice-hotkeys
            aria-keyshortcuts="ArrowLeft"
            onClick={() => moveExercise(-1)}
          >
            Previous exercise
          </button>
          <button
            disabled={
              selectedIndex === library.length - 1 ||
              running ||
              saving ||
              listening
            }
            data-practice-hotkeys
            aria-keyshortcuts="ArrowRight"
            onClick={() => moveExercise(1)}
          >
            Next exercise
          </button>
        </div>
      )}
    </div>
  );
}
