import { execFileSync } from 'node:child_process';
import { copyFileSync, writeFileSync } from 'node:fs';
execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'deploy',
  '--config', 'wrangler.preview.jsonc', '--dry-run', '--outdir', 'dist/worker'], { stdio: 'inherit' });
copyFileSync('dist/worker/worker.js', 'dist/client/_worker.js');
copyFileSync('public-app/preview-headers.txt', 'dist/client/_headers');
// Static notation, sprites and the SPA bypass Functions. Only the API needs it.
writeFileSync('dist/client/_routes.json', JSON.stringify({ version: 1, include: ['/api/*'], exclude: [] }));
