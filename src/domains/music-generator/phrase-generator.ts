import { choose } from "./seeded-random";
import type { Harmony } from "./types";
// Four-bar questions ending on V pair with answers ending V-I.
// Each eight-bar period retains the motif; later periods sequence and vary it.
export function phraseHarmony(measures: number, difficulty: number, random: () => number): Harmony[] {
  const endings = Array.from({length:measures/8},(_,i) => difficulty >= 3 && i < measures/8-1
    ? choose(random, ["authentic","imperfect","plagal"] as const) : "authentic" as const);
  return Array.from({ length: measures }, (_, bar) => {
    const position = bar % 4, question = Math.floor(bar / 4) % 2 === 0;
    if (position === 0) return { degree: 0, secondary: false, function: "tonic" };
    if (position === 1) {
      const degree = difficulty === 1 ? 0 : difficulty === 2 ? 3 : choose(random, [1, 3, 5]);
      return { degree, secondary: difficulty >= 4 && degree === 1 && (question || endings[Math.floor(bar/8)] !== "plagal") && random() < .5, function: degree === 0 || degree === 5 ? "tonic" : "predominant" };
    }
    if (position === 2 || question) return !question && endings[Math.floor(bar/8)] === "plagal"
      ? { degree: 3, secondary: false, function: "predominant" }
      : { degree: 4, secondary: false, function: "dominant", ...(position === 3 ? { cadence: "half" as const } : {}) };
    return { degree: 0, secondary: false, function: "tonic", cadence: endings[Math.floor(bar/8)] };
  });
}
