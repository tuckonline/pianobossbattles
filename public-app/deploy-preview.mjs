import { execFileSync } from 'node:child_process';
const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
if (branch !== 'feature/end-user-website-v1') throw new Error('Preview deployment is restricted to feature/end-user-website-v1.');
const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
if (dirty) throw new Error('Commit the verified changes before deploying the preview.');
execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'pages', 'deploy',
  'dist/client', '--project-name', 'pianobossbattles-preview', '--branch', branch,
  '--no-bundle', '--commit-dirty=false'], { stdio: 'inherit',
  env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: 'c5fd2cb61b7bd05dac120e8f23d303a6' } });
