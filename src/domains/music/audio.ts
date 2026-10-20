import type { MidiEvent } from "../blocks/schema";
import { pairNotes } from "./model";
export class AudioEngine {
  private context: AudioContext | null = null;
  private nodes = new Set<OscillatorNode>();
  private interval: ReturnType<typeof setInterval> | null = null;
  async unlock() {
    this.context ??= new AudioContext();
    await this.context.resume();
    return this.context;
  }
  private tone(
    ctx: AudioContext,
    pitch: number,
    start: number,
    duration: number,
    velocity = 90,
  ) {
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = 440 * 2 ** ((pitch - 69) / 12);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime((velocity / 127) * 0.12, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      start + Math.max(0.03, duration),
    );
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + Math.max(0.04, duration) + 0.02);
    this.nodes.add(oscillator);
    oscillator.onended = () => {
      this.nodes.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  async play(events: MidiEvent[], rate = 1) {
    const ctx = await this.unlock();
    this.stop();
    const origin = ctx.currentTime + 0.05;
    pairNotes(events).forEach((n) =>
      this.tone(
        ctx,
        n.pitch,
        origin + n.onset / 1000 / rate,
        n.duration / 1000 / rate,
        n.velocity,
      ),
    );
  }
  async metronome(bpm: number, count?: number) {
    const ctx = await this.unlock();
    this.stop();
    let next = ctx.currentTime + 0.05,
      beat = 0;
    const schedule = () => {
      while (
        next < ctx.currentTime + 0.1 &&
        (count === undefined || beat < count)
      ) {
        this.tone(ctx, beat % 4 === 0 ? 96 : 89, next, 0.035, 65);
        next += 60 / bpm;
        beat++;
      }
      if (count !== undefined && beat >= count && this.interval) {
        clearInterval(this.interval);
        this.interval = null;
      }
    };
    this.interval = setInterval(schedule, 25);
    schedule();
  }
  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.nodes.forEach((n) => {
      try {
        n.stop();
      } catch {
        /* already ended */
      }
    });
    this.nodes.clear();
  }
  dispose() {
    this.stop();
    void this.context?.close();
    this.context = null;
  }
}
export class MidiPlayback extends AudioEngine {}
