import { useEffect, useState } from "react";
import { CinematicVideo } from "./cinematic-video";
export function ClockworkPortrait({ large = false }: { large?: boolean }) {
  return (
    <svg
      className={large ? "clockwork-king large" : "clockwork-king"}
      viewBox="0 0 240 260"
      role="img"
      aria-label="The Clockwork King"
    >
      <circle
        className="king-gear"
        cx="120"
        cy="130"
        r="104"
        fill="none"
        stroke="currentColor"
        strokeWidth="18"
        strokeDasharray="12 10"
      />
      <path
        d="M55 234 70 142 170 142 185 234Z"
        fill="#173d50"
        stroke="#cdb77e"
        strokeWidth="3"
      />
      <path d="m75 62-8-35 33 17 20-30 20 30 33-17-8 35Z" fill="#d9b86d" />
      <path
        d="M78 70h84v60l-42 32-42-32Z"
        fill="#d7c08a"
        stroke="#f5dfa3"
        strokeWidth="3"
      />
      <path d="m88 91 25 7m39-7-25 7" stroke="#0d2738" strokeWidth="9" />
      <circle
        cx="120"
        cy="196"
        r="25"
        fill="#061f30"
        stroke="#d8ba73"
        strokeWidth="4"
      />
      <path
        className="king-hand"
        d="M120 179v17l13 7"
        fill="none"
        stroke="#6ee7df"
        strokeWidth="4"
      />
      <path d="M46 242h148" stroke="#d8ba73" strokeWidth="8" />
    </svg>
  );
}
export function RealmCinematic({
  kind,
  onDone,
  minimal = false,
}: {
  kind: "intro" | "victory" | "defeat";
  onDone: () => void;
  minimal?: boolean;
}) {
  const [reduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    if (minimal) { onDone(); return; }
    if (reduced) return;
    if (kind === "intro") return;
    const timer = setTimeout(onDone, 5000);
    return () => clearTimeout(timer);
  }, [kind, onDone, reduced, minimal]);
  if (minimal) return null;
  if (kind === "intro" && !reduced) return <CinematicVideo src="/cinematics/clockwork-king-intro.mp4"
    heading="THE CLOCKWORK KING" subtitle="THE GRAND TRIAL OF TIME" eyebrow="FINAL ENCOUNTER"
    label="Clockwork King introduction" skipLabel="Skip cinematic" zoom={1} holdEnding={false} onDone={onDone}/>;
  return (
    <section
      className={`realm-cinematic ${kind}`}
      aria-label={
        kind === "intro"
          ? "Clockwork King introduction"
          : kind === "victory"
            ? "Kingdom restored"
            : "The King awaits"
      }
      data-reduced-motion={reduced}
    >
      <div className="cinematic-orbit" />
      <ClockworkPortrait large />
      <span className="realm-eyebrow">
        {kind === "intro"
          ? "THE GRAND TRIAL OF TIME"
          : kind === "victory"
            ? "THE CLOCKS SING AGAIN"
            : "EVERY ATTEMPT IS PRACTICE"}
      </span>
      <h1>
        {kind === "intro"
          ? "The Clockwork King"
          : kind === "victory"
            ? "The kingdom returns to harmony."
            : "The King awaits your return."}
      </h1>
      <p>
        {kind === "intro"
          ? "The throne awakens. Four musical phases will align the great clock."
          : kind === "victory"
            ? "Your steady pulse has restored the heart of the kingdom."
            : "The mechanism needs another adjustment. Your results will show where to begin."}
      </p>
      <button className="primary" onClick={onDone}>
        {reduced ? "Continue" : "Skip cinematic"}
      </button>
    </section>
  );
}
