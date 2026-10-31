import type { ScoreNote } from "../../../hosted/sight-library";
import { difficultyProfiles, noviceProfile } from "./difficulty-profiles";
import { tonality, mod, type Tonality } from "./music-theory";
import { phraseHarmony } from "./phrase-generator";
import { choose, seededRandom } from "./seeded-random";
import type { ClassicalExercise, GeneratorSettings, Harmony } from "./types";
import { validateExercise } from "./exercise-validator";
import { markStartingFingers } from "./starting-fingers";

export function validateSettings(s: GeneratorSettings) {
  if (!Number.isInteger(s.difficulty) || s.difficulty < 1 || s.difficulty > 5 ||
      !Number.isFinite(s.tempoBpm) || s.tempoBpm < 40 || s.tempoBpm > 160 ||
      ![8, 16, 32, 64].includes(s.measures) || !["right", "left", "both"].includes(s.hands) ||
      !["major", "minor"].includes(s.mode) || !Number.isInteger(s.seed) || s.seed < 0 || s.seed > 0xffffffff || (s.curriculumVersion!==undefined&&s.curriculumVersion!==2))
    throw Error("Use level 1–5, tempo 40–160, 8/16/32/64 measures, a hand selection and a 32-bit seed.");
  return tonality(s.key, s.mode);
}
function harmonicNote(key: Tonality, degree: number, octave: number, harmony: Harmony) {
  const d = mod(degree, 7);
  const raised = harmony.secondary ? (d === 3 || (key.mode === "minor" && d === 5) ? 1 : 0)
    : key.mode === "minor" && harmony.degree === 4 && d === 6 ? 1 : 0;
  return key.note(degree, octave, raised);
}
const rest = (): ScoreNote[] => [{ pitch: 0, beats: 4, tie: false, rest: true }];
function compose(s: GeneratorSettings, key: Tonality, retry: number): ClassicalExercise {
  const random = seededRandom((s.seed + retry * 0x9e3779b9) >>> 0);
  const novice=s.curriculumVersion===2&&s.difficulty===1;
  const profile = novice ? noviceProfile : difficultyProfiles[s.difficulty - 1];
  const harmony = phraseHarmony(s.measures, s.difficulty, random);
  const motif = choose(random, [[0, 1, 2, 1], [0, 2, 1, 0], [2, 1, 0, 1], [0, 1, 0, -1]]);
  const rhythm = choose<readonly number[]>(random, profile.rhythms);
  const variation = choose<readonly number[]>(random, profile.rhythms);
  const right: ScoreNote[][] = [], left: ScoreNote[][] = [];
  let previous = key.note(2, s.hands === "left" ? 2 : 4).pitch;
  let previousLeap = 0;
  let previousBass = key.note(0, 3).pitch;
  const accompaniment = choose(random, [[0, 2, 1, 2], [0, 1, 2, 1], [0, 1, 2, 3]]);
  for (let bar = 0; bar < s.measures; bar++) {
    const h = harmony[bar], answer = !!h.cadence && h.cadence !== "half";
    const nextCadence = harmony[bar + 1]?.cadence;
    const beforeAnswer = !!nextCadence && nextCadence !== "half";
    const cadenceApproach = novice ? 1 : nextCadence === "imperfect" ? 1 : nextCadence === "plagal" ? 5 : 6;
    const durations: readonly number[] = answer ? [4] : h.cadence === "half" ? [2, 2] : bar % 4 < 2 ? rhythm : variation;
    const melody: ScoreNote[] = [];
    let beat = 0;
    for (let i = 0; i < durations.length; i++) {
      const last = i === durations.length - 1;
      const melodicMinor = key.mode === "minor" && s.difficulty >= 3 && nextCadence === "authentic" && i === durations.length - 2 && beat % 2 !== 0;
      // Cadential leading tone resolves by semitone to tonic; V/V's third resolves to V.
      const forced = answer ? novice ? 0 : h.cadence === "imperfect" ? 2 : 7 : last && beforeAnswer ? cadenceApproach : last && h.secondary ? 3
        : last && h.cadence === "half" ? novice ? 1 : 4 : melodicMinor ? 5 : i === 0 && harmony[bar - 1]?.secondary ? 4 : undefined;
      const nextForced = i === durations.length - 2 ? beforeAnswer ? cadenceApproach : h.secondary ? 3 : h.cadence === "half" ? novice ? 1 : 4 : undefined : undefined;
      const octave = s.hands === "left" ? 2 : 4;
      const chord = [h.degree, mod(h.degree + 2, 7), mod(h.degree + 4, 7)];
      const target = 2 + motif[i % motif.length] + (Math.floor(bar / 8) % 2) * (s.difficulty > 2 ? 2 : 1) + (bar % 4 === 1 ? 1 : 0);
      let candidates = Array.from({ length: profile.span + 1 }, (_, degree) => degree)
        .filter(degree => forced === undefined || degree === forced)
        .filter(degree => forced !== undefined || ((beat % 2 !== 0 || chord.includes(mod(degree, 7))) &&
          // Reserve raised leading tones for the actual V-I resolution.
          !(h.degree === 4 && mod(degree, 7) === 6) && !(h.secondary && mod(degree, 7) === 3)))
        .map(degree => ({ degree, note: melodicMinor ? key.note(degree, octave, 1) : harmonicNote(key, degree, octave, h) }))
        .filter(({ degree, note }) => Math.abs(note.pitch - previous) <= profile.leap &&
          (forced !== undefined || chord.includes(mod(degree, 7)) || Math.abs(note.pitch - previous) <= 2))
        .filter(({ note }) => nextForced === undefined || Math.abs(note.pitch - harmonicNote(key, nextForced, octave, h).pitch) <= profile.leap);
      if (!candidates.length) throw Error("No playable melodic continuation");
      candidates = candidates.sort((a, b) => {
        const cost = (x: typeof a) => Math.abs(x.degree - target) * 1.3 + Math.abs(x.note.pitch - previous) * .6 + (x.note.pitch === previous ? 2.5 : 0)
          + (Math.abs(previousLeap) > 4 && Math.sign(x.note.pitch - previous) === Math.sign(previousLeap) ? 4 : 0);
        return cost(a) - cost(b);
      });
      const picked = candidates[0].note;
      previousLeap = picked.pitch - previous; previous = picked.pitch;
      melody.push({ ...picked, beats: durations[i] }); beat += durations[i];
    }
    // A short breath at selected phrase openings; rests never enter MIDI targets.
    if (s.difficulty >= 3 && bar % 8 === 0 && melody.length > 2) melody[0] = { ...melody[0], rest: true };
    const bass: ScoreNote[] = [];
    const bassRhythm = answer || novice ? [4] : s.difficulty === 1 ? [2, 2] : s.difficulty === 2 ? [1, 1, 1, 1]
      : s.difficulty === 3 ? Array(8).fill(.5) as number[] : [1, .5, .5, .5, .5, .5, .5];
    const tones = [h.degree, h.degree + 2, h.degree + 4, h.degree + 7];
    bassRhythm.forEach((beats, i) => {
      const degree = answer ? 0 : s.difficulty <= 2 ? h.degree + (i % 2 ? 4 : 0) : tones[accompaniment[i % 4]];
      const voicings = [1, 2, 3].map(octave => harmonicNote(key, degree, octave, h))
        .filter(n => n.pitch >= 36 && n.pitch < 60);
      const voiced = voicings.sort((a,b) => Math.abs(a.pitch-previousBass)-Math.abs(b.pitch-previousBass))[0];
      previousBass = voiced.pitch;
      bass.push({ ...voiced, beats });
    });
    // Split syncopated durations across the beat with an explicit tie, retaining onset identity.
    const tiedMelody = melody.flatMap((n, i) => s.difficulty >= 3 && n.beats === 1 && i > 0 &&
      melody.slice(0, i).reduce((sum, x) => sum + x.beats, 0) % 1 === .5
      ? [{ ...n, beats: .5, tie: true }, { ...n, beats: .5, tie: false }] : [n]);
    right.push(s.hands === "left" ? rest() : tiedMelody);
    left.push(s.hands === "right" ? rest() : s.hands === "left" ? tiedMelody : bass);
  }
  markStartingFingers(right, left);
  return {
    // Never a catalog ID: this mode has local assessment only and makes no reward commands.
    number: 0, title: `${s.key} ${s.mode} · Classical study`, tempoBpm: s.tempoBpm,
    beatsPerMeasure: 4, measuresPerSystem: 4, durationBeats: s.measures * 4,
    keySignature: { fifths: key.fifths, mode: s.mode }, right, left,
    generated: { version: 1, settings: { ...s }, harmony, motif: [...motif] },
  };
}
export function generateClassicalExercise(settings: GeneratorSettings): ClassicalExercise {
  const key = validateSettings(settings);
  let reason = "";
  for (let retry = 0; retry < 12; retry++) {
    try {
      const exercise = compose(settings, key, retry);
      validateExercise(exercise);
      return exercise;
    } catch (error) { reason = (error as Error).message; }
  }
  throw Error(`Could not compose a playable phrase: ${reason}. Try another seed or level.`);
}
