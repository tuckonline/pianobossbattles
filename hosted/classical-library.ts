import type { Exercise, ScoreNote } from "./sight-library";
import additions from "./data/classical-additions.json" with { type: "json" };
import bridge from "./data/classical-bridge.json" with { type: "json" };
import depth from "./data/classical-depth.json" with { type: "json" };

// Original miniatures, not transcriptions or works attributed to the named composers.
// Tokens: scientific pitch, quarter-note beats, optional fingering; ~ sustains a tie.
const semitones: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function bars(text: string): ScoreNote[][] {
  return text.split("|").map(bar => bar.trim().split(/\s+/).map(token => {
    const match = /^([A-G])(\d):([\d.]+)(?:@([1-5]))?(~)?$/.exec(token);
    if (!match) throw new Error(`Invalid classical study note: ${token}`);
    return { pitch: (+match[2] + 1) * 12 + semitones[match[1]], beats: +match[3],
      tie: !!match[5], ...(match[4] ? { finger: +match[4] } : {}) };
  }));
}
function study(number: number, title: string, right: string, left: string,
  learningFocus: string, practiceTip: string, description: string, tempoBpm = 60, beatsPerMeasure = 4): Exercise {
  return { number: 8000 + number, title: `${number}. ${title}`, collection: "classical-foundations",
    composer: "PianoPath original study", arrangement: "Original music composed for this beginner collection.",
    difficulty: number <= 2 ? "Start here" : number <= 5 ? "Early beginner" : "Next step",
    description, learningFocus, practiceTip, tempoBpm, beatsPerMeasure, measuresPerSystem: 4,
    right: bars(right), left: bars(left) };
}
const studies: Exercise[] = [
  study(1, "Five-Finger Promenade",
    "C4:1@1 D4:1 E4:1 F4:1|G4:1@5 F4:1 E4:1 D4:1|C4:1 E4:1 D4:1 F4:1|E4:1 D4:1 C4:2|C4:1 D4:1 E4:1 G4:1|F4:1 E4:1 D4:1 C4:1|D4:1 E4:1 F4:1 D4:1|C4:4",
    "C3:1@5 D3:1 E3:1 F3:1|G3:1@1 F3:1 E3:1 D3:1|C3:1 E3:1 D3:1 F3:1|E3:1 D3:1 C3:2|C3:1 D3:1 E3:1 G3:1|F3:1 E3:1 D3:1 C3:1|D3:1 E3:1 F3:1 D3:1|C3:4",
    "Even quarter notes and coordinated hands in C position.",
    "Use RH 1–5 and LH 5–1 on C–G. Keep each finger close to its key and make every note equally gentle.",
    "A compact finger study inspired by Hanon's repeating patterns, shaped into two four-bar phrases."),
  study(2, "The Patient Bass",
    "C4:1@1 E4:1@3 D4:1@2 E4:1|F4:1@4 E4:1 D4:1 E4:1|G4:1@5 F4:1 E4:1 D4:1|C4:4|E4:1 F4:1 G4:1 E4:1|D4:1 E4:1 F4:1 D4:1|E4:1 D4:1 C4:1 D4:1|C4:4",
    "C3:4@5~|C3:4|G3:4@1|C3:4@5|C3:4~|C3:4|G3:4@1|C3:4@5",
    "A moving melody over a sustained bass; reading ties.",
    "Keep the tied bass C held across the barline while your right hand moves. Untied repeated notes need a fresh press.",
    "A Schmitt-inspired independence study with a quiet, sustained left hand."),
  study(3, "A Little Conversation",
    "C4:1@1 E4:1 G4:1 E4:1|F4:1 D4:1 E4:1 C4:1|D4:1 E4:1 F4:1 D4:1|G4:2 E4:2|E4:1 G4:1 F4:1 E4:1|D4:1 F4:1 E4:1 D4:1|C4:1 D4:1 E4:1 D4:1|C4:4",
    "C3:4@5|F3:4@2|G3:4@1|C3:4@5|C3:1 E3:1 G3:1 E3:1|F3:1 D3:1 G3:1 F3:1|E3:1 D3:1 G3:2|C3:4",
    "Recognizing related phrases and following a more active bass answer.",
    "Hear bars 1–4 as a question and bars 5–8 as an answer. Practise the left-hand answer alone before combining hands.",
    "A small Baroque-style dialogue inspired by Bach's clear motifs and independent voices."),
  study(4, "Little Courtyard Minuet",
    "E4:1@3 G4:1 F4:1|E4:1 D4:1 C4:1|D4:1 E4:1 F4:1|G4:2 G4:1|E4:1 G4:1 E4:1|F4:1 D4:1 E4:1|D4:1 E4:1 D4:1|C4:2 C4:1",
    "C3:2@5 G3:1@1|C3:2 E3:1|G3:2 D3:1|G3:2 D3:1|C3:2 E3:1|F3:2@2 C3:1|G3:2 D3:1|C3:2 C3:1",
    "A steady three-beat dance pulse and short phrases.",
    "Count 1–2–3, leaning gently on beat 1. Keep beats 2 and 3 light. Stay in the same five-finger positions.",
    "An original minuet drawing on the balanced dance phrases of the Baroque and Classical eras.", 66, 3),
  study(5, "Evening Song",
    "E4:2@3 G4:2@5|F4:2 E4:2|D4:2 F4:2|E4:4|G4:2 E4:1 F4:1|E4:2 D4:2|D4:2 E4:1 D4:1|C4:4",
    "C3:2@5 E3:2@3|F3:2@2 C3:2|G3:2@1 D3:2@4|C3:2 G3:2|C3:2 E3:2|F3:2 C3:2|G3:2 G3:2|C3:4",
    "Sustained melody, legato touch and a quieter accompaniment.",
    "Let the right hand sing while the left hand stays softer. Give each half note two beats when playing musically; MIDI practice checks pitches at your own pace.",
    "A lyrical miniature inspired by the simple singing character of Romantic teaching pieces.", 60),
  study(6, "Little Clockwork Finale",
    "C4:0.5@1 D4:0.5 E4:0.5 F4:0.5 G4:0.5 F4:0.5 E4:0.5 D4:0.5|C4:1 E4:1 G4:2|F4:0.5 E4:0.5 D4:0.5 C4:0.5 D4:0.5 E4:0.5 F4:0.5 D4:0.5|E4:2 C4:2|E4:0.5 F4:0.5 G4:0.5 E4:0.5 F4:0.5 E4:0.5 D4:0.5 C4:0.5|D4:1 F4:1 G4:2|G4:0.5 F4:0.5 E4:0.5 D4:0.5 E4:0.5 D4:0.5 C4:0.5 D4:0.5|C4:4",
    "C3:4@5|C3:2 G3:2@1|G3:4|C3:4|C3:2 E3:2@3|G3:4|G3:4|C3:4@5",
    "Even eighth notes, rhythmic contrast and a steady bass.",
    "Count 1-and-2-and-3-and-4-and. Each eighth note divides a beat in two. Start with one hand if needed.",
    "A light Classical-style finale combining Hanon-like finger motion with a simple musical cadence.", 60),
  ...(additions as Exercise[]),
  ...(bridge as Exercise[]),
  ...(depth as Exercise[]),
];

