export const difficultyProfiles = [
  { name: "Beginner", span: 7, leap: 5, rhythms: [[1, 1, 2], [2, 1, 1], [1, 1, 1, 1]] },
  { name: "Elementary", span: 9, leap: 7, rhythms: [[1, .5, .5, 1, 1], [.5, .5, 1, 1, 1], [1, 1, 2]] },
  { name: "Intermediate", span: 11, leap: 7, rhythms: [[1.5, .5, 1, 1], [.5, 1, .5, 1, 1], [.5, .5, .5, .5, 1, 1]] },
  { name: "Advanced", span: 13, leap: 9, rhythms: [[.25, .25, .25, .25, .5, .5, 1, 1], [1.5, .5, .5, .5, .5, .5], [.5, .5, 1, .25, .25, .25, .25, 1]] },
  { name: "Expert", span: 14, leap: 12, rhythms: [[.25, .25, .25, .25, .5, .5, .25, .25, .25, .25, 1], [.75, .25, .5, .5, .25, .25, .25, .25, 1], [.5, .5, .25, .25, .25, .25, .5, .5, 1]] },
] as const;

// Musical curriculum presets are independent of MIDI timing forgiveness.
// Keep v1 generator profiles above intact so old seeds still reconstruct.
export const musicalTiers = [
  {name:"Novice",tempo:50,range:[40,60],description:"Fixed five-note position, quarter/half notes and one held bass note per bar."},
  {name:"Beginner",tempo:65,range:[55,75],description:"Short stepwise phrases, introductory eighth notes and simple accompaniment."},
  {name:"Intermediate",tempo:80,range:[70,100],description:"Dotted rhythms, gentle syncopation and two-hand patterns."},
  {name:"Advanced",tempo:105,range:[90,125],description:"Sixteenth-note figures, wider movement and richer harmony."},
  {name:"Maestro",tempo:130,range:[110,160],description:"Denser subdivisions, wider registers and demanding coordination."},
] as const;
export const noviceProfile = {span:2,leap:4,rhythms:[[2,2],[1,1,2],[2,1,1]]} as const;

// Realm lessons choose distinct rhythmic skills within the selected tier.
// The ordinary generator and older realm receipts retain their original profiles.
export function lessonRhythms(
  difficulty: number,
  focus: "pulse" | "continuity" | "precision",
): readonly (readonly number[])[] {
  if (focus === "pulse") return difficulty === 1 ? [[2, 2]] : [[1, 1, 1, 1]];
  if (focus === "precision")
    return difficulty <= 2 ? [[2, 1, 1], [1, 1, 2]] : difficultyProfiles[difficulty - 1].rhythms;
  if (difficulty === 1) return [[1, 1, 1, 1]];
  // Keep subdivisions even here; dotted/offbeat figures belong to Trial 3.
  return difficultyProfiles[difficulty - 1].rhythms.filter(
    (rhythm) => rhythm.every(
      (beats, i) => beats !== 1.5 && beats !== 0.75 &&
        rhythm.slice(0, i).reduce((sum, n) => sum + n, 0) % beats === 0,
    ),
  ).filter((rhythm) => rhythm.some((beats) => beats < 1));
}
