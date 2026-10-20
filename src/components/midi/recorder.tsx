"use client";
import { useEffect, useRef, useState } from "react";
import { midiBus, MidiRecorder, trimRecording } from "@/domains/midi/engine";
import { AudioEngine } from "@/domains/music/audio";
import { pairNotes, noteName } from "@/domains/music/model";
import type { MidiEvent } from "@/domains/blocks/schema";
import { command } from "../ui/actions";
import { VirtualKeyboard } from "./setup";
export interface Recording {
  id: string;
  title: string;
  events: MidiEvent[];
  tempo: number;
  duration: number;
}
export function TeacherRecorder({
  onSaved,
}: {
  onSaved: (recording: Recording) => void;
}) {
  const recorder = useRef<MidiRecorder | null>(null),
    audio = useRef<AudioEngine | null>(null);
  const [recording, setRecording] = useState(false),
    [events, setEvents] = useState<MidiEvent[]>([]),
    [tempo, setTempo] = useState(80),
    [title, setTitle] = useState("Untitled MIDI recording"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [trimStart, setTrimStart] = useState(0),
    [trimEnd, setTrimEnd] = useState(0);
  useEffect(() => {
    recorder.current = new MidiRecorder(midiBus);
    audio.current = new AudioEngine();
    return () => {
      recorder.current?.stop();
      audio.current?.dispose();
    };
  }, []);
  const notes = pairNotes(events);
  return (
    <section className="panel">
      <h3>Record from your keyboard</h3>
      <div className="row">
        <label>
          Recording title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </label>
        <label>
          Recorded tempo
          <input
            type="number"
            min={20}
            max={300}
            value={tempo}
            onChange={(e) => setTempo(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="row spacer">
        <button
          disabled={recording}
          onClick={() => {
            setEvents([]);
            recorder.current?.start();
            setRecording(true);
            setError("");
          }}
        >
          {events.length ? "Re-record" : "Record"}
        </button>
        <button
          className="secondary"
          disabled={!recording}
          onClick={() => {
            const captured = recorder.current?.stop() ?? [];
            setEvents(captured);
            setTrimStart(0);
            setTrimEnd(Math.max(0, ...captured.map((e) => e.timestamp)));
            setRecording(false);
          }}
        >
          Stop recording
        </button>
        <button
          className="secondary"
          disabled={!events.length || recording}
          onClick={() => void audio.current?.play(events)}
        >
          Replay recording
        </button>
        <button
          className="quiet"
          disabled={recording}
          onClick={() => {
            recorder.current?.clear();
            setEvents([]);
          }}
        >
          Clear recording
        </button>
      </div>
      <p role="status">
        {recording
          ? "Recording… play notes, then stop."
          : `${notes.length} captured notes · ${events.filter((e) => e.type === "CONTROL_CHANGE").length} controller events`}
      </p>
      <VirtualKeyboard />
      {notes.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Note</th>
                  <th>Onset (ms)</th>
                  <th>Duration (ms)</th>
                  <th>Velocity</th>
                </tr>
              </thead>
              <tbody>
                {notes.slice(0, 40).map((n, i) => (
                  <tr key={i}>
                    <td>{noteName(n.pitch)}</td>
                    <td>{Math.round(n.onset)}</td>
                    <td>{Math.round(n.duration)}</td>
                    <td>{n.velocity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row">
            <label>
              Trim start (ms)
              <input
                type="number"
                min={0}
                value={trimStart}
                onChange={(e) => setTrimStart(Number(e.target.value))}
              />
            </label>
            <label>
              Trim end (ms)
              <input
                type="number"
                min={0}
                value={trimEnd}
                onChange={(e) => setTrimEnd(Number(e.target.value))}
              />
            </label>
            <button
              className="secondary"
              onClick={() => {
                try {
                  const trimmed = trimRecording(events, trimStart, trimEnd);
                  setEvents(trimmed);
                  setTrimStart(0);
                  setTrimEnd(trimEnd - trimStart);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Apply trim
            </button>
          </div>
          <button
            className="spacer"
            disabled={busy || recording}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const result = await command<Recording>({
                  action: "record",
                  data: { title, tempo, events },
                });
                onSaved(result);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Save recording to block"}
          </button>
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
