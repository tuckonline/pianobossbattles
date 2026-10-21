import {afterEach,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {brandingMetadata} from '../public-app/branding-metadata';
afterEach(()=>vi.unstubAllEnvs());
it('keeps production page identity with publicly addressable preview images in initial HTML',()=>{
 const template=readFileSync('public-app/index.html','utf8');
 for(const origin of ['https://www.pianobossbattles.com','https://feature-end-user-website-v1.pianobossbattles-preview.pages.dev']){
  vi.stubEnv('PUBLIC_ASSET_ORIGIN',origin);
  const transform=brandingMetadata().transformIndexHtml as (html:string)=>string;
  const html=transform(template);
  expect(html).toContain('<title>Piano Boss Battles — Play Music. Defeat Bosses.</title>');
  expect(html).toContain('rel="canonical" href="https://www.pianobossbattles.com/"');
  expect(html).toContain('property="og:url" content="https://www.pianobossbattles.com/"');
  expect(html).toContain('name="twitter:card" content="summary_large_image"');
  for(const key of ['og:image','twitter:image'])expect(html).toContain(`${key}" content="${origin}/branding/social-preview.png"`);
  expect(html).not.toContain('__PUBLIC_ASSET_ORIGIN__');
 }
});
it('preserves the exact approved source and emits correctly sized icons and sharing art',async()=>{
 expect(createHash('sha256').update(readFileSync('design/branding/approved-emblem.png')).digest('hex')).toBe('fc60d89b14d1ec21d87171ae1ce424043dc0ba2039de97ccaebbd0f78e44b32f');
 for(const [name,width,height] of [['branding/favicon-32.png',32,32],['apple-touch-icon.png',180,180],['branding/social-preview.png',1200,630]] as const){
  const metadata=await sharp(`hosted/public/${name}`).metadata();
  expect(metadata).toMatchObject({format:'png',width,height});
 }
 const ico=readFileSync('hosted/public/favicon.ico');
 expect(ico.readUInt16LE(2)).toBe(1);expect(ico.readUInt16LE(4)).toBe(3);
 for(let i=0;i<3;i++){
  const entry=6+i*16,offset=ico.readUInt32LE(entry+12),length=ico.readUInt32LE(entry+8);
  expect(await sharp(ico.subarray(offset,offset+length)).metadata()).toMatchObject({format:'png',width:[16,32,48][i],height:[16,32,48][i]});
 }
});
