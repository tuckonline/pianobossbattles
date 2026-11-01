import { expect, it } from "vitest";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { assignPositionFingers, noviceHandPositions, positionFinger, validateHandPosition, validatePositionFingering } from "../src/domains/music-generator/hand-positions";
import { generateClassicalExercise } from "../src/domains/music-generator/classical-generator";
import { validateExercise } from "../src/domains/music-generator/exercise-validator";
import { markStartingFingers } from "../src/domains/music-generator/starting-fingers";
import { tonality } from "../src/domains/music-generator/music-theory";
import type { GeneratorSettings } from "../src/domains/music-generator/types";
import { assessPractice, musicXml, noteGroups, soundingNotes } from "../hosted/sight-library";
import { importMusicXml } from "../src/domains/notation/musicxml";
import { realmScore, sliceStudy } from "../src/domains/realms/content";
import { referenceEvents, summarize } from "../src/domains/realms/performance";
import { challengeById } from "../src/domains/realms/registry";

const settings: GeneratorSettings = { difficulty: 1, key: "C", mode: "major", tempoBpm: 50,
  measures: 8, hands: "both", seed: 1, curriculumVersion: 2, positionVersion: 1 };

it("maps standard C positions in opposite directions, including repeated notes", () => {
  const positions = noviceHandPositions("C", "major", "both");
  expect(positions.right!.fingerPitches).toEqual({ 1:60, 2:62, 3:64, 4:65, 5:67 });
  expect(positions.left!.fingerPitches).toEqual({ 1:55, 2:53, 3:52, 4:50, 5:48 });
  const c = tonality("C", "major");
  const right = [[0,1,2,2,1,0].map(d => c.note(d,4))], left = [[0,1,2,2,1,0].map(d => c.note(d,3))];
  assignPositionFingers(right, positions.right!); assignPositionFingers(left, positions.left!);
  expect(right.flat().map(n=>n.finger)).toEqual([1,2,3,3,2,1]);
  expect(left.flat().map(n=>n.finger)).toEqual([5,4,3,3,4,5]);
});

it("generates simple, reproducible Novice music inside explicit positions across seeds and supported keys", () => {
  const variants = new Set<string>();
  for (const [key, mode] of [["C","major"],["G","major"],["F","major"],["D","major"],["A","minor"]] as const) {
    for (const hands of ["right","left","both"] as const) for (const seed of [1,2,42]) {
      const ex = generateClassicalExercise({ ...settings, key, mode, hands, seed });
      validateExercise(ex);
      for (const hand of ["right","left"] as const) {
        const notes = soundingNotes(ex,hand);
        for (const n of ex[hand].flat().filter(n=>!n.rest))
          expect(n.finger).toBe(positionFinger(ex.handPositions![hand]!,n.pitch));
        if (hands === "both" && hand === "left") {
          expect(ex.left.every(bar=>bar.length===1&&bar[0].beats===4)).toBe(true);
        } else if (notes.length) {
          expect(new Set(notes.map(n=>n.pitch)).size).toBeLessThanOrEqual(3);
          expect(notes.every(n=>n.beats>=1)).toBe(true);
          expect(notes.slice(1).every((n,i)=>Math.abs(n.pitch-notes[i].pitch)<=4)).toBe(true);
        }
      }
      expect(ex.right.flat().some(n=>n.tie)).toBe(false);
      if(key==="C" && hands==="both") variants.add(JSON.stringify(soundingNotes(ex)));
    }
  }
  expect(variants.size).toBeGreaterThan(1);
  expect(generateClassicalExercise(settings)).toEqual(generateClassicalExercise(settings));
  expect(()=>generateClassicalExercise({...settings,key:"Gb"})).toThrow(/Novice hand positions/);
});

