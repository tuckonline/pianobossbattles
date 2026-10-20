# Lesson blocks

The source of truth is `src/domains/blocks/schema.ts`. Every supported block is a discriminated Zod object. The registry in `components/lesson/registry.tsx` maps its type to TeacherEditorComponent and StudentRendererComponent. The registry reuses field editors for similar text, media and question blocks. MIDI-specific controls are composed by the builder.

Implemented block families: text/heading/instruction/completion, divider, image/audio/video/MusicXML, MIDI demonstration/exercise, and multiple-choice quiz/assessment/theory/ear-training activities. Ear training is a question container; author audio in an adjacent audio block. It does not generate audio questions.

To add a type: add its schema, include it in the union and registry, define editor and renderer, add `emptyBlock` defaults, validate asset references server-side, and write a contract test. Both preview and lessons will pick it up without course-specific code. Change `schemaVersion` and add migration logic if stored semantics change.

Plain text is rendered as text, not unsanitized HTML. Media uses HTTPS references. MusicXML rejects DTD/entity declarations. Verovio SVG is sanitized before rendering. Future Markdown must use an explicit sanitizer.
