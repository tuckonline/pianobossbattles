import { describe, expect, it } from "vitest";
import { generateClassicalExercise } from "../src/domains/music-generator/classical-generator";
import { validateExercise } from "../src/domains/music-generator/exercise-validator";
import { keys, tonality } from "../src/domains/music-generator/music-theory";
import { assessPractice, musicXml, soundingNotes, noteGroups } from "../hosted/sight-library";
import { importMusicXml } from "../src/domains/notation/musicxml";
import type { GeneratorSettings } from "../src/domains/music-generator/types";
import { startingFinger } from "../src/domains/music-generator/starting-fingers";
import { musicalTiers } from "../src/domains/music-generator/difficulty-profiles";

const settings: GeneratorSettings = { difficulty: 3, key: "C", mode: "major", tempoBpm: 80, measures: 16, hands: "both", seed: 12345 };
describe("Classical composition", () => {
  it("keeps Novice in five-note positions with simple rhythms and sustained bass",()=>{
    for(const [key,mode] of [["C","major"],["F","major"],["A","minor"]] as const)for(const hands of ["right","left","both"] as const)for(let seed=0;seed<3;seed++){
      const ex=generateClassicalExercise({...settings,key,mode,hands,seed,difficulty:1,curriculumVersion:2,tempoBpm:50});
      validateExercise(ex);
      const melody=soundingNotes(ex,hands==="left"?"left":"right");
      expect(Math.max(...melody.map(n=>n.pitch))-Math.min(...melody.map(n=>n.pitch))).toBeLessThanOrEqual(7);
      expect(melody.every(n=>n.beats>=1)).toBe(true);
      expect(melody.slice(1).every((n,i)=>Math.abs(n.pitch-melody[i].pitch)<=4)).toBe(true);
      if(hands==="both")expect(ex.left.every(bar=>bar.length===1&&bar[0].beats===4)).toBe(true);
      expect(()=>importMusicXml(musicXml(ex))).not.toThrow();
    }
  });
  it("provides five tempo presets and meaningfully different Novice and Maestro music",()=>{
    expect(musicalTiers.map(t=>[t.name,t.tempo])).toEqual([["Novice",50],["Beginner",65],["Intermediate",80],["Advanced",105],["Maestro",130]]);
    const generated=musicalTiers.map((tier,i)=>generateClassicalExercise({...settings,curriculumVersion:2,difficulty:i+1,tempoBpm:tier.tempo}));
    expect(generated.map(e=>e.tempoBpm)).toEqual([50,65,80,105,130]);
    expect(soundingNotes(generated[4]).length).toBeGreaterThan(soundingNotes(generated[0]).length*2);
    expect(generated[4].right.flat().some(n=>n.beats===.25)).toBe(true);
    expect(generated[0].right.flat().every(n=>n.beats>=1&&!n.tie)).toBe(true);
  });
  it("is reproducible and varies musical content across seeds", () => {
    expect(generateClassicalExercise(settings)).toEqual(generateClassicalExercise(settings));
    const unique = new Set(Array.from({ length: 40 }, (_, seed) => JSON.stringify(soundingNotes(generateClassicalExercise({ ...settings, seed })))));
    expect(unique.size).toBeGreaterThan(30);
  });
  it("validates hundreds of seeds across all tonalities, levels, lengths and hands", () => {
    let total = 0;
    for (const signature of keys) for (const mode of ["major", "minor"] as const) for (let difficulty = 1; difficulty <= 5; difficulty++) for (let seed = 0; seed < 6; seed++) {
      const ex = generateClassicalExercise({ ...settings, key: signature[mode], mode, difficulty, seed, measures: [8,16,32,64][seed % 4], hands: (["both","right","left"] as const)[seed % 3] });
      validateExercise(ex);
      expect(ex.right).toHaveLength(ex.generated.settings.measures);
      for(const hand of ["right","left"] as const) {
        const first=ex[hand].flat().find(n=>!n.rest);
        const marked=ex[hand].flat().filter(n=>n.finger!==undefined);
        expect(marked).toEqual(first?[first]:[]);
        if(first) { expect(first.finger).toBeGreaterThanOrEqual(1);expect(first.finger).toBeLessThanOrEqual(5); }
      }
      const pitches = noteGroups(ex, ex.generated.settings.hands).flatMap(g => g.pitches);
      expect(assessPractice(ex, ex.generated.settings.hands, pitches)).toMatchObject({ complete: true, accuracy: 100, mistakes: 0 });
      total++;
    }
    expect(total).toBe(720);
  });
  it("round trips written pitch and timing through MusicXML, including rests, flats and raised minor leading tones", () => {
    for (const signature of keys) for (const mode of ["major", "minor"] as const) for (const difficulty of [1,3,5]) {
      const ex = generateClassicalExercise({ ...settings, key: signature[mode], mode, difficulty });
      const imported = importMusicXml(musicXml(ex));
      expect(imported.key.fifths).toBe(signature.fifths);
      // The importer retains written tie segments. Compare written events before tie merging.
      const written = (["right","left"] as const).flatMap(hand => {
        let beat = 0;
        return ex[hand].flat().flatMap(n => {
          const event = { pitch: n.pitch, tick: beat * 480, duration: n.beats * 480 };
          beat += n.beats; return n.rest ? [] : [event];
        });
      }).sort((a,b) => a.tick-b.tick || a.pitch-b.pitch);
      expect(imported.notes.map(n => ({pitch:n.midiPitch,tick:n.onsetTick,duration:n.durationTicks})).sort((a,b)=>a.tick-b.tick||a.pitch-b.pitch)).toEqual(written);
    }
  });
  it("ends the complete study with root-position V-I and a leading-tone resolution", () => {
    for (const mode of ["major","minor"] as const) {
      const ex = generateClassicalExercise({...settings,mode,key:mode==="minor"?"A":"C"});
      const melody = soundingNotes(ex,"right");
      for(let bar=15;bar<16;bar+=8) {
        const final=melody.find(n=>n.beat===bar*4)!;
        const previous=melody.filter(n=>n.beat<bar*4).at(-1)!;
        expect(final.pitch-previous.pitch).toBe(1);
        expect(ex.generated.harmony[bar-1].degree).toBe(4);
        expect(ex.generated.harmony[bar].degree).toBe(0);
        expect(ex.left[bar][0].pitch%12).toBe(tonality(ex.generated.settings.key,mode).tonic);
      }
    }
  });
  it("varies internal cadences while retaining a conclusive final authentic cadence", () => {
    const cadences=new Set<string>();
    for(let seed=0;seed<30;seed++){
      const ex=generateClassicalExercise({...settings,difficulty:5,measures:32,seed});
      ex.generated.harmony.forEach(h=>{if(h.cadence)cadences.add(h.cadence);});
      expect(ex.generated.harmony.at(-1)?.cadence).toBe("authentic");
    }
    expect([...cadences].sort()).toEqual(["authentic","half","imperfect","plagal"]);
  });
  it("changes musical density and vocabulary with difficulty, not just tempo", () => {
    const low=generateClassicalExercise({...settings,difficulty:1});
    const high=generateClassicalExercise({...settings,difficulty:5});
    expect(soundingNotes(high).length).toBeGreaterThan(soundingNotes(low).length*1.5);
    expect(high.right.flat().some(n=>n.beats===.25)).toBe(true);
    expect(low.right.flat().every(n=>n.beats>=1)).toBe(true);
    expect(Array.from({length:12},(_,seed)=>musicXml(generateClassicalExercise({...settings,difficulty:3,seed}))).some(xml=>xml.includes("<dot/>"))).toBe(true);
  });
  it("rejects invalid settings and corrupt durations, spelling and ties", () => {
    for(const patch of [{tempoBpm:0},{measures:9},{difficulty:6},{key:"H"},{seed:NaN}]) expect(()=>generateClassicalExercise({...settings,...patch})).toThrow();
    const ex=generateClassicalExercise(settings);
    ex.right[0][1].beats=3; expect(()=>validateExercise(ex)).toThrow();
    const broken=generateClassicalExercise(settings);
    broken.right[0][1].spelling!.alter+=1; expect(()=>validateExercise(broken)).toThrow();
  });
  it("does not turn rests or tied continuations into extra MIDI attacks", () => {
    const ex=generateClassicalExercise({...settings,seed:2});
    expect(soundingNotes(ex).every(n=>n.pitch>0)).toBe(true);
    const expected=noteGroups(ex,"both").flatMap(g=>g.pitches);
    expect(assessPractice(ex,"both",[1,...expected])).toMatchObject({complete:true,mistakes:1});
  });
  it("suggests mirrored five-finger starts and favors long fingers on black keys", () => {
    const key=tonality("C","major");
    const ascending=[[0,1,2,3,4].map(d=>key.note(d,4))];
    const descending=[[...ascending[0]].reverse()];
    expect(startingFinger(ascending,"right")).toBe(1);
    expect(startingFinger(ascending,"left")).toBe(5);
    expect(startingFinger(descending,"right")).toBe(5);
    expect(startingFinger(descending,"left")).toBe(1);
    const black=tonality("Gb","major");
    expect(startingFinger([[0,1,2].map(d=>black.note(d,4))],"right")).toBe(2);
    expect(startingFinger([[{pitch:0,beats:1,tie:false,rest:true}]],"left")).toBeUndefined();
  });
  it("engraves one starting finger per sounding hand without changing note evaluation", () => {
    for(const hands of ["right","left","both"] as const) {
      const ex=generateClassicalExercise({...settings,hands});
      const plain={...ex,right:ex.right.map(bar=>bar.map(n=>({...n,finger:undefined}))),left:ex.left.map(bar=>bar.map(n=>({...n,finger:undefined})))};
      expect(soundingNotes(ex)).toEqual(soundingNotes(plain));
      expect(musicXml(ex).match(/<fingering /g)).toHaveLength(hands==="both"?2:1);
      expect(ex[hands==="left"?"left":"right"][0][0].rest).toBe(true);
      expect(ex[hands==="left"?"left":"right"][0][0].finger).toBeUndefined();
    }
  });
});