// Keep storage IDs stable as the course grows. Course position is presentation
// metadata, never a replacement ID for previous attempts or collection progress.
export const classicalStages = [
  {title:'Five-finger foundations', focus:'Find notes, read steps and skips, and coordinate both hands in one position.',
    checkpoint:'Find C–G without searching, play the simple patterns with relaxed hands, and notice the written rests.', ids:[25,26,27,1,28,8]},
  {title:'Independent hands and phrases', focus:'Hold one hand while the other moves, then exchange roles and shape a phrase.',
    checkpoint:'Keep the quieter hand steady and recognize which hand carries the moving line.', ids:[29,2,30,7,5,3]},
  {title:'Rhythm and first harmonies', focus:'Introduce three-beat bars, two-note chords, and short groups of eighth notes.',
    checkpoint:'Place each chord comfortably and read a pair of eighth notes as one beat, without rushing the next note.', ids:[31,4,32,10,33,6]},
  {title:'Minor colours and accompaniment', focus:'Transfer familiar patterns to A minor; combine bass-and-chord patterns with dotted rhythms.',
    checkpoint:'Play the waltz accompaniment quietly, then connect four-bar phrases in the returning rondo theme.', ids:[11,34,35,36,9,12]},
  {title:'Thumb passages and new keys', focus:'Prepare thumb crossings, then explore one-octave C, G and F major scales.',
    checkpoint:'Use the written crossings with a relaxed hand and identify F-sharp and B-flat before playing.', ids:[37,13,38,14,39,15]},
  {title:'Minor scales and chord shapes', focus:'Compare natural and harmonic minor, mirror a scale, and connect triads, inversions and cadences.',
    checkpoint:'Recognize the raised seventh in harmonic minor and place complete chord shapes before moving on.', ids:[40,16,17,41,18,20]},
  {title:'Broken chords and moving positions', focus:'Build arpeggios and Alberti bass gradually, then apply them in short musical pieces.',
    checkpoint:'Move the whole hand between positions and keep an even, quiet accompaniment below the melody.', ids:[42,19,43,44,21,22]},
  {title:'Early intermediate miniatures', focus:'Follow independent voices, connect contrasting keys, and assemble longer Classical forms.',
    checkpoint:'Learn the short sections, practise their joins, and complete the sonatina and 24-bar rondo with comfortable hands.', ids:[45,23,46,47,24,48]},
] as const;

export type ClassicalLesson = Exercise & {step:number; courseStage:number};
const xmlText = (s:string) => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export const classicalLibrary: ClassicalLesson[] = classicalStages.flatMap((stage,stageIndex) =>
  stage.ids.map((id,index) => {
    const source=studies.find(e=>e.number===8000+id);
    if (!source) throw new Error(`Missing Classical Foundations study ${id}`);
    const step=stageIndex*6+index+1;
    const title=`${step}. ${source.title!.replace(/^\d+\.\s*/, '')}`;
    return {...source, step, courseStage:stageIndex+1, title,
      difficulty:`Stage ${stageIndex+1} · ${stage.title}`,
      notationXml:source.notationXml?.replace(/<work-title>[\s\S]*?<\/work-title>/,`<work-title>${xmlText(title)}</work-title>`)};
  }));
