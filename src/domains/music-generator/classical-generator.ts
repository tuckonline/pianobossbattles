import { motifCandidates, type MusicalMotif, type MotifUse } from "./motif-development";
import { learningStep } from "./learning-steps";
import type { ScoreNote } from "../../../hosted/sight-library";
import { difficultyProfiles, lessonRhythms, noviceProfile } from "./difficulty-profiles";
import { tonality, mod, type Tonality } from "./music-theory";
import { phraseHarmony } from "./phrase-generator";
import { choose, seededRandom } from "./seeded-random";
import type { ClassicalExercise, GeneratorSettings, Harmony } from "./types";
import { validateExercise } from "./exercise-validator";
import { markStartingFingers } from "./starting-fingers";
import { assignPositionFingers, noviceHandPositions, positionFinger } from "./hand-positions";

export function validateSettings(s: GeneratorSettings) {
  if (!Number.isInteger(s.difficulty) || s.difficulty < 1 || s.difficulty > 5 ||
      !Number.isFinite(s.tempoBpm) || s.tempoBpm < 40 || s.tempoBpm > 160 ||
      ![8, 16, 32, 64].includes(s.measures) || !["right", "left", "both"].includes(s.hands) ||
      !["major", "minor"].includes(s.mode) || !Number.isInteger(s.seed) || s.seed < 0 || s.seed > 0xffffffff || (s.curriculumVersion!==undefined&&s.curriculumVersion!==2) ||
      (s.rhythmFocus !== undefined && (s.curriculumVersion !== 2 || !["pulse", "continuity", "precision"].includes(s.rhythmFocus))) ||
      (s.positionVersion !== undefined && (s.positionVersion !== 1 || s.curriculumVersion !== 2)))
    throw Error("Use level 1–5, tempo 40–160, 8/16/32/64 measures, a hand selection and a 32-bit seed.");
  if(s.compositionVersion !== undefined && s.compositionVersion !== 2) throw Error("Unsupported composition version");
  learningStep(s);
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
  const step = learningStep(s);
  const novice=!!step || s.curriculumVersion===2&&s.difficulty===1;
  // Choose the playable hand positions before selecting any notes.
  const positions = novice && s.positionVersion === 1 ? noviceHandPositions(s.key, s.mode, s.hands) : undefined;
  const melodyHand = s.hands === "left" ? "left" : "right";
  const melodyPosition = positions?.[melodyHand];
  const melodyOctave = s.hands === "left" ? positions ? 3 : 2 : 4;
  const profile = step ? {span:step.span,leap:4,rhythms:step.rhythms} : novice ? noviceProfile : difficultyProfiles[s.difficulty - 1];
  const harmony = phraseHarmony(s.measures, step ? 1 : s.difficulty, random);
  const motif = choose(random, [[0, 1, 2, 1], [0, 2, 1, 0], [2, 1, 0, 1], [0, 1, 0, -1]]);
  const rhythms = s.rhythmFocus ? lessonRhythms(s.difficulty, s.rhythmFocus) : profile.rhythms;
  const rhythm = choose<readonly number[]>(random, rhythms);
  const variation = choose<readonly number[]>(random, rhythms);
  const right: ScoreNote[][] = [], left: ScoreNote[][] = [];
  let previous = key.note(2, melodyOctave).pitch;
  let previousLeap = 0;
  let previousBass = key.note(0, 3).pitch;
  const accompaniment = choose(random, [[0, 2, 1, 2], [0, 1, 2, 1], [0, 1, 2, 3]]);
  const development:MotifUse[]=[];
  const direction=s.compositionVersion===2 ? choose(random,[-1,1]) : 1;
  const phraseShape=s.compositionVersion===2 ? choose(random,["arch","descending","question-answer"] as const) : undefined;
  for (let bar = 0; bar < s.measures; bar++) {
    const registerShift=phraseShape==="arch" ? [0,1,2,0][bar%4] : phraseShape==="descending" ? [0,-1,-2,0][bar%4] : [0,0,1,0][bar%4];
    const h = harmony[bar], answer = !!h.cadence && h.cadence !== "half";
    const nextCadence = harmony[bar + 1]?.cadence;
    const beforeAnswer = !!nextCadence && nextCadence !== "half";
    const cadenceApproach = novice ? 1 : nextCadence === "imperfect" ? 1 : nextCadence === "plagal" ? 5 : 6;
    let durations: readonly number[] = answer ? [4] : h.cadence === "half" ? [2, 2] : bar % 4 < 2 ? rhythm : variation;
    if(s.compositionVersion===2 && beforeAnswer)durations=development[Math.floor(bar/8)*8].motif.beats;
    const startPitch=previous,startLeap=previousLeap;
    const realize=(idea?:MusicalMotif)=>{
      previous=startPitch;previousLeap=startLeap;
    const melody: ScoreNote[] = [];
    const degrees:number[]=[];
    let beat = 0;
    for (let i = 0; i < durations.length; i++) {
      const last = i === durations.length - 1;
      const melodicMinor = key.mode === "minor" && s.difficulty >= 3 && nextCadence === "authentic" && i === durations.length - 2 && beat % 2 !== 0;
      // Cadential leading tone resolves by semitone to tonic; V/V's third resolves to V.
      const forced = answer ? novice ? 0 : h.cadence === "imperfect" ? 2 : 7 : last && beforeAnswer ? cadenceApproach : last && h.secondary ? 3
        : last && h.cadence === "half" ? novice ? 1 : 4 : melodicMinor ? 5 : i === 0 && harmony[bar - 1]?.secondary ? 4 : undefined;
      const nextForced = i === durations.length - 2 ? beforeAnswer ? cadenceApproach : h.secondary ? 3 : h.cadence === "half" ? novice ? 1 : 4 : undefined : undefined;
      const octave = melodyOctave;
      const chord = [h.degree, mod(h.degree + 2, 7), mod(h.degree + 4, 7)];
      const legacyTarget = 2 + motif[i % motif.length] + (Math.floor(bar / 8) % 2) * (s.difficulty > 2 ? 2 : 1) + (bar % 4 === 1 ? 1 : 0);
      const anchor=development[Math.floor(bar/8)*8]?.motif;
      const target=s.compositionVersion===2 ? (anchor ? anchor.degrees[i%anchor.degrees.length] + registerShift : Math.min(profile.span,Math.max(0,2+direction*motif[i%motif.length]))) : legacyTarget;
      let candidates = Array.from({ length: profile.span + 1 }, (_, degree) => degree)
        .filter(degree => forced === undefined || degree === forced)
        .filter(degree => forced !== undefined || ((beat % 2 !== 0 || chord.includes(mod(degree, 7))) &&
          // Reserve raised leading tones for the actual V-I resolution.
          !(h.degree === 4 && mod(degree, 7) === 6) && !(h.secondary && mod(degree, 7) === 3)))
        .map(degree => ({ degree, note: melodicMinor ? key.note(degree, octave, 1) : harmonicNote(key, degree, octave, h) }))
        .filter(({ note }) => !melodyPosition || positionFinger(melodyPosition, note.pitch) !== undefined)
        .filter(({ degree, note }) => Math.abs(note.pitch - previous) <= profile.leap &&
          (forced !== undefined || chord.includes(mod(degree, 7)) || Math.abs(note.pitch - previous) <= 2))
        .filter(({ note }) => nextForced === undefined || Math.abs(note.pitch - harmonicNote(key, nextForced, octave, h).pitch) <= profile.leap);
      if(idea) candidates=candidates.filter(c=>c.degree===idea.degrees[i]);
      if (!candidates.length) throw Error("No playable melodic continuation");
      candidates = candidates.sort((a, b) => {
        const cost = (x: typeof a) => Math.abs(x.degree - target) * 1.3 + Math.abs(x.note.pitch - previous) * .6 + (x.note.pitch === previous ? 2.5 : 0)
          + (Math.abs(previousLeap) > 4 && Math.sign(x.note.pitch - previous) === Math.sign(previousLeap) ? 4 : 0);
        return cost(a) - cost(b);
      });
      const picked = candidates[0].note; degrees.push(candidates[0].degree);
      previousLeap = picked.pitch - previous; previous = picked.pitch;
      melody.push({ ...picked, beats: durations[i] }); beat += durations[i];
    }
    return {melody,degrees};
    };
    let realized:ReturnType<typeof realize>|undefined;
    let technique:MotifUse["technique"]=h.cadence?"cadence":beforeAnswer?"prepare":bar===0?"introduce":"fallback";
    const source=bar%16>=8 ? Math.floor(bar/8)*8 : Math.floor(bar/16)*16;
    const sourceIndex=source===bar ? 0 : source;
    let used:MusicalMotif|undefined;
    if(s.compositionVersion===2 && bar>0 && !h.cadence && !beforeAnswer && !h.secondary && !harmony[bar-1]?.secondary) {
      const originalDurations=durations;
      for(const candidate of motifCandidates(development[sourceIndex].motif,bar,h.degree,rhythms,direction,registerShift)) {
        durations=candidate.motif.beats;
        try { realized=realize(candidate.motif);technique=candidate.technique;used=candidate.motif;break; } catch { /* Try the next bounded, harmony-compatible transformation. */ }
      }
      if(!realized)durations=originalDurations;
    }
    realized ??= realize();
    const melody=realized.melody;
    if(used)melody.forEach((n,i)=>{if(used!.rests[i])n.rest=true;});
    // A short breath at selected phrase openings; rests never enter MIDI targets.
    if (s.difficulty >= 3 && bar % 8 === 0 && melody.length > 2) melody[0] = { ...melody[0], rest: true };
    if(s.compositionVersion===2)development.push({bar,source:sourceIndex,technique,motif:{degrees:realized.degrees,beats:[...durations],rests:melody.map(n=>!!n.rest)}});
    const bass: ScoreNote[] = [];
    const bassRhythm = step ? (answer || step.bassAttacks === 1 ? [4] : [2,2]) : answer || novice ? [4] : s.difficulty === 1 ? [2, 2] : s.difficulty === 2 ? [1, 1, 1, 1]
      : s.difficulty === 3 ? Array(8).fill(.5) as number[] : [1, .5, .5, .5, .5, .5, .5];
    const tones = [h.degree, h.degree + 2, h.degree + 4, h.degree + 7];
    bassRhythm.forEach((beats, i) => {
      const degree = step ? (answer ? 0 : step.movingBass && i % 2 ? h.degree === 0 ? 4 : 1 : h.degree) : answer ? 0 : s.difficulty <= 2 ? h.degree + (i % 2 ? 4 : 0) : tones[accompaniment[i % 4]];
      const voicings = (positions?.left ? [3] : [1, 2, 3]).map(octave => harmonicNote(key, degree, octave, h))
        .filter(n => positions?.left ? positionFinger(positions.left, n.pitch) !== undefined : n.pitch >= 36 && n.pitch < 60);
      const voiced = voicings.sort((a,b) => Math.abs(a.pitch-previousBass)-Math.abs(b.pitch-previousBass))[0];
      if (!voiced) throw Error("No bass note fits the selected hand position.");
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
  if (positions) {
    if (positions.right) assignPositionFingers(right, positions.right);
    if (positions.left) assignPositionFingers(left, positions.left);
  } else if (s.positionVersion !== 1) markStartingFingers(right, left);
  return {
    // Never a catalog ID: this mode has local assessment only and makes no reward commands.
    number: 0, title: `${s.key} ${s.mode} · Classical study`, tempoBpm: s.tempoBpm,
    beatsPerMeasure: 4, measuresPerSystem: 4, durationBeats: s.measures * 4,
    keySignature: { fifths: key.fifths, mode: s.mode }, right, left,
    ...(s.positionVersion === 1 ? { handPositions: positions, generatedFingering: positions ? "fixed-position" as const : "omitted" as const } : {}),
    generated: { version: 1, settings: { ...s }, harmony, motif: [...motif], ...(s.compositionVersion===2?{development,phraseShape}:{}) },
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
