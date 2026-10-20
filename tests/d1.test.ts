import { beforeAll, afterAll, it, expect } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import type { D1Database } from "@cloudflare/workers-types";
import {
  D1Platform,
  type Version,
  type Recording,
  type Enrollment,
} from "../hosted/service";
import { defaultScoring } from "../src/domains/blocks/schema";
import { MidiSimulator, MidiEventBus } from "../src/domains/midi/engine";
import { sightLibrary, noteGroups } from "../hosted/sight-library";
import type { Exercise } from "../hosted/sight-library";
const mf = new Miniflare({
  modules: true,
  scriptPath: "dist/server/index.js",
  compatibilityDate: "2026-05-01",
  d1Databases: ["DB"],
  bindings: { PIANOPATH_OWNER_EMAIL: "owner@example.test" },
});
let platform: D1Platform;
beforeAll(async () => {
  const db = await mf.getD1Database("DB");
  for (const f of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    for (const statement of readFileSync(`drizzle/${f}`, "utf8").split(
      "--> statement-breakpoint",
    ))
      if (statement.trim()) await db.prepare(statement).run();
  platform = new D1Platform(db as unknown as D1Database);
});
afterAll(() => mf.dispose());
it("synchronizes OBS by account, rejects stale writes and reads authoritative best scores", async () => {
  const actor = await platform.ensureUser(
    "obs-user",
    "obs@example.test",
    "OBS tester",
  );
  const headers = {
    "oai-authenticated-user-id": actor.id,
    "oai-authenticated-user-email": actor.email,
    Origin: "https://example.test",
    "Content-Type": "application/json",
  };
  const url = "https://example.test/api/obs";
  const sourceId = crypto.randomUUID(),
    secondId = crypto.randomUUID();
  const snapshot = {
    exerciseNumber: 1,
    title: "Exercise 1",
    hand: "right",
    status: "practicing",
    accuracy: 75,
    mistakes: 1,
    measure: 2,
    totalMeasures: 16,
  };
  const post = (
    source: string,
    sequence: number,
    claim: boolean,
    s = snapshot,
  ) =>
    mf.dispatchFetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ sourceId: source, sequence, claim, snapshot: s }),
    });
  expect((await mf.dispatchFetch(url)).status).toBe(401);
  expect(
    (
      await mf.dispatchFetch(url, {
        method: "POST",
        headers: { ...headers, Origin: "https://evil.test" },
        body: "{}",
      })
    ).status,
  ).toBe(403);
  expect(await (await post(sourceId, 2, true)).json()).toEqual({
    accepted: true,
  });
  expect(await (await post(sourceId, 1, true)).json()).toEqual({
    accepted: false,
  });
  expect(
    ((await (await mf.dispatchFetch(url, { headers })).json()) as any).snapshot,
  ).toEqual(snapshot);
  const other = await mf.dispatchFetch(url, {
    headers: { ...headers, "oai-authenticated-user-id": "another-user" },
  });
  expect(((await other.json()) as any).snapshot).toBeNull();
  expect(
    await (
      await post(secondId, 1, true, { ...snapshot, title: "New selection" })
    ).json(),
  ).toEqual({ accepted: true });
  expect(await (await post(sourceId, 3, false)).json()).toEqual({
    accepted: false,
  });
  await platform.command(actor, {
    action: "sightAttempt",
    exerciseNumber: 1,
    hand: "right",
    played: noteGroups(sightLibrary[0], "right").flatMap((g) => g.pitches),
  });
  const saved = (await (
    await mf.dispatchFetch(url, { headers })
  ).json()) as any;
  expect(saved).toMatchObject({
    best: 100,
    attempts: 1,
    snapshot: { title: "New selection" },
  });
  expect(
    (await post(secondId, 2, false, { ...snapshot, measure: 999 })).status,
  ).toBe(400);
});
it("serves all ten beginner pieces from D1 and saves completed repertoire practice", async () => {
  const actor = await platform.ensureUser(
    "beginner-student",
    "beginner@example.test",
    "Beginner student",
  );
  const view = await platform.view(actor, "/student/practice");
  const catalog = (view.practiceExercises as Exercise[]).filter(
    (e) => e.collection === "beginner-pieces",
  );
  expect(catalog).toHaveLength(10);
  expect(catalog.every((e) => !e.polyphony)).toBe(true);
  const piece = (await platform.command(actor, {
    action: "practiceExercise",
    exerciseNumber: 4003,
  })) as Exercise;
  expect(piece.title).toBe("Hot Cross Buns");
  const played = noteGroups(piece, "both").flatMap((g) => g.pitches);
  await expect(
    platform.command(actor, {
      action: "sightAttempt",
      exerciseNumber: 4003,
      hand: "both",
      played: played.slice(0, -1),
    }),
  ).rejects.toMatchObject({ status: 400 });
  const result = await platform.command(actor, {
    action: "sightAttempt",
    exerciseNumber: 4003,
    hand: "both",
    played,
  });
  expect(result).toMatchObject({ exerciseNumber: 4003, accuracy: 100 });
});
it("keeps removed Czerny collections and Zelda's Lullaby out of the practice catalog", async () => {
  const actor=await platform.ensureUser("removed-catalog","removed@example.test","Catalog test");
  const view=await platform.view(actor,"/student/practice");
  expect((view.practiceExercises as Exercise[]).some(e=>e.collection?.startsWith("czerny-")||e.number===7002)).toBe(false);
  for(const exerciseNumber of [3100,6001,7002]) await expect(platform.command(actor,{action:"practiceExercise",exerciseNumber})).rejects.toMatchObject({status:404});
});
it("imports all 213 Schmitt definitions into D1 and scores saved practice from the database", async () => {
  const student = await platform.ensureUser(
    "schmitt-student",
    "schmitt@example.test",
    "Schmitt student",
  );
  const view = await platform.view(student, "/student/practice");
  const exercises = (view.practiceExercises as Exercise[]).filter(
    (e) => e.collection === "schmitt-op16",
  );
  expect(exercises).toHaveLength(213);
  expect(exercises[0].number).toBe(2001);
  expect(exercises.at(-1)?.number).toBe(2213);
  const heldExercise = exercises[110];
  const result = await platform.command(student, {
    action: "sightAttempt",
    exerciseNumber: heldExercise.number,
    hand: "both",
    played: noteGroups(heldExercise, "both").flatMap((g) => g.pitches),
  });
  expect(result).toMatchObject({
    exerciseNumber: 2111,
    accuracy: 100,
    mistakes: 0,
  });
  const saved = await platform.view(student, "/student/practice");
  expect(saved.sightAttempts).toHaveLength(1);
  await expect(
    platform.command(student, {
      action: "sightAttempt",
      exerciseNumber: 9999,
      hand: "both",
      played: [60],
    }),
  ).rejects.toMatchObject({ status: 404 });
});
it("saves completed sight-reading results and isolates each learner's history", async () => {
  const student = await platform.ensureUser(
    "sight-student",
    "sight@example.test",
    "Sight student",
  );
  const other = await platform.ensureUser(
    "sight-other",
    "sight-other@example.test",
    "Other",
  );
  const played = noteGroups(sightLibrary[0], "both").flatMap((g) => g.pitches);
  await expect(
    platform.command(student, {
      action: "sightAttempt",
      exerciseNumber: 1,
      hand: "both",
      played: [60],
    }),
  ).rejects.toMatchObject({ status: 400 });
  const result = await platform.command(student, {
    action: "sightAttempt",
    exerciseNumber: 1,
    hand: "both",
    played: [61, ...played],
  });
  expect(result).toMatchObject({
    exerciseNumber: 1,
    hand: "both",
    mistakes: 1,
  });
  const own = await platform.view(student, "/student/sight-read");
  const theirs = await platform.view(other, "/student/sight-read");
  expect(own.sightAttempts).toHaveLength(1);
  expect(theirs.sightAttempts).toHaveLength(0);
});
it("D1 authoring, immutable publishing, scoring, enrollment and atomic progress", async () => {
  const teacher = await platform.ensureUser(
      "teacher",
      "owner@example.test",
      "Owner",
      "owner@example.test",
    ),
    student = await platform.ensureUser(
      "student",
      "student@example.test",
      "Student",
    ),
    outsider = await platform.ensureUser(
      "outsider",
      "other@example.test",
      "Outsider",
    );
  expect(student.roles).toEqual(["STUDENT"]);
  const course = (await platform.command(teacher, {
    action: "createCourse",
    title: "Developer D1 Course",
  })) as { id: string };
  let version = (
    await platform.all<Version>(
      "SELECT * FROM versions WHERE course_id=?",
      course.id,
    )
  )[0];
  await expect(
    platform.command(outsider, { action: "newDraft", courseId: course.id }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    platform.view(outsider, `/teacher/courses/${course.id}`),
  ).rejects.toMatchObject({ status: 403 });
  const events = new MidiSimulator(new MidiEventBus(), () => 0).sequence([
    { pitch: 60, onset: 0, duration: 400 },
  ]);
  const recording = (await platform.command(teacher, {
    action: "record",
    data: { title: "Developer MIDI fixture", tempo: 80, events },
  })) as Recording;
  const tree = {
    modules: [
      {
        id: "module",
        title: "Developer module",
        lessons: [
          {
            id: "lesson",
            title: "Developer lesson",
            blocks: [
              {
                id: "exercise",
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
  };
  const save = {
    action: "saveDraft",
    courseId: course.id,
    versionId: version.id,
    revision: 0,
    tree,
    metadata: {
      ...version.metadata,
      rights: { status: "ORIGINAL", owner: "Developer fixture", notes: "" },
    },
    visibility: "PUBLIC",
  };
  version = (await platform.command(teacher, save)) as Version;
  await expect(platform.command(teacher, save)).rejects.toMatchObject({
    status: 409,
  });
  expect(
    (
      await platform.one<Version>(
        "SELECT * FROM versions WHERE id=?",
        version.id,
      )
    )?.revision,
  ).toBe(1);
  await platform.command(teacher, {
    action: "publish",
    courseId: course.id,
    versionId: version.id,
    revision: 1,
  });
  const enrollment = (await platform.command(student, {
    action: "enroll",
    courseId: course.id,
  })) as Enrollment;
  await expect(
    platform.enrolled(outsider, enrollment.id),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    platform.command(student, {
      action: "complete",
      enrollmentId: enrollment.id,
      lessonId: "lesson",
    }),
  ).rejects.toThrow("Pass each");
  const result = (await platform.command(student, {
    action: "perform",
    data: {
      enrollmentId: enrollment.id,
      lessonId: "lesson",
      blockId: "exercise",
      mode: "PERFORMANCE",
      tempo: 80,
      events,
    },
  })) as { analysis: { overall: number } };
  expect(result.analysis.overall).toBe(100);
  await platform.command(student, {
    action: "complete",
    enrollmentId: enrollment.id,
    lessonId: "lesson",
  });
  await platform.command(student, {
    action: "complete",
    enrollmentId: enrollment.id,
    lessonId: "lesson",
  });
  expect((await platform.analytics(teacher)).progress).toHaveLength(1);
  const next = (await platform.command(teacher, {
    action: "newDraft",
    courseId: course.id,
  })) as Version;
  await platform.command(teacher, {
    action: "publish",
    courseId: course.id,
    versionId: next.id,
    revision: 0,
  });
  expect((await platform.enrolled(student, enrollment.id)).version.id).toBe(
    version.id,
  );
  await expect(
    platform
      .stmt("UPDATE versions SET tree=? WHERE id=?", "{}", version.id)
      .run(),
  ).rejects.toThrow("immutable");
});
it("D1 invitations, private assignment and media metadata persist", async () => {
  const teacher = await platform.ensureUser("t2", "t2@example.test", "Teacher");
  await platform
    .stmt("INSERT INTO roles VALUES('teacher-role','t2','TEACHER')")
    .run();
  teacher.roles.push("TEACHER");
  const student = await platform.ensureUser("s2", "s2@example.test", "Student");
  const invite = (await platform.command(teacher, {
    action: "invite",
    email: student.email,
  })) as { token: string };
  await expect(
    platform.command(teacher, { action: "acceptInvite", token: invite.token }),
  ).rejects.toMatchObject({ status: 403 });
  await platform.command(student, {
    action: "acceptInvite",
    token: invite.token,
  });
  await expect(
    platform.command(student, { action: "acceptInvite", token: invite.token }),
  ).rejects.toMatchObject({ status: 403 });
  const c = (await platform.command(teacher, {
    action: "createCourse",
    title: "Developer private course",
  })) as { id: string };
  const v = (
    await platform.all<Version>(
      "SELECT * FROM versions WHERE course_id=?",
      c.id,
    )
  )[0];
  await platform.command(teacher, {
    action: "saveDraft",
    courseId: c.id,
    versionId: v.id,
    revision: 0,
    visibility: "PRIVATE",
    metadata: {
      ...v.metadata,
      rights: { status: "ORIGINAL", owner: "Developer", notes: "" },
    },
    tree: {
      modules: [
        {
          id: "m",
          title: "Fixture",
          lessons: [
            {
              id: "l",
              title: "Fixture",
              blocks: [
                {
                  id: "b",
                  type: "TEXT",
                  schemaVersion: 1,
                  config: { text: "Fixture only" },
                },
              ],
            },
          ],
        },
      ],
    },
  });
  await platform.command(teacher, {
    action: "publish",
    courseId: c.id,
    versionId: v.id,
    revision: 1,
  });
  await expect(
    platform.command(student, { action: "enroll", courseId: c.id }),
  ).rejects.toMatchObject({ status: 403 });
  await platform.command(teacher, {
    action: "assign",
    courseId: c.id,
    studentId: student.id,
    instructions: "Developer test",
  });
  expect(
    await platform.one(
      "SELECT id FROM assignments WHERE assigned_to=?",
      student.id,
    ),
  ).toBeDefined();
  await platform.command(teacher, {
    action: "addMedia",
    title: "Technical fixture",
    kind: "MUSICXML",
    url: "https://example.test/fixture.musicxml",
    rights: { status: "ORIGINAL", owner: "Developer", notes: "" },
  });
  expect(
    await platform.one("SELECT id FROM assets WHERE owner_id=?", teacher.id),
  ).toBeDefined();
});
it("Worker rejects missing identity, cross-origin mutations and unprivileged admin access", async () => {
  expect(
    (await mf.dispatchFetch("https://example.test/api/platform")).status,
  ).toBe(401);
  const headers = {
    "oai-authenticated-user-id": "student",
    "oai-authenticated-user-email": "student@example.test",
  };
  expect(
    (
      await mf.dispatchFetch(
        "https://example.test/api/platform?path=/admin/users",
        { headers },
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await mf.dispatchFetch("https://example.test/api/platform", {
        method: "POST",
        headers: { ...headers, Origin: "https://evil.test" },
        body: JSON.stringify({ action: "createCourse", title: "Bad" }),
      })
    ).status,
  ).toBe(403);
});

it("serves the complete Burgmüller catalogue and saves both-hands attempts in D1", async () => {
  const actor = await platform.ensureUser(
    "burg-student",
    "burg@example.test",
    "Burg student",
  );
  const view = await platform.view(actor, "/student/practice");
  const catalog = (view.practiceExercises as Exercise[]).filter(
    (e) => e.collection === "burgmuller-op100",
  );
  expect(catalog).toHaveLength(25);
  expect(catalog.every((e) => !e.polyphony)).toBe(true);
  const ex = (await platform.command(actor, {
    action: "practiceExercise",
    exerciseNumber: 5025,
  })) as Exercise;
  const played = noteGroups(ex, "both").flatMap((g) => g.pitches);
  await expect(
    platform.command(actor, {
      action: "sightAttempt",
      exerciseNumber: 5025,
      hand: "right",
      played,
    }),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    platform.command(actor, {
      action: "sightAttempt",
      exerciseNumber: 5025,
      hand: "both",
      played: played.slice(0, -1),
    }),
  ).rejects.toMatchObject({ status: 400 });
  const result = await platform.command(actor, {
    action: "sightAttempt",
    exerciseNumber: 5025,
    hand: "both",
    played,
  });
  expect(result).toMatchObject({ exerciseNumber: 5025, accuracy: 100 });
  const refreshed = await platform.view(actor, "/student/practice");
  expect(refreshed.sightAttempts).toEqual(
    expect.arrayContaining([expect.objectContaining({ exerciseNumber: 5025 })]),
  );
});
