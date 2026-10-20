import { polyphonicXml } from "./polyphonic-score";
export type Hand = "both" | "right" | "left";
export type ScoreNote = {
  pitch: number;
  beats: number;
  tie: boolean;
  finger?: number;
};
export type Exercise = {
  number: number;
  title?: string;
  tempoBpm?: number;
  beatsPerMeasure?: number;
  measuresPerSystem?: number;
  right: ScoreNote[][];
  left: ScoreNote[][];
  polyphony?: SoundNote[];
  durationBeats?: number;
  sourcePage?: number;
  collection?: string;
  bothHandsOnly?: boolean;
  singleHand?: "right" | "left";
  notationUrl?: string;
  notationXml?: string;
  composer?: string;
  difficulty?: string;
  description?: string;
  learningFocus?: string;
  practiceTip?: string;
  arrangement?: string;
  sourceUrl?: string;
};
export { sightLibrary } from "./sight-data";
export type SoundNote = {
  pitch: number;
  beat: number;
  beats: number;
  hand: "right" | "left";
};
export function soundingNotes(
  exercise: Exercise,
  hand: Hand = "both",
): SoundNote[] {
  if (exercise.polyphony)
    return exercise.polyphony
      .filter((n) => hand === "both" || n.hand === hand)
      .sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
  const result: SoundNote[] = [];
  for (const h of ["right", "left"] as const) {
    if (hand !== "both" && hand !== h) continue;
    let beat = 0,
      previous: SoundNote | undefined,
      tied = false;
    for (const bar of exercise[h])
      for (const n of bar) {
        if (tied && previous?.pitch === n.pitch) previous.beats += n.beats;
        else {
          previous = { pitch: n.pitch, beat, beats: n.beats, hand: h };
          result.push(previous);
        }
        tied = n.tie;
        beat += n.beats;
      }
  }
  return result.sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
}
export function noteGroups(exercise: Exercise, hand: Hand) {
  const groups: { beat: number; pitches: number[] }[] = [];
  for (const n of soundingNotes(exercise, hand)) {
    let group = groups.at(-1);
    if (!group || group.beat !== n.beat) {
      group = { beat: n.beat, pitches: [] };
      groups.push(group);
    }
    group.pitches.push(n.pitch);
  }
  return groups;
}
// The terminal Schmitt entry is a cadence, played only on the last repeat.
export function practicePass(exercise: Exercise, omitClosing = false): Exercise {
  if (!omitClosing || exercise.collection !== "schmitt-op16") return exercise;
  const notes = soundingNotes(exercise);
  const end = Math.max(...notes.map(n => n.beat));
  if (end <= 0) return exercise;
  return { ...exercise, durationBeats: end,
    polyphony: notes.filter(n => n.beat < end).map(n => ({ ...n, beats: Math.min(n.beats, end - n.beat) })) };
}

