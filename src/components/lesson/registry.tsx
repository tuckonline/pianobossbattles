"use client";
/* eslint-disable @next/next/no-img-element -- Creator-hosted media is intentionally loaded directly without a server image proxy. */
import type { LessonBlock } from "@/domains/blocks/schema";
import type { Recording } from "../midi/recorder";
import { MusicPlayer } from "../music/player";
import { NotationViewer } from "../music/notation";
export interface Asset {
  id: string;
  title: string;
  kind: string;
  url: string | null;
}
export interface BlockContext {
  recordings: Recording[];
  assets: Asset[];
  lessonId: string;
  enrollmentId?: string;
  answers: Record<string, number>;
  onAnswer: (blockId: string, answer: number) => void;
}
export function BlockFields({
  block,
  onChange,
  assets,
}: {
  block: LessonBlock;
  onChange: (block: LessonBlock) => void;
  assets: Asset[];
}) {
  const config = block.config;
  if ("text" in config)
    return (
      <label>
        {block.type === "HEADING" ? "Heading" : "Text"}
        <textarea
          value={config.text}
          onChange={(e) =>
            onChange({
              ...block,
              config: { ...config, text: e.target.value },
            } as LessonBlock)
          }
        />
      </label>
    );
  if ("assetId" in config)
    return (
      <>
        <label>
          Media asset
          <select
            value={config.assetId}
            onChange={(e) =>
              onChange({
                ...block,
                config: { ...config, assetId: e.target.value },
              } as LessonBlock)
            }
          >
            <option value="">Select media</option>
            {assets
              .filter(
                (a) =>
                  a.kind ===
                  (block.type === "NOTATION" ? "MUSICXML" : block.type),
              )
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
          </select>
        </label>
        <label>
          Caption
          <input
            value={config.caption}
            onChange={(e) =>
              onChange({
                ...block,
                config: { ...config, caption: e.target.value },
              } as LessonBlock)
            }
          />
        </label>
      </>
    );
  if ("prompt" in config)
    return (
      <div className="stack">
        <label>
          Question
          <textarea
            value={config.prompt}
            onChange={(e) =>
              onChange({
                ...block,
                config: { ...config, prompt: e.target.value },
              } as LessonBlock)
            }
          />
        </label>
        {config.options.map((option, i) => (
          <label key={i}>
            Option {i + 1}
            <input
              value={option}
              onChange={(e) =>
                onChange({
                  ...block,
                  config: {
                    ...config,
                    options: config.options.map((v, j) =>
                      j === i ? e.target.value : v,
                    ),
                  },
                } as LessonBlock)
              }
            />
          </label>
        ))}
        <button
          className="quiet"
          onClick={() =>
            onChange({
              ...block,
              config: { ...config, options: [...config.options, ""] },
            } as LessonBlock)
          }
        >
          Add answer option
        </button>
        <label>
          Correct answer
          <select
            value={config.answer}
            onChange={(e) =>
              onChange({
                ...block,
                config: { ...config, answer: Number(e.target.value) },
              } as LessonBlock)
            }
          >
            {config.options.map((_, i) => (
              <option key={i} value={i}>
                Option {i + 1}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  return (
    <p className="muted">
      {block.type === "DIVIDER"
        ? "A visual separator."
        : "Configure the recording and scoring below."}
    </p>
  );
}
function RenderBlock({
  block,
  context,
}: {
  block: LessonBlock;
  context: BlockContext;
}) {
  const config = block.config;
  if (block.type === "DIVIDER") return <hr />;
  if ("text" in config) {
    if (block.type === "HEADING") return <h2>{config.text}</h2>;
    return (
      <p className={block.type === "INSTRUCTION" ? "notice" : ""}>
        {config.text}
      </p>
    );
  }
  if ("recordingId" in config) {
    const recording = context.recordings.find(
      (r) => r.id === config.recordingId,
    );
    return recording ? (
      <MusicPlayer
        recording={recording}
        scoring={config.scoring}
        lessonId={context.lessonId}
        blockId={block.id}
        enrollmentId={context.enrollmentId}
        demonstration={block.type === "MIDI_DEMONSTRATION"}
      />
    ) : (
      <p role="alert">Save a recording to preview this activity.</p>
    );
  }
  if ("assetId" in config) {
    const asset = context.assets.find((a) => a.id === config.assetId);
    if (!asset?.url) return <p>Media unavailable.</p>;
    return (
      <figure>
        {block.type === "IMAGE" ? (
          <img
            className="media"
            src={asset.url}
            alt={config.caption || asset.title}
          />
        ) : block.type === "AUDIO" ? (
          <audio controls src={asset.url} />
        ) : block.type === "VIDEO" ? (
          <video className="media" controls src={asset.url} />
        ) : (
          <NotationViewer url={asset.url} />
        )}
        <figcaption>{config.caption}</figcaption>
      </figure>
    );
  }
  if ("prompt" in config)
    return (
      <fieldset>
        <legend>{config.prompt}</legend>
        {config.options.map((option, i) => (
          <label key={i} className="check">
            <input
              type="radio"
              name={block.id}
              checked={context.answers[block.id] === i}
              onChange={() => context.onAnswer(block.id, i)}
            />
            {option}
          </label>
        ))}
      </fieldset>
    );
  return null;
}
export const blockRegistry: Record<
  LessonBlock["type"],
  {
    TeacherEditorComponent: typeof BlockFields;
    StudentRendererComponent: typeof RenderBlock;
  }
> = Object.fromEntries(
  [
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
  ].map((type) => [
    type,
    {
      TeacherEditorComponent: BlockFields,
      StudentRendererComponent: RenderBlock,
    },
  ]),
) as Record<
  LessonBlock["type"],
  {
    TeacherEditorComponent: typeof BlockFields;
    StudentRendererComponent: typeof RenderBlock;
  }
>;
