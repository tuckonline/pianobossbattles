# Content model and authoring recipes

## Course content

Create a course through Teacher Studio or `PlatformService.createCourse(actor, title)`. It starts private with an empty draft and UNKNOWN rights. Add a module with a new stable ID, title and empty lessons. Add a lesson with a new stable ID, title and blocks array. Blocks have `id`, `type`, `schemaVersion: 1`, and centrally validated `config`.

Save the entire draft through `saveDraft` with the current revision. Never insert unvalidated client JSON directly. A successful save increments revision. For MIDI, call `record` with normalized events, then reference its immutable recording ID from the exercise block. Publish only after rights and completeness checks pass.

Future content prompts should supply: course metadata, owner, rights declaration, module/lesson outline, validated blocks, expected MIDI recording or MusicXML source, and scoring profile. They should use existing authoring APIs, not add course-specific routes or change the engines. Do not put production curriculum in developer fixtures.

## Sight reading, practice and repertoire

The `library_item` table shares ownership, lifecycle, rights, revision, blocks and optional canonical score across EXERCISE, SIGHT_READING and REPERTOIRE. `library_attempt` retains performed MIDI and analysis; `user_repertoire` tracks personal progress. `content_skill` associates any content kind with skills.

Adding the first real library item requires a small library service/API and editor built over these existing tables and schemas. This foundation does not yet expose library-item CRUD. A future prompt should implement that service with owner checks, immutable publication snapshots and assignment validation, then insert content through it. This is extension work, not a database or engine redesign.

For sight reading, store teacher-authored or generated canonical scores with provenance and generation settings. For practice exercises, store a canonical score/recording and an existing MIDI block configuration. For repertoire, supply rights metadata and notation/performance assets. Do not infer copyright permission from availability online. No content library or skill taxonomy has been seeded.
