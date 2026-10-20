import {build as viteBuild} from 'vite';
import {build} from 'esbuild';
import {cp} from 'node:fs/promises';
await viteBuild({configFile:'public-app/vite.config.ts'});
await cp('src/app/icon.svg','dist/client/icon.svg');
await build({entryPoints:['public-app/server.ts'],outfile:'dist/server/public.mjs',bundle:true,platform:'node',format:'esm',packages:'external',target:'node22'});
