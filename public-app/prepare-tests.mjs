import {build} from 'esbuild';
// Compatibility tests only. This worker has no deployment identity or bindings.
await build({entryPoints:['hosted/worker.ts'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022'});
