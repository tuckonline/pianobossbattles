# Clockwork Kingdom production release — 2026-10-30

The signed-in homepage now opens Clockwork Kingdom: five musical trials and the Clockwork King. The existing battle experience and its records remain available at `/legacy-battles`. Infinite Classical Practice generates seeded studies with starting-finger guidance.

## Difficulty and grading

- Five musical tiers use tempo presets of Novice 50, Beginner 65, Intermediate 80, Advanced 105 and Maestro 130 BPM. Tempo remains adjustable.
- Novice uses a small pitch range, simple rhythms and sustained bass. Difficulty changes musical content independently of MIDI tolerance.
- Realm progress is stored independently for each difficulty in the existing `game_events` table. Legacy records and untiered realm records are retained. No database migration is required.
- Rhythm tolerance remains `max(70, min(150, 60000 / BPM * 0.2))` milliseconds. Pitch matching remains `min(60000 / BPM * 0.45, 300)` milliseconds. Star thresholds remain 70/85/95 percent.
- Versioned grading accepts valid early opening notes, waits for the full existing late window, prevents reuse of expected notes and duplicate packets, and avoids penalizing a wrong-pitch substitution twice. Timing diagnostics report signed onset deviations. Old receipts retain their original interpretation.
- The audio metronome aligns with the performance clock; pending audio unlock cannot restart sound after stopping.

## Scope and release verification

The feature files were promoted from the existing development worktree onto production base `54541d02150b88f08524a00343db456a0bf1401c`. Unreleased Creator Studio changes were excluded. Existing authentication, database bindings, protected music delivery and deployment guards are unchanged.

Checks on the assembled production worktree:

- TypeScript: passed.
- ESLint on changed TypeScript/TSX files: passed.
- Realm, persistence and audio tests: 16 passed.
- Generator and existing engine tests: 23 passed, including Novice/Maestro content, tempo presets and legacy pitch/rhythm grading.
- Production client and Pages worker packaging: passed (`npm run build:preview` is local packaging only).
- Bundle checks confirmed the expected Supabase project, realm/difficulty content and absence of private score files. No extensive browser playthrough campaign was run.

Physical MIDI input, perceived audio/visual alignment and a real signed-in saved attempt still require the owner's keyboard check on the live site.

## Publish and rollback

Publish from a clean, pushed `feature/end-user-website-v1` using the existing guarded helper: `node public-app/deploy-production.mjs --confirm-production`.

Target: `https://www.pianobossbattles.com`, Cloudflare Pages project `pianobossbattles`, production branch `production`.

Pre-release deployment retained for rollback: `c85acc6b-0c62-4a6b-87d3-26f199ea127c` (source `54541d0`). Rolling back assets/worker does not require deleting realm records or changing database schema.
