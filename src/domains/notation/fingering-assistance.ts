export type FingeringLevel = "full" | "light" | "minimal" | "off";
export type FingeringPreference = FingeringLevel | "recommended";
export const recommendedFingering = (difficulty: number): FingeringLevel =>
  difficulty === 1 ? "full" : difficulty === 2 ? "light" : difficulty === 5 ? "off" : "minimal";
export const resolveFingering = (preference: FingeringPreference, difficulty: number) =>
  preference === "recommended" ? recommendedFingering(difficulty) : preference;
export const lowerFingering = (level: FingeringLevel): FingeringLevel | undefined =>
  ({ full: "light", light: "minimal", minimal: "off", off: undefined } as const)[level];

// Display-only copy. Never feed the filtered document back into exercise/grading data.
export function filterFingerings(xml: string, level: FingeringLevel): string {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Unable to read fingering annotations.");
  const seen = new Map<string, Set<string>>();
  for (const part of Array.from(doc.querySelectorAll("part"))) {
    for (const note of Array.from(part.querySelectorAll("note"))) {
      const hand = note.getAttribute("data-pianopath-hand") ?? note.querySelector("staff")?.textContent ?? "1";
      const key = `${part.getAttribute("id")}:${hand}`;
      const fingers = seen.get(key) ?? new Set<string>();
      for (const annotation of Array.from(note.querySelectorAll("fingering"))) {
        const value = annotation.textContent?.trim() ?? "";
        const valid = /^[1-5](?:[\s/−–-]+[1-5])*$/.test(value);
        const essential = annotation.getAttribute("substitution") === "yes" ||
          ["position-change", "crossing", "substitution"].includes(note.getAttribute("data-fingering-event") ?? "");
        const keep = valid && level !== "off" && (level === "full" || fingers.size === 0 || essential ||
          (level === "light" && (!fingers.has(value) || note.getAttribute("data-fingering-event") === "phrase-start")));
        if (!keep) annotation.remove();
        if (valid) fingers.add(value);
      }
      seen.set(key, fingers);
    }
  }
  return new XMLSerializer().serializeToString(doc);
}
