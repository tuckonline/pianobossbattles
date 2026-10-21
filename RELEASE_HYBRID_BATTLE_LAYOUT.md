# Approved hybrid battle layout release

Owner authorized production publication on 2026-10-21 after local review.
Promoted from development commit b9bdf48 into feature/end-user-website-v1.

Includes the required one-page setup -> Start Battle -> modal countdown flow,
compact three-column HUD, larger stable notation region and optional cinematic
portal. Side-by-side visual placement is opt-in; existing OBS/Shorts defaults
remain unchanged. Existing storage/checkpoint fixes are retained.

Excludes Creator Studio routes/services, Creator migration, original Sites/D1,
OBS redesign, DNS, auth/SMTP, schema and gameplay changes.

Candidate verification: 480 unit/database/network tests across 66 suites;
47 public browser tests; TypeScript; changed-file ESLint; production packaging;
and diff whitespace checks passed. Both bosses, dense Schmitt/Hanon notation,
three desktop resolutions, all game modes, loop continuity, pause/resume,
score retention, audio ownership and all three held results were exercised.
Packaged assets were scanned for local private credentials and database URLs.
Browser MIDI was simulated; native piano/OBS recording verification remains manual.

Production configuration is unchanged in public-app/production/wrangler.jsonc,
including APP_ORIGIN, Supabase public settings and existing HYPERDRIVE binding.
Release via the existing guarded deploy:production helper only.
Rollback target: 0b2d7346-c0a5-490e-92d3-3037e5d9ae15 (76f3752).
No removed preview environment is recreated.
