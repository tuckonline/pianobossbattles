// Mechanical derivatives of the owner's approved artwork; no redrawing.
import sharp from 'sharp';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const source='design/branding/approved-emblem.png';
const output='hosted/public';
await mkdir(`${output}/branding`,{recursive:true});
for(const size of [128,256])await sharp(source).resize(size,size).png({compressionLevel:9,palette:true,colours:256,effort:10}).toFile(`${output}/branding/emblem-${size}.png`);
for(const size of [16,32,48])await sharp(source).resize(size,size).png({compressionLevel:9}).toFile(`${output}/branding/favicon-${size}.png`);
// ICO directory wrapping exact PNG derivatives, with multiple browser sizes.
const icons=await Promise.all([16,32,48].map(size=>readFile(`${output}/branding/favicon-${size}.png`)));
const directory=Buffer.alloc(6+16*icons.length);directory.writeUInt16LE(1,2);directory.writeUInt16LE(icons.length,4);
let offset=directory.length;
icons.forEach((png,index)=>{const p=6+16*index,size=[16,32,48][index];directory[p]=size;directory[p+1]=size;directory.writeUInt16LE(1,p+4);directory.writeUInt16LE(32,p+6);directory.writeUInt32LE(png.length,p+8);directory.writeUInt32LE(offset,p+12);offset+=png.length;});
await writeFile(`${output}/favicon.ico`,Buffer.concat([directory,...icons]));
const touch=await sharp(source).resize(168,168).toBuffer();
await sharp({create:{width:180,height:180,channels:4,background:'#091727'}}).composite([{input:touch,left:6,top:6}]).flatten({background:'#091727'}).png({compressionLevel:9}).toFile(`${output}/apple-touch-icon.png`);
const emblem=(await sharp(source).resize(470,470).png().toBuffer()).toString('base64');
const social=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
 <defs><radialGradient id="navy"><stop stop-color="#12344d"/><stop offset="1" stop-color="#06111f"/></radialGradient><linearGradient id="energy"><stop stop-color="#23d9ff" stop-opacity="0"/><stop offset=".5" stop-color="#23d9ff" stop-opacity=".35"/><stop offset="1" stop-color="#23d9ff" stop-opacity="0"/></linearGradient></defs>
 <rect width="1200" height="630" fill="#06111f"/><rect width="1200" height="630" fill="url(#navy)"/>
 <path d="M-50 590 560 -20M-60 610 570 -20M740 680 1240 180" stroke="url(#energy)" stroke-width="2" fill="none"/>
 <image href="data:image/png;base64,${emblem}" x="35" y="80" width="470" height="470"/>
 <g fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-weight="800"><text x="535" y="258" font-size="72" letter-spacing="-2">Piano Boss</text><text x="531" y="346" font-size="88" letter-spacing="-2">Battles</text></g>
 <path d="M538 385h92" stroke="#36dcf3" stroke-width="4"/>
 <text x="535" y="442" fill="#b9eaf4" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="500">Play Music. Defeat Bosses.</text>
 </svg>`);
await sharp(social).png({compressionLevel:9}).toFile(`${output}/branding/social-preview.png`);
console.log('Generated approved emblem derivatives, ICO, Apple touch icon and 1200x630 social preview.');
