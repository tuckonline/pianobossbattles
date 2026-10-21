# Approved Piano Boss Battles branding

`approved-emblem.png` is the owner's supplied original, copied without changes
from the October 20, 2026 attachment. SHA-256:
`fc60d89b14d1ec21d87171ae1ce424043dc0ba2039de97ccaebbd0f78e44b32f`.
The original is retained here as source material, not copied into the public build.

`node scripts/generate-branding.mjs` makes mechanical resized copies using Sharp
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