it("rejects bad finger numbers, mismatched pitches, missing positions and unexpected shifts", () => {
  for (const badFinger of [0,6,1.5,2]) {
    const ex = generateClassicalExercise(settings); ex.right[0][0].finger=badFinger;
    expect(()=>validatePositionFingering(ex)).toThrow(/finger/i);
  }
  const shifted = generateClassicalExercise(settings); shifted.left[0][0].pitch=43;
  expect(()=>validatePositionFingering(shifted)).toThrow(/position/);
  const missing = generateClassicalExercise(settings); delete missing.handPositions;
  expect(()=>validateExercise(missing)).toThrow(/position/);
  const position = noviceHandPositions("C","major","right").right!;
  expect(()=>validateHandPosition({...position,fingerPitches:{...position.fingerPitches,2:60}})).toThrow();
});

it("preserves authored markings and marks attacks rather than tied continuations", () => {
  const c = tonality("C","major"), position = noviceHandPositions("C","major","right").right!;
  const authored = [[{...c.note(0,4),finger:4,fingeringSource:"authored" as const}]];
  markStartingFingers(authored,[]); assignPositionFingers(authored,position);
  expect(authored[0][0].finger).toBe(4);
  const untagged = [[{...c.note(0,4),finger:2}]];
  markStartingFingers(untagged,[]); assignPositionFingers(untagged,position);
  expect(untagged[0][0].finger).toBe(2);
  const tied = [[{...c.note(0,4),tie:true},c.note(0,4),c.note(0,4)]];
  assignPositionFingers(tied,position);
  expect(tied.flat().map(n=>n.finger)).toEqual([1,undefined,1]);
});

it("keeps MusicXML finger numbers on the correct pitch and staff without changing MIDI grading", () => {
  const ex = generateClassicalExercise(settings), xml = musicXml(ex);
  expect(XMLValidator.validate(xml)).toBe(true);
  const parsed = new XMLParser({ignoreAttributes:false}).parse(xml);
  const notes = parsed["score-partwise"].part.measure.flatMap((bar: {note: {rest?:unknown;staff:number;notations?:{technical?:{fingering?:{"#text":number;"@_placement":string}}}}[]}) => bar.note).filter((n: {rest?:unknown}) => n.rest === undefined);
  for (const n of notes) expect(n.notations.technical.fingering["@_placement"]).toBe(n.staff===1?"above":"below");
  const imported = importMusicXml(xml);
  expect(imported.notes.every(n=>n.fingering === positionFinger(ex.handPositions![n.midiPitch<60?"left":"right"]!,n.midiPitch))).toBe(true);
  const plain = structuredClone(ex);
  for(const hand of ["right","left"] as const) plain[hand].flat().forEach(n=>{delete n.finger;delete n.fingeringSource;});
  expect(soundingNotes(ex)).toEqual(soundingNotes(plain));
  const played = noteGroups(ex,"both").flatMap(g=>g.pitches);
  expect(assessPractice(ex,"both",played)).toEqual(assessPractice(plain,"both",played));
  const authoredXml = xml.replace('<fingering placement="above">3</fingering>','<fingering placement="above">4</fingering>');
  expect(importMusicXml(authoredXml).notes[0].fingering).toBe(4);
});

it("omits uncertain higher-level fingerings and preserves position guidance in focused practice", () => {
  for(const difficulty of [2,3,4,5]) {
    const ex = generateClassicalExercise({...settings,difficulty});
    expect(ex.generatedFingering).toBe("omitted");
    expect([...ex.left.flat(),...ex.right.flat()].every(n=>n.finger===undefined)).toBe(true);
  }
  const score = realmScore({version:1,challengeId:"hands-of-time",seed:1,key:"C",tempo:50,difficulty:1,curriculumVersion:2,studyVersion:2,positionVersion:1,gradingVersion:2});
  const cut = sliceStudy(score,{start:4,end:8,title:"Practice"},45,"left");
  validatePositionFingering(cut.exercise);
  expect(cut.exercise.left[0][0]).toMatchObject({pitch:48,finger:5});
  expect(summarize(score,referenceEvents(score),challengeById("hands-of-time"),Infinity,2)).toMatchObject({pitch:100,rhythm:100,stars:3});
  const higherBoss = realmScore({version:1,challengeId:"clockwork-king",seed:1,key:"C",tempo:80,difficulty:3,curriculumVersion:2,positionVersion:1});
  expect(higherBoss.exercise.handPositions).toBeUndefined();
});
