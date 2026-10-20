import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/sqlite-core";
export const shortsSessions=sqliteTable('shorts_sessions',{
  userId:text('user_id').notNull(),id:text('id').notNull(),revision:integer('revision').notNull(),
  payload:text('payload').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[primaryKey({columns:[t.userId,t.id]}),index('shorts_sessions_owner_updated').on(t.userId,t.updatedAt)]);
export const practiceExercises = sqliteTable(
  "practice_exercises",
  {
    number: integer("number").primaryKey(),
    collection: text("collection").notNull(),
    sourceNumber: integer("source_number").notNull(),
    title: text("title").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourcePage: integer("source_page").notNull(),
    definition: text("definition").notNull(),
  },
  (t) => [
    uniqueIndex("practice_collection_number").on(t.collection, t.sourceNumber),
  ],
);
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});
export const roles = sqliteTable(
  "roles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull(),
  },
  (t) => [uniqueIndex("role_membership").on(t.userId, t.role)],
);
export const courses = sqliteTable(
  "courses",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    visibility: text("visibility").notNull(),
    status: text("status").notNull(),
    publishedVersionId: text("published_version_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("course_owner").on(t.ownerId)],
);
export const collaborators = sqliteTable(
  "collaborators",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull(),
  },
  (t) => [uniqueIndex("collaborator_membership").on(t.courseId, t.userId)],
);
export const versions = sqliteTable(
  "versions",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id),
    number: integer("number").notNull(),
    revision: integer("revision").notNull(),
    status: text("status").notNull(),
    metadata: text("metadata").notNull(),
    tree: text("tree").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    updatedBy: text("updated_by")
      .notNull()
      .references(() => users.id),
    publishedAt: text("published_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("version_number").on(t.courseId, t.number)],
);
export const recordings = sqliteTable(
  "recordings",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    tempo: integer("tempo").notNull(),
    duration: integer("duration").notNull(),
    events: text("events").notNull(),
    canonical: text("canonical").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("recording_owner").on(t.ownerId)],
);
export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    kind: text("kind").notNull(),
    url: text("url").notNull(),
    rights: text("rights").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("asset_owner").on(t.ownerId)],
);
export const enrollments = sqliteTable(
  "enrollments",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => users.id),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id),
    versionId: text("version_id")
      .notNull()
      .references(() => versions.id),
    accessType: text("access_type").notNull(),
    completedAt: text("completed_at"),
    currentLessonId: text("current_lesson_id"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("student_course").on(t.studentId, t.courseId)],
);
export const performances = sqliteTable(
  "performances",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollments.id),
    versionId: text("version_id")
      .notNull()
      .references(() => versions.id),
    lessonId: text("lesson_id").notNull(),
    blockId: text("block_id").notNull(),
    mode: text("mode").notNull(),
    tempo: integer("tempo").notNull(),
    events: text("events").notNull(),
    analysis: text("analysis").notNull(),
    score: integer("score").notNull(),
    passed: integer("passed").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("attempt_enrollment").on(t.enrollmentId, t.lessonId),
    index("attempt_user").on(t.userId),
  ],
);
export const progress = sqliteTable(
  "progress",
  {
    id: text("id").primaryKey(),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollments.id),
    lessonId: text("lesson_id").notNull(),
    completedAt: text("completed_at").notNull(),
  },
  (t) => [uniqueIndex("lesson_completion").on(t.enrollmentId, t.lessonId)],
);
export const relationships = sqliteTable(
  "relationships",
  {
    id: text("id").primaryKey(),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => users.id),
    studentId: text("student_id")
      .notNull()
      .references(() => users.id),
  },
  (t) => [uniqueIndex("teacher_student").on(t.teacherId, t.studentId)],
);
export const invitations = sqliteTable("invitations", {
  id: text("id").primaryKey(),
  teacherId: text("teacher_id")
    .notNull()
    .references(() => users.id),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  acceptedAt: text("accepted_at"),
});
export const assignments = sqliteTable(
  "assignments",
  {
    id: text("id").primaryKey(),
    assignedBy: text("assigned_by")
      .notNull()
      .references(() => users.id),
    assignedTo: text("assigned_to")
      .notNull()
      .references(() => users.id),
    contentType: text("content_type").notNull(),
    contentId: text("content_id").notNull(),
    versionId: text("version_id")
      .notNull()
      .references(() => versions.id),
    instructions: text("instructions").notNull(),
    status: text("status").notNull(),
    dueAt: text("due_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("assignment_student").on(t.assignedTo)],
);
export const audit = sqliteTable("audit", {
  id: text("id").primaryKey(),
  actorId: text("actor_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  resourceId: text("resource_id").notNull(),
  details: text("details").notNull(),
  createdAt: text("created_at").notNull(),
});
export const guards = sqliteTable("mutation_guards", {
  id: text("id").primaryKey(),
  accepted: integer("accepted").notNull(),
});
export const videoUploads = sqliteTable(
  "video_uploads",
  {
    id: text("id").primaryKey(),
    uploaderId: text("uploader_id")
      .notNull()
      .references(() => users.id),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    uploadId: text("upload_id").notNull(),
    filename: text("filename").notNull(),
    size: integer("size").notNull(),
    rights: text("rights").notNull(),
    parts: text("parts").notNull().default("{}"),
    state: text("state").notNull().default("UPLOADING"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("video_upload_owner_created").on(t.uploaderId, t.createdAt)],
);
export const sightAttempts = sqliteTable(
  "sight_attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    exerciseNumber: integer("exercise_number").notNull(),
    hand: text("hand").notNull(),
    accuracy: integer("accuracy").notNull(),
    mistakes: integer("mistakes").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("sight_attempt_user_created").on(t.userId, t.createdAt)],
);
export const obsSessions = sqliteTable("obs_sessions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  sourceId: text("source_id").notNull(),
  sequence: integer("sequence").notNull(),
  snapshot: text("snapshot").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const obsScorePeers = sqliteTable("obs_score_peers", {
  userId:text("user_id").notNull(),
  viewerId:text("viewer_id").notNull(),
  sourceId:text("source_id").notNull(),
  offer:text("offer").notNull(),
  answer:text("answer"),
  createdAt:integer("created_at").notNull(),
},t=>[primaryKey({columns:[t.userId,t.viewerId]}),index("obs_score_peers_source").on(t.userId,t.sourceId,t.createdAt)]);

export const practiceStreamStats = sqliteTable("practice_stream_stats", {
  userId: text("user_id").primaryKey().references(() => users.id),
  startedAt: text("started_at").notNull(),
});

export const gamePlayers = sqliteTable("game_players", {
  userId: text("user_id").notNull().references(()=>users.id),
  totalXp: integer("total_xp").notNull().default(0),
  rulesVersion: integer("rules_version").notNull().default(1),
  curveVersion: integer("curve_version").notNull().default(1),
  revision: integer("revision").notNull().default(0),
  settings: text("settings").notNull().default("{}"),
  updatedAt: text("updated_at").notNull(),
}, t=>[primaryKey({columns:[t.userId]})]);

export const gameSessions = sqliteTable("game_sessions", {
  id: text("id").notNull(),
  userId: text("user_id").notNull().references(()=>users.id),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  startingXp: integer("starting_xp").notNull(),
  curveVersion: integer("curve_version").notNull().default(1),
}, t=>[primaryKey({columns:[t.userId,t.id]})]);

export const gameAttempts = sqliteTable("game_attempts", {
  id: text("id").notNull(),
  userId: text("user_id").notNull().references(()=>users.id),
  sessionId: text("session_id").notNull(),
  exerciseNumber: integer("exercise_number").notNull(),
  conditionKey: text("condition_key").notNull(),
  status: text("status").notNull(),
  sequence: integer("sequence").notNull(),
  played: text("played").notNull(),
  result: text("result").notNull(),
  activeMs: integer("active_ms").notNull().default(0),
  startedAt: text("started_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, t=>[primaryKey({columns:[t.userId,t.id]}),index("game_attempt_session").on(t.userId,t.sessionId),index("game_attempt_condition").on(t.userId,t.conditionKey,t.status)]);

export const gameXpLedger = sqliteTable("game_xp_ledger", {
  rewardId: text("reward_id").notNull(),
  userId: text("user_id").notNull().references(()=>users.id),
  sourceEventId: text("source_event_id").notNull(),
  attemptId: text("attempt_id"),
  sessionId: text("session_id").notNull(),
  category: text("category").notNull(),
  amount: integer("amount").notNull(),
  rulesVersion: integer("rules_version").notNull().default(1),
  createdAt: text("created_at").notNull(),
}, t=>[primaryKey({columns:[t.userId,t.rewardId]}),index("game_ledger_session").on(t.userId,t.sessionId)]);

export const gameUnlocks = sqliteTable("game_unlocks", {
  userId: text("user_id").notNull().references(()=>users.id),
  achievementId: text("achievement_id").notNull(),
  sourceEventId: text("source_event_id").notNull(),
  sessionId: text("session_id").notNull(),
  unlockedAt: text("unlocked_at").notNull(),
  awardedXp: integer("awarded_xp").notNull(),
}, t=>[primaryKey({columns:[t.userId,t.achievementId]})]);

export const gameComboRecords = sqliteTable("game_combo_records", {
  userId: text("user_id").notNull().references(()=>users.id),
  scope: text("scope").notNull(),
  scopeId: text("scope_id").notNull(),
  best: integer("best").notNull(),
  updatedAt: text("updated_at").notNull(),
}, t=>[primaryKey({columns:[t.userId,t.scope,t.scopeId]})]);

export const gameDays = sqliteTable("game_days", {
  userId: text("user_id").notNull().references(()=>users.id),
  day: text("day").notNull(),
}, t=>[primaryKey({columns:[t.userId,t.day]})]);

export const battleStoryAttempts=sqliteTable('battle_story_attempts',{
  userId:text('user_id').notNull().references(()=>users.id),attemptId:text('attempt_id').notNull(),
  challengeKey:text('challenge_key').notNull(),challenge:text('challenge').notNull(),result:text('result').notNull(),
},t=>[primaryKey({columns:[t.userId,t.attemptId]})]);
export const battleStoryRecords=sqliteTable('battle_story_records',{
  userId:text('user_id').notNull().references(()=>users.id),challengeKey:text('challenge_key').notNull(),
  lastResult:text('last_result').notNull(),bestResult:text('best_result').notNull(),
},t=>[primaryKey({columns:[t.userId,t.challengeKey]})]);

export const gameEvents = sqliteTable("game_events", {
  userId: text("user_id").notNull().references(()=>users.id),
  id: text("id").notNull(),
  sessionId: text("session_id").notNull(),
  attemptId: text("attempt_id"),
  sequence: integer("sequence").notNull(),
  event: text("event").notNull(),
}, t=>[primaryKey({columns:[t.userId,t.id]})]);
