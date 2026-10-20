# Implementation report

## Built

The repository implements protected student/teacher/admin shells, email/password sessions through Better Auth, multi-role authorization, creator-owned versioned courses, module/lesson/block editing, MIDI recording, a simulator, canonical music types, a limited MusicXML importer, Verovio notation rendering, audio playback/metronome, configurable server scoring, preview, publishing, enrollments, progress, invitation/assignment flow and basic teacher analytics. Thirty PostgreSQL tables and a generated migration support these features and future domains.

## Architectural decisions

Drizzle is used as the requested Prisma-equivalent ORM. JSON course snapshots keep configurable content separate from software. Relational ownership and enrollment boundaries remain explicit. Published versions are immutable through the application and students retain their version. Recordings and their normalized events are stored once and referenced by exercise blocks. Preview uses the same lesson renderer/player but has no enrollment and saves no progress.

## Authoring and learning

Teachers create modules and lessons and choose registry-backed blocks. MIDI recording captures relative timestamps, velocity, channels and sustain, then generates canonical tick data with transcription warnings. The recording ID plus a scoring profile becomes the expected exercise response. The player captures a new performance; the server obtains the expected data from the pinned version, recomputes the score, saves events/analysis and validates all required activities before marking a lesson complete.

Publishing requires a known rights status/owner and nonempty lessons. New draft versions preserve earlier content. Student rendering always uses version metadata. The application exposes neutral responsive components and keyboard-accessible reordering, focus states, semantic forms and MIDI simulator controls.

## Future content

Use the existing authoring service and block schemas for new courses, modules and lessons. Use normalized recordings or canonical/MusicXML assets for new MIDI activities. Do not add course-specific React logic. The generic library item/attempt/repertoire schemas are ready for future sight-reading, practice and repertoire APIs; their first full content-management workflow still needs implementation. See content-model.md for recipes.

## Running and testing

Follow README.md for PostgreSQL or local PGlite setup, initial admin grant, fixtures and commands. Follow midi.md for physical keyboard setup. Simulator events enter the same recorder/scorer path and are used in automated tests. No physical MIDI keyboard was available for hardware validation.

## Known limitations

- This is an initial working foundation, not a completed production-hardening program.
- Library CRUD, non-course assignment execution, skill mastery algorithm, standalone S3 adapter, collaborator-management UI, email delivery/recovery and sophisticated moderation are extension points. Sites supports course-builder video, audio and MIDI uploads through private R2 storage.
- MIDI templates currently share common player behavior; advanced template-specific rules are not implemented.
- Playback uses oscillators, not sampled piano audio; acoustic sustain and seamless submeasure loops are not implemented.
- MusicXML canonical import is limited; Verovio renders the original notation. Automatic cursor-ID mapping and professional transcription are not complete.
- Scoring uses a baseline greedy matcher and assumes 4/4 for problem-measure labels.
- Production operational hardening, distributed rate limits, backups, real-PostgreSQL load/concurrency tests and hardware/browser testing remain necessary.
- The initial Sites deployment uses the D1/Worker adapter and Sites sign-in. PostgreSQL/Better Auth remains available for standalone hosting. Dedicated library/mastery workflows are not enabled on the initial hosted version.

## Recommended next phase

Finish deployment-specific authentication/persistence verification and production security/operational controls, then build one teacher-authored pilot course to validate authoring ergonomics and musical scoring with real keyboards. Add library CRUD using the existing content model before creating sight-reading, exercise or repertoire collections. Keep final branding, commercial content and payments out until these foundations are validated.
