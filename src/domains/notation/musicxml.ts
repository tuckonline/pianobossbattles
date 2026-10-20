import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { MusicalScore, ExpectedNote } from "../music/model";
type XmlNode = { [key: string]: unknown };
const array = (x: unknown): XmlNode[] =>
  !x ? [] : Array.isArray(x) ? (x as XmlNode[]) : [x as XmlNode];
// Ordered parsing preserves backup/forward/chord timing. Unsupported notation remains in source XML.
export function importMusicXml(xml: string): MusicalScore {
  if (xml.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error(
      "MusicXML must be under 2 MB and cannot contain DTDs or entities",
    );
  if (XMLValidator.validate(xml) !== true) throw new Error("Invalid XML");
  const parsed = new XMLParser({
    ignoreAttributes: false,
    preserveOrder: true,
  }).parse(xml) as XmlNode[];
  const root = parsed.find((n) => n["score-partwise"])?.["score-partwise"];
  if (!root) throw new Error("Only score-partwise MusicXML is supported");
  const score: MusicalScore = {
    schemaVersion: 1,
    ppq: 480,
    meter: { numerator: 4, denominator: 4 },
    key: { fifths: 0, mode: "major" },
    tempoEvents: [{ tick: 0, bpm: 80 }],
    measures: [],
    voices: [],
    chordGroups: [],
    notes: [],
    warnings: [
      "Review imported voices, spelling, ties and tuplets before scoring. Compressed MXL is not supported.",
    ],
  };
  const value = (nodes: unknown, key: string): unknown => {
    const item = array(nodes).find((n) => key in n)?.[key];
    if (Array.isArray(item)) return (item[0] as XmlNode)?.["#text"];
    return item;
  };
  for (const part of array(root).filter((n) => "part" in n)) {
    let tick = 0,
      divisions = 1;
    let measureNumber = 0;
    for (const measure of array(part.part).filter((n) => "measure" in n)) {
      measureNumber++;
      const start = tick;
      let previous = tick,
        max = tick;
      let graceDelay = 0, previousDelay = 0;
      const nodes = array(measure.measure);
      for (const [nodeIndex, node] of nodes.entries()) {
        if (node.attributes) {
          const a = array(node.attributes);
          divisions = Number(value(a, "divisions") ?? divisions);
          const time = a.find((n) => n.time)?.time;
          if (time) {
            score.meter = {
              numerator: Number(value(time, "beats") ?? 4),
              denominator: Number(value(time, "beat-type") ?? 4),
            };
          }
          const key = a.find((n) => n.key)?.key;
          if (key) score.key.fifths = Number(value(key, "fifths") ?? 0);
        }
        if (node.backup)
          tick -=
            (Number(value(node.backup, "duration") ?? 0) * 480) / divisions;
        if (node.forward)
          tick +=
            (Number(value(node.forward, "duration") ?? 0) * 480) / divisions;
        if (node.note) {
          const n = array(node.note),
            writtenDuration = (Number(value(n, "duration") ?? 0) * 480) / divisions,
            chord = n.some((x) => "chord" in x),
            grace = n.find(x => "grace" in x),
            pitch = n.find((x) => x.pitch)?.pitch;
          // Explicit MusicXML grace realization borrows time from the following
          // principal note, without shifting barlines or the other hand's voice.
          const percent = Number((grace?.[":@"] as XmlNode | undefined)?.["@_steal-time-following"] ?? 0);
          const principal = grace && percent > 0 ? nodes.slice(nodeIndex + 1).find(x =>
            x.note && !array(x.note).some(y => "grace" in y)) : undefined;
          const stolen = principal ? Math.round(
            Number(value(principal.note, "duration") ?? 0) * 480 / divisions * Math.min(percent, 100) / 100,
          ) : 0;
          const delay = chord ? previousDelay : graceDelay;
          const onset = chord ? previous : tick + delay;
          const duration = grace ? stolen : Math.max(0, writtenDuration - delay);
          if (pitch) {
            const step = String(value(pitch, "step")),
              alter = Number(value(pitch, "alter") ?? 0),
              octave = Number(value(pitch, "octave"));
            const offsets: Record<string, number> = {
              C: 0,
              D: 2,
              E: 4,
              F: 5,
              G: 7,
              A: 9,
              B: 11,
            };
            if (offsets[step] === undefined || !Number.isFinite(octave))
              throw new Error("Unsupported pitch");
            const voice = String(value(n, "voice") ?? "1");
            const note: ExpectedNote = {
              id: `xml-${score.notes.length}`,
              midiPitch: (octave + 1) * 12 + offsets[step] + alter,
              spelling: `${step}${alter === 1 ? "#" : alter === -1 ? "b" : ""}${octave}`,
              onsetTick: onset,
              durationTicks: duration,
              measure: measureNumber,
              beat: (onset - start) / 480 + 1,
              hand: "UNSPECIFIED",
              voice,
            };
            score.notes.push(note);
          }
          previous = onset;
          if (grace) graceDelay += stolen;
          else if (!chord) {
            tick += writtenDuration;
            previousDelay = graceDelay;
            graceDelay = 0;
          }
          max = Math.max(max, onset + duration);
        }
      }
      tick = max;
      if (!score.measures.some((m) => m.number === measureNumber))
        score.measures.push({
          number: measureNumber,
          startTick: start,
          voices: [],
        });
    }
  }
  score.voices = [...new Set(score.notes.map((n) => n.voice))].map((id) => ({
    id,
    name: id,
  }));
  return score;
}
