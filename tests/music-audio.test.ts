import { afterEach, expect, it, vi } from "vitest";
import { AudioEngine } from "../src/domains/music/audio";

function audioFixture(resume: () => Promise<void> = async () => {}) {
  const notes: {
    frequency: { value: number };
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }[] = [];
  const context = {
    currentTime: 0,
    resume,
    close: async () => {},
    destination: {},
    createOscillator: () => {
      const oscillator = {
        frequency: { value: 0 },
        type: "",
        connect: vi.fn((gain) => gain),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      notes.push(oscillator);
      return oscillator;
    },
    createGain: () => ({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
  };
  vi.stubGlobal(
    "AudioContext",
    class {
      constructor() {
        return context;
      }
    },
  );
  return { context, notes };
}
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("aligns accented metronome beats to the performance clock and stops scheduling on pause", async () => {
  vi.useFakeTimers();
  vi.spyOn(performance, "now").mockReturnValue(1000);
  const { context, notes } = audioFixture(),
    engine = new AudioEngine();
  await engine.metronome(60, undefined, { startAtMs: 1100, beatOffset: -4 });
  context.currentTime = 0.05;
  await vi.advanceTimersByTimeAsync(25);
  expect(notes).toHaveLength(1);
  expect(notes[0].start).toHaveBeenCalledWith(0.1);
  expect(notes[0].frequency.value).toBeCloseTo(2093.0045, 3);
  context.currentTime = 1.05;
  await vi.advanceTimersByTimeAsync(25);
  expect(notes).toHaveLength(2);
  expect(notes[1].start).toHaveBeenCalledWith(1.1);
  expect(notes[1].frequency.value).toBeLessThan(notes[0].frequency.value);
  engine.stop();
  context.currentTime = 5;
  await vi.advanceTimersByTimeAsync(1000);
  expect(notes).toHaveLength(2);
  expect(vi.getTimerCount()).toBe(0);
});
it("does not restart sound when audio permission resolves after pause or leaving the exercise", async () => {
  vi.useFakeTimers();
  let release!: () => void;
  const { notes } = audioFixture(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const engine = new AudioEngine(),
    pending = engine.metronome(60);
  engine.stop();
  release();
  await pending;
  expect(notes).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
});
