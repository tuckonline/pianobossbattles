import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { MidiEvent } from "../src/domains/blocks/schema";
import { midiBus } from "../src/domains/midi/engine";
import { goldRules, PracticeActivity, type EconomySnapshot } from "../src/domains/economy/rewards";
import { platformRequest } from "../src/lib/platform-request";

type ActivityListener = (event: MidiEvent | null) => void;
export const PracticeGoldContext = createContext<ActivityListener | undefined>(undefined);

// Observe the existing MIDI bus only while a practice player is running.
// No changes to the grader, playback clock, notation or metronome.
export function usePracticeActivity(enabled: boolean) {
  const record = useContext(PracticeGoldContext);
  useEffect(() => {
    if (!record || !enabled) return;
    const unsubscribe = midiBus.subscribe(event => {
      if (!document.hidden) record(event);
    });
    const hidden = () => { if (document.hidden) record(null); };
    document.addEventListener("visibilitychange", hidden);
    return () => { unsubscribe(); document.removeEventListener("visibilitychange", hidden); record(null); };
  }, [enabled, record]);
}

type Session = { id: string; totalMs: number; savedMs: number; opened: boolean };
export function usePracticeGold(userId: string, accept: (next?: EconomySnapshot) => void, scopeId?: string) {
  const session = useRef<Session | null>(null), meter = useRef(new PracticeActivity());
  const flight = useRef<Promise<void> | null>(null);
  const [error, setError] = useState("");
  const [confirmed,setConfirmed]=useState({activeMs:0,earned:0});
  const key = `pbb:practice-gold:v2:${userId}${scopeId ? `:${scopeId}` : ""}`;
  const persist = useCallback(() => {
    if (!session.current) return;
    try { localStorage.setItem(key, JSON.stringify(session.current)); }
    catch { setError("Practice gold cannot be backed up in this browser. Keep this page open until it saves."); }
  }, [key]);
  const flush = useCallback(() => {
    if (flight.current) return flight.current;
    const current = session.current;
    if (!current || (current.opened && Math.floor(current.totalMs) <= current.savedMs)) return Promise.resolve();
    persist();
    const task = (async () => {
      try {
        const save = async (activeMs: number) => {
          const response = await platformRequest({ action: "practice", expectedUserId: userId, sessionId: current.id, activeMs }, "/api/music-room");
          const data = await response.json();
          if (!response.ok) throw Error(data.error ?? "Practice gold could not save. It will retry.");
          if (session.current === current) accept(data.economy);
          if(session.current === current)setConfirmed({activeMs:data.activeMs,earned:data.totalEarned ?? 0});
          return data as { activeMs: number };
        };
        if (!current.opened) {
          const saved = await save(0);
          current.opened = true;
          current.savedMs = saved.activeMs;
          current.totalMs = Math.max(current.totalMs, saved.activeMs);
        }
        const target = Math.floor(current.totalMs);
        if (target > current.savedMs) current.savedMs = (await save(target)).activeMs;
        if (session.current === current) { setError(""); persist(); }
      } catch (e) {
        if (session.current === current) setError(`Practice gold is waiting to save: ${(e as Error).message}`);
      } finally { flight.current = null; }
    })();
    flight.current = task;
    return task;
  }, [userId, accept, persist]);
  useEffect(() => {
    const activity = meter.current;
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "null") as Session | null;
      session.current = saved && typeof saved.id === "string" && Number.isFinite(saved.totalMs) && saved.totalMs >= 0
        ? { ...saved, opened: false } : { id: scopeId ?? crypto.randomUUID(), totalMs: 0, savedMs: 0, opened: false };
    } catch { session.current = { id: scopeId ?? crypto.randomUUID(), totalMs: 0, savedMs: 0, opened: false }; }
    activity.reset();
    // Restore an unsaved checkpoint; a new empty session opens on the first note.
    if (scopeId || session.current.totalMs > session.current.savedMs) void flush();
    const timer = window.setInterval(() => {
      if (session.current && session.current.totalMs > session.current.savedMs) void flush();
    }, goldRules.saveIntervalMs);
    const online = () => { void flush(); };
    const leaving = () => { activity.reset(); persist(); void flush(); };
    window.addEventListener("online", online);
    window.addEventListener("pagehide", leaving);
    return () => {
      window.clearInterval(timer); window.removeEventListener("online", online); window.removeEventListener("pagehide", leaving);
      persist(); activity.reset(); session.current = null;
    };
  }, [key, flush, persist, scopeId]);
  const record = useCallback<ActivityListener>(event => {
    if (!event) { meter.current.reset(); persist(); void flush(); return; }
    const current = session.current;
    if (!current) return;
    current.totalMs += meter.current.record(event, performance.now());
    if (!current.opened && event.type === "NOTE_ON" && event.velocity) void flush();
  }, [flush, persist]);
  return { record, error, confirmed, flush, pendingMs: Math.max(0,(session.current?.totalMs ?? 0)-(session.current?.savedMs ?? 0)) };
}
