import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
if (!process.argv.includes('--confirm-production')) throw new Error('Production deployment requires --confirm-production and explicit owner approval.');
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
const branch = git(['branch', '--show-current']);
if (branch !== 'feature/end-user-website-v1') throw new Error('Deploy the reviewed release from feature/end-user-website-v1.');
if (git(['status', '--porcelain'])) throw new Error('Commit the verified release before deploying.');
if (git(['rev-parse', 'HEAD']) !== git(['rev-parse', 'origin/feature/end-user-website-v1'])) throw new Error('Push the reviewed release before deploying.');
execFileSync(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'), 'pages', 'deploy',
  resolve('dist/client'), '--cwd', resolve('public-app/production'), '--project-name', 'pianobossbattles', '--branch', 'production',
  '--commit-hash', git(['rev-parse', 'HEAD']), '--commit-dirty=false'], {
  stdio: 'inherit', env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: 'c5fd2cb61b7bd05dac120e8f23d303a6' },
});
