import type { Exercise, ScoreNote } from "./sight-library";

const escape = (s: string) => s.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
const durations: Record<number, [string, boolean]> = {
  4: ["whole", false], 3: ["half", true], 2: ["half", false],
  1.5: ["quarter", true], 1: ["quarter", false], .75: ["eighth", true],
  .5: ["eighth", false], .25: ["16th", false],
};
// Opt-in extension of the existing MusicXML converter. Legacy scores retain their engraving.
export function structuredMusicXml(ex: Exercise) {
  const meter = ex.beatsPerMeasure ?? 4;
  const previousTie = { right: false, left: false };
  const measures = ex.right.map((_, index) => {
    const voices = (["right", "left"] as const).map((hand, staff) => {
      let beat = 0;
      return ex[hand][index].map((n: ScoreNote, i, notes) => {
        const [type, dot] = durations[n.beats] ?? [];
        if (!type) throw Error("Unsupported written duration");
        const spelling = n.spelling;
        if (!n.rest && !spelling) throw Error("A keyed score requires spelled notes");
        const pitch = n.rest ? "<rest/>" : `<pitch><step>${spelling!.step}</step><alter>${spelling!.alter}</alter><octave>${spelling!.octave}</octave></pitch>`;
        const stop = previousTie[hand]; previousTie[hand] = n.tie;
        const ties = `${stop ? '<tie type="stop"/>' : ""}${n.tie ? '<tie type="start"/>' : ""}`;
        // Beam only adjacent short notes within a quarter-note beat.
        const beam = [1, 2].map(level => {
          const limit = level === 1 ? 1 : .5;
          if (n.rest || n.beats >= limit) return "";
          const before = notes[i - 1], after = notes[i + 1];
          const joinsBefore = before && !before.rest && before.beats < limit && Math.floor(beat - before.beats) === Math.floor(beat);
          const joinsAfter = after && !after.rest && after.beats < limit && Math.floor(beat + n.beats) === Math.floor(beat);
          if (!joinsBefore && !joinsAfter) return "";
          return `<beam number="${level}">${joinsBefore ? joinsAfter ? "continue" : "end" : "begin"}</beam>`;
        }).join("");
        beat += n.beats;
        const fingering = !n.rest && n.finger ? `<technical><fingering placement="${hand === "right" ? "above" : "below"}">${n.finger}</fingering></technical>` : "";
        const notations = `${stop ? '<tied type="stop"/>' : ""}${n.tie ? '<tied type="start"/>' : ""}${fingering}`;
        return `<note>${pitch}<duration>${n.beats * 4}</duration>${ties}<voice>${staff + 1}</voice><type>${type}</type>${dot ? "<dot/>" : ""}<staff>${staff + 1}</staff>${beam}${notations ? `<notations>${notations}</notations>` : ""}</note>`;
      }).join("");
    });
    const attributes = index === 0 ? `<attributes><divisions>4</divisions><key><fifths>${ex.keySignature!.fifths}</fifths><mode>${ex.keySignature!.mode}</mode></key><time><beats>${meter}</beats><beat-type>4</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes><direction><sound tempo="${ex.tempoBpm ?? 80}"/></direction>` : "";
    return `<measure number="${index + 1}">${index && index % (ex.measuresPerSystem ?? 4) === 0 ? '<print new-system="yes"/>' : ""}${attributes}${voices[0]}<backup><duration>${meter * 4}</duration></backup>${voices[1]}${index === ex.right.length - 1 ? '<barline location="right"><bar-style>light-heavy</bar-style></barline>' : ""}</measure>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><work><work-title>${escape(ex.title ?? "Classical practice")}</work-title></work><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${measures}</part></score-partwise>`;
}
