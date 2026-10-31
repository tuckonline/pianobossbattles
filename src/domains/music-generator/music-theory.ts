import type { ScoreNote } from "../../../hosted/sight-library";
export const keys = [
  { major: "C", minor: "A", fifths: 0 }, { major: "G", minor: "E", fifths: 1 },
  { major: "D", minor: "B", fifths: 2 }, { major: "A", minor: "F#", fifths: 3 },
  { major: "E", minor: "C#", fifths: 4 }, { major: "B", minor: "G#", fifths: 5 },
  { major: "Gb", minor: "Eb", fifths: -6 }, { major: "Db", minor: "Bb", fifths: -5 },
  { major: "Ab", minor: "F", fifths: -4 }, { major: "Eb", minor: "C", fifths: -3 },
  { major: "Bb", minor: "G", fifths: -2 }, { major: "F", minor: "D", fifths: -1 },
] as const;
const letters = ["C", "D", "E", "F", "G", "A", "B"] as const;
const naturals = [0, 2, 4, 5, 7, 9, 11];
export const mod = (n: number, d: number) => ((n % d) + d) % d;
export function tonality(key: string, mode: "major" | "minor") {
  const signature = keys.find(k => k[mode] === key);
  if (!signature) throw Error("Choose a supported major or minor key.");
  const letter = letters.indexOf(key[0] as typeof letters[number]);
  const tonic = naturals[letter] + (key.includes("#") ? 1 : key.includes("b") ? -1 : 0);
  const scale = mode === "major" ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
  // Degree is zero-based, with octave encoded in the unbounded diatonic index.
  function note(degree: number, octave: number, raise = 0): ScoreNote {
    const index = mod(degree, 7), cycles = Math.floor(degree / 7);
    const pitch = 12 * (octave + 1) + tonic + scale[index] + cycles * 12 + raise;
    const absoluteLetter = letter + degree;
    const writtenOctave = octave + Math.floor(absoluteLetter / 7);
    const step = letters[mod(absoluteLetter, 7)];
    const natural = 12 * (writtenOctave + 1) + naturals[letters.indexOf(step)];
    return { pitch, beats: 1, tie: false, spelling: { step, alter: pitch - natural, octave: writtenOctave } };
  }
  return { ...signature, tonic: mod(tonic, 12), mode, note };
}
export type Tonality = ReturnType<typeof tonality>;
