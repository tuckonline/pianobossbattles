import type { RealmProgress } from "./types";

export type AnimationPreference = "balanced" | "cinematic" | "minimal";
export type RealmAnimation =
  | { type: "realm-enter"; firstVisit: boolean }
  | { type: "trial-enter"; trialId: string; firstVisit: boolean }
  | { type: "trial-complete"; trialId: string; difficulty: number; firstClear: boolean; stars: number; goldEarned: number; accuracy: number; improved: boolean }
  | { type: "trial-failed"; trialId: string };
export type PresentationMetadata = { version: 1; preference: AnimationPreference; seen: string[] };
export const emptyPresentation = (): PresentationMetadata => ({ version: 1, preference: "balanced", seen: [] });
export function readPresentation(raw: string | null): PresentationMetadata {
  try {
    const value = JSON.parse(raw ?? "null");
    if (value?.version !== 1) return emptyPresentation();
    return { version: 1, preference: ["balanced", "cinematic", "minimal"].includes(value.preference) ? value.preference : "balanced",
      seen: Array.isArray(value.seen) ? value.seen.filter((s: unknown) => typeof s === "string" && s.length < 160) : [] };
  } catch { return emptyPresentation(); }
}
export function animationDuration(event: RealmAnimation, preference: AnimationPreference, reduced: boolean) {
  if (reduced || preference === "minimal") return 0;
  // Cinematic deliberately reuses Balanced until richer assets are available.
  switch (event.type) {
    case "realm-enter": return event.firstVisit ? 6500 : 2300;
    case "trial-enter": return event.firstVisit ? 2800 : 0;
    case "trial-complete": return event.firstClear ? 4600 : 2600;
    case "trial-failed": return 1300;
  }
}
export function presentationKey(event: RealmAnimation) {
  switch (event.type) {
    case "realm-enter": return event.firstVisit ? "realm:clockwork-kingdom" : undefined;
    case "trial-enter": return event.firstVisit ? `entry:${event.trialId}` : undefined;
    case "trial-complete": return event.firstClear ? `clear:${event.difficulty}:${event.trialId}` : undefined;
    case "trial-failed": return undefined;
  }
}
// Call only on completion or explicit skip. Never on mount or interruption.
export function completePresentation(metadata: PresentationMetadata, event: RealmAnimation): PresentationMetadata {
  const key = presentationKey(event);
  return !key || metadata.seen.includes(key) ? metadata : { ...metadata, seen: [...metadata.seen, key] };
}
export function clockRestoration(progress: RealmProgress) {
  const trials = ["steady-pulse", "broken-clockwork", "syncopation-trap", "hands-of-time", "perfect-mechanism"];
  return { completedTrials: trials.filter(id => progress.challenges[id]?.completed).length, bossDefeated: progress.bossDefeated };
}
