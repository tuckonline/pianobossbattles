import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
  real,
} from "drizzle-orm/pg-core";
import type {
  CourseTree,
  CourseMetadata,
  MidiEvent,
  ScoringProfile,
} from "@/domains/blocks/schema";
const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const dates = () => ({
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const user = pgTable("user", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  ...dates(),
});
export const session = pgTable("session", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  ...dates(),
});
export const account = pgTable("account", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  ...dates(),
});
export const verification = pgTable("verification", {
  id: id(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  ...dates(),
});
export const userRoles = pgTable(
  "user_role",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["STUDENT", "TEACHER", "ADMIN"] }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);
export const studentProfiles = pgTable("student_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id),
  preferences: jsonb("preferences").notNull().default({}),
  ...dates(),
});
export const teacherProfiles = pgTable("teacher_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id),
  displayName: text("display_name").notNull(),
  biography: text("biography").notNull().default(""),
  credentials: text("credentials").notNull().default(""),
  specialties: jsonb("specialties").$type<string[]>().notNull().default([]),
  website: text("website"),
  ...dates(),
});
export const courses = pgTable(
  "course",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id),
    visibility: text("visibility", { enum: ["PRIVATE", "UNLISTED", "PUBLIC"] })
      .notNull()
      .default("PRIVATE"),
    status: text("status", {
      enum: [
        "DRAFT",
        "IN_REVIEW",
        "PUBLISHED",
        "ARCHIVED",
        "REJECTED",
        "SCHEDULED",
      ],
    })
      .notNull()
      .default("DRAFT"),
    metadata: jsonb("metadata").$type<CourseMetadata>().notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    updatedBy: text("updated_by")
      .notNull()
      .references(() => user.id),
    publishedAt: timestamp("published_at"),
    ...dates(),
  },
  (t) => [index("course_owner_idx").on(t.ownerId)],
);
export const collaborators = pgTable(
  "course_collaborator",
  {
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    role: text("role", { enum: ["EDITOR", "INSTRUCTOR", "VIEWER"] }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.userId] })],
);
export const versions = pgTable(
  "course_version",
  {
    id: id(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id),
    number: integer("number").notNull(),
    revision: integer("revision").notNull().default(0),
    status: text("status", { enum: ["DRAFT", "PUBLISHED"] })
      .notNull()
      .default("DRAFT"),
    tree: jsonb("tree").$type<CourseTree>().notNull().default({ modules: [] }),
    metadata: jsonb("metadata").$type<CourseMetadata>().notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    updatedBy: text("updated_by")
      .notNull()
      .references(() => user.id),
    publishedAt: timestamp("published_at"),
    ...dates(),
  },
  (t) => [uniqueIndex("course_version_number").on(t.courseId, t.number)],
);
export const publishedVersions = pgTable("published_version", {
  courseId: text("course_id")
    .primaryKey()
    .references(() => courses.id),
  versionId: text("version_id")
    .notNull()
    .unique()
    .references(() => versions.id),
});
export const contentAssets = pgTable("content_asset", {
  id: id(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id),
  kind: text("kind", {
    enum: ["IMAGE", "VIDEO", "AUDIO", "MUSICXML", "MIDI"],
  }).notNull(),
  title: text("title").notNull(),
  storageKey: text("storage_key"),
  url: text("url"),
  mime: text("mime"),
  size: integer("size"),
  rights: jsonb("rights").notNull().default({ status: "UNKNOWN" }),
  ...dates(),
});
export const midiRecordings = pgTable("midi_recording", {
  id: id(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id),
  title: text("title").notNull(),
  duration: real("duration").notNull(),
  tempo: real("tempo").notNull(),
  meter: jsonb("meter").$type<[number, number]>().notNull().default([4, 4]),
  events: jsonb("events").$type<MidiEvent[]>().notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  ...dates(),
});
export const canonicalScores = pgTable("canonical_score", {
  id: id(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id),
  schemaVersion: integer("schema_version").notNull().default(1),
  data: jsonb("data").notNull(),
  sourceAssetId: text("source_asset_id").references(() => contentAssets.id),
  ...dates(),
});
export const scoringProfiles = pgTable("scoring_profile", {
  id: id(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id),
  name: text("name").notNull(),
  config: jsonb("config").$type<ScoringProfile>().notNull(),
  ...dates(),
});
export const enrollments = pgTable(
  "course_enrollment",
  {
    id: id(),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id),
    versionId: text("version_id")
      .notNull()
      .references(() => versions.id),
    accessType: text("access_type", {
      enum: [
        "FREE",
        "PURCHASED",
        "TEACHER_ASSIGNED",
        "INVITED",
        "ADMIN_GRANTED",
      ],
    }).notNull(),
    currentLessonId: text("current_lesson_id"),
    completedAt: timestamp("completed_at"),
    ...dates(),
  },
  (t) => [uniqueIndex("enrollment_student_course").on(t.studentId, t.courseId)],
);
export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: id(),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollments.id),
    lessonId: text("lesson_id").notNull(),
    completedAt: timestamp("completed_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("progress_once").on(t.enrollmentId, t.lessonId)],
);
export const performances = pgTable(
  "performance",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollments.id),
    versionId: text("version_id")
      .notNull()
      .references(() => versions.id),
    lessonId: text("lesson_id").notNull(),
    blockId: text("block_id").notNull(),
    mode: text("mode", {
      enum: ["LEARN", "PRACTICE", "PERFORMANCE"],
    }).notNull(),
    tempo: real("tempo").notNull(),
    startedAt: timestamp("started_at").notNull(),
    endedAt: timestamp("ended_at").notNull(),
    events: jsonb("events").$type<MidiEvent[]>().notNull(),
    analysis: jsonb("analysis").notNull(),
    score: real("score").notNull(),
    passed: boolean("passed").notNull(),
    scoringVersion: text("scoring_version").notNull().default("1"),
    ...dates(),
  },
  (t) => [index("performance_enrollment_idx").on(t.enrollmentId)],
);
export const relationships = pgTable(
  "teacher_student_relationship",
  {
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id),
    studentId: text("student_id")
      .notNull()
      .references(() => user.id),
    ...dates(),
  },
  (t) => [primaryKey({ columns: [t.teacherId, t.studentId] })],
);
export const invitations = pgTable("student_invitation", {
  id: id(),
  teacherId: text("teacher_id")
    .notNull()
    .references(() => user.id),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  ...dates(),
});
export const assignments = pgTable("assignment", {
  id: id(),
  assignedBy: text("assigned_by")
    .notNull()
    .references(() => user.id),
  assignedTo: text("assigned_to")
    .notNull()
    .references(() => user.id),
  contentType: text("content_type", {
    enum: [
      "COURSE",
      "LESSON",
      "EXERCISE",
      "SIGHT_READING",
      "REPERTOIRE",
      "CUSTOM_PRACTICE",
    ],
  }).notNull(),
  contentId: text("content_id").notNull(),
  versionId: text("version_id").references(() => versions.id),
  dueAt: timestamp("due_at"),
  instructions: text("instructions").notNull().default(""),
  status: text("status", { enum: ["ASSIGNED", "IN_PROGRESS", "COMPLETED"] })
    .notNull()
    .default("ASSIGNED"),
  completion: real("completion").notNull().default(0),
  ...dates(),
});
export const skills = pgTable("skill", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  parentId: text("parent_id"),
  difficulty: integer("difficulty").notNull(),
  description: text("description").notNull().default(""),
});
export const contentSkills = pgTable(
  "content_skill",
  {
    contentType: text("content_type").notNull(),
    contentId: text("content_id").notNull(),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id),
  },
  (t) => [primaryKey({ columns: [t.contentType, t.contentId, t.skillId] })],
);
export const skillMastery = pgTable(
  "user_skill_mastery",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id),
    mastery: real("mastery").notNull().default(0),
    confidence: real("confidence").notNull().default(0),
    exposures: integer("exposures").notNull().default(0),
    successes: integer("successes").notNull().default(0),
    failures: integer("failures").notNull().default(0),
    lastPracticed: timestamp("last_practiced"),
    nextReview: timestamp("next_review"),
    trend: jsonb("trend").notNull().default([]),
  },
  (t) => [primaryKey({ columns: [t.userId, t.skillId] })],
);
export const libraryItems = pgTable("library_item", {
  id: id(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id),
  kind: text("kind", {
    enum: ["EXERCISE", "SIGHT_READING", "REPERTOIRE"],
  }).notNull(),
  title: text("title").notNull(),
  status: text("status", { enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] })
    .notNull()
    .default("DRAFT"),
  version: integer("version").notNull().default(1),
  blocks: jsonb("blocks").notNull().default([]),
  canonicalScoreId: text("canonical_score_id").references(
    () => canonicalScores.id,
  ),
  rights: jsonb("rights").notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  updatedBy: text("updated_by")
    .notNull()
    .references(() => user.id),
  ...dates(),
});
export const practiceSessions = pgTable("practice_session", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  contentId: text("content_id"),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  durationSeconds: integer("duration_seconds").notNull().default(0),
});
export const libraryAttempts = pgTable("library_attempt", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  itemId: text("item_id")
    .notNull()
    .references(() => libraryItems.id),
  itemVersion: integer("item_version").notNull(),
  events: jsonb("events").$type<MidiEvent[]>().notNull(),
  analysis: jsonb("analysis").notNull(),
  ...dates(),
});
export const userRepertoire = pgTable(
  "user_repertoire",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    itemId: text("item_id")
      .notNull()
      .references(() => libraryItems.id),
    progress: real("progress").notNull().default(0),
    ...dates(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] })],
);
export const reports = pgTable("content_report", {
  id: id(),
  reportedBy: text("reported_by")
    .notNull()
    .references(() => user.id),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["OPEN", "REVIEWED", "RESOLVED"] })
    .notNull()
    .default("OPEN"),
  adminNotes: text("admin_notes").notNull().default(""),
  ...dates(),
});
export const auditLog = pgTable("audit_log", {
  id: id(),
  actorId: text("actor_id")
    .notNull()
    .references(() => user.id),
  action: text("action").notNull(),
  resourceId: text("resource_id").notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
