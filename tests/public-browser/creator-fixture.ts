import { type Page } from "@playwright/test";
import { defaultGameSettings } from "../../hosted/game-core";

import {readFileSync} from 'node:fs';
import {catalog as authoredCatalog} from '../../public-app/server-catalog';
export const catalog=authoredCatalog.filter(e=>e.collection!=='repertoire-archived').map(e=>e.notationUrl?{...e,notationXml:readFileSync('hosted/public'+e.notationUrl,'utf8'),notationUrl:undefined}:e);

const id="a0000000-0000-4000-8000-000000000001";
export const user={id,email:"browser-test@example.test",email_confirmed_at:new Date().toISOString(),aud:"authenticated",role:"authenticated",user_metadata:{name:"Test Pianist"},app_metadata:{provider:"email",providers:["email"]},created_at:new Date().toISOString()};
const token=[{alg:"HS256",typ:"JWT"},{sub:id,exp:Math.floor(Date.now()/1000)+3600,role:"authenticated"}].map(x=>Buffer.from(JSON.stringify(x)).toString("base64url")).join(".")+".fixture";
const session={access_token:token,refresh_token:"fixture-only",expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:"bearer",user};
export async function fixture(page:Page,signedIn=false,midiSupported=true,admin=false) {
  // Explicit UI fixtures only. Real SQL/RLS and reward behavior have separate tests.
  await page.route("https://huxmltjtovpxxxupuxdg.supabase.co/auth/v1/**",async route=>{
    const url=route.request().url();
    await route.fulfill({json:url.includes("/user")?user:url.includes("/signup")?{user,session:null}:url.includes("/token")?session:{}});
  });
  await page.route("**/api/auth/session",r=>r.fulfill({json:{signedIn:true}}));
  await page.route('**/api/music**',r=>{
    if(r.request().url().includes('/authorize'))return r.fulfill({json:{authorized:true}});
    const etag='"fixture-catalog-'+admin+'"';
    if(r.request().headers()['if-none-match']===etag)return r.fulfill({status:304,headers:{etag}});
    return r.fulfill({headers:{etag},json:{admin,pieces:catalog.map(e=>({...Object.fromEntries(Object.entries(e).filter(([key])=>!["right","left","polyphony","notationXml","notationUrl","sourceUrl"].includes(key))),right:[],left:[],detailsRequired:true,available:true}))}});
  });
  let settings=structuredClone(defaultGameSettings);
  let snapshot: unknown=null;
  settings.bossBattle.enabled=true;
  const player=()=>({userId:id,xp:0,curveVersion:2,settings,best:0,sessionBest:0,exerciseBest:0,unlocks:[],celebrations:[]});
  await page.route(/\/api\/(platform|creator\/game)$/,async route=>{
    const c=route.request().postDataJSON();
    if(c.action==="practiceExercise")return route.fulfill({json:catalog.find(x=>x.number===c.exerciseNumber)});
    if(c.action==="battleStoryRecords"||c.action==="battleStorySave")return route.fulfill({json:[]});
    if(c.action==="sightAttempt")return route.fulfill({json:{id:"fixture-attempt",exerciseNumber:c.exerciseNumber,hand:c.hand,accuracy:100,mistakes:0,createdAt:new Date().toISOString(),progress:{attempts:1,best:100}}});
    if(c.action==="gameSettings")settings=c.settings;
    await route.fulfill({json:player()});
  });
  await page.route("**/api/profile",r=>r.fulfill({json:{actor:user,history:[],attempts:[],victories:{count:0}}}));
  await page.route("**/api/obs**",r=>{
    if(r.request().url().includes("rtc=1"))return r.fulfill({json:{active:false,offers:[]}});
    if(r.request().method()==="POST"){snapshot=r.request().postDataJSON().snapshot;return r.fulfill({json:{accepted:true}});}
    return r.fulfill({json:{snapshot,gamePlayer:player(),updatedAt:Date.now(),attempts:0,best:null}});
  });
  await page.route("**/api/shorts**",r=>r.fulfill({json:[]}));
  await page.addInitScript(({session,signedIn,midiSupported})=>{
    if(signedIn)localStorage.setItem("sb-huxmltjtovpxxxupuxdg-auth-token",JSON.stringify(session));
    const input={id:"test-midi",name:"Test piano",state:"connected",connection:"open",onmidimessage:null as null|((e:{data:Uint8Array;timeStamp:number})=>void),open:async()=>{},close:async()=>{}};
    const probe=window as unknown as {midiRequests:number};probe.midiRequests=0;
    Object.defineProperty(navigator,"requestMIDIAccess",{value:!midiSupported?undefined:async()=>{probe.midiRequests++;return {inputs:new Map([["test-midi",input]]),onstatechange:null};}});
    (window as unknown as {playNotes:(p:number[])=>void}).playNotes=(pitches:number[])=>{for(const pitch of pitches)input.onmidimessage?.({data:new Uint8Array([144,pitch,90]),timeStamp:performance.now()});};
  },{session,signedIn,midiSupported});
  return {player,snapshot:()=>snapshot};
}
