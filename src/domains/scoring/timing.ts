import type { MidiEvent } from "../blocks/schema";

// Preserve the original Clockwork numbers. Difficulty does not enter this formula.
export function clockworkTiming(bpm: number) {
  const beatMs = 60000 / bpm;
  return {
    rhythmToleranceMs: Math.max(70, Math.min(150, beatMs * 0.2)),
    matchWindowMs: Math.min(beatMs * 0.45, 300),
  };
}

// Only identical packets are duplicates. Never debounce fast real strikes or
// collapse separate chord pitches/channels. Saved receipts remain unchanged.
export function deduplicateMidi(events: MidiEvent[]): MidiEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    const key = JSON.stringify([
      e.type,
      e.timestamp,
      e.channel,
      e.pitch,
      e.velocity,
      e.controller,
      e.value,
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export type TimingWindow = { early: number; late: number };
