# Approved Piano Boss Battles branding

`approved-emblem.png` is the owner's supplied original, copied without changes
from the October 20, 2026 attachment. SHA-256:
`fc60d89b14d1ec21d87171ae1ce424043dc0ba2039de97ccaebbd0f78e44b32f`.
The original is retained here as source material, not copied into the public build.

`node scripts/generate-branding.mjs` makes mechanical resized copies of `emblem-transparent-v2.png` using Sharp
(already installed with Next.js), an ICO containing 16/32/48 px PNGs, the 180 px
Apple icon, and the 1200x630 social card. The social card composes the exact emblem
with live-rendered typography and a navy background; it does not redraw the logo.
Generated assets are committed, so builds require no image generation or new runtime.

Both public headers share `public-app/brand-emblem.tsx`. Existing header sizes,
wordmarks and responsive rules are retained. OBS presentation is unchanged.

Metadata is in the initial HTML, including on logged-out pages. Canonical and
Open Graph page URLs are always `https://www.pianobossbattles.com/`.
The build-only `PUBLIC_ASSET_ORIGIN` controls only the absolute sharing-image URL.
It defaults to production. For the isolated preview, build in PowerShell with:

```powershell
$env:PUBLIC_ASSET_ORIGIN='https://feature-end-user-website-v1.pianobossbattles-preview.pages.dev'
npm run build:preview
Remove-Item Env:PUBLIC_ASSET_ORIGIN
```

Then use the existing guarded preview deployment command. Before a separately
approved production release, rebuild without this override so its sharing image
uses the production host. No production configuration or DNS changes are needed.
Preview keeps its existing noindex policy; social platforms may cache older cards.

Branding verification (2026-10-20): 2 focused metadata/asset tests and all 25
existing browser tests passed, including responsive headers, authentication UI,
MIDI scoring, chains, notation presets and OBS audio-owner behavior. TypeScript,
changed-file ESLint and the Pages/Worker build passed. Desktop and 390 px mobile
screenshots were inspected. Browser auth/gameplay tests use fixture accounts;
this branding change does not change the underlying authentication or gameplay.

## Transparent emblem revision and compact setup (October 20)

The new owner-supplied simplified cyan keys/crossed-swords reference was edited
with built-in ImageGen (transparent background mode) into
`emblem-transparent-v2.png`. Original approved artwork remains untouched.
Header and favicon derivatives preserve transparent pixels; Apple touch icon
and social card retain their intentional navy backgrounds.

Generation prompt: Create a polished high-resolution transparent PNG logo emblem
closely matching the supplied Piano Boss Battles reference. Keep upright cyan
piano keys, two simple crossed cyan-white swords with points upward, and a thin
softly rounded cyan square border. Clean simplified beveled luminous cyan design,
restrained edge glow, clear small favicon silhouette. Center with small even
margins. Remove the navy background completely, including empty gaps; no opaque
badge backing, text, extra objects, smoke, or large flames. Readable at 40px and 32px.

Desktop setup and preview use viewport-responsive sizing at widths >=1100px and
heights >=768px. Music lists and long queues scroll internally; smaller screens
retain page scrolling. Battle Audio is an expandable control, and existing
history controls remain available. Active Theatre and OBS layouts are unchanged.

Revision checks: 28 browser tests, 3 branding tests, TypeScript, changed-file ESLint, and preview production build passed. Desktop screenshots inspected at 1366x768, 1440x900, and 1920x1080; narrow layout retains scrolling. No real-account or physical MIDI retesting was needed for this presentation-only revision.
