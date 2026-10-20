import { it, expect } from "vitest";
import { previewWav } from "../src/domains/music/preview-audio";
import type { MidiEvent } from "../src/domains/blocks/schema";
const events: MidiEvent[] = [
  { type: "NOTE_ON", pitch: 69, velocity: 90, timestamp: 500, channel: 0 },
  { type: "NOTE_OFF", pitch: 69, velocity: 0, timestamp: 1500, channel: 0 },
];
it("renders valid non-silent PCM, preserves leading rests and follows tempo", () => {
  const wav = new DataView(previewWav(events));
  expect(String.fromCharCode(...new Uint8Array(wav.buffer, 0, 4))).toBe("RIFF");
  expect(wav.getUint32(24, true)).toBe(22050);
  expect(wav.byteLength).toBe(44 + Math.ceil(1.58 * 22050) * 2);
  for (let i = 0; i < 11025; i++)
    expect(wav.getInt16(44 + i * 2, true)).toBe(0);
  expect(Math.abs(wav.getInt16(44 + 11500 * 2, true))).toBeGreaterThan(100);
  expect(previewWav(events, 2).byteLength).toBe(
    44 + Math.ceil(0.83 * 22050) * 2,
  );
  expect(() => previewWav([], 1)).toThrow("no playable notes");
  expect(() => previewWav(events, 0)).toThrow("tempo");
});
