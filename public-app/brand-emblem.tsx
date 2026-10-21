/* eslint-disable @next/next/no-img-element -- Static asset in the independent Vite application. */
export function BrandEmblem({className}:{className:string}){
 return <img className={className} src="/branding/emblem-128.png" srcSet="/branding/emblem-128.png 1x, /branding/emblem-256.png 2x" width="46" height="46" alt="" aria-hidden="true"/>;
}
