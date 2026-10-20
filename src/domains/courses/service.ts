import { and, eq, desc, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db";
import * as s from "@/lib/schema";
import {
  metadataSchema,
  treeSchema,
  midiEventSchema,
  type CourseTree,
  type CourseMetadata,
} from "../blocks/schema";
import {
  DomainError,
  requireRole,
  canEdit,
  canInstruct,
  type Actor,
} from "../auth/permissions";
import { scorePerformance } from "../scoring/engine";
import { pairNotes, recordingToScore } from "../music/model";
import { createHash, randomBytes } from "node:crypto";
export class PlatformService {
  constructor(private db: Database) {}
  async courseAccess(
    actor: Actor,
    courseId: string,
    permission: "read" | "edit" | "instruct" | "owner" = "read",
  ) {
    const [course] = await this.db
      .select()
      .from(s.courses)
      .where(eq(s.courses.id, courseId));
    if (!course) throw new DomainError("Course not found", 404);
    const [collab] = await this.db
      .select()
      .from(s.collaborators)
      .where(
        and(
          eq(s.collaborators.courseId, courseId),
          eq(s.collaborators.userId, actor.id),
        ),
      );
    const owner = actor.id === course.ownerId || actor.roles.includes("ADMIN");
    if (
      permission === "owner"
        ? !owner
        : permission === "edit"
          ? !canEdit(actor, course.ownerId, collab?.role)
          : permission === "instruct"
            ? !canInstruct(actor, course.ownerId, collab?.role)
            : !owner && !collab
    )
      throw new DomainError("Course access denied", 403);
    return course;
  }
  async createCourse(actor: Actor, title: string) {
    requireRole(actor, "TEACHER");
    const metadata = metadataSchema.parse({
      title,
      description: "",
      rights: { status: "UNKNOWN", owner: "", notes: "" },
    });
    const id = crypto.randomUUID();
    return this.db.transaction(async (tx) => {
      const [course] = await tx
        .insert(s.courses)
        .values({
          id,
          slug: `course-${id}`,
          ownerId: actor.id,
          metadata,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning();
      await tx
        .insert(s.versions)
        .values({
          courseId: id,
          number: 1,
          metadata,
          tree: { modules: [] },
          createdBy: actor.id,
          updatedBy: actor.id,
        });
      return course;
    });
  }
  async teacherCourses(actor: Actor) {
    requireRole(actor, "TEACHER");
    const memberships = await this.db
      .select()
      .from(s.collaborators)
      .where(eq(s.collaborators.userId, actor.id));
    const owned = await this.db
      .select()
      .from(s.courses)
      .where(eq(s.courses.ownerId, actor.id));
    const shared = memberships.length
      ? await this.db
          .select()
          .from(s.courses)
          .where(
            inArray(
              s.courses.id,
              memberships.map((m) => m.courseId),
            ),
          )
      : [];
    return [...owned, ...shared].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );
  }
  async draft(actor: Actor, courseId: string) {
    const course = await this.courseAccess(actor, courseId);
    const versions = await this.db
      .select()
      .from(s.versions)
      .where(eq(s.versions.courseId, courseId))
      .orderBy(desc(s.versions.number));
    return {
      course,
      versions,
      draft: versions.find((v) => v.status === "DRAFT") ?? null,
    };
  }
  private async validateReferences(
    actor: Actor,
    tree: CourseTree,
    ownerId: string,
  ) {
    for (const b of tree.modules.flatMap((m) =>
      m.lessons.flatMap((l) => l.blocks),
    )) {
      if ("recordingId" in b.config) {
        const [r] = await this.db
          .select()
          .from(s.midiRecordings)
          .where(eq(s.midiRecordings.id, b.config.recordingId));
        if (!r || ![ownerId, actor.id].includes(r.ownerId))
          throw new DomainError(
            "Recording is missing or belongs to another creator",
            403,
          );
        if (!pairNotes(r.events).length)
          throw new DomainError("Record at least one complete note");
      }
      if ("assetId" in b.config) {
        const [a] = await this.db
          .select()
          .from(s.contentAssets)
          .where(eq(s.contentAssets.id, b.config.assetId));
        if (!a || ![ownerId, actor.id].includes(a.ownerId))
          throw new DomainError(
            "Media is missing or belongs to another creator",
            403,
          );
        const required = b.type === "NOTATION" ? "MUSICXML" : b.type;
        if (a.kind !== required)
          throw new DomainError("Media type does not match this block");
      }
    }
  }
  async saveDraft(
    actor: Actor,
    input: {
      courseId: string;
      versionId: string;
      revision: number;
      tree: CourseTree;
      metadata: CourseMetadata;
      visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
    },
  ) {
    const course = await this.courseAccess(actor, input.courseId, "edit");
    const tree = treeSchema.parse(input.tree),
      metadata = metadataSchema.parse(input.metadata);
    await this.validateReferences(actor, tree, course.ownerId);
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM course WHERE id=${course.id} FOR UPDATE`,
      );
      const [version] = await tx
        .update(s.versions)
        .set({
          tree,
          metadata,
          revision: sql`${s.versions.revision}+1`,
          updatedBy: actor.id,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(s.versions.id, input.versionId),
            eq(s.versions.courseId, course.id),
            eq(s.versions.status, "DRAFT"),
            eq(s.versions.revision, input.revision),
          ),
        )
        .returning();
      if (!version)
        throw new DomainError(
          "This draft changed in another window. Reload before saving.",
          409,
        );
      await tx
        .update(s.courses)
        .set({
          metadata,
          visibility: input.visibility,
          updatedBy: actor.id,
          updatedAt: new Date(),
        })
        .where(eq(s.courses.id, course.id));
      return version;
    });
  }
  async newDraft(actor: Actor, courseId: string) {
    await this.courseAccess(actor, courseId, "edit");
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM course WHERE id=${courseId} FOR UPDATE`,
      );
      const [latest] = await tx
        .select()
        .from(s.versions)
        .where(eq(s.versions.courseId, courseId))
        .orderBy(desc(s.versions.number));
      if (latest.status === "DRAFT") return latest;
      const [version] = await tx
        .insert(s.versions)
        .values({
          courseId,
          number: latest.number + 1,
          metadata: latest.metadata,
          tree: latest.tree,
          createdBy: actor.id,
          updatedBy: actor.id,
        })
        .returning();
      return version;
    });
  }
  async publish(
    actor: Actor,
    courseId: string,
    versionId: string,
    revision: number,
  ) {
    await this.courseAccess(actor, courseId, "owner");
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM course WHERE id=${courseId} FOR UPDATE`,
      );
      const [v] = await tx
        .select()
        .from(s.versions)
        .where(
          and(
            eq(s.versions.id, versionId),
            eq(s.versions.courseId, courseId),
            eq(s.versions.status, "DRAFT"),
            eq(s.versions.revision, revision),
          ),
        );
      if (!v) throw new DomainError("Draft is stale or already published", 409);
      const tree = treeSchema.parse(v.tree);
      const lessons = tree.modules.flatMap((m) => m.lessons);
      if (!lessons.length || lessons.some((l) => !l.blocks.length))
        throw new DomainError(
          "Add at least one lesson and a block in each lesson before publishing",
        );
      if (
        v.metadata.rights.status === "UNKNOWN" ||
        !v.metadata.rights.owner.trim()
      )
        throw new DomainError(
          "Declare content rights and the rights owner before publishing",
        );
      const now = new Date();
      await tx
        .update(s.versions)
        .set({ status: "PUBLISHED", publishedAt: now })
        .where(eq(s.versions.id, v.id));
      await tx
        .insert(s.publishedVersions)
        .values({ courseId, versionId })
        .onConflictDoUpdate({
          target: s.publishedVersions.courseId,
          set: { versionId },
        });
      await tx
        .update(s.courses)
        .set({ status: "PUBLISHED", publishedAt: now, updatedBy: actor.id })
        .where(eq(s.courses.id, courseId));
      await tx
        .insert(s.auditLog)
        .values({
          actorId: actor.id,
          action: "COURSE_PUBLISHED",
          resourceId: courseId,
          details: { versionId },
        });
      return { versionId };
    });
  }
  async record(actor: Actor, input: unknown) {
    requireRole(actor, "TEACHER");
    const data = z
      .object({
        title: z.string().min(1).max(200),
        tempo: z.number().min(20).max(300),
        events: z.array(midiEventSchema).min(2).max(10000),
      })
      .parse(input);
    const events = [...data.events].sort((a, b) => a.timestamp - b.timestamp);
    if (!pairNotes(events).length)
      throw new DomainError("Recording needs a complete note");
    const [recording] = await this.db
      .insert(s.midiRecordings)
      .values({
        ...data,
        events,
        ownerId: actor.id,
        createdBy: actor.id,
        duration: Math.max(...events.map((e) => e.timestamp)),
      })
      .returning();
    await this.db
      .insert(s.canonicalScores)
      .values({
        ownerId: actor.id,
        data: recordingToScore(events, data.tempo),
      });
    return recording;
  }
  async recordings(actor: Actor) {
    requireRole(actor, "TEACHER");
    return this.db
      .select()
      .from(s.midiRecordings)
      .where(eq(s.midiRecordings.ownerId, actor.id))
      .orderBy(desc(s.midiRecordings.createdAt));
  }
  async enroll(actor: Actor, courseId: string) {
    requireRole(actor, "STUDENT");
    const [course] = await this.db
      .select()
      .from(s.courses)
      .where(eq(s.courses.id, courseId));
    if (
      !course ||
      course.status !== "PUBLISHED" ||
      course.visibility === "PRIVATE"
    )
      throw new DomainError(
        "This course requires a teacher assignment or invitation",
        403,
      );
    const [publication] = await this.db
      .select()
      .from(s.publishedVersions)
      .where(eq(s.publishedVersions.courseId, courseId));
    if (!publication) throw new DomainError("Course not published");
    const [version] = await this.db
      .select()
      .from(s.versions)
      .where(eq(s.versions.id, publication.versionId));
    if (version.metadata.accessPolicy !== "FREE")
      throw new DomainError("A teacher must grant access to this course", 403);
    const [enrollment] = await this.db
      .insert(s.enrollments)
      .values({
        studentId: actor.id,
        courseId,
        versionId: publication.versionId,
        accessType: "FREE",
      })
      .onConflictDoNothing()
      .returning();
    return (
      enrollment ??
      (
        await this.db
          .select()
          .from(s.enrollments)
          .where(
            and(
              eq(s.enrollments.studentId, actor.id),
              eq(s.enrollments.courseId, courseId),
            ),
          )
      )[0]
    );
  }
  async studentCourses(actor: Actor) {
    return this.db
      .select({ enrollment: s.enrollments, version: s.versions })
      .from(s.enrollments)
      .innerJoin(s.versions, eq(s.enrollments.versionId, s.versions.id))
      .where(eq(s.enrollments.studentId, actor.id));
  }
  async enrolled(actor: Actor, enrollmentId: string) {
    const [row] = await this.db
      .select({ enrollment: s.enrollments, version: s.versions })
      .from(s.enrollments)
      .innerJoin(s.versions, eq(s.enrollments.versionId, s.versions.id))
      .where(
        and(
          eq(s.enrollments.id, enrollmentId),
          eq(s.enrollments.studentId, actor.id),
        ),
      );
    if (!row) throw new DomainError("Enrollment not found", 404);
    return row;
  }
  async resources(tree: CourseTree) {
    const blocks = tree.modules.flatMap((m) =>
      m.lessons.flatMap((l) => l.blocks),
    );
    const recordingIds = blocks.flatMap((b) =>
        "recordingId" in b.config ? [b.config.recordingId] : [],
      ),
      assetIds = blocks.flatMap((b) =>
        "assetId" in b.config ? [b.config.assetId] : [],
      );
    return {
      recordings: recordingIds.length
        ? await this.db
            .select()
            .from(s.midiRecordings)
            .where(inArray(s.midiRecordings.id, recordingIds))
        : [],
      assets: assetIds.length
        ? await this.db
            .select()
            .from(s.contentAssets)
            .where(inArray(s.contentAssets.id, assetIds))
        : [],
    };
  }
  async submitPerformance(actor: Actor, input: unknown) {
    const data = z
      .object({
        enrollmentId: z.string(),
        lessonId: z.string(),
        blockId: z.string(),
        mode: z.enum(["LEARN", "PRACTICE", "PERFORMANCE"]),
        tempo: z.number().min(20).max(300),
        events: z.array(midiEventSchema).max(10000),
      })
      .parse(input);
    const { version } = await this.enrolled(actor, data.enrollmentId);
    const lesson = version.tree.modules
        .flatMap((m) => m.lessons)
        .find((l) => l.id === data.lessonId),
      block = lesson?.blocks.find((b) => b.id === data.blockId);
    if (block?.type !== "MIDI_EXERCISE")
      throw new DomainError("Exercise not found", 404);
    const [recording] = await this.db
      .select()
      .from(s.midiRecordings)
      .where(eq(s.midiRecordings.id, block.config.recordingId));
    const analysis = scorePerformance(
      recording.events,
      data.events,
      block.config.scoring,
      data.tempo,
    );
    const end = new Date(),
      start = new Date(
        end.getTime() - Math.max(0, ...data.events.map((e) => e.timestamp)),
      );
    const [performance] = await this.db
      .insert(s.performances)
      .values({
        ...data,
        userId: actor.id,
        versionId: version.id,
        startedAt: start,
        endedAt: end,
        score: analysis.overall,
        passed: analysis.passed,
        analysis,
      })
      .returning();
    return performance;
  }
  async completeLesson(
    actor: Actor,
    enrollmentId: string,
    lessonId: string,
    answers: Record<string, number>,
  ) {
    const { version, enrollment } = await this.enrolled(actor, enrollmentId);
    const lessons = version.tree.modules.flatMap((m) => m.lessons),
      lesson = lessons.find((l) => l.id === lessonId);
    if (!lesson) throw new DomainError("Lesson not found", 404);
    const attempts = await this.db
      .select()
      .from(s.performances)
      .where(
        and(
          eq(s.performances.enrollmentId, enrollmentId),
          eq(s.performances.lessonId, lessonId),
          eq(s.performances.passed, true),
        ),
      );
    for (const block of lesson.blocks) {
      if (
        block.type === "MIDI_EXERCISE" &&
        !attempts.some((a) => a.blockId === block.id)
      )
        throw new DomainError(
          "Pass each MIDI exercise before completing this lesson",
        );
      if ("answer" in block.config && answers[block.id] !== block.config.answer)
        throw new DomainError(
          "Answer each activity correctly before completing this lesson",
        );
    }
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM course_enrollment WHERE id=${enrollment.id} FOR UPDATE`,
      );
      await tx
        .insert(s.lessonProgress)
        .values({ enrollmentId, lessonId })
        .onConflictDoNothing();
      const progress = await tx
        .select()
        .from(s.lessonProgress)
        .where(eq(s.lessonProgress.enrollmentId, enrollmentId));
      const completed = lessons.every((l) =>
        progress.some((p) => p.lessonId === l.id),
      );
      await tx
        .update(s.enrollments)
        .set({
          currentLessonId: lessonId,
          completedAt: completed ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(s.enrollments.id, enrollmentId));
      if (completed)
        await tx
          .update(s.assignments)
          .set({ status: "COMPLETED", completion: 1 })
          .where(
            and(
              eq(s.assignments.assignedTo, actor.id),
              eq(s.assignments.contentType, "COURSE"),
              eq(s.assignments.contentId, enrollment.courseId),
              eq(s.assignments.versionId, version.id),
            ),
          );
      return {
        completedLessons: progress.length,
        totalLessons: lessons.length,
      };
    });
  }
  async analytics(actor: Actor) {
    requireRole(actor, "TEACHER");
    const owned = await this.teacherCourses(actor);
    const permitted = [];
    for (const c of owned) {
      try {
        await this.courseAccess(actor, c.id, "instruct");
        permitted.push(c.id);
      } catch {}
    }
    if (!permitted.length)
      return { students: [], performances: [], progress: [] };
    const students = await this.db
      .select({
        enrollment: s.enrollments,
        name: s.user.name,
        email: s.user.email,
      })
      .from(s.enrollments)
      .innerJoin(s.user, eq(s.enrollments.studentId, s.user.id))
      .where(inArray(s.enrollments.courseId, permitted));
    const ids = students.map((s) => s.enrollment.id);
    return {
      students,
      performances: ids.length
        ? await this.db
            .select({
              id: s.performances.id,
              userId: s.performances.userId,
              lessonId: s.performances.lessonId,
              score: s.performances.score,
              passed: s.performances.passed,
              createdAt: s.performances.createdAt,
              analysis: s.performances.analysis,
            })
            .from(s.performances)
            .where(inArray(s.performances.enrollmentId, ids))
            .orderBy(desc(s.performances.createdAt))
            .limit(100)
        : [],
      progress: ids.length
        ? await this.db
            .select()
            .from(s.lessonProgress)
            .where(inArray(s.lessonProgress.enrollmentId, ids))
        : [],
    };
  }
  async invite(actor: Actor, email: string) {
    requireRole(actor, "TEACHER");
    z.email().parse(email);
    const token = randomBytes(24).toString("hex");
    await this.db
      .insert(s.invitations)
      .values({
        teacherId: actor.id,
        email: email.toLowerCase(),
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      });
    return { token };
  }
  async acceptInvitation(actor: Actor, token: string) {
    const [u] = await this.db
      .select()
      .from(s.user)
      .where(eq(s.user.id, actor.id));
    const hash = createHash("sha256").update(token).digest("hex");
    return this.db.transaction(async (tx) => {
      const [invitation] = await tx
        .select()
        .from(s.invitations)
        .where(eq(s.invitations.tokenHash, hash))
        .for("update");
      if (
        !invitation ||
        invitation.acceptedAt ||
        invitation.expiresAt < new Date() ||
        invitation.email !== u.email.toLowerCase()
      )
        throw new DomainError(
          "Invitation is invalid, expired, or addressed to another email",
          403,
        );
      await tx
        .insert(s.relationships)
        .values({ teacherId: invitation.teacherId, studentId: actor.id })
        .onConflictDoNothing();
      await tx
        .update(s.invitations)
        .set({ acceptedAt: new Date() })
        .where(eq(s.invitations.id, invitation.id));
      return { accepted: true };
    });
  }
  async assignCourse(
    actor: Actor,
    courseId: string,
    studentId: string,
    instructions: string,
  ) {
    await this.courseAccess(actor, courseId, "instruct");
    const [relationship] = await this.db
      .select()
      .from(s.relationships)
      .where(
        and(
          eq(s.relationships.teacherId, actor.id),
          eq(s.relationships.studentId, studentId),
        ),
      );
    if (!relationship && !actor.roles.includes("ADMIN"))
      throw new DomainError("Student must accept your invitation first", 403);
    const [publication] = await this.db
      .select()
      .from(s.publishedVersions)
      .where(eq(s.publishedVersions.courseId, courseId));
    if (!publication) throw new DomainError("Publish the course first");
    return this.db.transaction(async (tx) => {
      await tx
        .insert(s.enrollments)
        .values({
          studentId,
          courseId,
          versionId: publication.versionId,
          accessType: "TEACHER_ASSIGNED",
        })
        .onConflictDoNothing();
      const [enrollment] = await tx
        .select()
        .from(s.enrollments)
        .where(
          and(
            eq(s.enrollments.studentId, studentId),
            eq(s.enrollments.courseId, courseId),
          ),
        );
      const [assignment] = await tx
        .insert(s.assignments)
        .values({
          assignedBy: actor.id,
          assignedTo: studentId,
          contentType: "COURSE",
          contentId: courseId,
          versionId: enrollment.versionId,
          instructions,
        })
        .returning();
      return assignment;
    });
  }
}
