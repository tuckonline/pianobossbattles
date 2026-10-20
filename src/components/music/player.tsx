"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MidiEvent, ScoringProfile } from "@/domains/blocks/schema";
import { midiBus, MidiRecorder } from "@/domains/midi/engine";
import { AudioEngine } from "@/domains/music/audio";
import { pairNotes, noteName } from "@/domains/music/model";
import { scorePerformance, type Analysis } from "@/domains/scoring/engine";
import { VirtualKeyboard } from "../midi/setup";
import type { Recording } from "../midi/recorder";
import { command } from "../ui/actions";
export function MusicPlayer({
  recording,
  scoring,
  enrollmentId,
  lessonId,
  blockId,
  demonstration = false,
}: {
  recording: Recording;
  scoring: ScoringProfile;
  enrollmentId?: string;
  lessonId: string;
  blockId: string;
  demonstration?: boolean;
}) {
  const [mode, setMode] = useState<"LEARN" | "PRACTICE" | "PERFORMANCE">(
      "LEARN",
    ),
    [tempo, setTempo] = useState(scoring.targetTempo),
    [running, setRunning] = useState(false),
    [result, setResult] = useState<Analysis | null>(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [cursor, setCursor] = useState(0),
    [incorrect, setIncorrect] = useState<number[]>([]),
    [loop, setLoop] = useState(false),
    [metronome, setMetronome] = useState(false),
    [hand, setHand] = useState("BOTH");
  const recorder = useRef<MidiRecorder | null>(null),
    audio = useRef<AudioEngine | null>(null),
    click = useRef<AudioEngine | null>(null),
    loopTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const notes = useMemo(() => pairNotes(recording.events), [recording.events]);
  useEffect(() => {
    recorder.current = new MidiRecorder(midiBus);
    audio.current = new AudioEngine();
    click.current = new AudioEngine();
    return () => {
      recorder.current?.stop();
      audio.current?.dispose();
      click.current?.dispose();
      if (loopTimer.current) clearInterval(loopTimer.current);
    };
  }, []);
  useEffect(() => {
    if (!running || mode === "PERFORMANCE") return;
    const groups = [...new Set(notes.map((n) => n.onset))].map((onset) =>
      notes.filter((n) => n.onset === onset).map((n) => n.pitch),
    );
    let index = 0;
    const held = new Set<number>();
    return midiBus.subscribe((e) => {
      if (e.type === "NOTE_OFF") {
        held.delete(e.pitch!);
        return;
      }
      if (e.type !== "NOTE_ON") return;
      held.add(e.pitch!);
      if (groups[index]?.includes(e.pitch!)) {
        setIncorrect([]);
        if (groups[index].every((p) => held.has(p))) {
          index++;
          setCursor(index);
        }
      } else setIncorrect([e.pitch!]);
    });
  }, [running, mode, notes]); // stable recording identity
  const end = async () => {
    setRunning(false);
    click.current?.stop();
    const events = recorder.current?.stop() ?? [];
    setSaving(true);
    try {
      if (enrollmentId) {
        const response = await command<{ analysis: Analysis }>({
          action: "perform",
          data: { enrollmentId, lessonId, blockId, mode, tempo, events },
        });
        setResult(response.analysis);
      } else
        setResult(scorePerformance(recording.events, events, scoring, tempo));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const playbackEvents: MidiEvent[] =
    hand === "BOTH"
      ? recording.events
      : recording.events.filter(
          (e) =>
            e.type === "CONTROL_CHANGE" ||
            (hand === "LEFT" ? (e.pitch ?? 60) < 60 : (e.pitch ?? 60) >= 60),
        );
  return (
    <section className="panel">
      <h3>
        {demonstration ? "MIDI demonstration" : "Interactive MIDI exercise"}
      </h3>
      <p>
        {recording.title} · {notes.length} notes
      </p>
      <div className="row">
        <label>
          Mode
          <select
            disabled={running}
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
          >
            <option value="LEARN">Learn — wait for notes</option>
            <option value="PRACTICE">Practice</option>
            <option value="PERFORMANCE">Performance</option>
          </select>
        </label>
        <label>
          Tempo
          <input
            disabled={running}
            type="number"
            min={20}
            max={300}
            value={tempo}
            onChange={(e) => setTempo(Number(e.target.value))}
          />
        </label>
        <label>
          Playback hand
          <select value={hand} onChange={(e) => setHand(e.target.value)}>
            <option value="BOTH">Both</option>
            <option value="LEFT">Lower register (below C4)</option>
            <option value="RIGHT">Upper register</option>
          </select>
        </label>
      </div>
      <div className="row spacer">
        <button
          className="secondary"
          onClick={async () => {
            await audio.current?.play(playbackEvents, tempo / recording.tempo);
            if (loopTimer.current) clearInterval(loopTimer.current);
            if (loop)
              loopTimer.current = setInterval(
                () =>
                  void audio.current?.play(
                    playbackEvents,
                    tempo / recording.tempo,
                  ),
                Math.max(
                  250,
                  (recording.duration * recording.tempo) / tempo + 250,
                ),
              );
          }}
        >
          Listen
        </button>
        <button
          className="quiet"
          onClick={() => {
            audio.current?.stop();
            if (loopTimer.current) clearInterval(loopTimer.current);
          }}
        >
          Stop playback
        </button>
        <label className="check">
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => setLoop(e.target.checked)}
          />
          Loop playback
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={metronome}
            disabled={running}
            onChange={(e) => setMetronome(e.target.checked)}
          />
          Metronome
        </label>
      </div>
      {!demonstration && (
        <>
          <div className="row spacer">
            <button
              disabled={running || saving}
              onClick={() => {
                audio.current?.stop();
                if (loopTimer.current) clearInterval(loopTimer.current);
                setError("");
                setResult(null);
                setCursor(0);
                setIncorrect([]);
                recorder.current?.start();
                setRunning(true);
                if (metronome) void click.current?.metronome(tempo);
              }}
            >
              Start attempt
            </button>
            <button disabled={!running} onClick={() => void end()}>
              Finish attempt
            </button>
          </div>
          <p role="status">
            {saving
              ? "Saving performance…"
              : running
                ? mode === "LEARN"
                  ? `Listening · group ${cursor + 1} · ${notes[cursor] ? `next ${noteName(notes[cursor].pitch)}` : "all notes played"}`
                  : "Recording your performance…"
                : `Passing score: ${scoring.passingScore} · minimum tempo: ${scoring.minimumTempo}`}
          </p>
          <VirtualKeyboard
            expected={
              mode === "LEARN" && running && notes[cursor]
                ? [notes[cursor].pitch]
                : []
            }
            incorrect={incorrect}
          />
          {result && (
            <div className="results" role="status">
              <strong>
                {result.overall}% ·{" "}
                {result.passed ? "Passed" : "Keep practicing"}
              </strong>
              <p>
                {result.missedNotes.length} missed · {result.extraNotes.length}{" "}
                extra · {result.earlyNotes.length} early ·{" "}
                {result.lateNotes.length} late
              </p>
              <small>
                {enrollmentId
                  ? "Performance saved."
                  : "Preview only — no student progress was saved."}
              </small>
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
