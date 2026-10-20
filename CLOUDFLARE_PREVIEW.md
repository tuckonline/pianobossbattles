# Cloudflare preview

This deployment uses a **Cloudflare Pages feature-branch preview** with an
advanced-mode Worker backend, not a production deployment, Git integration, or
the original ChatGPT-hosted app. The feature branch is
`feature/end-user-website-v1`. Do not connect a custom domain or merge to main.

## Runtime and deployment

The Vite SPA uses Cloudflare Static Assets. A small Node-compatible Worker invokes
the same authenticated API, PostgreSQL adapter, scoring service and OBS handlers
as the local Node server. OBS SSE connections retain their database pool until
the stream ends or is cancelled. The presentation routes do not create MIDI
evaluators.

Build: `npm run build:preview`

Deploy the preview only: `npm run deploy:preview`

Configuration: `wrangler.jsonc`; Pages project `pianobossbattles-preview`, branch
`feature/end-user-website-v1`. The project reserves `main` as its production
branch, but has no Git integration and no production deployment. The deployment
script rejects other branches and dirty working trees. Auth and Hyperdrive
bindings exist only in the preview environment.

`wrangler.preview.jsonc` also supplies the Worker bundling settings for the dry-run
build. Initial Worker Previews and a version preview uploaded successfully, but
returned platform 404 responses; neither was promoted to production. Their
workers.dev production endpoint remains disabled. Pages uses the identical
Worker code and the same isolated Hyperdrive connection.

Hyperdrive `pianobossbattles-preview` stores the database credentials server-side.
It connects to the new Supabase project through its session pooler with
`verify-full` and the official Supabase Root 2021 CA. Query caching is disabled.
The original D1 database is not bound or modified. The public publishable key is
intentionally included in the SPA; no privileged Supabase key is used.

The local `.env`, certificate setup and Wrangler credentials remain ignored.
Do not put `DATABASE_URL` or database passwords in Vite variables, CLI arguments,
Wrangler configuration, browser assets, or Git. Preview API responses are private
and uncacheable; preview pages advertise `noindex, nofollow` (not access control).
Authentication and email verification are still required to access player data.

## Auth redirects

The exact stable preview root and `/?recovery=1` callback are added to Supabase's
allowlist. Existing localhost and production-domain entries are preserved; Site
URL remains localhost during local testing. Unique per-deployment URLs are not
auth callback destinations. Use the stable preview URL for sign-in and testing.

## Prelaunch gates

- **Password recovery: UNVERIFIED.** The default sender hit its quota. A delivered
  reset email did not complete recovery in a different browser; corrected PKCE
  handling has fixture coverage but the real reset flow must still be completed.
- Configure a dedicated transactional SMTP provider, sender domain and delivery
  monitoring before public launch. Verify registration, confirmation and password
  reset delivery to non-team recipients. Do not disable confirmation to work
  around the default sender's restrictions.
- Complete deployed login, refresh persistence, real MIDI and OBS recording checks.
- Review Cloudflare request/CPU and Hyperdrive query quotas under actual OBS polling
  load before inviting players; no plan upgrade is performed by this deployment.
- Complete final security and cross-player isolation review.
- Obtain explicit owner approval before public-domain deployment or DNS changes.

See SUPABASE_SETUP.md for the completed local registration, saved-progress and
database/RLS checks. Preview verification results are recorded separately below.
