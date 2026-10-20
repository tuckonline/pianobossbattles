import { beforeAll, afterAll, it, expect } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import type { D1Database } from "@cloudflare/workers-types";
import { D1Platform, type HostedActor, type Version } from "../hosted/service";
import { importMidi } from "../hosted/uploads";
import MidiPackage from "@tonejs/midi";
import {
  VIDEO_PART_SIZE,
  VIDEO_UPLOAD_LIMIT,
} from "../src/domains/media/upload-limits";
const { Midi } = MidiPackage;
const mf = new Miniflare({
  modules: true,
  scriptPath: "dist/server/index.js",
  compatibilityDate: "2026-05-01",
  d1Databases: ["DB"],
  r2Buckets: ["BUCKET"],
  bindings: { PIANOPATH_OWNER_EMAIL: "owner@test.local" },
});
let service: D1Platform,
  teacher: HostedActor,
  student: HostedActor,
  courseId: string;
const rights = { status: "ORIGINAL", owner: "Test", notes: "" };
const headers = (id = "teacher", email = "owner@test.local") => ({
  "oai-authenticated-user-id": id,
  "oai-authenticated-user-email": email,
  Origin: "http://localhost",
});
beforeAll(async () => {
  const db = await mf.getD1Database("DB");
  for (const f of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    for (const sql of readFileSync(`drizzle/${f}`, "utf8").split(
      "--> statement-breakpoint",
    ))
      if (sql.trim()) await db.prepare(sql).run();
  service = new D1Platform(db as unknown as D1Database);
  teacher = await service.ensureUser(
    "teacher",
    "owner@test.local",
    "Teacher",
    "owner@test.local",
  );
  student = await service.ensureUser(
    "student",
    "student@test.local",
    "Student",
  );
  courseId = (
    (await service.command(teacher, {
      action: "createCourse",
      title: "Upload security test",
    })) as { id: string }
  ).id;
});
afterAll(() => mf.dispose());
function videoRequest(
  action: string,
  params: Record<string, string>,
  body?: Buffer,
  requestHeaders = headers(),
) {
  return mf.dispatchFetch(
    `http://localhost/api/uploads/video/${action}?${new URLSearchParams(params)}`,
    {
      method: "POST",
      headers: {
        ...requestHeaders,
        ...(body ? { "Content-Length": String(body.length) } : {}),
      },
      body,
    },
  );
}
function startVideo(size: number, requestHeaders = headers()) {
  return videoRequest(
    "start",
    {
      courseId,
      filename: "large.mp4",
      size: String(size),
      rights: JSON.stringify(rights),
    },
    undefined,
    requestHeaders,
  );
}

it("uploads a video larger than 100 MB in bounded chunks, retries parts, and completes idempotently", async () => {
  const size = 101 * 1024 * 1024;
  const start = await startVideo(size);
  expect(start.status).toBe(200);
  const session = (await start.json()) as { id: string; partSize: number };
  expect(session.partSize).toBe(VIDEO_PART_SIZE);
  expect((await videoRequest("complete", { id: session.id })).status).toBe(409);
  expect(
    (
      await videoRequest(
        "part",
        { id: session.id, partNumber: "1" },
        Buffer.alloc(1),
      )
    ).status,
  ).toBe(413);
  expect(
    (
      await videoRequest(
        "abort",
        { id: session.id },
        undefined,
        headers("other-teacher", "other@test.local"),
      )
    ).status,
  ).not.toBe(200);
  const chunk = Buffer.alloc(VIDEO_PART_SIZE, 7);
  chunk.write("ftyp", 4);
  for (let offset = 0, n = 1; offset < size; offset += VIDEO_PART_SIZE, n++) {
    const part = chunk.subarray(0, Math.min(VIDEO_PART_SIZE, size - offset));
    expect(
      (
        await videoRequest(
          "part",
          { id: session.id, partNumber: String(n) },
          part,
        )
      ).status,
    ).toBe(200);
    if (n === 1)
      expect(
        (await videoRequest("part", { id: session.id, partNumber: "1" }, part))
          .status,
      ).toBe(200);
  }
  const completed = await videoRequest("complete", { id: session.id });
  expect(completed.status).toBe(200);
  const { asset } = (await completed.json()) as {
    asset: { id: string; url: string };
  };
  expect((await videoRequest("complete", { id: session.id })).status).toBe(200);
  const info = await mf.dispatchFetch(`http://localhost${asset.url}`, {
    method: "HEAD",
    headers: headers(),
  });
  expect(Number(info.headers.get("Content-Length"))).toBe(size);
  const ending = await mf.dispatchFetch(`http://localhost${asset.url}`, {
    headers: { ...headers(), Range: "bytes=-16" },
  });
  expect(ending.status).toBe(206);
  expect(Buffer.from(await ending.arrayBuffer())).toEqual(Buffer.alloc(16, 7));
  // Cleanup after an uncertain client response preserves the completed video.
  expect((await videoRequest("abort", { id: session.id })).status).toBe(200);
  expect(
    await service.one("SELECT id FROM assets WHERE id=?", asset.id),
  ).toBeDefined();
}, 60000);

it("accepts the 1 GB boundary, rejects larger videos and unauthorized sessions, and removes aborted uploads", async () => {
  expect((await startVideo(VIDEO_UPLOAD_LIMIT + 1)).status).toBe(413);
  expect((await startVideo(0)).status).toBe(413);
  expect(
    (
      await startVideo(
        VIDEO_UPLOAD_LIMIT,
        headers("student", "student@test.local"),
      )
    ).status,
  ).toBe(403);
  const started = await startVideo(VIDEO_UPLOAD_LIMIT);
  expect(started.status).toBe(200);
  const { id } = (await started.json()) as { id: string };
  expect(
    (await videoRequest("part", { id, partNumber: "999" }, Buffer.alloc(1)))
      .status,
  ).toBe(400);
  expect((await videoRequest("abort", { id })).status).toBe(200);
  expect(
    await service.one("SELECT id FROM video_uploads WHERE id=?", id),
  ).toBeUndefined();
  expect(
    await service.one("SELECT id FROM assets WHERE id=?", id),
  ).toBeUndefined();
});

it("rejects invalid video content without publishing an asset", async () => {
  const started = await startVideo(16);
  const { id } = (await started.json()) as { id: string };
  expect(
    (await videoRequest("part", { id, partNumber: "1" }, Buffer.alloc(16)))
      .status,
  ).toBe(200);
  expect((await videoRequest("complete", { id })).status).toBe(400);
  expect(
    await service.one("SELECT id FROM assets WHERE id=?", id),
  ).toBeUndefined();
  expect(
    await (await mf.getR2Bucket("BUCKET")).head(`course-files/${id}`),
  ).toBeNull();
});
function upload(
  body: Buffer,
  filename = "lesson.wav",
  kind = "AUDIO",
  requestHeaders = headers(),
) {
  const query = new URLSearchParams({
    courseId,
    filename,
    kind,
    rights: JSON.stringify(rights),
  });
  return mf.dispatchFetch(`http://localhost/api/uploads?${query}`, {
    method: "POST",
    headers: {
      ...requestHeaders,
      "Content-Length": String(body.length),
      "Content-Type": "application/octet-stream",
    },
    body,
  });
}

it("stores files durably, supports seeking, and restricts students to referenced enrolled versions", async () => {
  const data = Buffer.from("RIFF1234WAVE test audio payload");
  const response = await upload(data);
  expect(response.status).toBe(201);
  const { asset } = (await response.json()) as {
    asset: { id: string; url: string };
  };
  const read = (h = headers(), extra: Record<string, string> = {}) =>
    mf.dispatchFetch(`http://localhost${asset.url}`, {
      headers: { ...h, ...extra },
    });
  expect(Buffer.from(await (await read()).arrayBuffer())).toEqual(data);
  const partial = await read(headers(), { Range: "bytes=5-8" });
  expect(partial.status).toBe(206);
  expect(partial.headers.get("Content-Range")).toBe(`bytes 5-8/${data.length}`);
  expect(Buffer.from(await partial.arrayBuffer())).toEqual(data.subarray(5, 9));
  expect((await read(headers(), { Range: "bytes=999-" })).status).toBe(416);
  expect((await read(headers("student", "student@test.local"))).status).toBe(
    403,
  );
  let version = (
    await service.all<Version>(
      "SELECT * FROM versions WHERE course_id=?",
      courseId,
    )
  )[0];
  const tree = {
    modules: [
      {
        id: "m",
        title: "Module",
        lessons: [
          {
            id: "l",
            title: "Lesson",
            blocks: [
              {
                id: "audio",
                type: "AUDIO",
                schemaVersion: 1,
                config: { assetId: asset.id, caption: "" },
              },
            ],
          },
        ],
      },
    ],
  };
  version = (await service.command(teacher, {
    action: "saveDraft",
    courseId,
    versionId: version.id,
    revision: version.revision,
    tree,
    metadata: { ...version.metadata, rights },
    visibility: "PUBLIC",
  })) as Version;
  await service.command(teacher, {
    action: "publish",
    courseId,
    versionId: version.id,
    revision: version.revision,
  });
  await service.command(student, { action: "enroll", courseId });
  expect((await read(headers("student", "student@test.local"))).status).toBe(
    200,
  );
  const other = (await (await upload(data)).json()) as {
    asset: { id: string; url: string };
  };
  const draft = (await service.command(teacher, {
    action: "newDraft",
    courseId,
  })) as Version;
  tree.modules[0].lessons[0].blocks[0].config.assetId = other.asset.id;
  await service.command(teacher, {
    action: "saveDraft",
    courseId,
    versionId: draft.id,
    revision: draft.revision,
    tree,
    metadata: draft.metadata,
    visibility: "PUBLIC",
  });
  expect(
    (
      await mf.dispatchFetch(`http://localhost${other.asset.url}`, {
        headers: headers("student", "student@test.local"),
      })
    ).status,
  ).toBe(403);
  expect((await read(headers("outsider", "outsider@test.local"))).status).toBe(
    403,
  );
  expect((await mf.dispatchFetch(`http://localhost${asset.url}`)).status).toBe(
    401,
  );
});

it("rejects unauthorized uploads, invalid types, malformed MIDI, and oversized files", async () => {
  expect(
    (
      await upload(
        Buffer.from("x"),
        "x.wav",
        "AUDIO",
        headers("student", "student@test.local"),
      )
    ).status,
  ).toBe(403);
  expect((await upload(Buffer.from("x"), "x.html")).status).toBe(400);
  expect((await upload(Buffer.from("not audio"), "x.wav")).status).toBe(400);
  expect((await upload(Buffer.from("x"), "x.mid", "MIDI")).status).toBe(400);
  expect(
    (
      await upload(Buffer.from("x"), "x.wav", "AUDIO", {
        ...headers(),
        Origin: "https://other.test",
      })
    ).status,
  ).toBe(403);
  expect(
    (await upload(Buffer.alloc(2 * 1024 * 1024 + 1), "x.mid", "MIDI")).status,
  ).toBe(413);
  const stranger = await service.ensureUser(
    "other-teacher",
    "other@test.local",
    "Other",
  );
  await service
    .stmt(
      "INSERT INTO roles(id,user_id,role) VALUES(?,?,'TEACHER')",
      "other-role",
      stranger.id,
    )
    .run();
  expect(
    (
      await upload(
        Buffer.from("x"),
        "x.wav",
        "AUDIO",
        headers(stranger.id, stranger.email),
      )
    ).status,
  ).toBe(403);
});

it("imports MIDI tempo changes and pedal data and retains the original file", async () => {
  const midi = new Midi();
  midi.header.tempos = [
    { ticks: 0, bpm: 120 },
    { ticks: 480, bpm: 60 },
  ];
  midi.header.update();
  midi
    .addTrack()
    .addNote({ midi: 60, ticks: 0, durationTicks: 960, velocity: 0.8 })
    .addCC({ number: 64, ticks: 240, value: 1 });
  const bytes = midi.toArray();
  const imported = importMidi(bytes);
  expect(imported.tempo).toBe(120);
  expect(
    imported.events.find((e) => e.type === "NOTE_OFF")?.timestamp,
  ).toBeCloseTo(1500);
  expect(
    imported.events.find((e) => e.type === "CONTROL_CHANGE"),
  ).toMatchObject({ controller: 64, value: 127, timestamp: 250 });
  const response = await upload(Buffer.from(bytes), "exercise.mid", "MIDI");
  expect(response.status).toBe(201);
  const result = (await response.json()) as {
    asset: { url: string };
    recording: { id: string; events: unknown[] };
  };
  expect(result.recording.events).toHaveLength(3);
  expect(
    await service.one(
      "SELECT * FROM recordings WHERE id=?",
      result.recording.id,
    ),
  ).toBeDefined();
  const original = await mf.dispatchFetch(
    `http://localhost${result.asset.url}`,
    { headers: headers() },
  );
  expect(Buffer.from(await original.arrayBuffer())).toEqual(Buffer.from(bytes));
});
