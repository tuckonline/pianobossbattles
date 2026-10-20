"use client";
import { useEffect, useRef, useState } from "react";
import {
  MidiDeviceManager,
  midiBus,
  midiSimulator,
} from "@/domains/midi/engine";
import { noteName } from "@/domains/music/model";
export function MidiSetup({ compact = false, onConnectionChange }: { compact?: boolean; onConnectionChange?: (connected: boolean) => void }) {
  const connectionCallback=useRef(onConnectionChange);connectionCallback.current=onConnectionChange;
  const manager = useRef<MidiDeviceManager | null>(null);
  const [devices, setDevices] = useState<
      { id: string; name: string; state: string }[]
    >([]),
    [selected, setSelected] = useState(""),
    [status, setStatus] = useState(
      "Connect a MIDI keyboard or use the on-screen simulator.",
    ),
    [activity, setActivity] = useState("No input yet");
  useEffect(() => {
    const m = new MidiDeviceManager(midiBus);
    manager.current = m;
    m.onChange = () => {
      setDevices(m.devices);
      setSelected(m.selectedId ?? "");
      setStatus(m.status);
      connectionCallback.current?.(m.devices.some(d=>d.id===m.selectedId&&d.state==="connected"));
    };
    const unsub = midiBus.subscribe((e) =>
      setActivity(
        e.type === "CONTROL_CHANGE"
          ? `Sustain ${(e.value ?? 0) >= 64 ? "on" : "off"}`
          : `${noteName(e.pitch!)} · velocity ${e.velocity} · channel ${e.channel + 1}`,
      ),
    );
    return () => {
      unsub();
      m.dispose();
      manager.current = null;
    };
  }, []);
  const connectionDetails = (
    <>
      <span role="status">{status}</span>
      {devices.length > 0 && (
        <label>
          Input device
          <select
            value={selected}
            onChange={(e) => manager.current?.select(e.target.value)}
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} {d.state === "disconnected" ? "(disconnected)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <small>{activity}</small>
    </>
  );
  if (compact)
    return (
      <div className="midi-compact">
        <button className="secondary midi-connect" onClick={() => void manager.current?.connect()}>
          Connect MIDI Piano
        </button>
        <details className="midi-details">
          <summary>MIDI connection</summary>
          <div className="midi-details-panel">{connectionDetails}</div>
        </details>
      </div>
    );
  return (
    <div className="midi-status">
      <div className="row">
        <strong>MIDI connection</strong>
        <button className="secondary" onClick={() => void manager.current?.connect()}>
          Connect MIDI Piano
        </button>
      </div>
      {connectionDetails}
    </div>
  );
}

export function VirtualKeyboard({
  low = 48,
  high = 72,
  expected = [],
  incorrect = [],
  compact = false,
}: {
  low?: number;
  high?: number;
  expected?: number[];
  incorrect?: number[];
  compact?: boolean;
}) {
  const [active, setActive] = useState<Set<number>>(new Set());
  const pressed = useRef(new Set<number>());
  useEffect(
    () =>
      midiBus.subscribe((e) => {
        if (e.type === "CONTROL_CHANGE") return;
        setActive((old) => {
          const next = new Set(old);
          if (e.type === "NOTE_ON") next.add(e.pitch!);
          else next.delete(e.pitch!);
          return next;
        });
      }),
    [],
  );
  useEffect(() => {
    const held = pressed.current;
    return () => {
      held.forEach((n) => midiSimulator.note(n, false));
      held.clear();
    };
  }, []);
  const press = (pitch: number) => {
    if (!pressed.current.has(pitch)) {
      pressed.current.add(pitch);
      midiSimulator.note(pitch, true);
    }
  };
  const release = (pitch: number) => {
    if (pressed.current.delete(pitch)) midiSimulator.note(pitch, false);
  };
  const isBlack = (pitch: number) => [1, 3, 6, 8, 10].includes(pitch % 12);
  const first = Math.max(21, low - (isBlack(low) ? 1 : 0));
  const last = Math.min(108, high + (isBlack(high) ? 1 : 0));
  const keys = Array.from(
    { length: Math.max(0, last - first + 1) },
    (_, i) => first + i,
  );
  const whites = keys.filter((pitch) => !isBlack(pitch));
  return (
    <div className={`keyboard-simulator${compact ? ' keyboard-simulator-compact' : ''}`}>
      <div className="keyboard" aria-label="MIDI simulator keyboard">
        <div className="keyboard-bed" style={{ minWidth: whites.length * 42 }}>
          {keys.map((pitch) => (
            <button
              key={pitch}
              type="button"
              aria-label={`Play ${noteName(pitch)}`}
              aria-pressed={active.has(pitch)}
              style={{
                left: `${((whites.filter((n) => n < pitch).length - (isBlack(pitch) ? 0.31 : 0)) * 100) / whites.length}%`,
                width: `${((isBlack(pitch) ? 0.62 : 1) * 100) / whites.length}%`,
              }}
              className={`piano-key ${[1, 3, 6, 8, 10].includes(pitch % 12) ? "black" : ""} ${expected.includes(pitch) ? "expected" : ""} ${active.has(pitch) ? "active" : ""} ${incorrect.includes(pitch) ? "incorrect" : ""}`}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                press(pitch);
              }}
              onPointerUp={() => release(pitch)}
              onPointerCancel={() => release(pitch)}
              onLostPointerCapture={() => release(pitch)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  press(pitch);
                }
              }}
              onKeyUp={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  release(pitch);
                }
              }}
              onBlur={() => release(pitch)}
            >
              {noteName(pitch)}
            </button>
          ))}
        </div>
      </div>
      <small className="keyboard-help">
        Simulator: hold a key with your pointer, or focus it and hold Space. No
        physical keyboard required.
      </small>
      <label className="check">
        <input
          type="checkbox"
          onChange={(e) => midiSimulator.sustain(e.target.checked)}
        />
        Simulate sustain pedal
      </label>
    </div>
  );
}
