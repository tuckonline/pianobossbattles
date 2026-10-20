import type { R2Bucket } from "@cloudflare/workers-types";
import { z } from "zod";
import { Midi } from "@tonejs/midi";
import {
  D1Platform,
  type Asset,
  type HostedActor,
  type Version,
} from "./service";
import { DomainError, requireRole } from "../src/domains/auth/permissions";
import {
  midiEventSchema,
  rightsSchema,
  type MidiEvent,
} from "../src/domains/blocks/schema";
import { recordingToScore } from "../src/domains/music/model";

const formats: Record<string, { kind: string; mime: string }> = {
  mp4: { kind: "VIDEO", mime: "video/mp4" },
  webm: { kind: "VIDEO", mime: "video/webm" },
  mp3: { kind: "AUDIO", mime: "audio/mpeg" },
  wav: { kind: "AUDIO", mime: "audio/wav" },
  m4a: { kind: "AUDIO", mime: "audio/mp4" },
  ogg: { kind: "AUDIO", mime: "audio/ogg" },
  mid: { kind: "MIDI", mime: "audio/midi" },
  midi: { kind: "MIDI", mime: "audio/midi" },
};

export function validMediaHeader(bytes: Uint8Array, extension: string) {
  const text = new TextDecoder().decode(bytes);
  if (extension === "wav")
    return text.startsWith("RIFF") && text.slice(8, 12) === "WAVE";
  if (extension === "mp4" || extension === "m4a")
    return text.slice(4, 8) === "ftyp";
  if (extension === "webm")
    return (
      bytes[0] === 0x1a &&
      bytes[1] === 0x45 &&
      bytes[2] === 0xdf &&
      bytes[3] === 0xa3
    );
  if (extension === "ogg") return text.startsWith("OggS");
  if (extension === "mp3")
    return (
      text.startsWith("ID3") ||
      (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
    );
  return false;
}

export function importMidi(bytes: Uint8Array) {
  try {
    if (
      new TextDecoder().decode(bytes.slice(0, 4)) !== "MThd" ||
      bytes.length < 14
    )
      throw new Error("Invalid header");
    // Format 2 and SMPTE do not represent the shared musical timeline used by lessons.
    if (bytes[9] > 1 || bytes[12] & 128)
      throw new Error("Unsupported timeline");
    const midi = new Midi(bytes);
    const events: MidiEvent[] = [];
    for (const track of midi.tracks) {
      for (const note of track.notes) {
        events.push(
          {
            type: "NOTE_ON",
            timestamp: note.time * 1000,
            pitch: note.midi,
            velocity: Math.max(1, Math.round(note.velocity * 127)),
            channel: track.channel,
          },
          {
            type: "NOTE_OFF",
            timestamp: (note.time + note.duration) * 1000,
            pitch: note.midi,
            velocity: Math.round(note.noteOffVelocity * 127),
            channel: track.channel,
          },
        );
      }
      for (let controller = 0; controller < 128; controller++)
        for (const cc of track.controlChanges[controller] ?? [])
          events.push({
            type: "CONTROL_CHANGE",
            timestamp: cc.time * 1000,
            channel: track.channel,
            controller,
            value: Math.round(cc.value * 127),
          });
    }
    if (!events.some((e) => e.type === "NOTE_ON")) throw new Error("No notes");
    const valid = z.array(midiEventSchema).min(2).max(10000).parse(events);
    valid.sort(
      (a, b) =>
        a.timestamp - b.timestamp ||
        (a.type === "NOTE_OFF" ? -1 : b.type === "NOTE_OFF" ? 1 : 0),
    );
    const tempo = midi.header.tempos[0]?.bpm ?? 120;
    if (tempo < 20 || tempo > 300)
      throw new Error("Tempo outside supported range");
    return {
      events: valid,
      tempo,
      duration: Math.round(Math.max(...valid.map((e) => e.timestamp))),
    };
  } catch {
    throw new DomainError(
      "Use a valid MIDI format 0 or 1 file with notes, up to 10,000 note/control events, one hour, and a starting tempo of 20–300 BPM.",
    );
  }
}

export async function uploadFile(
  request: Request,
  bucket: R2Bucket,
  service: D1Platform,
  actor: HostedActor,
) {
  requireRole(actor, "TEACHER");
  const params = new URL(request.url).searchParams;
  const courseId = z.string().min(1).max(200).parse(params.get("courseId"));
  const course = await service.course(actor, courseId, "edit");
  const filename = z
    .string()
    .trim()
    .min(1)
    .max(200)
    .parse(params.get("filename"));
  const kind = z.enum(["VIDEO", "AUDIO", "MIDI"]).parse(params.get("kind"));
  const format = formats[filename.split(".").at(-1)!.toLowerCase()];
  if (!format || format.kind !== kind)
    throw new DomainError("Choose a supported file type for this block.");
  const size = Number(request.headers.get("content-length"));
  const limit = (kind === "MIDI" ? 2 : 100) * 1024 * 1024;
  if (!Number.isSafeInteger(size) || size <= 0 || !request.body)
    throw new DomainError("The file is empty or its size is unavailable.", 400);
  if (size > limit)
    throw new DomainError(
      `File exceeds the ${kind === "MIDI" ? 2 : 100} MB limit.`,
      413,
    );
  const rights = rightsSchema.parse(JSON.parse(params.get("rights") ?? "{}"));
  const id = crypto.randomUUID(),
    stamp = new Date().toISOString();
  const asset: Asset = {
    id,
    ownerId: course.ownerId,
    title: filename,
    kind,
    url: `/api/files/${id}`,
    rights,
  };
  // Media streams directly into R2, avoiding a video-sized allocation in the Worker.
  const midiBytes =
    kind === "MIDI" ? new Uint8Array(await request.arrayBuffer()) : undefined;
  const imported = midiBytes ? importMidi(midiBytes) : undefined;
  const recording = imported
    ? { id, ownerId: course.ownerId, title: filename, ...imported }
    : undefined;
  const key = `course-files/${id}`;
  try {
    await bucket.put(key, (midiBytes ?? request.body) as never, {
      httpMetadata: { contentType: format.mime },
      customMetadata: { filename, ownerId: course.ownerId, courseId },
    });
    if (!midiBytes) {
      const header = await bucket.get(key, {
        range: { offset: 0, length: Math.min(size, 16) },
      });
      if (
        !header ||
        header.size !== size ||
        !validMediaHeader(
          new Uint8Array(await header.arrayBuffer()),
          filename.split(".").at(-1)!.toLowerCase(),
        )
      )
        throw new DomainError(
          "This file does not contain the selected audio or video format. Export it in a supported format and try again.",
        );
    }
    const statements = [
      service.stmt(
        "INSERT INTO assets VALUES(?,?,?,?,?,?,?)",
        id,
        course.ownerId,
        filename,
        kind,
        asset.url,
        JSON.stringify(rights),
        stamp,
      ),
    ];
    if (recording)
      statements.push(
        service.stmt(
          "INSERT INTO recordings VALUES(?,?,?,?,?,?,?,?)",
          id,
          course.ownerId,
          filename,
          recording.tempo,
          recording.duration,
          JSON.stringify(recording.events),
          JSON.stringify(recordingToScore(recording.events, recording.tempo)),
          stamp,
        ),
      );
    await service.db.batch(statements);
  } catch (error) {
    await bucket.delete(key).catch(() => {});
    throw error;
  }
  return { asset, recording };
}

export async function readFile(
  request: Request,
  bucket: R2Bucket,
  service: D1Platform,
  actor: HostedActor,
) {
  const id = new URL(request.url).pathname.slice("/api/files/".length);
  const asset = await service.one<Asset>("SELECT * FROM assets WHERE id=?", id);
  if (!asset || asset.url !== `/api/files/${id}`)
    throw new DomainError("File not found", 404);
  const key = `course-files/${id}`;
  const info = await bucket.head(key);
  if (!info) throw new DomainError("File not found", 404);
  if (asset.ownerId !== actor.id && !actor.roles.includes("ADMIN")) {
    let canEditOrigin = false;
    if (info.customMetadata?.courseId) {
      try {
        await service.course(actor, info.customMetadata.courseId, "edit");
        canEditOrigin = true;
      } catch (error) {
        if (!(error instanceof DomainError)) throw error;
      }
    }
    // A learner receives only files referenced by their enrolled version, never later drafts.
    const versions = await service.all<Version>(
      `SELECT v.* FROM versions v JOIN courses c ON c.id=v.course_id WHERE
       c.owner_id=? OR EXISTS(SELECT 1 FROM collaborators x WHERE x.course_id=c.id AND x.user_id=?)
       OR EXISTS(SELECT 1 FROM enrollments e WHERE e.version_id=v.id AND e.student_id=?)`,
      actor.id,
      actor.id,
      actor.id,
    );
    const allowed = versions.some((v) =>
      v.tree.modules.some((m) =>
        m.lessons.some((l) =>
          l.blocks.some(
            (b) =>
              ("assetId" in b.config && b.config.assetId === id) ||
              ("recordingId" in b.config && b.config.recordingId === id),
          ),
        ),
      ),
    );
    if (!allowed && !canEditOrigin)
      throw new DomainError("File access denied", 403);
  }
  const headers = new Headers({
    "Content-Type":
      info.httpMetadata?.contentType ?? "application/octet-stream",
    "Content-Length": String(info.size),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    ETag: info.httpEtag,
  });
  if (request.method === "HEAD") return new Response(null, { headers });
  const range = request.headers.get("range");
  let offset = 0,
    end = info.size - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2]))
      return new Response(null, {
        status: 416,
        headers: {
          ...Object.fromEntries(headers),
          "Content-Range": `bytes */${info.size}`,
          "Content-Length": "0",
        },
      });
    if (!match[1]) offset = Math.max(0, info.size - Number(match[2]));
    else {
      offset = Number(match[1]);
      if (match[2]) end = Math.min(end, Number(match[2]));
    }
    if (
      !Number.isSafeInteger(offset) ||
      !Number.isSafeInteger(end) ||
      offset > end ||
      offset >= info.size
    )
      return new Response(null, {
        status: 416,
        headers: {
          ...Object.fromEntries(headers),
          "Content-Range": `bytes */${info.size}`,
          "Content-Length": "0",
        },
      });
    headers.set("Content-Range", `bytes ${offset}-${end}/${info.size}`);
    headers.set("Content-Length", String(end - offset + 1));
  }
  const object = await bucket.get(
    key,
    range ? { range: { offset, length: end - offset + 1 } } : undefined,
  );
  if (!object) throw new DomainError("File not found", 404);
  return new Response(object.body as never, {
    status: range ? 206 : 200,
    headers,
  });
}
