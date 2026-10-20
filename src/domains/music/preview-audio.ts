import type { MidiEvent } from "../blocks/schema";
import { pairNotes } from "./model";

// A self-contained WAV uses the browser's regular media playback path, without
// depending on a live Web Audio context or downloading a soundfont.
export function previewWav(events: MidiEvent[], rate = 1, durationMs = 0): ArrayBuffer {
  if (!Number.isFinite(rate) || rate <= 0)
    throw new Error("Invalid playback tempo.");
  const notes = pairNotes(events).filter(
    (n) => n.duration > 0 && n.velocity > 0,
  );
  if (!notes.length) throw new Error("This score has no playable notes.");
  const sampleRate = 22050;
  const seconds =
    Math.max(durationMs / 1000 / rate, ...notes.map((n) => (n.onset + n.duration) / 1000 / rate)) + 0.08;
  if (seconds > 1800)
    throw new Error("This preview is too long. Choose a faster tempo.");
  const samples = new Float32Array(Math.ceil(seconds * sampleRate));
  for (const n of notes) {
    const start = Math.round((n.onset / 1000 / rate) * sampleRate);
    const duration = n.duration / 1000 / rate;
    const length = Math.ceil(duration * sampleRate);
    const frequency = 440 * 2 ** ((n.pitch - 69) / 12);
    for (let i = 0; i < length && start + i < samples.length; i++) {
      const t = i / sampleRate;
      const envelope =
        Math.min(1, t / 0.006) *
        Math.min(1, (duration - t) / 0.035) *
        (0.25 + 0.75 * Math.exp(-3 * t));
      const phase = 2 * Math.PI * frequency * t;
      samples[start + i] +=
        (((Math.sin(phase) +
          0.25 * Math.sin(2 * phase) +
          0.08 * Math.sin(3 * phase)) *
          envelope *
          n.velocity) /
          127) *
        0.32;
    }
  }
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const wav = new DataView(buffer);
  const text = (offset: number, value: string) =>
    [...value].forEach((c, i) => wav.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  wav.setUint32(4, buffer.byteLength - 8, true);
  text(8, "WAVE");
  text(12, "fmt ");
  wav.setUint32(16, 16, true);
  wav.setUint16(20, 1, true);
  wav.setUint16(22, 1, true);
  wav.setUint32(24, sampleRate, true);
  wav.setUint32(28, sampleRate * 2, true);
  wav.setUint16(32, 2, true);
  wav.setUint16(34, 16, true);
  text(36, "data");
  wav.setUint32(40, samples.length * 2, true);
  samples.forEach((value, i) =>
    wav.setInt16(
      44 + i * 2,
      Math.round(Math.max(-0.95, Math.min(0.95, value)) * 32767),
      true,
    ),
  );
  return buffer;
}

export class PreviewAudio {
  private media = new Audio();
  private url: string | undefined;
  private request = 0;
  get currentTime() {
    return this.media.currentTime;
  }
  get ended() {
    return this.media.ended;
  }
  setVolume(volume: number) {
    this.media.volume = Math.max(0, Math.min(1, volume));
    this.media.muted = false;
  }
  async play(events: MidiEvent[], rate = 1, durationMs = 0) {
    this.stop();
    const request = this.request;
    this.url = URL.createObjectURL(
      new Blob([previewWav(events, rate, durationMs)], { type: "audio/wav" }),
    );
    this.media.src = this.url;
    this.media.muted = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      // Called directly from Listen's click, preserving browser user activation.
      await Promise.race([
        this.media.play(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () =>
              reject(
                new Error(
                  "Audio did not start. Allow sound for this site and try Listen again.",
                ),
              ),
            8000,
          );
        }),
      ]);
      return request === this.request;
    } catch (error) {
      if (request !== this.request) return false;
      this.stop();
      throw new Error(
        `Unable to start audio. Check that this tab allows sound, then try again. ${error instanceof Error ? error.message : ""}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
  stop() {
    this.request++;
    this.media.pause();
    this.media.removeAttribute("src");
    this.media.load();
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = undefined;
  }
  dispose() {
    this.stop();
  }
}
