# Publishing

Course has visibility PRIVATE/UNLISTED/PUBLIC and lifecycle DRAFT/IN_REVIEW/PUBLISHED/ARCHIVED/REJECTED/SCHEDULED. Version has DRAFT/PUBLISHED. IN_REVIEW, REJECTED and SCHEDULED are architectural states; no review queue or scheduler is implemented. Admin can archive or mark review states.

An owner/admin publishes an explicitly identified draft revision. The service locks the course row, verifies rights and lesson completeness, marks the version published, updates the published-version pointer and writes an audit record in one transaction. Save requests update only DRAFT versions with a matching revision. A new draft deep-copies the last version and increments its number. Module, lesson and block IDs remain stable unless duplicated.

CourseEnrollment references a concrete version. Publishing version 2 does not migrate existing version-1 enrollments or their progress. Such migrations must be explicit future product actions. Media and recordings referenced by published trees cannot currently be edited through the API.

Course metadata has a draft copy on Course for Studio lists and a versioned copy for student rendering. Published enrollment pages use the published metadata snapshot. Visibility is course-level access policy. Archive prevents new self-enrollment; existing enrolled students retain their version.

Publishing a course is separate from deploying the website to Sites. Hosting does not automatically publish any teacher draft.
