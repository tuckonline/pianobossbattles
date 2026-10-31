import { soundingNotes, noteGroups } from "../../../hosted/sight-library";
import { difficultyProfiles, noviceProfile } from "./difficulty-profiles";
import { mod, tonality } from "./music-theory";
import type { ClassicalExercise } from "./types";
export function validateExercise(ex: ClassicalExercise) {
  const { settings: s, harmony } = ex.generated;
  const key = tonality(s.key, s.mode);
  const fail = (message: string): never => { throw Error(message); };
  if (ex.right.length !== s.measures || ex.left.length !== s.measures || harmony.length !== s.measures ||
      ex.durationBeats !== s.measures * 4 || ex.keySignature?.fifths !== key.fifths) fail("Invalid form or key");
  for (const hand of ["right", "left"] as const) {
    let prior: typeof ex.right[number][number] | undefined;
    for (const measure of ex[hand]) {
      if (measure.reduce((sum, n) => sum + n.beats, 0) !== 4) fail("Measure must contain four beats");
      for (const n of measure) {
        if (![.25, .5, .75, 1, 1.5, 2, 3, 4].includes(n.beats)) fail("Invalid duration");
        if (!Number.isInteger(n.pitch) || n.pitch < 0 || n.pitch > 127) fail("Invalid MIDI pitch");
        if (prior?.tie && (n.rest || prior.pitch !== n.pitch)) fail("Broken tie");
        if (n.rest) { if (n.tie) fail("Tied rest"); }
        else {
          if (!n.spelling) fail("Missing pitch spelling");
          const spell = n.spelling!;
          const natural = ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 })[spell.step];
          if (12 * (spell.octave + 1) + natural + spell.alter !== n.pitch || Math.abs(spell.alter) > 2) fail("Pitch spelling disagreement");
          if (n.pitch < (hand === "right" ? 60 : 36) || n.pitch > (hand === "right" ? 95 : 76)) fail("Unplayable register");
        }
        prior = n;
      }
    }
    if (prior?.tie) fail("Unfinished tie");
  }
  const melodyHand = s.hands === "left" ? "left" : "right";
  const melody = soundingNotes(ex, melodyHand);
  const novice=s.curriculumVersion===2&&s.difficulty===1;
  const leap = novice?noviceProfile.leap:difficultyProfiles[s.difficulty - 1].leap;
  if(novice){
    const base=key.note(0,s.hands==="left"?2:4).pitch,top=key.note(4,s.hands==="left"?2:4).pitch;
    if(melody.some(n=>n.pitch<base||n.pitch>top||n.beats<1)||ex[melodyHand].flat().some(n=>n.tie))fail("Novice melody exceeds five-finger rhythm/position limits");
    if(s.hands==="both"&&ex.left.some(bar=>bar.length!==1||bar[0].beats!==4))fail("Novice accompaniment must be one sustained note per bar");
  }
  for (let i = 1; i < melody.length; i++) if (Math.abs(melody[i].pitch - melody[i - 1].pitch) > leap) fail("Melody exceeds level interval limit");
  for (const [bar, h] of harmony.entries()) {
    if (![0,1,3,4,5].includes(h.degree) || (h.secondary && (h.degree !== 1 || s.difficulty < 4))) fail("Invalid harmony");
    const pitches = (degree: number) => {
      const d = mod(degree,7);
      const raise = h.secondary ? (d === 3 || (s.mode === "minor" && d === 5) ? 1 : 0)
        : s.mode === "minor" && h.degree === 4 && d === 6 ? 1 : 0;
      return mod(key.note(degree,4,raise).pitch,12);
    };
    const chord = [h.degree,h.degree+2,h.degree+4].map(pitches);
    const scale = Array.from({length:7},(_,degree)=>pitches(degree));
    // Ascending melodic minor may raise degree six on a weak beat before V-I.
    if(s.mode==="minor"&&h.degree===4&&s.difficulty>=3)scale.push(key.note(5,4,1).pitch%12);
    for(const n of soundingNotes(ex).filter(n=>Math.floor(n.beat/4)===bar)) {
      if(!scale.includes(n.pitch%12))fail("Pitch outside the planned tonality");
      if(n.hand===melodyHand && n.beat%2===0 && !chord.includes(n.pitch%12))fail("Strong melody beat does not support harmony");
      if(s.hands==="both" && n.hand==="left" && !chord.includes(n.pitch%12))fail("Accompaniment does not support harmony");
    }
  }
  for (let bar = 3; bar < s.measures; bar += 4) {
    const notes = melody.filter(n => Math.floor(n.beat / 4) === bar), ending = notes.at(-1)!;
    const cadence = harmony[bar].cadence;
    const expected = cadence === "half" ? key.note(novice?1:4,4).pitch%12 : cadence === "imperfect" ? key.note(2,4).pitch%12 : key.tonic;
    if (ending.pitch%12 !== expected) fail("Cadence melody does not resolve");
    if (cadence !== "half") {
      const leading = melody.filter(n => n.beat < bar * 4).at(-1)!;
      if (cadence === "authentic" && (novice ? leading.pitch%12!==key.note(1,4).pitch%12 : ending.pitch - leading.pitch !== 1)) fail("Missing cadential resolution");
      if (harmony[bar - 1].degree !== (cadence === "plagal" ? 3 : 4)) fail("Missing cadential harmony");
      if (s.hands === "both" && mod(ex.left[bar][0].pitch - key.tonic, 12) !== 0) fail("Cadence bass is not tonic");
    }
  }
  const groups = noteGroups(ex, s.hands);
  if (!groups.length || groups.some(g => new Set(g.pitches).size !== g.pitches.length)) fail("Ambiguous MIDI unison");
  if (soundingNotes(ex).some(n => n.beat + n.beats > ex.durationBeats!)) fail("Note exceeds exercise");
}
