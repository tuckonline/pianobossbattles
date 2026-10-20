import type { MidiEvent } from "../blocks/schema";
export interface TimeSignature {
  numerator: number;
  denominator: number;
}
export interface KeySignature {
  fifths: number;
  mode: "major" | "minor";
}
export interface ExpectedNote {
  id: string;
  midiPitch: number;
  spelling: string;
  onsetTick: number;
  durationTicks: number;
  measure: number;
  beat: number;
  hand: "LEFT" | "RIGHT" | "BOTH" | "UNSPECIFIED";
  voice: string;
  fingering?: number;
  articulation?: string;
  dynamic?: string;
  chordGroupId?: string;
}
export interface MusicalScore {
  schemaVersion: 1;
  ppq: number;
  meter: TimeSignature;
  key: KeySignature;
  tempoEvents: { tick: number; bpm: number }[];
  measures: { number: number; startTick: number; voices: string[] }[];
  voices: { id: string; name: string }[];
  chordGroups: { id: string; noteIds: string[] }[];
  notes: ExpectedNote[];
  warnings: string[];
}
export interface PlayedNote {
  pitch: number;
  onset: number;
  duration: number;
  velocity: number;
  channel: number;
}
export function pairNotes(events: MidiEvent[]): PlayedNote[] {
  const active = new Map<string, MidiEvent[]>();
  const notes: PlayedNote[] = [];
  for (const e of [...events].sort((a, b) => a.timestamp - b.timestamp)) {
    const key = `${e.channel}:${e.pitch}`;
    if (e.type === "NOTE_ON") {
      const queue = active.get(key) ?? [];
      queue.push(e);
      active.set(key, queue);
    } else if (e.type === "NOTE_OFF") {
      const on = active.get(key)?.shift();
      if (on)
        notes.push({
          pitch: on.pitch!,
          onset: on.timestamp,
          duration: Math.max(0, e.timestamp - on.timestamp),
          velocity: on.velocity!,
          channel: on.channel,
        });
    }
  }
  return notes.sort((a, b) => a.onset - b.onset || a.pitch - b.pitch);
}
export const noteName = (pitch: number) =>
  ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][
    pitch % 12
  ] +
  (Math.floor(pitch / 12) - 1);
export interface Quantizer {
  quantize(tick: number): number;
}
export const exactQuantizer: Quantizer = { quantize: (t) => Math.round(t) };
export function recordingToScore(
  events: MidiEvent[],
  bpm: number,
  meter: TimeSignature = { numerator: 4, denominator: 4 },
  quantizer: Quantizer = exactQuantizer,
): MusicalScore {
  if (bpm <= 0 || meter.numerator <= 0 || meter.denominator <= 0)
    throw new Error("Invalid music timing");
  const ppq = 480,
    ticksPerMs = (ppq * bpm) / 60000,
    measureTicks = ((ppq * 4) / meter.denominator) * meter.numerator;
  const notes = pairNotes(events).map((n, i) => {
    const tick = quantizer.quantize(n.onset * ticksPerMs);
    return {
      id: `note-${i}`,
      midiPitch: n.pitch,
      spelling: noteName(n.pitch),
      onsetTick: tick,
      durationTicks: Math.max(1, quantizer.quantize(n.duration * ticksPerMs)),
      measure: Math.floor(tick / measureTicks) + 1,
      beat: (tick % measureTicks) / ((ppq * 4) / meter.denominator) + 1,
      hand: "UNSPECIFIED" as const,
      voice: `channel-${n.channel}`,
    };
  });
  const voices = [...new Set(notes.map((n) => n.voice))].map((id) => ({
    id,
    name: id,
  }));
  return {
    schemaVersion: 1,
    ppq,
    meter,
    key: { fifths: 0, mode: "major" },
    tempoEvents: [{ tick: 0, bpm }],
    measures: Array.from(
      { length: Math.max(1, ...notes.map((n) => n.measure)) },
      (_, i) => ({
        number: i + 1,
        startTick: i * measureTicks,
        voices: voices.map((v) => v.id),
      }),
    ),
    voices,
    chordGroups: [],
    notes,
    warnings: [
      "MIDI-derived spelling, meter and hand assignment require teacher review.",
    ],
  };
}
