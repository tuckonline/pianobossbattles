import { z } from "zod";
export const midiEventSchema = z
  .object({
    type: z.enum(["NOTE_ON", "NOTE_OFF", "CONTROL_CHANGE"]),
    timestamp: z.number().finite().min(0).max(3600000),
    pitch: z.number().int().min(0).max(127).optional(),
    velocity: z.number().int().min(0).max(127).optional(),
    channel: z.number().int().min(0).max(15),
    controller: z.number().int().min(0).max(127).optional(),
    value: z.number().int().min(0).max(127).optional(),
  })
  .superRefine((e, c) => {
    if (
      e.type === "CONTROL_CHANGE"
        ? e.controller === undefined || e.value === undefined
        : e.pitch === undefined || e.velocity === undefined
    )
      c.addIssue({ code: "custom", message: "Missing MIDI event fields" });
  });
export type MidiEvent = z.infer<typeof midiEventSchema>;
export const dimensions = [
  "pitch",
  "rhythm",
  "duration",
  "continuity",
  "chord",
  "velocity",
  "pedal",
] as const;
export const scoringSchema = z
  .object({
    weights: z.object({
      pitch: z.number().min(0).max(10),
      rhythm: z.number().min(0).max(10),
      duration: z.number().min(0).max(10),
      continuity: z.number().min(0).max(10),
      chord: z.number().min(0).max(10),
      velocity: z.number().min(0).max(10),
      pedal: z.number().min(0).max(10),
    }),
    onsetTolerance: z.number().min(20).max(1000),
    chordTolerance: z.number().min(10).max(500),
    passingScore: z.number().min(1).max(100),
    minimumTempo: z.number().min(20).max(300),
    targetTempo: z.number().min(20).max(300),
  })
  .refine(
    (p) => Object.values(p.weights).some((w) => w > 0),
    "Enable at least one scoring dimension",
  )
  .refine(
    (p) => p.minimumTempo <= p.targetTempo,
    "Minimum tempo cannot exceed target tempo",
  );
export type ScoringProfile = z.infer<typeof scoringSchema>;
export const defaultScoring: ScoringProfile = {
  weights: {
    pitch: 1,
    rhythm: 0,
    duration: 0,
    continuity: 0,
    chord: 0,
    velocity: 0,
    pedal: 0,
  },
  onsetTolerance: 250,
  chordTolerance: 80,
  passingScore: 80,
  minimumTempo: 40,
  targetTempo: 80,
};
export const exerciseTypes = [
  "PLAY_THESE_NOTES",
  "PLAY_THIS_CHORD",
  "PLAY_THIS_PATTERN",
  "PLAY_THIS_RHYTHM",
  "PLAY_THIS_PASSAGE",
  "COPY_MY_PLAYING",
  "WAIT_MODE",
  "PERFORMANCE",
  "FREE_PRACTICE",
  "SCALE",
  "ARPEGGIO",
] as const;
export const blockTypes = [
  "TEXT",
  "HEADING",
  "IMAGE",
  "VIDEO",
  "AUDIO",
  "NOTATION",
  "MIDI_DEMONSTRATION",
  "MIDI_EXERCISE",
  "THEORY_ACTIVITY",
  "EAR_TRAINING_ACTIVITY",
  "QUIZ",
  "ASSESSMENT",
  "INSTRUCTION",
  "DIVIDER",
  "COMPLETION",
] as const;
const base = { id: z.string().min(1).max(100), schemaVersion: z.literal(1) };
const text = z.string().max(30000);
const media = z.object({
  assetId: z.string().min(1),
  caption: text.default(""),
});
const midi = z.object({
  recordingId: z.string().min(1),
  template: z.enum(exerciseTypes),
  scoring: scoringSchema,
});
const question = z
  .object({
    prompt: text.min(1),
    options: z.array(z.string().min(1).max(1000)).min(2).max(10),
    answer: z.number().int().min(0),
  })
  .refine((q) => q.answer < q.options.length, "Answer must identify an option");
