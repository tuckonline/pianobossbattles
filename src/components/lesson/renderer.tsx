"use client";
import { useState } from "react";
import type { Lesson } from "@/domains/blocks/schema";
import { blockRegistry, type Asset } from "./registry";
import type { Recording } from "../midi/recorder";
import { MidiSetup } from "../midi/setup";
import { command } from "../ui/actions";
export function LessonRenderer({
  lesson,
  recordings,
  assets,
  enrollmentId,
}: {
  lesson: Lesson;
  recordings: Recording[];
  assets: Asset[];
  enrollmentId?: string;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({}),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <article className="lesson-renderer">
      <h1>{lesson.title}</h1>
      {lesson.blocks.some((b) => b.type.startsWith("MIDI")) && <MidiSetup />}
      {lesson.blocks.map((block) => {
        const Renderer = blockRegistry[block.type].StudentRendererComponent;
        return (
          <div key={block.id} className="spacer">
            <Renderer
              block={block}
              context={{
                recordings,
                assets,
                lessonId: lesson.id,
                enrollmentId,
                answers,
                onAnswer: (id, answer) =>
                  setAnswers({ ...answers, [id]: answer }),
              }}
            />
          </div>
        );
      })}
      {enrollmentId && (
        <div className="spacer">
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await command({
                  action: "complete",
                  enrollmentId,
                  lessonId: lesson.id,
                  answers,
                });
                setMessage("Lesson complete. Your progress is saved.");
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Complete lesson
          </button>
          <p role="status">{message}</p>
        </div>
      )}
    </article>
  );
}
