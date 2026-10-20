import {build as viteBuild} from 'vite';
import {build} from 'esbuild';
import {cp} from 'node:fs/promises';
await viteBuild({configFile:'public-app/vite.config.ts'});
// Notation is private API data; publish only non-music presentation assets.
for(const path of ['battle','audio','shorts-export.py'])await cp(`hosted/public/${path}`,`dist/client/${path}`,{recursive:true});
await cp('src/app/icon.svg','dist/client/icon.svg');
await build({entryPoints:['public-app/server.ts'],outfile:'dist/server/public.mjs',bundle:true,platform:'node',format:'esm',packages:'external',target:'node22'});
