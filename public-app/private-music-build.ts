import type {Plugin} from 'vite';
// The shared practice renderer has optional legacy course UIs. Public players
// receive definitions only from the authenticated catalog API, never JS assets.
const privateLibraries:Record<string,string[]>={
 'sight-data':['sightLibrary'], 'classical-library':['classicalLibrary','classicalStages'],
 'moonlight-library':['moonlightLibrary'], 'schmitt-library':['schmittLibrary'],
};
export function privateMusicBuild():Plugin{return {
 name:'private-music',enforce:'pre',
 load(id){const match=id.replaceAll('\\','/').match(/\/hosted\/([^/]+)\.ts$/);
  const exports=match&&privateLibraries[match[1]];
  if(exports)return exports.map(name=>`export const ${name}=[];`).join('\n');
 },
 generateBundle(_options,bundle){for(const output of Object.values(bundle))if(output.type==='chunk'){
  for(const moduleId of Object.keys(output.modules)){
   const path=moduleId.replaceAll('\\','/');
   if(path.includes('/hosted/data/')||path.endsWith('/catalog-seed.json')||/\/hosted\/(practice|scales)-library\.ts$/.test(path))this.error(`Private music data entered the browser bundle: ${path}`);
  }
 }},
 configureServer(server){server.middlewares.use((req,res,next)=>{
  if(decodeURIComponent((req.url??'').split('?')[0]).startsWith('/scores/')){res.statusCode=404;res.end();return;}next();
 });},
};}
