import type { ClassicalExercise, GeneratorSettings } from "./types";
import { validateExercise } from "./exercise-validator";

export const lessonFocuses = {
  "note-recognition": {
    title: "Recognize notes in your key",
    objective: "Read the written pitches and find their keys before playing.",
    explanation: "A note's position on the staff tells you its letter name; the key signature tells you which notes are sharp or flat. For example, in C major, C–D–E uses three neighboring white keys. Read your own score's key signature first.",
    stages: ["Find and name the notes in a short study before playing.", "Read each new pitch before moving to its key; notice notes that return.", "Use the same note-reading habit through a longer musical question and answer."],
  },
  "steady-pulse": {
    title: "Keep a steady pulse",
    objective: "Keep counting equal beats while notes last for different lengths.",
    explanation: "These studies are in 4/4: count 1–2–3–4 evenly in each bar. A quarter note lasts one beat, a half note two, and a whole note four. For two half notes, play on 1 and 3 while continuing to count all four beats. Timing is a listening goal here, not a measured score.",
    stages: ["Count four even beats per bar with a comfortable, slower study.", "Keep counting through held notes; match each written duration to the beat.", "Carry the same steady count through longer phrases and their cadences."],
  },
} as const;
export type LessonFocus = keyof typeof lessonFocuses;
export function availableLessonFocuses(settings: GeneratorSettings): LessonFocus[] {
  // These existing profiles use integer beat durations in both hands. Do not
  // replace a player's step with a rhythmFocus profile to manufacture a lesson.
  const simple = settings.learningStep
    ? ["novice-1-v1","novice-2-v1","novice-3-v1","beginner-1-v1","beginner-2-v1"].includes(settings.learningStep)
    : settings.curriculumVersion === 2 && settings.difficulty === 1 && !settings.rhythmFocus;
  return simple ? ["steady-pulse","note-recognition"] : ["note-recognition"];
}
export function supportsLesson(exercise: ClassicalExercise, focus: LessonFocus): boolean {
  validateExercise(exercise);
  const melody = exercise[exercise.generated.settings.hands === "left" ? "left" : "right"].flat().filter(n=>!n.rest);
  if(new Set(melody.map(n=>n.pitch)).size < 2)return false;
  if(focus === "steady-pulse")return exercise.beatsPerMeasure === 4 &&
    [...exercise.right,...exercise.left].every(bar=>bar.every(n=>[1,2,4].includes(n.beats) && !n.tie));
  return true;
}
