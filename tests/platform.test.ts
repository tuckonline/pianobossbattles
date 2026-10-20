import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import * as s from "../src/lib/schema";
import { PlatformService } from "../src/domains/courses/service";
import { defaultScoring } from "../src/domains/blocks/schema";
import { MidiSimulator, MidiEventBus } from "../src/domains/midi/engine";
import type { Database } from "../src/lib/db";
const client = new PGlite(),
  database = drizzle(client, { schema: s }),
  service = new PlatformService(database as Database);
const teacher = {
    id: "teacher",
    roles: ["TEACHER", "STUDENT"] as ("TEACHER" | "STUDENT")[],
  },
  student = { id: "student", roles: ["STUDENT"] as "STUDENT"[] },
  outsider = { id: "outsider", roles: ["TEACHER"] as "TEACHER"[] };
beforeAll(async () => {
  for (const f of readdirSync("postgres/drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await client.exec(readFileSync(`postgres/drizzle/${f}`, "utf8"));
  for (const actor of [teacher, student, outsider])
    await database
      .insert(s.user)
      .values({
        id: actor.id,
        name: actor.id,
        email: `${actor.id}@example.test`,
      });
});
afterAll(() => client.close());
it("teacher authors, records, publishes; student enrolls, performs; progress remains pinned", async () => {
  const c = await service.createCourse(teacher, "Developer Test Course");
  let d = (await service.draft(teacher, c.id)).draft!;
  await expect(service.draft(outsider, c.id)).rejects.toMatchObject({
    status: 403,
  });
  const events = new MidiSimulator(new MidiEventBus(), () => 0).sequence([
    { pitch: 60, onset: 0, duration: 300 },
  ]);
  const recording = await service.record(teacher, {
    title: "Developer MIDI Exercise",
    tempo: 80,
    events,
  });
  const tree = {
    modules: [
      {
        id: "m",
        title: "Developer Test Module",
        lessons: [
          {
            id: "l",
            title: "Developer Test Lesson",
            blocks: [
              {
                id: "text",
                schemaVersion: 1 as const,
                type: "TEXT" as const,
                config: { text: "Developer fixture only." },
              },
              {
                id: "midi",
                schemaVersion: 1 as const,
                type: "MIDI_EXERCISE" as const,
                config: {
                  recordingId: recording.id,
                  template: "PLAY_THESE_NOTES" as const,
                  scoring: defaultScoring,
                },
              },
            ],
          },
        ],
      },
    ],
  };
  await expect(
    service.saveDraft(outsider, {
      courseId: c.id,
      versionId: d.id,
      revision: d.revision,
      tree,
      metadata: d.metadata,
      visibility: "PUBLIC",
    }),
  ).rejects.toMatchObject({ status: 403 });
  d = await service.saveDraft(teacher, {
    courseId: c.id,
    versionId: d.id,
    revision: d.revision,
    tree,
    metadata: {
      ...d.metadata,
      rights: { status: "ORIGINAL", owner: "Developer", notes: "Test fixture" },
    },
    visibility: "PUBLIC",
  });
  await expect(
    service.saveDraft(teacher, {
      courseId: c.id,
      versionId: d.id,
      revision: 0,
      tree,
      metadata: d.metadata,
      visibility: "PUBLIC",
    }),
  ).rejects.toMatchObject({ status: 409 });
  await service.publish(teacher, c.id, d.id, d.revision);
  const enrolled = await service.enroll(student, c.id);
  expect(enrolled.versionId).toBe(d.id);
  expect((await service.enroll(student, c.id)).id).toBe(enrolled.id);
  await expect(service.enrolled(outsider, enrolled.id)).rejects.toMatchObject({
    status: 404,
  });
  await expect(
    service.completeLesson(student, enrolled.id, "l", {}),
  ).rejects.toThrow("Pass each MIDI");
  const performance = await service.submitPerformance(student, {
    enrollmentId: enrolled.id,
    lessonId: "l",
    blockId: "midi",
    mode: "PERFORMANCE",
    tempo: 80,
    events,
  });
  expect(performance.score).toBe(100);
  expect(performance.events).toHaveLength(2);
  expect(await service.completeLesson(student, enrolled.id, "l", {})).toEqual({
    completedLessons: 1,
    totalLessons: 1,
  });
  expect(await service.completeLesson(student, enrolled.id, "l", {})).toEqual({
    completedLessons: 1,
    totalLessons: 1,
  });
  expect((await service.analytics(teacher)).progress).toHaveLength(1);
  expect((await service.analytics(outsider)).students).toHaveLength(0);
  const next = await service.newDraft(teacher, c.id);
  expect(next.number).toBe(2);
  await service.publish(teacher, c.id, next.id, next.revision);
  expect((await service.enrolled(student, enrolled.id)).version.id).toBe(d.id);
  await expect(
    service.saveDraft(teacher, {
      courseId: c.id,
      versionId: d.id,
      revision: d.revision,
      tree,
      metadata: d.metadata,
      visibility: "PUBLIC",
    }),
  ).rejects.toMatchObject({ status: 409 });
});
it("private courses need a relationship and authorized assignment", async () => {
  const course = await service.createCourse(
    teacher,
    "Private Developer Fixture",
  );
  const d = (await service.draft(teacher, course.id)).draft!;
  const saved = await service.saveDraft(teacher, {
    courseId: course.id,
    versionId: d.id,
    revision: 0,
    tree: {
      modules: [
        {
          id: "pm",
          title: "Fixture",
          lessons: [
            {
              id: "pl",
              title: "Fixture",
              blocks: [
                {
                  id: "pb",
                  schemaVersion: 1,
                  type: "TEXT",
                  config: { text: "Fixture" },
                },
              ],
            },
          ],
        },
      ],
    },
    metadata: {
      ...d.metadata,
      rights: { status: "ORIGINAL", owner: "Developer", notes: "" },
    },
    visibility: "PRIVATE",
  });
  await service.publish(teacher, course.id, saved.id, saved.revision);
  await expect(service.enroll(student, course.id)).rejects.toMatchObject({
    status: 403,
  });
  await expect(
    service.assignCourse(teacher, course.id, student.id, "Test"),
  ).rejects.toMatchObject({ status: 403 });
  const invite = await service.invite(teacher, "student@example.test");
  await expect(
    service.acceptInvitation(outsider, invite.token),
  ).rejects.toMatchObject({ status: 403 });
  await service.acceptInvitation(student, invite.token);
  await service.assignCourse(
    teacher,
    course.id,
    student.id,
    "Developer test assignment",
  );
  expect(
    (await service.studentCourses(student)).some(
      (c) => c.enrollment.courseId === course.id,
    ),
  ).toBe(true);
});
