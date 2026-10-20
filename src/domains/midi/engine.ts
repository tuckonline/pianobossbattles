import type { MidiEvent } from "../blocks/schema";
export type Listener = (event: MidiEvent) => void;
export function normalizeMidi(
  data: ArrayLike<number>,
  timestamp: number,
): MidiEvent | null {
  const status = data[0],
    kind = status & 0xf0,
    channel = status & 0x0f;
  if (
    data.length < 3 ||
    !Number.isFinite(timestamp) ||
    timestamp < 0 ||
    data[1] > 127 ||
    data[2] > 127
  )
    return null;
  if (kind === 0x90 || kind === 0x80)
    return {
      type: kind === 0x80 || data[2] === 0 ? "NOTE_OFF" : "NOTE_ON",
      timestamp,
      pitch: data[1],
      velocity: data[2],
      channel,
    };
  if (kind === 0xb0)
    return {
      type: "CONTROL_CHANGE",
      timestamp,
      channel,
      controller: data[1],
      value: data[2],
    };
  return null;
}
export class MidiEventBus {
  private listeners = new Set<Listener>();
  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  emit(e: MidiEvent) {
    this.listeners.forEach((fn) => fn(e));
  }
}
export class MidiDeviceManager {
  private access: MIDIAccess | null = null;
  private selected: string | null = null;
  private attached: MIDIInput | null = null;
  status = "Not connected";
  onChange: () => void = () => {};
  constructor(readonly bus: MidiEventBus) {}
  get devices() {
    return this.access
      ? Array.from(this.access.inputs.values()).map((d) => ({
          id: d.id,
          name: d.name ?? "MIDI keyboard",
          state: d.state,
        }))
      : [];
  }
  get selectedId() {
    return this.selected;
  }
  async connect() {
    if (!navigator.requestMIDIAccess) {
      this.status =
        "Web MIDI is unavailable in this browser. Use Chrome or Edge, or the simulator.";
      this.onChange();
      return;
    }
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this.access.onstatechange = () => {
        this.bind();
        this.onChange();
      };
      this.selected =
        localStorage.getItem("pianopath:midi") ?? this.devices[0]?.id ?? null;
      this.bind();
    } catch {
      this.status =
        "MIDI permission was denied. Allow MIDI access in browser settings and retry.";
    }
    this.onChange();
  }
  select(id: string) {
    this.selected = id;
    localStorage.setItem("pianopath:midi", id);
    this.bind();
    this.onChange();
  }
  private bind() {
    if (this.attached) this.attached.onmidimessage = null;
    this.attached = null;
    const device = this.selected
      ? this.access?.inputs.get(this.selected)
      : null;
    if (device?.state === "connected") {
      this.attached = device;
      device.onmidimessage = (e) => {
        if (!e.data) return;
        const event = normalizeMidi(e.data, e.timeStamp);
        if (event) this.bus.emit(event);
      };
      this.status = `Connected: ${device.name ?? "MIDI keyboard"}`;
    } else
      this.status = this.selected
        ? "Selected keyboard disconnected"
        : "No keyboard found";
  }
  dispose() {
    if (this.attached) this.attached.onmidimessage = null;
    if (this.access) this.access.onstatechange = null;
    this.onChange = () => {};
  }
}
export class MidiRecorder {
  events: MidiEvent[] = [];
  private startTime: number | null = null;
  private unsubscribe: (() => void) | null = null;
  constructor(
    private bus: MidiEventBus,
    private now: () => number = () => performance.now(),
  ) {}
  start() {
    this.unsubscribe?.();
    this.events = [];
    this.startTime = this.now();
    this.unsubscribe = this.bus.subscribe((e) => {
      if (this.startTime === null) return;
      if (this.events.length < 10000)
        this.events.push({
          ...e,
          timestamp: Math.max(0, e.timestamp - this.startTime),
        });
    });
  }
  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.startTime === null) return this.events;
    const end = Math.max(0, this.now() - this.startTime);
    const held = new Map<string, MidiEvent>();
    const pedals = new Set<number>();
    for (const e of this.events) {
      const key = `${e.channel}:${e.pitch}`;
      if (e.type === "NOTE_ON") held.set(key, e);
      if (e.type === "NOTE_OFF") held.delete(key);
      if (e.type === "CONTROL_CHANGE" && e.controller === 64) {
        if ((e.value ?? 0) >= 64) pedals.add(e.channel);
        else pedals.delete(e.channel);
      }
    }
    for (const e of held.values())
      this.events.push({ ...e, type: "NOTE_OFF", velocity: 0, timestamp: end });
    for (const channel of pedals)
      this.events.push({
        type: "CONTROL_CHANGE",
        channel,
        controller: 64,
        value: 0,
        timestamp: end,
      });
    this.startTime = null;
    return [...this.events].sort((a, b) => a.timestamp - b.timestamp);
  }
  clear() {
    this.stop();
    this.events = [];
  }
}
export function trimRecording(events: MidiEvent[], start: number, end: number) {
  if (start < 0 || end <= start) throw new Error("Invalid trim range");
  const held = new Map<string, MidiEvent>();
  const controls = new Map<string, MidiEvent>();
  for (const e of events.filter((e) => e.timestamp < start)) {
    const k = `${e.channel}:${e.pitch}`;
    if (e.type === "NOTE_ON") held.set(k, e);
    if (e.type === "NOTE_OFF") held.delete(k);
    if (e.type === "CONTROL_CHANGE")
      controls.set(`${e.channel}:${e.controller}`, e);
  }
  const trimmed = [...held.values(), ...controls.values()].map((e) => ({
    ...e,
    timestamp: 0,
  }));
  trimmed.push(
    ...events
      .filter((e) => e.timestamp >= start && e.timestamp <= end)
      .map((e) => ({ ...e, timestamp: e.timestamp - start })),
  );
  const bus = new MidiEventBus();
  let time = 0;
  const r = new MidiRecorder(bus, () => time);
  r.start();
  trimmed.forEach((e) => bus.emit(e));
  time = end - start;
  return r.stop();
}
export class MidiSimulator {
  constructor(
    private bus: MidiEventBus,
    private now: () => number = () => performance.now(),
  ) {}
  note(pitch: number, pressed: boolean, velocity = 90, channel = 0) {
    this.bus.emit({
      type: pressed ? "NOTE_ON" : "NOTE_OFF",
      pitch,
      velocity: pressed ? velocity : 0,
      channel,
      timestamp: this.now(),
    });
  }
  sustain(down: boolean, channel = 0) {
    this.bus.emit({
      type: "CONTROL_CHANGE",
      controller: 64,
      value: down ? 127 : 0,
      channel,
      timestamp: this.now(),
    });
  }
  sequence(
    notes: {
      pitch: number;
      onset: number;
      duration: number;
      velocity?: number;
      channel?: number;
    }[],
  ) {
    const start = this.now();
    return notes
      .flatMap((n) => [
        {
          type: "NOTE_ON" as const,
          pitch: n.pitch,
          velocity: n.velocity ?? 90,
          channel: n.channel ?? 0,
          timestamp: start + n.onset,
        },
        {
          type: "NOTE_OFF" as const,
          pitch: n.pitch,
          velocity: 0,
          channel: n.channel ?? 0,
          timestamp: start + n.onset + n.duration,
        },
      ])
      .sort((a, b) => a.timestamp - b.timestamp);
  }
}
export const midiBus = new MidiEventBus();
export const midiSimulator = new MidiSimulator(midiBus);
