# Testing

## Verified in this workspace

- 13 unit/database integration tests passed.
- The teacher-to-student Playwright workflow passed against the production Next.js server with an isolated local database.
- TypeScript, ESLint and the optimized Next.js build passed.
- Physical MIDI and Sites deployment have not been verified.

The Sites adapter additionally passes 3 D1/Worker integration tests (16 total unit/integration tests) and the complete teacher/student browser workflow against the local Worker. These verify atomic stale-write rejection, database-level published immutability, private assignments, saved performances/progress, missing identity and cross-origin rejection. Native WebMCP availability and physical MIDI remain unverified.

Use PostgreSQL for normal development when possible. Restarting the Next.js development server while a file-backed PGlite instance is still open can abort that local database instance. The verified browser run used a fresh PGlite directory and one production server process; this is a test convenience, not a hosted deployment configuration.

`npm test` runs pure-engine tests and a database integration suite. Coverage includes MIDI normalization/recording/simulation/trimming, canonical conversion, scoring dimension validation, pitch/timing outcomes, XML input validation, roles, course ownership, stale revisions, published immutability, enrollment idempotency, unauthorized access, required exercise completion, stored events, progress idempotency, analytics boundaries, pinned versions, invitation email binding and private assignments.

`npm run test:e2e` uses Playwright against localhost. Seed fixtures with a development-only FIXTURE_PASSWORD first. It signs in as a teacher, authors a course, records an on-screen MIDI note, previews, publishes, signs in in a separate student browser context, enrolls, plays, saves progress, checks role redirects, and verifies teacher analytics. It is not a physical-device test.

Run `npm run typecheck`, `npm run lint` and `npm run build` before shipping. The build requires an auth secret and a DATABASE_URL in production mode but does not require a live database for dynamically rendered pages. A syntactically valid unused local connection string can be used for build-only CI. Never report a successful build as proof of deployed database connectivity.

Required next verification: real PostgreSQL under concurrency, physical MIDI hardware, MusicXML multi-part fidelity, mobile browser compatibility, hosted authentication and storage, and accessibility with a screen reader. Add behavioral tests for future engines rather than snapshots that mirror implementation details.