export function assessPractice(
  exercise: Exercise,
  hand: Hand,
  played: number[],
) {
  const groups = noteGroups(exercise, hand);
  const evaluations: {sequence:number; outcome:"correct"|"incorrect"; occurrence:string|null; pitch:number; groupId:string; groupSize:number; groupComplete:boolean}[] = [];
  const feedback = new Map<
    string,
    { beat: number; pitch: number; status: "correct" | "incorrect" }
  >();
  let cursor = 0,
    mistakes = 0,
    correct = 0;
  let pending = [...(groups[0]?.pitches ?? [])];
  for (const pitch of played) {
    if (cursor === groups.length) break;
    const index = pending.indexOf(pitch);
    if (index < 0) {
      evaluations.push({sequence:evaluations.length,outcome:"incorrect",occurrence:null,pitch,groupId:String(cursor),groupSize:groups[cursor].pitches.length,groupComplete:false});
      mistakes++;
      // A wrong key is not necessarily printed in the score. Mark only the
      // still-missing targets at this entry; already-correct chord tones stay green.
      for (const missing of pending)
        feedback.set(`${cursor}:${missing}`, {
          beat: groups[cursor].beat,
          pitch: missing,
          status: "incorrect",
        });
    } else {
      feedback.set(`${cursor}:${pitch}`, {
        beat: groups[cursor].beat,
        pitch,
        status: "correct",
      });
      const ordinal=groups[cursor].pitches.filter(p=>p===pitch).length-pending.filter(p=>p===pitch).length;
      evaluations.push({sequence:evaluations.length,outcome:"correct",occurrence:`${cursor}:${pitch}:${ordinal}`,pitch,groupId:String(cursor),groupSize:groups[cursor].pitches.length,groupComplete:pending.length===1});
      pending.splice(index, 1);
      correct++;
    }
    if (!pending.length) {
      cursor++;
      pending = [...(groups[cursor]?.pitches ?? [])];
    }
  }
  return {
    cursor,
    pending,
    mistakes,
    correct,
    complete: cursor === groups.length,
    accuracy: Math.round((100 * correct) / Math.max(1, correct + mistakes)),
    feedback: [...feedback.values()],
    evaluations,
  };
}
export function musicXml(
  exercise: Exercise,
  measureOffset = 0,
  finalPage = true,
) {
  if (exercise.polyphony) return polyphonicXml(exercise);
  const beatsPerMeasure = exercise.beatsPerMeasure ?? 4;
  const clef = (i: number) =>
    exercise.beatsPerMeasure === 2 && exercise.right[i][0].pitch < 60
      ? "<sign>F</sign><line>4</line>"
      : "<sign>G</sign><line>2</line>";
  const names = ["C", "", "D", "", "E", "F", "", "G", "", "A", "", "B"];
  const tied = { right: false, left: false };
  const bars = exercise.right
    .map((_, i) => {
      const voices = (["right", "left"] as const).map((h, voice) =>
        exercise[h][i]
          .map((n, index, notes) => {
            const beat = notes
              .slice(0, index)
              .reduce((sum, note) => sum + note.beats, 0);
            const previousEighth =
              n.beats === 0.5 &&
              notes[index - 1]?.beats === 0.5 &&
              Math.floor((beat - 0.5) / 2) === Math.floor(beat / 2);
            const nextEighth =
              n.beats === 0.5 &&
              notes[index + 1]?.beats === 0.5 &&
              Math.floor((beat + 0.5) / 2) === Math.floor(beat / 2);
            const beam =
              previousEighth || nextEighth
                ? `<beam number="1">${previousEighth ? (nextEighth ? "continue" : "end") : "begin"}</beam>`
                : "";
            const stop = tied[h];
            tied[h] = n.tie;
            const ties = `${stop ? '<tie type="stop"/>' : ""}${n.tie ? '<tie type="start"/>' : ""}`;
            const notation = `${stop ? '<tied type="stop"/>' : ""}${n.tie ? '<tied type="start"/>' : ""}${n.finger ? `<technical><fingering>${n.finger}</fingering></technical>` : ""}`;
            const sixteenthBeam =
              n.beats === 0.25
                ? [1, 2]
                    .map(
                      (level) =>
                        `<beam number="${level}">${index % 4 === 0 ? "begin" : index % 4 === 3 ? "end" : "continue"}</beam>`,
                    )
                    .join("")
                : "";
            return `<note><pitch><step>${names[n.pitch % 12]}</step><octave>${Math.floor(n.pitch / 12) - 1}</octave></pitch><duration>${n.beats * 4}</duration>${ties}<voice>${voice + 1}</voice><type>${n.beats === 4 ? "whole" : n.beats === 2 ? "half" : n.beats === 1 ? "quarter" : n.beats === 0.5 ? "eighth" : "16th"}</type><staff>${voice + 1}</staff>${beam}${sixteenthBeam}${notation ? `<notations>${notation}</notations>` : ""}</note>`;
          })
          .join(""),
      );
      return `<measure number="${i + 1 + measureOffset}">${i > 0 && i % (exercise.measuresPerSystem ?? Math.ceil(exercise.right.length / 2)) === 0 ? '<print new-system="yes"/>' : ""}${i === 0 ? `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>${beatsPerMeasure}</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1">${clef(i)}</clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>` : clef(i) !== clef(i - 1) ? `<attributes><clef number="1">${clef(i)}</clef></attributes>` : ""}${voices[0]}<backup><duration>${beatsPerMeasure * 4}</duration></backup>${voices[1]}${finalPage && i === exercise.right.length - 1 ? '<barline location="right"><bar-style>light-heavy</bar-style></barline>' : ""}</measure>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><work><work-title>${exercise.title ?? `Exercise ${exercise.number}`}</work-title></work><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${bars}</part></score-partwise>`;
}
