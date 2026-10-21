import type {Plugin} from 'vite';

// Preview cards must fetch their image from the deployed preview. Page identity
// always stays at the canonical production URL; never infer it from Host headers.
export function brandingMetadata():Plugin{
 const origin=new URL(process.env.PUBLIC_ASSET_ORIGIN??'https://www.pianobossbattles.com');
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('PUBLIC_ASSET_ORIGIN must be a public HTTPS origin.');
 return {name:'branding-metadata',transformIndexHtml:html=>html.replaceAll('__PUBLIC_ASSET_ORIGIN__',origin.origin)};
}
