import type { R2Bucket, R2UploadedPart } from "@cloudflare/workers-types";
import { z } from "zod";
import { D1Platform, type HostedActor, type Asset } from "./service";
import { DomainError, requireRole } from "../src/domains/auth/permissions";
import { rightsSchema } from "../src/domains/blocks/schema";
import {
  VIDEO_UPLOAD_LIMIT,
  VIDEO_PART_SIZE,
} from "../src/domains/media/upload-limits";
import { validMediaHeader } from "./uploads";

interface Session {
  id: string;
  uploaderId: string;
  courseId: string;
  ownerId: string;
  uploadId: string;
  filename: string;
  size: number;
  rights: unknown;
  parts: string;
  state: string;
  createdAt: string;
}

async function discard(
  bucket: R2Bucket,
  service: D1Platform,
  session: Session,
) {
  // A lost completion response must never cause deletion of a saved asset.
  const asset = await service.one<Asset>(
    "SELECT * FROM assets WHERE id=?",
    session.id,
  );
  if (!asset) {
    await bucket
      .resumeMultipartUpload(`course-files/${session.id}`, session.uploadId)
      .abort();
    await bucket.delete(`course-files/${session.id}`);
  }
  await service.stmt("DELETE FROM video_uploads WHERE id=?", session.id).run();
}

export async function uploadVideo(
  request: Request,
  bucket: R2Bucket,
  service: D1Platform,
  actor: HostedActor,
) {
  requireRole(actor, "TEACHER");
  const url = new URL(request.url),
    params = url.searchParams;
  const action = url.pathname.slice("/api/uploads/video/".length);
  if (action === "start") {
    const courseId = z.string().min(1).max(200).parse(params.get("courseId"));
    const course = await service.course(actor, courseId, "edit");
    const filename = z
      .string()
      .trim()
      .min(1)
      .max(200)
      .parse(params.get("filename"));
    const extension = filename.split(".").at(-1)!.toLowerCase();
    if (!["mp4", "webm"].includes(extension))
      throw new DomainError("Choose an MP4 or WebM video.");
    const size = Number(params.get("size"));
    if (!Number.isSafeInteger(size) || size <= 0 || size > VIDEO_UPLOAD_LIMIT)
      throw new DomainError("Choose a non-empty video up to 1 GB.", 413);
    const rights = rightsSchema.parse(JSON.parse(params.get("rights") ?? "{}"));
    const expired = await service.all<Session>(
      "SELECT * FROM video_uploads WHERE uploader_id=? AND created_at<? LIMIT 20",
      actor.id,
      new Date(Date.now() - 86400000).toISOString(),
    );
    for (const session of expired) await discard(bucket, service, session);
    const id = crypto.randomUUID();
    const multipart = await bucket.createMultipartUpload(`course-files/${id}`, {
      httpMetadata: {
        contentType: extension === "mp4" ? "video/mp4" : "video/webm",
      },
      customMetadata: { filename, ownerId: course.ownerId, courseId },
    });
    try {
      await service
        .stmt(
          "INSERT INTO video_uploads(id,uploader_id,course_id,owner_id,upload_id,filename,size,rights,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
          id,
          actor.id,
          courseId,
          course.ownerId,
          multipart.uploadId,
          filename,
          size,
          JSON.stringify(rights),
          new Date().toISOString(),
        )
        .run();
    } catch (error) {
      await multipart.abort();
      throw error;
    }
    return { id, partSize: VIDEO_PART_SIZE };
  }
  if (!["part", "complete", "abort"].includes(action))
    throw new DomainError("Not found", 404);
  const id = z.string().uuid().parse(params.get("id"));
  const session = await service.one<Session>(
    "SELECT * FROM video_uploads WHERE id=? AND uploader_id=?",
    id,
    actor.id,
  );
  if (!session)
    throw new DomainError(
      "Upload not found. Choose the file and try again.",
      404,
    );
  if (action === "abort") {
    await discard(bucket, service, session);
    return { aborted: true };
  }
  await service.course(actor, session.courseId, "edit");
  const existing = await service.one<Asset>(
    "SELECT * FROM assets WHERE id=?",
    id,
  );
  if (action === "complete" && existing) return { asset: existing };
  if (session.state !== "UPLOADING")
    throw new DomainError("Upload is already complete.", 409);
  if (Date.now() - Date.parse(session.createdAt) > 86400000)
    throw new DomainError(
      "Upload expired. Choose the file and try again.",
      410,
    );
  const key = `course-files/${id}`,
    multipart = bucket.resumeMultipartUpload(key, session.uploadId);
  const count = Math.ceil(session.size / VIDEO_PART_SIZE);
  if (action === "part") {
    const partNumber = Number(params.get("partNumber"));
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > count)
      throw new DomainError("Invalid video part.");
    const expected = Math.min(
      VIDEO_PART_SIZE,
      session.size - (partNumber - 1) * VIDEO_PART_SIZE,
    );
    if (
      Number(request.headers.get("content-length")) !== expected ||
      !request.body
    )
      throw new DomainError("Video part has an incorrect size.", 413);
    const part = await multipart.uploadPart(partNumber, request.body as never);
    // Store R2's part receipt, never a client-supplied ETag. Retrying replaces only this part.
    await service
      .stmt(
        "UPDATE video_uploads SET parts=json_set(parts,?,json(?)) WHERE id=? AND state='UPLOADING'",
        `$."${partNumber}"`,
        JSON.stringify(part),
        id,
      )
      .run();
    return { partNumber };
  }
  const receipts = JSON.parse(session.parts) as Record<string, R2UploadedPart>;
  const parts: R2UploadedPart[] = [];
  for (let n = 1; n <= count; n++) {
    if (!receipts[n])
      throw new DomainError(
        "Some video parts are missing. Retry the upload.",
        409,
      );
    parts.push(receipts[n]);
  }
  // R2 completion may have succeeded even if its response or the subsequent D1 write failed.
  if (!(await bucket.head(key))) await multipart.complete(parts);
  const header = await bucket.get(key, {
    range: { offset: 0, length: Math.min(16, session.size) },
  });
  if (
    !header ||
    header.size !== session.size ||
    !validMediaHeader(
      new Uint8Array(await header.arrayBuffer()),
      session.filename.split(".").at(-1)!.toLowerCase(),
    )
  ) {
    await bucket.delete(key);
    await service.stmt("DELETE FROM video_uploads WHERE id=?", id).run();
    throw new DomainError("This file is not a supported MP4 or WebM video.");
  }
  const asset: Asset = {
    id,
    ownerId: session.ownerId,
    title: session.filename,
    kind: "VIDEO",
    url: `/api/files/${id}`,
    rights: session.rights,
  };
  await service.db.batch([
    service.stmt(
      "INSERT INTO assets VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
      id,
      asset.ownerId,
      asset.title,
      asset.kind,
      asset.url,
      JSON.stringify(asset.rights),
      new Date().toISOString(),
    ),
    service.stmt("UPDATE video_uploads SET state='COMPLETE' WHERE id=?", id),
  ]);
  return { asset };
}
