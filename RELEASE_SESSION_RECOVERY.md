# Approved save-session recovery release

Owner explicitly approved deployment on 2026-10-21. Promoted the runtime and
tests from development commit 704efc8 without unrelated Creator changes.

Public platform requests renew a rejected session and retry the same checkpoint
once, sharing concurrent recovery and preserving queued progress. Legacy/Sites
requests remain unchanged. Provider outages/throttling are no longer mislabeled
as expired or unverified email accounts. Auth settings, verification requirements,
gameplay, database schema, layout, DNS and recording infrastructure are unchanged.

Candidate: 489 unit/database/network tests (68 suites), seven focused browser
regressions, TypeScript, changed-file lint, build packaging, and private-credential
scan of 73 packaged files passed. Browser coverage includes renewal, queued MIDI
during an initial provider outage, checkpoint identity, battle/countdown continuity
and password recovery. These are fixtures, not a deliberate live token-expiry test.

Previous deployment / rollback: d2d42ba1-2273-4e71-bb64-e8b0a768bac3 (2a9f941).
Use the unchanged guarded production helper and existing runtime bindings.
