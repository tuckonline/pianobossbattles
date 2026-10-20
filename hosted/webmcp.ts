import { z } from "zod";
import { command } from "../src/components/ui/actions";
import { navigate } from "./navigation";
interface ModelContext {
  registerTool(
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean };
      execute: (input: unknown) => Promise<unknown>;
    },
    options: { signal: AbortSignal },
  ): void | Promise<void>;
}
export function registerWebMcp() {
  const controller = new AbortController();
  const context = (document as Document & { modelContext?: ModelContext })
    .modelContext;
  if (context)
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: "create_course_draft",
            description:
              "Create a new private PianoPath course draft and open its editor. Requires Teacher access.",
            inputSchema: {
              type: "object",
              properties: {
                title: { type: "string", minLength: 1, maxLength: 200 },
              },
              required: ["title"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false },
            async execute(input) {
              const data = z
                .object({ title: z.string().trim().min(1).max(200) })
                .strict()
                .parse(input);
              const course = await command<{ id: string }>({
                action: "createCourse",
                title: data.title,
              });
              navigate(`/teacher/courses/${course.id}`);
              return { courseId: course.id, status: "DRAFT" };
            },
          },
          { signal: controller.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Browsers without WebMCP continue normally. */
    }
  return () => controller.abort();
}
