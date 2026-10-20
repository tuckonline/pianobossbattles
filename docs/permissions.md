# Permissions

Roles are independent rows: STUDENT, TEACHER, ADMIN. Registering never grants TEACHER or ADMIN. Trusted role management is available through the local CLI and protected Admin API. Owners are represented by one required course.ownerId FK; a separate owner table would duplicate the same invariant. Collaborators have EDITOR, INSTRUCTOR or VIEWER roles.

| Action                          | Allowed                       |
| ------------------------------- | ----------------------------- |
| Create course/recording/media   | Teacher or admin              |
| Read Studio course              | Owner, collaborator, admin    |
| Edit draft                      | Owner, editor, admin          |
| Publish                         | Owner or admin                |
| Assign / analytics              | Owner, instructor, admin      |
| Open lesson / submit / complete | Matching enrollment's student |
| Grant roles / moderate          | Admin                         |

Every mutation authenticates the current session and performs server checks; UI visibility is supplementary. Resource references must belong to the course owner or current editor. Self-enrollment requires published PUBLIC/UNLISTED content with FREE access. Private assignment requires a teacher/student relationship accepted through an expiring, email-bound token. Invitation creation returns a link; it does not send email.

The command endpoint limits payload length and validates Zod schemas. Authentication enables Better Auth rate limiting. Production should add distributed API rate limiting, email verification and account recovery delivery, CSP review, access logging, backups and retention policy. These operational integrations are not claimed complete. Do not deploy fixture accounts.
