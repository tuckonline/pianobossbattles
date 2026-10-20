# Sites deployment

The initial hosted application uses Sites D1 and Sites-provided sign-in. The Site ID is persisted in `.openai/hosting.json`; always reuse it. Audience is private to its owner unless explicitly changed in Sites access settings. Course PUBLIC visibility does not override the Site audience.

## Two adapters, shared engines

- `hosted/` is a Cloudflare Worker, D1 service and React application using the existing course builder, recorder, lesson renderer, player, schemas and scoring engines.
- `src/app/` retains the Next.js/PostgreSQL/Better Auth application for standalone hosting.
- `npm run build` creates the Sites Worker and browser assets in `dist/`.
- `npm run build:next` builds the retained Next.js application.
- `drizzle/` contains D1 migrations; `postgres/drizzle/` preserves PostgreSQL migrations.
- D1 uses prepared statements and atomic batches. Transaction guards reject stale writes; a database trigger prohibits changing published versions. No DDL runs at request time.

The hosted database contains active course, role, media, MIDI, enrollment, performance, progress, invitation, assignment and audit models. Future library/mastery tables remain in the PostgreSQL foundation; port those through append-only D1 migrations when enabling those features.

## Identity

Sites verifies identity and forwards user ID and email. The Worker requires these headers and never trusts browser-supplied roles. Only the owner email configured in the secret `PIANOPATH_OWNER_EMAIL` receives initial Teacher/Admin grants. Other admitted users start as Students; admins can grant Teacher access. Do not expose this Worker outside the Sites dispatcher with untrusted identity headers.

The deployed Worker has no test-identity fallback. The loopback-only `hosted/preview.mjs` proxy injects a developer identity for local preview and is excluded from the built Worker. Password login remains in the standalone app; Sites owns hosted sign-in/sign-out. The API rejects missing identity, cross-origin mutations, oversized bodies, invalid block JSON and unauthorized records.

## Local hosted preview

```
npm ci
npm run build
npx wrangler d1 migrations apply pianopath-local --local --config dist/server/wrangler.json --persist-to .wrangler/state
npx wrangler dev --config dist/server/wrangler.json --port 8787 --ip 127.0.0.1 --persist-to .wrangler/state --var PIANOPATH_OWNER_EMAIL:local@pianopath.test
```

In another terminal run `node hosted/preview.mjs` and open `http://127.0.0.1:3001`. Browser tests use the Worker directly with distinct developer identities: `npm run test:e2e:sites`. All test content is local or isolated. Deployment migrations contain only schema and integrity triggers; production starts empty.

## Publication

Build, push the exact source revision, package the Worker/client/manifest/D1 migrations, save the version, and deploy privately. Sites provisions D1 and applies migrations. Preserve applied SQL and metadata. On Windows without Bash, use the packaged `prepare-site-build.cjs` validator and an equivalent tar archive of validated `dist/` output.

Optional WebMCP exposes `create_course_draft` through the same API and editor navigation. Browsers without WebMCP ignore it. Native WebMCP and physical MIDI availability are not verified by the automated tests.
