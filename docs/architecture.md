# Architecture

The Next.js application has three protected areas: `/student`, `/teacher`, and `/admin`. Server layouts enforce area roles, server pages enforce record access, and the mutation boundary `/api/platform` authenticates every request, validates a discriminated command schema, and checks same-origin requests. Better Auth owns registration, sessions, password hashing and logout under `/api/auth`.

UI is intentionally neutral. Course-specific React components do not exist. The domain graph is Course → CourseVersion → ordered Module → ordered Lesson → ordered LessonBlock. A validated JSON document holds each version's tree. Stable content IDs support ordering, duplication and version-bound progress without forcing every block's configuration into SQL tables. Course ownership, enrollments, progress, performances, roles and sharing are relational.

Pure modules in `domains/midi`, `domains/music`, `domains/scoring`, and `domains/blocks` contain the reusable engine logic. `components/lesson/renderer.tsx` is shared verbatim by student lessons and teacher preview. Preview does not submit performances or progress because it has no enrollment ID.

`PlatformService` centralizes course and student business rules. It accepts a database dependency, allowing integration tests to apply production PostgreSQL migrations in isolated PGlite. UI pages use Drizzle for simple scoped reads; domain-changing behavior goes through the service.

Flexible JSON is versioned and parsed with Zod at write boundaries. Recordings are immutable structured event streams. Assets are immutable metadata records. Sites supports private R2 file uploads with D1 asset metadata and authorized, range-capable playback; uploaded MIDI is also normalized into the shared recording model. Teacher-supplied HTTPS URLs remain supported. `ObjectStorage` provides a later S3 integration seam for the standalone PostgreSQL build. SQL history and fixture scripts are separate.

Future payment providers should implement access grants while keeping `CourseEnrollment.accessType`. Do not infer purchased access from a URL or client-provided price. Messaging, marketplace ranking, payouts, reviews and curriculum are outside this phase.
