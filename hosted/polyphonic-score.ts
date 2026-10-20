import type { Exercise, SoundNote } from "./sight-library";

const escapeXml = (text: string) =>
  text.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function polyphonicXml(ex: Exercise): string {
  const events = ex.polyphony!;
  const meter = ex.beatsPerMeasure ?? 4;
  const duration = ex.durationBeats!;
  const names = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];
  const accidentals = new Set([1, 3, 6, 8, 10]);
  const type = (beats: number) =>
    beats === 4
      ? "whole"
      : beats === 2
        ? "half"
        : beats === 1
          ? "quarter"
          : beats === 0.5
            ? "eighth"
            : "16th";
  const note = (
    n: SoundNote,
    beats: number,
    voice: number,
    staff: number,
    chord: boolean,
    start: number,
    end: number,
  ) => {
    const stop = n.beat < start,
      tie = n.beat + n.beats > end;
    const beamPosition = n.beats < 1 ? (n.beat % (n.beats * 4)) / n.beats : -1;
    const beam =
      !chord && beamPosition >= 0
        ? Array.from(
            { length: n.beats === 0.25 ? 2 : 1 },
            (_, i) =>
              `<beam number="${i + 1}">${beamPosition === 0 ? "begin" : beamPosition === 3 ? "end" : "continue"}</beam>`,
          ).join("")
        : "";
    return `<note>${chord ? "<chord/>" : ""}<pitch><step>${names[n.pitch % 12]}</step>${accidentals.has(n.pitch % 12) ? "<alter>1</alter>" : ""}<octave>${Math.floor(n.pitch / 12) - 1}</octave></pitch><duration>${beats * 4}</duration>${stop ? '<tie type="stop"/>' : ""}${tie ? '<tie type="start"/>' : ""}<voice>${voice}</voice><type>${type(beats)}</type><staff>${staff}</staff>${beam}${stop || tie ? `<notations>${stop ? '<tied type="stop"/>' : ""}${tie ? '<tied type="start"/>' : ""}</notations>` : ""}</note>`;
  };
  const measures: string[] = [];
  for (let start = 0, index = 0; start < duration; start += meter, index++) {
    const end = Math.min(start + meter, duration),
      length = end - start;
    const layers: string[] = [];
    for (const [staff, hand] of [
      [1, "right"],
      [2, "left"],
    ] as const) {
      for (const sustained of [false, true]) {
        const voice = (staff - 1) * 2 + (sustained ? 2 : 1);
        const notes = events.filter(
          (n) =>
            n.hand === hand &&
            n.beats >= 2 === sustained &&
            n.beat < end &&
            n.beat + n.beats > start,
        );
        if (!notes.length) continue;
        const groups = new Map<number, SoundNote[]>();
        for (const n of notes) {
          const beat = Math.max(start, n.beat);
          groups.set(beat, [...(groups.get(beat) ?? []), n]);
        }
        let cursor = start,
          xml = "";
        const gap = (beats: number) =>
          `<forward><duration>${beats * 4}</duration><voice>${voice}</voice><staff>${staff}</staff></forward>`;
        for (const [beat, group] of [...groups].sort((a, b) => a[0] - b[0])) {
          if (beat > cursor) xml += gap(beat - cursor);
          group.sort((a, b) => a.pitch - b.pitch);
          group.forEach(
            (n, i) =>
              (xml += note(
                n,
                Math.min(n.beat + n.beats, end) - beat,
                voice,
                staff,
                i > 0,
                start,
                end,
              )),
          );
          cursor = beat + Math.min(group[0].beats, end - beat);
        }
        if (cursor < end) xml += gap(end - cursor);
        layers.push(xml);
      }
    }
    const clefs = [1, 2]
      .map((staff) => {
        const notes = events.filter(
          (n) =>
            n.hand === (staff === 1 ? "right" : "left") &&
            n.beat >= start &&
            n.beat < end,
        );
        const treble =
          staff === 1 || Math.min(...notes.map((n) => n.pitch)) >= 60;
        return `<clef number="${staff}"><sign>${treble ? "G" : "F"}</sign><line>${treble ? 2 : 4}</line></clef>`;
      })
      .join("");
    measures.push(
      `<measure number="${index + 1}"${length < meter ? ' implicit="yes"' : ""}>${index > 0 && index % 4 === 0 ? '<print new-system="yes"/>' : ""}<attributes>${index === 0 ? `<divisions>4</divisions><key><fifths>0</fifths></key><time><beats>${meter}</beats><beat-type>4</beat-type></time><staves>2</staves>` : ""}${clefs}</attributes>${layers.join(`<backup><duration>${length * 4}</duration></backup>`)}${end === duration ? '<barline location="right"><bar-style>light-heavy</bar-style></barline>' : ""}</measure>`,
    );
  }
  return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><work><work-title>${escapeXml(ex.title ?? "Exercise")}</work-title></work><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${measures.join("")}</part></score-partwise>`;
}
