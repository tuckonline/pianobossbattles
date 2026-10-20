import "dotenv/config";
import { eq } from "drizzle-orm";
import { auth } from "../src/lib/auth";
import { db } from "../src/lib/db";
import * as s from "../src/lib/schema";
import { PlatformService } from "../src/domains/courses/service";
import { MidiSimulator, MidiEventBus } from "../src/domains/midi/engine";
import { defaultScoring } from "../src/domains/blocks/schema";
if (process.env.NODE_ENV === "production")
  throw new Error("Developer fixtures cannot be seeded in production");
const password = process.env.FIXTURE_PASSWORD;
if (!password || password.length < 12)
  throw new Error(
    "Set FIXTURE_PASSWORD to a development-only password of at least 12 characters",
  );
for (const role of ["teacher", "student", "admin"]) {
  const email = `${role}@pianopath.test`;
  let [u] = await db.select().from(s.user).where(eq(s.user.email, email));
  if (!u) {
    const created = await auth.api.signUpEmail({
      body: { email, password, name: `Developer ${role}` },
    });
    u = created.user as typeof u;
  }
  if (role !== "student")
    await db
      .insert(s.userRoles)
      .values({ userId: u.id, role: role === "teacher" ? "TEACHER" : "ADMIN" })
      .onConflictDoNothing();
}
const [teacher] = await db
  .select()
  .from(s.user)
  .where(eq(s.user.email, "teacher@pianopath.test"));
await db
  .insert(s.teacherProfiles)
  .values({ userId: teacher.id, displayName: "Developer teacher" })
  .onConflictDoNothing();
const platform = new PlatformService(db),
  actor = {
    id: teacher.id,
    roles: ["TEACHER", "STUDENT"] as ("TEACHER" | "STUDENT")[],
  };
if (
  !(await platform.teacherCourses(actor)).some(
    (c) => c.metadata.title === "Developer Test Course",
  )
) {
  const course = await platform.createCourse(actor, "Developer Test Course"),
    draft = (await platform.draft(actor, course.id)).draft!;
  const events = new MidiSimulator(new MidiEventBus(), () => 0).sequence([
    { pitch: 60, onset: 0, duration: 400 },
  ]);
  const recording = await platform.record(actor, {
    title: "Developer MIDI Exercise",
    tempo: 80,
    events,
  });
  await platform.saveDraft(actor, {
    courseId: course.id,
    versionId: draft.id,
    revision: 0,
    visibility: "PUBLIC",
    metadata: {
      ...draft.metadata,
      description: "Developer fixture only. Not a piano curriculum.",
      rights: {
        status: "ORIGINAL",
        owner: "PianoPath development fixtures",
        notes: "Single-note technical fixture.",
      },
    },
    tree: {
      modules: [
        {
          id: "dev-module",
          title: "Developer Test Module",
          lessons: [
            {
              id: "dev-lesson",
              title: "Developer Test Lesson",
              blocks: [
                {
                  id: "dev-text",
                  type: "TEXT",
                  schemaVersion: 1,
                  config: {
                    text: "Developer fixture: verifies MIDI capture and scoring.",
                  },
                },
                {
                  id: "dev-midi",
                  type: "MIDI_EXERCISE",
                  schemaVersion: 1,
                  config: {
                    recordingId: recording.id,
                    template: "PLAY_THESE_NOTES",
                    scoring: defaultScoring,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  });
}
console.log(
  "Developer accounts and an unpublished Developer Test Course are ready.",
);
process.exit(0);