export const blockSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("TEXT"), config: z.object({ text }) }),
  z.object({ ...base, type: z.literal("HEADING"), config: z.object({ text }) }),
  z.object({
    ...base,
    type: z.literal("INSTRUCTION"),
    config: z.object({ text }),
  }),
  z.object({ ...base, type: z.literal("IMAGE"), config: media }),
  z.object({ ...base, type: z.literal("VIDEO"), config: media }),
  z.object({ ...base, type: z.literal("AUDIO"), config: media }),
  z.object({ ...base, type: z.literal("NOTATION"), config: media }),
  z.object({ ...base, type: z.literal("MIDI_EXERCISE"), config: midi }),
  z.object({ ...base, type: z.literal("MIDI_DEMONSTRATION"), config: midi }),
  z.object({ ...base, type: z.literal("THEORY_ACTIVITY"), config: question }),
  z.object({
    ...base,
    type: z.literal("EAR_TRAINING_ACTIVITY"),
    config: question,
  }),
  z.object({ ...base, type: z.literal("QUIZ"), config: question }),
  z.object({ ...base, type: z.literal("ASSESSMENT"), config: question }),
  z.object({ ...base, type: z.literal("DIVIDER"), config: z.object({}) }),
  z.object({
    ...base,
    type: z.literal("COMPLETION"),
    config: z.object({ text }),
  }),
]);
export type LessonBlock = z.infer<typeof blockSchema>;
export const lessonSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  blocks: z.array(blockSchema).max(100),
});
export const treeSchema = z
  .object({
    modules: z
      .array(
        z.object({
          id: z.string().min(1),
          title: z.string().min(1).max(200),
          lessons: z.array(lessonSchema).max(200),
        }),
      )
      .max(100),
  })
  .superRefine((tree, c) => {
    const ids = new Set<string>();
    for (const m of tree.modules) {
      for (const item of [
        m,
        ...m.lessons,
        ...m.lessons.flatMap((l) => l.blocks),
      ]) {
        if (ids.has(item.id))
          c.addIssue({
            code: "custom",
            message: "Content IDs must be unique within a version",
          });
        ids.add(item.id);
      }
    }
  });
export type CourseTree = z.infer<typeof treeSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export const rightsSchema = z.object({
  status: z.enum([
    "ORIGINAL",
    "PUBLIC_DOMAIN",
    "LICENSED",
    "PERMISSION_GRANTED",
    "UNKNOWN",
  ]),
  owner: z.string().max(200),
  notes: z.string().max(5000),
  documentId: z.string().optional(),
});
export const metadataSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(10000),
  shortDescription: z.string().max(500).default(""),
  level: z.string().max(100).default("Unspecified"),
  category: z.string().max(100).default(""),
  language: z.string().max(20).default("en"),
  estimatedMinutes: z.number().int().min(0).default(0),
  prerequisites: z.array(z.string().max(200)).max(50).default([]),
  tags: z.array(z.string().max(100)).max(50).default([]),
  thumbnailId: z.string().optional(),
  previewLessonIds: z.array(z.string()).default([]),
  accessPolicy: z.enum(["FREE", "GRANT_REQUIRED"]).default("FREE"),
  rights: rightsSchema,
});
export type CourseMetadata = z.infer<typeof metadataSchema>;
export function emptyBlock(type: LessonBlock["type"]): LessonBlock {
  const common = { id: crypto.randomUUID(), schemaVersion: 1 as const };
  if (type === "MIDI_EXERCISE" || type === "MIDI_DEMONSTRATION")
    return {
      ...common,
      type,
      config: {
        recordingId: "",
        template: "PLAY_THESE_NOTES",
        scoring: structuredClone(defaultScoring),
      },
    };
  if (["IMAGE", "VIDEO", "AUDIO", "NOTATION"].includes(type))
    return {
      ...common,
      type,
      config: { assetId: "", caption: "" },
    } as LessonBlock;
  if (
    ["QUIZ", "ASSESSMENT", "THEORY_ACTIVITY", "EAR_TRAINING_ACTIVITY"].includes(
      type,
    )
  )
    return {
      ...common,
      type,
      config: { prompt: "", options: ["", ""], answer: 0 },
    } as LessonBlock;
  return {
    ...common,
    type,
    config: type === "DIVIDER" ? {} : { text: "" },
  } as LessonBlock;
}
