import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getActor } from "@/lib/session";
import { platform } from "@/lib/platform";
import { DomainError, requireRole } from "@/domains/auth/permissions";
import {
  treeSchema,
  metadataSchema,
  rightsSchema,
} from "@/domains/blocks/schema";
import { db } from "@/lib/db";
import * as s from "@/lib/schema";
const id = z.string().min(1).max(200);
const commands = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("createCourse"),
    title: z.string().trim().min(1).max(200),
  }),
  z.object({
    action: z.literal("saveDraft"),
    courseId: id,
    versionId: id,
    revision: z.number().int().min(0),
    tree: treeSchema,
    metadata: metadataSchema,
    visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]),
  }),
  z.object({ action: z.literal("newDraft"), courseId: id }),
  z.object({
    action: z.literal("publish"),
    courseId: id,
    versionId: id,
    revision: z.number().int().min(0),
  }),
  z.object({ action: z.literal("record"), data: z.unknown() }),
  z.object({ action: z.literal("enroll"), courseId: id }),
  z.object({ action: z.literal("perform"), data: z.unknown() }),
  z.object({
    action: z.literal("complete"),
    enrollmentId: id,
    lessonId: id,
    answers: z.record(z.string(), z.number().int()).default({}),
  }),
  z.object({ action: z.literal("invite"), email: z.email() }),
  z.object({ action: z.literal("acceptInvite"), token: z.string().max(100) }),
  z.object({
    action: z.literal("assign"),
    courseId: id,
    studentId: id,
    instructions: z.string().max(5000),
  }),
  z.object({
    action: z.literal("addMedia"),
    title: z.string().min(1).max(200),
    kind: z.enum(["IMAGE", "AUDIO", "VIDEO", "MUSICXML"]),
    url: z.url().refine((u) => u.startsWith("https://"), "Use an HTTPS URL"),
    rights: rightsSchema,
  }),
  z.object({
    action: z.literal("grantRole"),
    userId: id,
    role: z.enum(["STUDENT", "TEACHER", "ADMIN"]),
  }),
  z.object({
    action: z.literal("moderate"),
    courseId: id,
    status: z.enum(["IN_REVIEW", "ARCHIVED", "REJECTED"]),
    notes: z.string().min(1).max(5000),
  }),
]);
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (
      origin !==
      new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").origin
    )
      throw new DomainError("Invalid request origin", 403);
    if (Number(request.headers.get("content-length") ?? 0) > 2_000_000)
      throw new DomainError("Request too large", 413);
    const raw = await request.text();
    if (raw.length > 2_000_000) throw new DomainError("Request too large", 413);
    const c = commands.parse(JSON.parse(raw)),
      actor = await getActor();
    let result: unknown;
    switch (c.action) {
      case "createCourse":
        result = await platform.createCourse(actor, c.title);
        break;
      case "saveDraft":
        result = await platform.saveDraft(actor, c);
        break;
      case "newDraft":
        result = await platform.newDraft(actor, c.courseId);
        break;
      case "publish":
        result = await platform.publish(
          actor,
          c.courseId,
          c.versionId,
          c.revision,
        );
        break;
      case "record":
        result = await platform.record(actor, c.data);
        break;
      case "enroll":
        result = await platform.enroll(actor, c.courseId);
        break;
      case "perform":
        result = await platform.submitPerformance(actor, c.data);
        break;
      case "complete":
        result = await platform.completeLesson(
          actor,
          c.enrollmentId,
          c.lessonId,
          c.answers,
        );
        break;
      case "invite":
        result = await platform.invite(actor, c.email);
        break;
      case "acceptInvite":
        result = await platform.acceptInvitation(actor, c.token);
        break;
      case "assign":
        result = await platform.assignCourse(
          actor,
          c.courseId,
          c.studentId,
          c.instructions,
        );
        break;
      case "addMedia":
        requireRole(actor, "TEACHER");
        [result] = await db
          .insert(s.contentAssets)
          .values({
            ownerId: actor.id,
            title: c.title,
            kind: c.kind,
            url: c.url,
            rights: c.rights,
          })
          .returning();
        break;
      case "grantRole":
        requireRole(actor, "ADMIN");
        await db
          .insert(s.userRoles)
          .values({ userId: c.userId, role: c.role })
          .onConflictDoNothing();
        if (c.role === "TEACHER") {
          const [u] = await db
            .select()
            .from(s.user)
            .where(eq(s.user.id, c.userId));
          await db
            .insert(s.teacherProfiles)
            .values({ userId: c.userId, displayName: u.name })
            .onConflictDoNothing();
        }
        await db
          .insert(s.auditLog)
          .values({
            actorId: actor.id,
            action: "ROLE_GRANTED",
            resourceId: c.userId,
            details: { role: c.role },
          });
        result = { ok: true };
        break;
      case "moderate":
        requireRole(actor, "ADMIN");
        await db.transaction(async (tx) => {
          await tx
            .update(s.courses)
            .set({ status: c.status, updatedBy: actor.id })
            .where(eq(s.courses.id, c.courseId));
          await tx
            .insert(s.auditLog)
            .values({
              actorId: actor.id,
              action: "MODERATION",
              resourceId: c.courseId,
              details: { status: c.status, notes: c.notes },
            });
        });
        result = { ok: true };
        break;
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DomainError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
        { status: 400 },
      );
    console.error(error);
    return NextResponse.json(
      { error: "Unable to complete this request. Please try again." },
      { status: 500 },
    );
  }
}
