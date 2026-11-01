import { useCallback, useEffect, useRef, useState } from "react";

export function CinematicVideo({ src, onDone, heading = "THE CLOCKWORK KINGDOM", subtitle = "Rhythm & Coordination", eyebrow = "CHAPTER I", label = "Realm cinematic", skipLabel = "Skip animation", zoom = 1.15, holdEnding = true }: {
  src: string; onDone: () => void; heading?: string; subtitle?: string; eyebrow?: string;
  label?: string; skipLabel?: string; zoom?: number; holdEnding?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null), skip = useRef<HTMLButtonElement>(null), completed = useRef(false), callback = useRef(onDone);
  const [title, setTitle] = useState(false);
  const [fading, setFading] = useState(false);
  const ending = useRef(false), holdTimer = useRef<number | undefined>(undefined), fadeTimer = useRef<number | undefined>(undefined);
  callback.current = onDone;
  const finish = useCallback(() => { if (!completed.current) { completed.current = true; video.current?.pause(); callback.current(); } }, []);
  const endPlayback = useCallback(() => {
    if (ending.current || completed.current) return;
    if (!holdEnding) { finish(); return; }
    ending.current = true;
    setTitle(true);
    const duration = video.current?.duration;
    const remaining = Math.max(650, 7500 - (duration && Number.isFinite(duration) ? duration * 1000 : 6042));
    holdTimer.current = window.setTimeout(() => {
      setFading(true);
      fadeTimer.current = window.setTimeout(finish, 650);
    }, remaining - 650);
  }, [finish, holdEnding]);
  useEffect(() => {
    const player = video.current!;
    skip.current?.focus();
    // Watch only stalled/loading playback; normal completion follows the media clock.
    let last = -1, stalled = 0;
    const watchdog = window.setInterval(() => {
      stalled = player.currentTime === last ? stalled + 1 : 0;
      last = player.currentTime;
      if (!ending.current && stalled >= 10) finish();
    }, 1000);
    void player.play().catch(finish);
    return () => { clearInterval(watchdog); clearTimeout(holdTimer.current); clearTimeout(fadeTimer.current); player.pause(); player.removeAttribute("src"); player.load(); };
  }, [finish]);
  return <section className="realm-video" data-fading={fading} role="region" aria-label={label}>
    <div className="realm-video-frame"><video ref={video} src={src} style={{transform:`scale(${zoom})`}} muted playsInline preload="auto" onEnded={endPlayback} onError={finish}
      onTimeUpdate={e => { const v = e.currentTarget; if (Number.isFinite(v.duration) && v.currentTime >= Math.max(v.duration * .65, v.duration - 3)) setTitle(true); }}/></div>
    <button ref={skip} className="realm-video-skip" onClick={finish}>{skipLabel}</button>
    {title && <div className="realm-video-title"><span>{eyebrow}</span><h1>{heading}</h1><p>{subtitle}</p></div>}
  </section>;
}
