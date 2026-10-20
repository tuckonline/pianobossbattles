import { exportProgress } from "./game-backup";
import {gameSyncSchema,gameSettingsSchema,syncGame,readGame} from "./game-service";
import {storySaveSchema} from './battle-story';
import {readStoryRecords,saveStoryRecord} from './battle-story-service';
import { scalesLibrary } from "./scales-library";
import { deriveProgress, type ProgressAttempt } from "./collection-progress";
import burgmullerData from "./data/burgmuller-op100.json";
const burgmullerLibrary = burgmullerData as Exercise[];
import { practiceLibrary } from "./practice-library";
import { classicalLibrary } from "./classical-library";
import { moonlightLibrary } from "./moonlight-library";
import {moonlightRangeByNumber} from './moonlight-range';
import type {
  D1Database,
  D1PreparedStatement,
} from "@cloudflare/workers-types";
import { z } from "zod";
import {
  metadataSchema,
  treeSchema,
  midiEventSchema,
  rightsSchema,
  type CourseMetadata,
  type CourseTree,
  type MidiEvent,
} from "../src/domains/blocks/schema";
import {
  DomainError,
  requireRole,
  canEdit,
  canInstruct,
  type Actor,
} from "../src/domains/auth/permissions";
import { pairNotes, recordingToScore } from "../src/domains/music/model";
import { scorePerformance } from "../src/domains/scoring/engine";
import { sightLibrary, assessPractice, practicePass, type Exercise } from "./sight-library";
export interface HostedActor extends Actor {
  name: string;
  email: string;
}
export interface Version {
  id: string;
  courseId: string;
  number: number;
  revision: number;
  status: "DRAFT" | "PUBLISHED";
  metadata: CourseMetadata;
  tree: CourseTree;
}
export interface Course {
  id: string;
  ownerId: string;
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  status: string;
  publishedVersionId: string | null;
  metadata: CourseMetadata;
  updatedAt: string;
}
export interface Recording {
  id: string;
  ownerId: string;
  title: string;
  tempo: number;
  duration: number;
  events: MidiEvent[];
}
export interface Asset {
  id: string;
  ownerId: string;
  title: string;
  kind: string;
  url: string;
  rights: unknown;
}
export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  versionId: string;
  accessType: string;
  completedAt: string | null;
}
export interface Performance {
  id: string;
  userId: string;
  enrollmentId: string;
  lessonId: string;
  blockId: string;
  mode: string;
  score: number;
  passed: boolean;
  analysis: ReturnType<typeof scorePerformance>;
  createdAt: string;
}
const id = z.string().min(1).max(200);
const commands = z.discriminatedUnion("action", [
  storySaveSchema,
  z.object({action:z.literal('battleStoryRecords')}),
  gameSyncSchema,
  z.object({ action: z.literal("gameBackup") }),
  z.object({action:z.literal("gameState"),sessionId:z.string().uuid().optional(),exerciseNumber:z.number().int().optional()}),
  z.object({action:z.literal("gameSettings"),settings:gameSettingsSchema}),
  z.object({action:z.literal("gameSessionEnd"),sessionId:z.string().uuid()}),
  z.object({ action: z.literal("resetStreamStats") }),
  z.object({
    action: z.literal("practiceExercise"),
    exerciseNumber: z.number().int().min(1),
  }),
  z.object({
    action: z.literal("sightAttempt"),
    omitClosing: z.boolean().optional(),
    exerciseNumber: z.number().int().min(1).max(1000000),
    hand: z.enum(["both", "right", "left"]),
    played: z.array(z.number().int().min(0).max(127)).min(1).max(10000),
  }),
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
  z.object({
    action: z.literal("record"),
    data: z.object({
      title: z.string().min(1).max(200),
      tempo: z.number().min(20).max(300),
      events: z.array(midiEventSchema).min(2).max(10000),
    }),
  }),
  z.object({ action: z.literal("enroll"), courseId: id }),
  z.object({
    action: z.literal("perform"),
    data: z.object({
      enrollmentId: id,
      lessonId: id,
      blockId: id,
      mode: z.enum(["LEARN", "PRACTICE", "PERFORMANCE"]),
      tempo: z.number().min(20).max(300),
      events: z.array(midiEventSchema).max(10000),
    }),
  }),
  z.object({
    action: z.literal("complete"),
    enrollmentId: id,
    lessonId: id,
    answers: z.record(z.string(), z.number().int()).default({}),
  }),
  z.object({ action: z.literal("invite"), email: z.email() }),
  z.object({
    action: z.literal("acceptInvite"),
    token: z.string().min(20).max(100),
  }),
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
const now = () => new Date().toISOString(),
  uuid = () => crypto.randomUUID();
function decode<T>(row: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const k = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    result[k] =
      [
        "metadata",
        "tree",
        "events",
        "analysis",
        "rights",
        "canonical",
        "details",
      ].includes(k) && typeof value === "string"
        ? JSON.parse(value)
        : k === "passed"
          ? Boolean(value)
          : value;
  }
  return result as T;
}
async function tokenHash(token: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export class D1Platform {
  constructor(readonly db: D1Database) {}
  stmt(query: string, ...values: unknown[]) {
    return this.db.prepare(query).bind(...values);
  }
  async all<T>(query: string, ...values: unknown[]): Promise<T[]> {
    const result = await this.stmt(query, ...values).all<
      Record<string, unknown>
    >();
    return result.results.map((r) => decode<T>(r));
  }
  async one<T>(query: string, ...values: unknown[]): Promise<T | undefined> {
    const row = await this.stmt(query, ...values).first<
      Record<string, unknown>
    >();
    return row ? decode<T>(row) : undefined;
  }
  async practiceProgress(userId: string, exerciseNumber?: number) {
    const history = await this.all<ProgressAttempt>(
      "SELECT exercise_number, hand, accuracy, created_at FROM sight_attempts WHERE user_id=?" +
      (exerciseNumber === undefined ? "" : " AND exercise_number=?") + " ORDER BY created_at ASC, rowid ASC",
      ...[userId, ...(exerciseNumber === undefined ? [] : [exerciseNumber])],
    );
    return deriveProgress(history);
  }
  // Each operation is one D1 transaction. A failed guard aborts the entire batch.
  async atomic(
    condition: string,
    values: unknown[],
    statements: D1PreparedStatement[],
  ) {
    const guard = uuid();
    try {
      await this.db.batch([
        this.stmt(
          `INSERT INTO mutation_guards(id,accepted) SELECT ?,CASE WHEN (${condition}) THEN 1 ELSE 0 END`,
          guard,
          ...values,
        ),
        ...statements,
        this.stmt("DELETE FROM mutation_guards WHERE id=?", guard),
      ]);
    } catch (error) {
      if (String(error).includes("mutation guard"))
        throw new DomainError(
          "This record changed. Reload and try again.",
          409,
        );
      throw error;
    }
  }
  async ensureUser(
    id: string,
    email: string,
    name: string,
    ownerEmail?: string,
  ): Promise<HostedActor> {
    await this.db.batch([
      this.stmt(
        "INSERT INTO users(id,email,name,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email",
        id,
        email,
        name,
        now(),
      ),
      this.stmt(
        "INSERT INTO roles(id,user_id,role) VALUES(?,?,'STUDENT') ON CONFLICT(user_id,role) DO NOTHING",
        uuid(),
        id,
      ),
    ]);
    if (ownerEmail && email.toLowerCase() === ownerEmail.toLowerCase())
      await this.db.batch(
        ["ADMIN", "TEACHER"].map((role) =>
          this.stmt(
            "INSERT INTO roles(id,user_id,role) VALUES(?,?,?) ON CONFLICT(user_id,role) DO NOTHING",
            uuid(),
            id,
            role,
          ),
        ),
      );
    const roles = await this.all<{ role: Actor["roles"][number] }>(
      "SELECT role FROM roles WHERE user_id=?",
      id,
    );
    return { id, email, name, roles: roles.map((r) => r.role) };
  }
  async course(
    actor: Actor,
    courseId: string,
    access: "read" | "edit" | "owner" | "instruct" = "read",
  ) {
    const c = await this.one<Course>(
      "SELECT c.*,v.metadata FROM courses c JOIN versions v ON v.course_id=c.id AND v.number=(SELECT MAX(number) FROM versions WHERE course_id=c.id) WHERE c.id=?",
      courseId,
    );
    if (!c) throw new DomainError("Course not found", 404);
    const collab = await this.one<{ role: string }>(
      "SELECT role FROM collaborators WHERE course_id=? AND user_id=?",
      courseId,
      actor.id,
    );
    const owner = c.ownerId === actor.id || actor.roles.includes("ADMIN");
    if (
      access === "owner"
        ? !owner
        : access === "edit"
          ? !canEdit(actor, c.ownerId, collab?.role)
          : access === "instruct"
            ? !canInstruct(actor, c.ownerId, collab?.role)
            : !owner && !collab
    )
      throw new DomainError("Course access denied", 403);
    return c;
  }
  async teacherCourses(actor: Actor) {
    requireRole(actor, "TEACHER");
    return this.all<Course>(
      "SELECT c.*,v.metadata FROM courses c JOIN versions v ON v.course_id=c.id AND v.number=(SELECT MAX(number) FROM versions WHERE course_id=c.id) WHERE c.owner_id=? OR EXISTS(SELECT 1 FROM collaborators x WHERE x.course_id=c.id AND x.user_id=?) ORDER BY c.updated_at DESC",
      actor.id,
      actor.id,
    );
  }
  async enrolled(actor: Actor, enrollmentId: string) {
    const enrollment = await this.one<Enrollment>(
      "SELECT * FROM enrollments WHERE id=? AND student_id=?",
      enrollmentId,
      actor.id,
    );
    if (!enrollment) throw new DomainError("Enrollment not found", 404);
    const version = await this.one<Version>(
      "SELECT * FROM versions WHERE id=?",
      enrollment.versionId,
    );
    if (!version) throw new DomainError("Version not found", 404);
    return { enrollment, version };
  }
  async resources(tree: CourseTree) {
    const blocks = tree.modules.flatMap((m) =>
        m.lessons.flatMap((l) => l.blocks),
      ),
      r = [
        ...new Set(
          blocks.flatMap((b) =>
            "recordingId" in b.config ? [b.config.recordingId] : [],
          ),
        ),
      ],
      a = [
        ...new Set(
          blocks.flatMap((b) =>
            "assetId" in b.config ? [b.config.assetId] : [],
          ),
        ),
      ];
    return {
      recordings: r.length
        ? await this.all<Recording>(
            `SELECT * FROM recordings WHERE id IN (${r.map(() => "?").join(",")})`,
            ...r,
          )
        : [],
      assets: a.length
        ? await this.all<Asset>(
            `SELECT * FROM assets WHERE id IN (${a.map(() => "?").join(",")})`,
            ...a,
          )
        : [],
    };
  }
  async validateReferences(actor: Actor, ownerId: string, tree: CourseTree) {
    const resources = await this.resources(tree);
    for (const block of tree.modules.flatMap((m) =>
      m.lessons.flatMap((l) => l.blocks),
    )) {
      if ("recordingId" in block.config) {
        const r = resources.recordings.find(
          (r) =>
            r.id ===
            ("recordingId" in block.config ? block.config.recordingId : ""),
        );
        if (!r || ![actor.id, ownerId].includes(r.ownerId))
          throw new DomainError(
            "Recording is missing or owned by another creator",
            403,
          );
      }
      if ("assetId" in block.config) {
        const asset = resources.assets.find(
          (a) =>
            a.id === ("assetId" in block.config ? block.config.assetId : ""),
        );
        if (!asset || ![actor.id, ownerId].includes(asset.ownerId))
          throw new DomainError(
            "Media is missing or owned by another creator",
            403,
          );
        if (
          asset.kind !== (block.type === "NOTATION" ? "MUSICXML" : block.type)
        )
          throw new DomainError("Media type does not match block");
      }
    }
  }
  async analytics(actor: Actor) {
    const courses = await this.teacherCourses(actor),
      permitted: Course[] = [];
    for (const c of courses)
      try {
        await this.course(actor, c.id, "instruct");
        permitted.push(c);
      } catch {
        /* Editor/viewer roles do not confer analytics access. */
      }
    if (!permitted.length)
      return { students: [], performances: [], progress: [] };
    const ids = permitted.map((c) => c.id),
      marks = ids.map(() => "?").join(",");
    const rows = await this.all<Enrollment & { name: string; email: string }>(
      `SELECT e.*,u.name,u.email FROM enrollments e JOIN users u ON u.id=e.student_id WHERE e.course_id IN (${marks})`,
      ...ids,
    );
    return {
      students: rows.map((r) => ({
        enrollment: r,
        name: r.name,
        email: r.email,
      })),
      performances: await this.all<Performance>(
        `SELECT p.* FROM performances p JOIN enrollments e ON e.id=p.enrollment_id WHERE e.course_id IN (${marks}) ORDER BY p.created_at DESC LIMIT 100`,
        ...ids,
      ),
      progress: await this.all<{
        id: string;
        enrollmentId: string;
        lessonId: string;
      }>(
        `SELECT p.* FROM progress p JOIN enrollments e ON e.id=p.enrollment_id WHERE e.course_id IN (${marks})`,
        ...ids,
      ),
    };
  }
  async view(actor: HostedActor, path: string) {
    if(path === "/shorts") return {actor};
    if (path === "/student/sight-read" || path === "/student/practice")
      return {
        actor,
        practiceExercises:
          path === "/student/practice"
            ? (
                await this.all<{ definition: string }>(
                  "SELECT CASE WHEN collection IN ('czerny-op599','czerny-op481','beginner-pieces','repertoire','bach') THEN json_remove(definition,'$.polyphony') ELSE definition END AS definition FROM practice_exercises ORDER BY collection,source_number",
                )
              )
                .map((r) => JSON.parse(r.definition) as Exercise)
                .concat(
                  burgmullerLibrary.map(
                    ({ polyphony: _notes, ...catalogue }) => catalogue,
                  ),
                )
            : undefined,
        collectionProgress: await this.practiceProgress(actor.id),
        sightAttempts: await this.all(
          "SELECT * FROM sight_attempts WHERE user_id=? AND created_at > COALESCE((SELECT started_at FROM practice_stream_stats WHERE user_id=sight_attempts.user_id), '') ORDER BY created_at DESC LIMIT 1000",
          actor.id,
        ),
      };
    if (path.startsWith("/teacher")) {
      requireRole(actor, "TEACHER");
      const match = path.match(/^\/teacher\/courses\/([^/]+)$/);
      if (match) {
        const course = await this.course(actor, match[1], "edit"),
          versions = await this.all<Version>(
            "SELECT * FROM versions WHERE course_id=? ORDER BY number DESC",
            course.id,
          ),
          version = versions.find((v) => v.status === "DRAFT") ?? versions[0],
          resources = await this.resources(version.tree);
        return {
          actor,
          course,
          version,
          recordings: [
            ...new Map(
              [
                ...(await this.all<Recording>(
                  "SELECT * FROM recordings WHERE owner_id=?",
                  actor.id,
                )),
                ...resources.recordings,
              ].map((r) => [r.id, r]),
            ).values(),
          ],
          assets: [
            ...new Map(
              [
                ...(await this.all<Asset>(
                  "SELECT * FROM assets WHERE owner_id=?",
                  actor.id,
                )),
                ...resources.assets,
              ].map((a) => [a.id, a]),
            ).values(),
          ],
        };
      }
      return {
        actor,
        courses: await this.teacherCourses(actor),
        analytics: await this.analytics(actor),
        students: await this.all<{ id: string; name: string }>(
          "SELECT u.id,u.name FROM relationships r JOIN users u ON u.id=r.student_id WHERE r.teacher_id=?",
          actor.id,
        ),
        recordings: await this.all<Recording>(
          "SELECT * FROM recordings WHERE owner_id=?",
          actor.id,
        ),
        assets: await this.all<Asset>(
          "SELECT * FROM assets WHERE owner_id=?",
          actor.id,
        ),
      };
    }
    if (path.startsWith("/admin")) {
      requireRole(actor, "ADMIN");
      return {
        actor,
        users: await this.all(
          "SELECT * FROM users ORDER BY created_at DESC LIMIT 200",
        ),
        roles: await this.all("SELECT * FROM roles"),
        courses: await this.all(
          "SELECT c.*,v.metadata FROM courses c JOIN versions v ON v.course_id=c.id AND v.number=(SELECT MAX(number) FROM versions WHERE course_id=c.id)",
        ),
        audit: await this.all(
          "SELECT * FROM audit ORDER BY created_at DESC LIMIT 100",
        ),
      };
    }
    const publicMatch = path.match(/^\/courses\/([^/]+)$/);
    if (publicMatch) {
      const row = await this.one<Course>(
        "SELECT c.*,v.metadata FROM courses c JOIN versions v ON v.id=c.published_version_id WHERE c.id=? AND c.status='PUBLISHED' AND c.visibility!='PRIVATE'",
        publicMatch[1],
      );
      if (!row) throw new DomainError("Course unavailable", 404);
      return { actor, course: row };
    }
    const match = path.match(
      /^\/student\/courses\/([^/]+)(?:\/lessons\/([^/]+))?$/,
    );
    if (match) {
      const data = await this.enrolled(actor, match[1]);
      const lesson = match[2]
        ? data.version.tree.modules
            .flatMap((m) => m.lessons)
            .find((l) => l.id === match[2])
        : null;
      if (match[2] && !lesson) throw new DomainError("Lesson not found", 404);
      return {
        actor,
        ...data,
        lesson,
        ...(await this.resources(data.version.tree)),
        progress: await this.all(
          "SELECT * FROM progress WHERE enrollment_id=?",
          data.enrollment.id,
        ),
      };
    }
    const enrolled = await this.all<Enrollment>(
      "SELECT * FROM enrollments WHERE student_id=? ORDER BY created_at DESC",
      actor.id,
    );
    return {
      actor,
      courses: await Promise.all(
        enrolled.map(async (enrollment) => ({
          enrollment,
          version: (await this.one<Version>(
            "SELECT * FROM versions WHERE id=?",
            enrollment.versionId,
          ))!,
        })),
      ),
      performances: await this.all<Performance>(
        "SELECT * FROM performances WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
        actor.id,
      ),
      assignments: await this.all(
        "SELECT * FROM assignments WHERE assigned_to=? ORDER BY created_at DESC",
        actor.id,
      ),
    };
  }
  async command(actor: HostedActor, input: unknown): Promise<unknown> {
    const c = commands.parse(input);
    const stamp = now();
    switch (c.action) {
      case "gameBackup": return exportProgress(this, actor);
      case "gameState": return readGame(this,actor.id,c.sessionId,c.exerciseNumber);
      case "battleStoryRecords": return readStoryRecords(this,actor.id);
      case "battleStorySave": return saveStoryRecord(this,actor.id,c);
      case "gameSettings": {
        await this.stmt("INSERT INTO game_players(user_id,settings,updated_at,curve_version) VALUES (?,?,?,2) ON CONFLICT(user_id) DO UPDATE SET settings=excluded.settings,revision=revision+1,updated_at=excluded.updated_at",actor.id,JSON.stringify(c.settings),stamp).run();
        return readGame(this,actor.id);
      }
      case "gameSessionEnd": {
        for(let retry=0;retry<5;retry++){
          const player=await this.one<{revision:number}>("SELECT revision FROM game_players WHERE user_id=?",actor.id);
          if(!player)break;
          try{
            await this.atomic("EXISTS(SELECT 1 FROM game_players WHERE user_id=? AND revision=?)",[actor.id,player.revision],[
              this.stmt("UPDATE game_sessions SET ended_at=COALESCE(ended_at,?) WHERE user_id=? AND id=?",stamp,actor.id,c.sessionId),
              this.stmt("UPDATE game_attempts SET status='abandoned' WHERE user_id=? AND session_id=? AND status IN ('playing','paused')",actor.id,c.sessionId),
              this.stmt("INSERT INTO game_events(user_id,id,session_id,sequence,event) VALUES (?,?,?,0,?) ON CONFLICT DO NOTHING",actor.id,`${c.sessionId}:ended`,c.sessionId,JSON.stringify({id:`${c.sessionId}:ended`,version:1,playerId:actor.id,sessionId:c.sessionId,sequence:0,timestamp:Date.now(),type:'session.ended',payload:{}})),
              this.stmt("UPDATE game_players SET revision=revision+1 WHERE user_id=?",actor.id),
            ]);break;
          }catch(e){if(e instanceof DomainError&&e.status===409&&retry<4)continue;throw e;}
        }
        return readGame(this,actor.id,c.sessionId);
      }
      case "gameSync": {
        if (c.expectedUserId && c.expectedUserId !== actor.id) throw new DomainError("Your signed-in account changed. Reopen PianoPath with the account that earned this progress.", 401);
        const stored=await this.one<{definition:string}>("SELECT definition FROM practice_exercises WHERE number=?",c.exerciseNumber);
        const exercise:Exercise|undefined=stored?JSON.parse(stored.definition):[...sightLibrary,...practiceLibrary,...burgmullerLibrary,...classicalLibrary,...moonlightLibrary,...scalesLibrary].find(e=>e.number===c.exerciseNumber)??moonlightRangeByNumber(c.exerciseNumber);
        if(!exercise) throw new DomainError("Exercise not found",404);
        return syncGame(this,actor.id,c,exercise);
      }
      case "resetStreamStats": {
        await this.stmt(
          "INSERT INTO practice_stream_stats (user_id,started_at) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET started_at=excluded.started_at",
          actor.id, stamp,
        ).run();
        return { startedAt: stamp };
      }
      case "practiceExercise": {
        const builtIn = [...sightLibrary, ...practiceLibrary, ...burgmullerLibrary, ...classicalLibrary, ...moonlightLibrary, ...scalesLibrary].find(
          (e) => e.number === c.exerciseNumber,
        ) ?? moonlightRangeByNumber(c.exerciseNumber);
        if (builtIn) return builtIn;
        const stored = await this.one<{ definition: string }>(
          "SELECT definition FROM practice_exercises WHERE number=?",
          c.exerciseNumber,
        );
        if (!stored) throw new DomainError("Exercise not found", 404);
        return JSON.parse(stored.definition) as Exercise;
      }
      case "sightAttempt": {
        const stored = await this.one<{ definition: string }>(
          "SELECT definition FROM practice_exercises WHERE number=?",
          c.exerciseNumber,
        );
        const exercise: Exercise | undefined = stored
          ? JSON.parse(stored.definition)
          : [...sightLibrary, ...practiceLibrary, ...burgmullerLibrary, ...classicalLibrary, ...moonlightLibrary, ...scalesLibrary].find(
              (e) => e.number === c.exerciseNumber,
            ) ?? moonlightRangeByNumber(c.exerciseNumber);
        if (!exercise) throw new DomainError("Exercise not found", 404);
        if (exercise.singleHand && c.hand !== exercise.singleHand)
          throw new DomainError("Use the scored hand for this single-staff piece", 400);
        if (exercise.bothHandsOnly && c.hand !== "both")
          throw new DomainError(
            "This study supports both-hands practice only",
            400,
          );
        const result = assessPractice(practicePass(exercise, c.omitClosing), c.hand, c.played);
        if (!result.complete)
          throw new DomainError("Finish the exercise before saving", 400);
        const attempt = {
          id: uuid(),
          exerciseNumber: c.exerciseNumber,
          hand: c.hand,
          accuracy: result.accuracy,
          mistakes: result.mistakes,
          createdAt: stamp,
        };
        await this.stmt(
          "INSERT INTO sight_attempts (id,user_id,exercise_number,hand,accuracy,mistakes,created_at) VALUES (?,?,?,?,?,?,?)",
          attempt.id,
          actor.id,
          c.exerciseNumber,
          c.hand,
          result.accuracy,
          result.mistakes,
          stamp,
        ).run();
        return { ...attempt, progress: (await this.practiceProgress(actor.id, c.exerciseNumber))[c.exerciseNumber] };
      }
      case "createCourse": {
        requireRole(actor, "TEACHER");
        const courseId = uuid(),
          versionId = uuid(),
          metadata = metadataSchema.parse({
            title: c.title,
            description: "",
            rights: { status: "UNKNOWN", owner: "", notes: "" },
          });
        await this.db.batch([
          this.stmt(
            "INSERT INTO courses(id,owner_id,visibility,status,created_at,updated_at) VALUES(?,?,'PRIVATE','DRAFT',?,?)",
            courseId,
            actor.id,
            stamp,
            stamp,
          ),
          this.stmt(
            "INSERT INTO versions(id,course_id,number,revision,status,metadata,tree,created_by,updated_by,created_at,updated_at) VALUES(?,?,1,0,'DRAFT',?,?,?,?,?,?)",
            versionId,
            courseId,
            JSON.stringify(metadata),
            JSON.stringify({ modules: [] }),
            actor.id,
            actor.id,
            stamp,
            stamp,
          ),
        ]);
        return { id: courseId };
      }
      case "saveDraft": {
        const course = await this.course(actor, c.courseId, "edit");
        await this.validateReferences(actor, course.ownerId, c.tree);
        await this.atomic(
          "EXISTS(SELECT 1 FROM versions WHERE id=? AND course_id=? AND revision=? AND status='DRAFT')",
          [c.versionId, c.courseId, c.revision],
          [
            this.stmt(
              "UPDATE versions SET tree=?,metadata=?,revision=revision+1,updated_by=?,updated_at=? WHERE id=?",
              JSON.stringify(c.tree),
              JSON.stringify(c.metadata),
              actor.id,
              stamp,
              c.versionId,
            ),
            this.stmt(
              "UPDATE courses SET visibility=?,updated_at=? WHERE id=?",
              c.visibility,
              stamp,
              c.courseId,
            ),
          ],
        );
        return this.one<Version>(
          "SELECT * FROM versions WHERE id=?",
          c.versionId,
        );
      }
      case "publish": {
        await this.course(actor, c.courseId, "owner");
        const v = await this.one<Version>(
          "SELECT * FROM versions WHERE id=? AND course_id=? AND status='DRAFT' AND revision=?",
          c.versionId,
          c.courseId,
          c.revision,
        );
        if (!v)
          throw new DomainError("Draft is stale or already published", 409);
        const lessons = v.tree.modules.flatMap((m) => m.lessons);
        if (!lessons.length || lessons.some((l) => !l.blocks.length))
          throw new DomainError("Add a lesson and a block in every lesson");
        if (
          v.metadata.rights.status === "UNKNOWN" ||
          !v.metadata.rights.owner.trim()
        )
          throw new DomainError(
            "Declare content rights and rights owner before publishing",
          );
        await this.atomic(
          "EXISTS(SELECT 1 FROM versions WHERE id=? AND revision=? AND status='DRAFT')",
          [v.id, c.revision],
          [
            this.stmt(
              "UPDATE versions SET status='PUBLISHED',published_at=? WHERE id=?",
              stamp,
              v.id,
            ),
            this.stmt(
              "UPDATE courses SET status='PUBLISHED',published_version_id=?,updated_at=? WHERE id=?",
              v.id,
              stamp,
              c.courseId,
            ),
            this.stmt(
              "INSERT INTO audit VALUES(?,?,?,?,?,?)",
              uuid(),
              actor.id,
              "COURSE_PUBLISHED",
              c.courseId,
              JSON.stringify({ versionId: v.id }),
              stamp,
            ),
          ],
        );
        return { versionId: v.id };
      }
      case "newDraft": {
        await this.course(actor, c.courseId, "edit");
        const latest = (await this.one<Version>(
          "SELECT * FROM versions WHERE course_id=? ORDER BY number DESC LIMIT 1",
          c.courseId,
        ))!;
        if (latest.status === "DRAFT") return latest;
        const versionId = uuid();
        await this.atomic(
          "NOT EXISTS(SELECT 1 FROM versions WHERE course_id=? AND number>?)",
          [c.courseId, latest.number],
          [
            this.stmt(
              "INSERT INTO versions(id,course_id,number,revision,status,metadata,tree,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,0,'DRAFT',?,?,?,?,?,?)",
              versionId,
              c.courseId,
              latest.number + 1,
              JSON.stringify(latest.metadata),
              JSON.stringify(latest.tree),
              actor.id,
              actor.id,
              stamp,
              stamp,
            ),
          ],
        );
        return this.one<Version>(
          "SELECT * FROM versions WHERE id=?",
          versionId,
        );
      }
      case "record": {
        requireRole(actor, "TEACHER");
        const events = [...c.data.events].sort(
          (a, b) => a.timestamp - b.timestamp,
        );
        if (!pairNotes(events).length)
          throw new DomainError("Record at least one complete note");
        const recording = {
          id: uuid(),
          ownerId: actor.id,
          title: c.data.title,
          tempo: c.data.tempo,
          duration: Math.round(Math.max(...events.map((e) => e.timestamp))),
          events,
        };
        await this.stmt(
          "INSERT INTO recordings VALUES(?,?,?,?,?,?,?,?)",
          recording.id,
          actor.id,
          recording.title,
          recording.tempo,
          recording.duration,
          JSON.stringify(events),
          JSON.stringify(recordingToScore(events, recording.tempo)),
          stamp,
        ).run();
        return recording;
      }
      case "addMedia": {
        requireRole(actor, "TEACHER");
        const asset = {
          id: uuid(),
          ownerId: actor.id,
          title: c.title,
          kind: c.kind,
          url: c.url,
          rights: c.rights,
        };
        await this.stmt(
          "INSERT INTO assets VALUES(?,?,?,?,?,?,?)",
          asset.id,
          actor.id,
          c.title,
          c.kind,
          c.url,
          JSON.stringify(c.rights),
          stamp,
        ).run();
        return asset;
      }
      case "enroll": {
        const course = await this.one<Course>(
          "SELECT * FROM courses WHERE id=?",
          c.courseId,
        );
        if (
          !course ||
          course.visibility === "PRIVATE" ||
          course.status !== "PUBLISHED"
        )
          throw new DomainError("A teacher must assign this course", 403);
        const version = await this.one<Version>(
          "SELECT * FROM versions WHERE id=?",
          course.publishedVersionId,
        );
        if (!version || version.metadata.accessPolicy !== "FREE")
          throw new DomainError("A teacher must grant access", 403);
        await this.stmt(
          "INSERT INTO enrollments(id,student_id,course_id,version_id,access_type,created_at) SELECT ?,?,?,?,'FREE',? WHERE EXISTS(SELECT 1 FROM courses WHERE id=? AND status='PUBLISHED' AND visibility!='PRIVATE' AND published_version_id=?) ON CONFLICT(student_id,course_id) DO NOTHING",
          uuid(),
          actor.id,
          c.courseId,
          version.id,
          stamp,
          c.courseId,
          version.id,
        ).run();
        const enrollment = await this.one<Enrollment>(
          "SELECT * FROM enrollments WHERE student_id=? AND course_id=?",
          actor.id,
          c.courseId,
        );
        if (!enrollment)
          throw new DomainError("Course changed. Please reload.", 409);
        return enrollment;
      }
      case "perform": {
        const data = c.data,
          { version } = await this.enrolled(actor, data.enrollmentId);
        const block = version.tree.modules
          .flatMap((m) => m.lessons)
          .find((l) => l.id === data.lessonId)
          ?.blocks.find((b) => b.id === data.blockId);
        if (block?.type !== "MIDI_EXERCISE")
          throw new DomainError("Exercise not found", 404);
        const recording = (await this.one<Recording>(
          "SELECT * FROM recordings WHERE id=?",
          block.config.recordingId,
        ))!;
        const analysis = scorePerformance(
          recording.events,
          data.events,
          block.config.scoring,
          data.tempo,
        );
        await this.stmt(
          "INSERT INTO performances VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
          uuid(),
          actor.id,
          data.enrollmentId,
          version.id,
          data.lessonId,
          data.blockId,
          data.mode,
          data.tempo,
          JSON.stringify(data.events),
          JSON.stringify(analysis),
          analysis.overall,
          analysis.passed ? 1 : 0,
          stamp,
        ).run();
        return { analysis };
      }
      case "complete": {
        const { version, enrollment } = await this.enrolled(
            actor,
            c.enrollmentId,
          ),
          lessons = version.tree.modules.flatMap((m) => m.lessons),
          lesson = lessons.find((l) => l.id === c.lessonId);
        if (!lesson) throw new DomainError("Lesson not found", 404);
        const passed = await this.all<Performance>(
          "SELECT * FROM performances WHERE enrollment_id=? AND lesson_id=? AND passed=1",
          c.enrollmentId,
          c.lessonId,
        );
        for (const b of lesson.blocks) {
          if (
            b.type === "MIDI_EXERCISE" &&
            !passed.some((p) => p.blockId === b.id)
          )
            throw new DomainError(
              "Pass each MIDI exercise before completing this lesson",
            );
          if ("answer" in b.config && c.answers[b.id] !== b.config.answer)
            throw new DomainError("Answer each question correctly");
        }
        await this.db.batch([
          this.stmt(
            "INSERT INTO progress VALUES(?,?,?,?) ON CONFLICT(enrollment_id,lesson_id) DO NOTHING",
            uuid(),
            c.enrollmentId,
            c.lessonId,
            stamp,
          ),
          this.stmt(
            "UPDATE enrollments SET current_lesson_id=?,completed_at=CASE WHEN (SELECT COUNT(*) FROM progress WHERE enrollment_id=?)=? THEN ? ELSE NULL END WHERE id=?",
            c.lessonId,
            c.enrollmentId,
            lessons.length,
            stamp,
            c.enrollmentId,
          ),
          this.stmt(
            "UPDATE assignments SET status='COMPLETED' WHERE assigned_to=? AND content_type='COURSE' AND content_id=? AND version_id=? AND EXISTS(SELECT 1 FROM enrollments WHERE id=? AND completed_at IS NOT NULL)",
            actor.id,
            enrollment.courseId,
            version.id,
            enrollment.id,
          ),
        ]);
        return { complete: true };
      }
      case "invite": {
        requireRole(actor, "TEACHER");
        const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("");
        await this.stmt(
          "INSERT INTO invitations(id,teacher_id,email,token_hash,expires_at) VALUES(?,?,?,?,?)",
          uuid(),
          actor.id,
          c.email.toLowerCase(),
          await tokenHash(token),
          new Date(Date.now() + 7 * 86400000).toISOString(),
        ).run();
        return { token };
      }
      case "acceptInvite": {
        const hash = await tokenHash(c.token);
        const invitation = await this.one<{ id: string; teacherId: string }>(
          "SELECT * FROM invitations WHERE token_hash=? AND email=? AND expires_at>? AND accepted_at IS NULL",
          hash,
          actor.email.toLowerCase(),
          stamp,
        );
        if (!invitation)
          throw new DomainError(
            "Invitation is invalid, expired, or for another email",
            403,
          );
        await this.atomic(
          "EXISTS(SELECT 1 FROM invitations WHERE id=? AND accepted_at IS NULL AND expires_at>?)",
          [invitation.id, stamp],
          [
            this.stmt(
              "INSERT INTO relationships VALUES(?,?,?) ON CONFLICT(teacher_id,student_id) DO NOTHING",
              uuid(),
              invitation.teacherId,
              actor.id,
            ),
            this.stmt(
              "UPDATE invitations SET accepted_at=? WHERE id=?",
              stamp,
              invitation.id,
            ),
          ],
        );
        return { accepted: true };
      }
      case "assign": {
        const course = await this.course(actor, c.courseId, "instruct");
        if (course.status !== "PUBLISHED" || !course.publishedVersionId)
          throw new DomainError("Publish this course first");
        if (
          !actor.roles.includes("ADMIN") &&
          !(await this.one(
            "SELECT id FROM relationships WHERE teacher_id=? AND student_id=?",
            actor.id,
            c.studentId,
          ))
        )
          throw new DomainError(
            "Student must accept your invitation first",
            403,
          );
        await this.db.batch([
          this.stmt(
            "INSERT INTO enrollments(id,student_id,course_id,version_id,access_type,created_at) VALUES(?,?,?,?,'TEACHER_ASSIGNED',?) ON CONFLICT(student_id,course_id) DO NOTHING",
            uuid(),
            c.studentId,
            c.courseId,
            course.publishedVersionId,
            stamp,
          ),
          this.stmt(
            "INSERT INTO assignments(id,assigned_by,assigned_to,content_type,content_id,version_id,instructions,status,created_at) SELECT ?,?,?,'COURSE',?,version_id,?,'ASSIGNED',? FROM enrollments WHERE student_id=? AND course_id=?",
            uuid(),
            actor.id,
            c.studentId,
            c.courseId,
            c.instructions,
            stamp,
            c.studentId,
            c.courseId,
          ),
        ]);
        return { assigned: true };
      }
      case "grantRole": {
        requireRole(actor, "ADMIN");
        await this.db.batch([
          this.stmt(
            "INSERT INTO roles VALUES(?,?,?) ON CONFLICT(user_id,role) DO NOTHING",
            uuid(),
            c.userId,
            c.role,
          ),
          this.stmt(
            "INSERT INTO audit VALUES(?,?,?,?,?,?)",
            uuid(),
            actor.id,
            "ROLE_GRANTED",
            c.userId,
            JSON.stringify({ role: c.role }),
            stamp,
          ),
        ]);
        return { ok: true };
      }
      case "moderate": {
        requireRole(actor, "ADMIN");
        await this.db.batch([
          this.stmt(
            "UPDATE courses SET status=?,updated_at=? WHERE id=?",
            c.status,
            stamp,
            c.courseId,
          ),
          this.stmt(
            "INSERT INTO audit VALUES(?,?,?,?,?,?)",
            uuid(),
            actor.id,
            "MODERATION",
            c.courseId,
            JSON.stringify({ status: c.status, notes: c.notes }),
            stamp,
          ),
        ]);
        return { ok: true };
      }
    }
  }
}
