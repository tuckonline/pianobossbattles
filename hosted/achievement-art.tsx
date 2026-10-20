import { useId } from "react";

// Each permanent achievement has its own vector artwork; shared framing keeps
// the set legible at both broadcast-card and collection-thumbnail sizes.
const artwork: Record<string, { color: string; symbol: React.ReactNode }> = {
  first_steps: { color: "#6ee7ca", symbol: <><path d="M27 62V51h15V40h14V29h14v33"/><path d="M30 69h39"/></> },
  finding_my_rhythm: { color: "#79dcff", symbol: <><path d="M34 66l9-39h10l9 39zM30 69h36M48 57l16-27"/><circle cx="48" cy="57" r="3"/></> },
  on_a_roll: { color: "#ffa46c", symbol: <><path d="M49 23c8 14-1 18 7 24l6-9c15 22 4 34-14 34-19 0-27-21-10-35-3 14 6 18 9 12 3-7-2-15 2-26z"/></> },
  century_streak: { color: "#b8a0ff", symbol: <><path d="M25 38l6 31M71 38l-6 31M23 48l8 6M73 48l-8 6"/><text x="48" y="58" textAnchor="middle" fontSize="23" stroke="none" fill="currentColor" fontWeight="800">100</text></> },
  unstoppable: { color: "#ffd279", symbol: <><path d="M53 22L30 51h16l-3 23 24-32H50z"/><path d="M25 30l-5 8M72 62l5-8"/></> },
  precision_player: { color: "#72e0e3", symbol: <><circle cx="46" cy="51" r="20"/><circle cx="46" cy="51" r="10"/><path d="M46 51l23-23M59 28h10v10"/></> },
  flawless_victory: { color: "#efd38e", symbol: <><path d="M27 39l10-12h22l10 12-21 32zM27 39h42M37 27l11 44 11-44M37 27l11 12 11-12"/><path d="M75 23v8M71 27h8M21 64v6M18 67h6"/></> },
  breakthrough: { color: "#8cb5ff", symbol: <><path d="M28 66l15-20 10 8 17-27M57 27h13v13M25 44l7 4-7 8M64 64l7-8-7-3"/></> },
  dedicated_student: { color: "#f2a6ca", symbol: <><rect x="28" y="31" width="40" height="37" rx="4"/><path d="M28 41h40M38 25v12M58 25v12M41 49h14l-9 13"/></> },
  exercise_explorer: { color: "#81d9ab", symbol: <><circle cx="48" cy="48" r="23"/><path d="M59 36l-6 17-17 7 7-17zM48 21v5M48 70v5M21 48h5M70 48h5"/><circle cx="48" cy="48" r="2"/></> },
  level_10_pianist: { color: "#dcc294", symbol: <><path d="M27 37l10 9 11-20 11 20 10-9-5 27H32zM33 70h30"/><circle cx="48" cy="56" r="4"/></> },
};
export function AchievementArt({ id = "level_10_pianist", locked = false }: { id?: string; locked?: boolean }) {
  const gradient = useId().replace(/:/g, "");
  const art = artwork[id] ?? artwork.level_10_pianist;
  return <svg className={`achievement-art ${locked ? "is-locked" : ""}`} viewBox="0 0 96 96" aria-hidden="true" data-art={id}>
    <defs>
      <linearGradient id={gradient} x2="1" y2="1"><stop stopColor={art.color}/><stop offset=".5" stopColor="#fff0c4"/><stop offset="1" stopColor={art.color}/></linearGradient>
      <radialGradient id={`${gradient}bg`}><stop stopColor={art.color} stopOpacity=".24"/><stop offset="1" stopColor="#101d32"/></radialGradient>
    </defs>
    <path d="M48 3L79 15l13 33-13 33-31 12-31-12L4 48l13-33z" fill={`url(#${gradient}bg)`} stroke={`url(#${gradient})`} strokeWidth="2"/>
    <path d="M48 9l27 11 11 28-11 28-27 11-27-11L10 48l11-28z" fill="none" stroke={art.color} strokeOpacity=".35"/>
    <g fill="none" stroke="currentColor" color={art.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">{art.symbol}</g>
    <path d="M17 17l6 1-5 5zM79 79l-6-1 5-5z" fill="#fff4cf"/>
  </svg>;
}
