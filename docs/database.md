# Database

Drizzle owns 30 PostgreSQL tables and generated SQL under `drizzle/`. Core relational entities include users, sessions, accounts, role memberships, student/teacher profiles, courses, collaborators, versions, current publications, assets, recordings, canonical scores, scoring profiles, enrollments, lesson progress, performances, relationships, invitations, assignments, skills, mastery, library items/attempts, practice sessions, personal repertoire, reports and audit history.

Modules, lessons and blocks are embedded in validated version JSON. MIDI events and performance analysis are bounded JSON documents attached to their parent records; they are not separate event rows. This preserves whole-attempt atomicity and avoids write amplification. Future analytics can normalize events into a warehouse without losing the originals.

Foreign keys protect user/course/version relationships. Unique indexes protect version numbering, one enrollment per student/course, one lesson completion per enrollment/lesson and role/collaborator memberships. Creator objects track ownership and timestamps; version and course writes track actor IDs.

`db:migrate` records each SQL filename in `pianopath_migrations`, takes a PostgreSQL advisory lock and applies it atomically. Do not edit applied migrations. Generate and inspect new migrations. Take backups before production schema changes. PGlite applies the same PostgreSQL SQL in tests; it is not a production multi-process substitute.

Library attempt, repertoire, skill and assignment-type tables are foundations, not claims that every end-user workflow exists. Polymorphic content IDs need service-level validation when those APIs are added.
