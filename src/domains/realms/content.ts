import type { Exercise } from "../../../hosted/sight-library";
import { generateClassicalExercise } from "../music-generator/classical-generator";
import { markStartingFingers } from "../music-generator/starting-fingers";
import type { GeneratorSettings } from "../music-generator/types";
import { assignPositionFingers } from "../music-generator/hand-positions";
import { challengeById } from "./registry";
import type { RealmScore, RunConfig, Section } from "./types";
function study(
  config: RunConfig,
  level: number,
  measures: number,
  hands: "right" | "both",
  varied: boolean,
  rhythmFocus?: GeneratorSettings["rhythmFocus"],
): Exercise {
  // Select reproducibly from the existing composer, requiring the actual written
  // vocabulary for the lesson instead of trusting a difficulty label.
  for (let n = 0; n < 96; n++) {
    const ex = generateClassicalExercise({
      difficulty: level,
      key: config.key,
      mode: "major",
      tempoBpm: config.tempo,
      measures,
      hands,
      seed: (config.seed + n) >>> 0,
      ...(config.curriculumVersion === 2 ? { curriculumVersion: 2 } : {}),
      ...(rhythmFocus ? { rhythmFocus } : {}),
      ...(config.positionVersion === 1 ? { positionVersion: 1 } : {}),
    });
    if (
      !varied ||
      (ex.right.flat().some((n) => n.beats === 1.5 || n.beats === 0.75) &&
        (level !== 3 || ex.right.flat().some((n) => n.tie)))
    )
      return ex;
  }
  throw Error("Could not prepare this rhythm study. Choose another variation.");
}
export function realmScore(config: RunConfig): RealmScore {
  const c = challengeById(config.challengeId);
  const tier = config.curriculumVersion === 2 ? config.difficulty : undefined;
  if (
    config.curriculumVersion === 2 &&
    (!Number.isInteger(tier) || tier! < 1 || tier! > 5)
  )
    throw Error("Choose a musical difficulty from 1 to 5.");
  if (config.studyVersion === 2 && config.curriculumVersion !== 2)
    throw Error("Trial studies require a musical difficulty.");
  const rhythmFocus = config.studyVersion === 2
    ? c.kind === "tempo" ? "pulse" : c.kind === "streak" ? "continuity" : c.kind === "precision" ? "precision" : undefined
    : undefined;
  let exercise: Exercise;
  const phases: Section[] = [];
  if (c.kind === "boss") {
    const titles = [
      "The Awakening",
      "The Acceleration",
      "The Broken Pendulum",
      "The Final Alignment",
    ];
    const studies = titles.map((title, i) => {
      phases.push({ start: i * 8, end: (i + 1) * 8, title });
      return study(
        { ...config, seed: (config.seed + i * 101) >>> 0 },
        tier !== undefined
          ? Math.max(1, tier - (i === 0 ? 2 : i === 1 ? 1 : 0))
          : i === 0
            ? 1
            : 3,
        8,
        "both",
        tier !== undefined
          ? Math.max(1, tier - (i === 0 ? 2 : i === 1 ? 1 : 0)) >= 3
          : i > 0,
      );
    });
    exercise = {
      ...studies[0],
      title: "The Grand Trial of Time",
      right: studies.flatMap((e) => e.right),
      left: studies.flatMap((e) => e.left),
      durationBeats: 128,
      ...(config.positionVersion === 1 && tier !== 1 ? { handPositions: undefined, generatedFingering: "omitted" as const } : {}),
    };
  } else
    exercise = study(
      config,
      tier ?? c.level,
      c.measures,
      c.hands,
      (tier ?? c.level) >= 3 && (!rhythmFocus || rhythmFocus === "precision"),
      rhythmFocus,
    );
  exercise = { ...exercise, title: c.title };
  const phrases = Array.from({ length: c.measures / 4 }, (_, i) => ({
    start: i * 4,
    end: (i + 1) * 4,
    title: `Phrase ${i + 1}`,
  }));
  return { exercise, phrases, phases };
}
export function sliceStudy(
  score: RealmScore,
  section: Section,
  tempo: number,
  hand?: "right" | "left",
): RealmScore {
  const rest = () => [{ pitch: 0, beats: 4, tie: false, rest: true }];
  const exercise = {
    ...score.exercise,
    title: `Practice measures ${section.start + 1}–${section.end}`,
    tempoBpm: tempo,
    right: structuredClone(
      score.exercise.right.slice(section.start, section.end),
    ),
    left: structuredClone(
      score.exercise.left.slice(section.start, section.end),
    ),
    durationBeats: (section.end - section.start) * 4,
  };
  if (hand === "left") exercise.right = exercise.right.map(rest);
  if (hand === "right") exercise.left = exercise.left.map(rest);
  for (const h of ["right", "left"] as const) {
    const last = exercise[h].at(-1)?.at(-1);
    if (last) last.tie = false;
    if (exercise.generatedFingering === "fixed-position" && exercise.handPositions?.[h])
      assignPositionFingers(exercise[h], exercise.handPositions[h]!);
  }
  if (!exercise.generatedFingering) markStartingFingers(exercise.right, exercise.left);
  return {
    exercise,
    phrases: [
      { start: 0, end: section.end - section.start, title: exercise.title },
    ],
    phases: [],
  };
}
