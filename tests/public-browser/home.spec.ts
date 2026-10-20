import { test, expect, type Page } from "@playwright/test";
import { defaultGameSettings } from "../../hosted/game-core";
import {readFileSync} from 'node:fs';
import {catalog as authoredCatalog} from '../../public-app/server-catalog';
const catalog=authoredCatalog.filter(e=>e.collection!=='repertoire-archived').map(e=>e.notationUrl?{...e,notationXml:readFileSync('hosted/public'+e.notationUrl,'utf8'),notationUrl:undefined}:e);
import { noteGroups } from "../../hosted/sight-library";
const id="a0000000-0000-4000-8000-000000000001";
const user={id,email:"browser-test@example.test",email_confirmed_at:new Date().toISOString(),aud:"authenticated",role:"authenticated",user_metadata:{name:"Test Pianist"},app_metadata:{provider:"email",providers:["email"]},created_at:new Date().toISOString()};
const token=[{alg:"HS256",typ:"JWT"},{sub:id,exp:Math.floor(Date.now()/1000)+3600,role:"authenticated"}].map(x=>Buffer.from(JSON.stringify(x)).toString("base64url")).join(".")+".fixture";
const session={access_token:token,refresh_token:"fixture-only",expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:"bearer",user};
async function fixture(page:Page,signedIn=false,midiSupported=true) {
  // Explicit UI fixtures only. Real SQL/RLS and reward behavior have separate tests.
  await page.route("https://huxmltjtovpxxxupuxdg.supabase.co/auth/v1/**",async route=>{
    const url=route.request().url();
    await route.fulfill({json:url.includes("/user")?user:url.includes("/signup")?{user,session:null}:url.includes("/token")?session:{}});
  });
  await page.route("**/api/auth/session",r=>r.fulfill({json:{signedIn:true}}));
  await page.route('**/api/music**',r=>r.fulfill({json:r.request().url().includes('/authorize')?{authorized:true}:{admin:false,pieces:catalog.map(e=>({...e,available:true}))}}));
  let settings=structuredClone(defaultGameSettings);
  let snapshot: unknown=null;
  settings.bossBattle.enabled=true;
  const player=()=>({userId:id,xp:0,curveVersion:2,settings,best:0,sessionBest:0,exerciseBest:0,unlocks:[],celebrations:[]});
  await page.route("**/api/platform",async route=>{
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
}

test('music administrator toggles parent and piece publication and previews hidden music',async({page})=>{
 await fixture(page,true);
 const pieces=catalog.filter(e=>e.collection==='schmitt-op16').map(e=>({number:e.number,title:e.title,collection:e.collection,published:true}));
 let published=true;
 await page.route('**/api/admin/music',async r=>{
  if(r.request().method()==='POST'){const x=r.request().postDataJSON();if(x.kind==='collection')published=x.published;else pieces.find(e=>e.number===x.id)!.published=x.published;}
  return r.fulfill({json:{collections:[{id:'schmitt-op16',name:'Schmitt Op. 16',published,total:pieces.length,available:published?pieces.filter(e=>e.published).length:0}],pieces:pieces.map(e=>({...e,available:published&&e.published,collectionPublished:published}))}});
 });
 await page.goto('/admin/music');
 await expect(page.getByRole('heading',{name:'Music Library Manager'})).toBeVisible();
 await page.getByLabel('Search pieces').fill('Exercise 7');
 const piece=page.getByRole('button',{name:'Publish Schmitt Op. 16 · Exercise 7',exact:true});
 await piece.click();await expect(piece).toHaveAttribute('aria-pressed','false');
 const collection=page.getByRole('button',{name:'Publish Schmitt Op. 16 collection',exact:true});
 await collection.click();await expect(collection).toHaveAttribute('aria-pressed','false');
 await expect(page.getByText('0 available / 213 pieces')).toBeVisible();
 await collection.click();await expect(piece).toHaveAttribute('aria-pressed','false');
 await page.getByLabel('Availability').selectOption('unavailable');
 await expect(page.locator('.admin-pieces li')).toHaveCount(1);
 await page.screenshot({path:'test-results/music-admin-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'test-results/music-admin-mobile.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('link',{name:'Test piece'}).click();
 await expect(page.locator('.battle-queue')).toContainText('Schmitt Op. 16 · Exercise 7');
});

test('ordinary player cannot manage music and keeps unavailable saved queue entries',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await fixture(page,true);
 await page.route('**/api/admin/music',r=>r.fulfill({status:403,json:{error:'Administrator access required.'}}));
 await page.route('**/api/music**',r=>r.fulfill({json:r.request().url().includes('/authorize')?{authorized:false}:{admin:false,pieces:catalog.map(e=>e.number===2001?{number:2001,title:e.title,collection:e.collection,right:[],left:[],available:false}:{...e,available:true})}}));
 await page.addInitScript(id=>localStorage.setItem(`pbb:setup:v2:${id}`,JSON.stringify({hand:'both',entries:[{number:2001,loops:5},{number:2002,loops:2}]})),id);
 await page.goto('/admin/music');await expect(page.getByRole('alert')).toHaveText('Administrator access required.');
 await expect(page.locator('.admin-music-columns')).toHaveCount(0);
 await page.getByRole('link',{name:'Back to your battle setup'}).click();
 await expect(page.locator('.battle-queue li')).toHaveCount(2);
 await expect(page.locator('.battle-queue li').first()).toContainText('Unavailable');
 await expect(page.getByRole('spinbutton',{name:'Loops'}).first()).toHaveValue('5');
 await expect(page.getByRole('button',{name:'Add Schmitt Op. 16 · Exercise 1 to queue',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Connect MIDI Piano'}).click();
 await page.getByRole('button',{name:/Continue to Battle Preview/}).click();
 await expect(page.getByRole('button',{name:'Start Battle',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Edit Setup',exact:true}).click();
 await page.screenshot({path:'test-results/music-unavailable-queue.png',fullPage:true});
 await page.getByRole('button',{name:'Remove item 1',exact:true}).click();
 await expect(page.locator('.battle-queue li')).toHaveCount(1);
 await page.getByRole('button',{name:/Continue to Battle Preview/}).click();
 await expect(page.getByRole('button',{name:'Start Battle',exact:true})).toBeEnabled();
 expect(errors).toEqual([]);
});

test('a piece hidden after rendering is rejected at start without beginning MIDI evaluation',async({page})=>{
 await fixture(page,true);await page.goto('/');
 await page.getByRole('button',{name:'Connect MIDI Piano'}).click();
 await page.getByRole('button',{name:/Continue to Battle Preview/}).click();
 await page.route('**/api/music/authorize',r=>r.fulfill({status:403,json:{error:'A piece in your queue is unavailable. Refresh the library or remove it before starting.'}}));
 await page.getByRole('button',{name:'Start Battle',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('unavailable');
 await expect(page.locator('.in-theatre')).toHaveCount(0);
});

test('republishing restores a saved unavailable piece without losing its loops',async({page})=>{
 await fixture(page,true);let available=false;
 await page.route('**/api/music**',r=>r.fulfill({json:r.request().url().includes('/authorize')?{authorized:true}:{admin:false,pieces:catalog.map(e=>e.number===2001&&!available?{number:2001,title:e.title,collection:e.collection,right:[],left:[],available:false}:{...e,available:true})}}));
 await page.addInitScript(id=>localStorage.setItem(`pbb:setup:v2:${id}`,JSON.stringify({hand:'both',entries:[{number:2001,loops:5}]})),id);
 await page.goto('/');await expect(page.locator('.battle-queue')).toContainText('Unavailable');
 await page.getByRole('button',{name:'Connect MIDI Piano'}).click();
 available=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.locator('.battle-queue')).not.toContainText('Unavailable');
 await expect(page.getByRole('spinbutton',{name:'Loops'})).toHaveValue('5');
 await page.getByRole('button',{name:/Continue to Battle Preview/}).click();
 await expect(page.locator('.sight-score svg').first()).toBeVisible();
 await page.getByRole('button',{name:'Start Battle',exact:true}).click();
 await expect(page.locator('.in-theatre')).toBeVisible();
 await page.waitForTimeout(3500);
 const before=Number(await page.locator('[data-authoritative-boss-hp]').getAttribute('data-authoritative-boss-hp'));
 await page.evaluate(p=>(window as unknown as {playNotes:(p:number[])=>void}).playNotes(p),noteGroups(catalog.find(e=>e.number===2001)!,'both')[0].pitches);
 await expect.poll(async()=>Number(await page.locator('[data-authoritative-boss-hp]').getAttribute('data-authoritative-boss-hp'))).toBe(before-2);
});
test("public logged-out page, registration, login and password reset use Supabase",async({page})=>{
  await fixture(page);
  await page.goto("/");
  await expect(page.getByRole("heading",{name:/Turn every note/})).toBeVisible();
  await page.screenshot({path:"test-results/public-home-desktop.png",fullPage:true});
  await page.getByRole("button",{name:"Create account",exact:true}).click();
  await page.getByLabel("Player name").fill("New Pianist");await page.getByLabel("Email",{exact:true}).fill("new@example.test");await page.getByLabel("Password",{exact:true}).fill("Long-Test-Password-123");
  const signup=page.waitForRequest(r=>r.url().includes("/signup"));
  await page.getByRole("button",{name:"Create account",exact:true}).click();
  expect((await signup).postDataJSON().data.name).toBe("New Pianist");
  await expect(page.getByRole("status").filter({hasText:"verify your account"})).toBeVisible();
  await page.screenshot({path:"test-results/public-registration.png",fullPage:true});
  await page.getByRole("button",{name:"Log in",exact:true}).click();
  await page.getByRole("button",{name:"Forgot password?"}).click();
  const recovery=page.waitForRequest(r=>r.url().includes("/recover"));
  await page.getByLabel("Email",{exact:true}).fill("new@example.test");await page.getByRole("button",{name:"Send reset link"}).click();
  expect((await recovery).postDataJSON().email).toBe("new@example.test");
  await expect(page.getByText(/If this address has an account/)).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:"test-results/public-home-mobile.png",fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole("button",{name:"Log in",exact:true}).click();
  await page.getByLabel("Email",{exact:true}).fill("browser-test@example.test");
  await page.getByLabel("Password",{exact:true}).fill("Long-Test-Password-123");
  await page.getByRole("button",{name:"Log in",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Build your battle."})).toBeVisible();
  await page.getByRole("button",{name:/Continue to Battle Preview/}).click();
  await page.locator(".sight-score svg").first().waitFor();
  await page.locator(".sight-score").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000); // Capture the loaded notation and sprite art, not loading placeholders.
  await page.locator(".player-header").scrollIntoViewIfNeeded();
  await page.screenshot({path:"test-results/public-player-mobile.png",fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole("button",{name:"Log out",exact:true}).click();
  await expect(page.getByRole("heading",{name:/Welcome back/})).toBeVisible();
});
test("queue, MIDI gate, Theatre, immediate note scoring, continuous loops, pause and persistent score",async({page})=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await fixture(page,true);await page.goto("/");
  await expect(page.getByRole("heading",{name:"Build your battle."})).toBeVisible();
  await page.getByRole("button",{name:/Continue to Battle Preview/}).click();
  await expect(page.getByRole("button",{name:"Start Battle",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Connect MIDI Piano"}).click();
  await expect(page.getByRole("button",{name:"Start Battle",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"Edit Setup",exact:true}).click();
  await page.getByRole("button",{name:/Grinwick Fast claws/}).click();
  await page.getByLabel("Search pieces").fill("Schmitt Op. 16 · Exercise 2");
  await page.getByRole("button",{name:"Add Schmitt Op. 16 · Exercise 2 to queue",exact:true}).click();
  await page.getByRole("spinbutton",{name:"Loops"}).first().fill("2");
  await expect(page.locator(".queue-heading")).toContainText("3 performances");
  await page.getByRole("button",{name:"Move item 2 up"}).click();
  await expect(page.locator(".battle-queue li").first()).toContainText("Exercise 2");
  await page.getByRole("button",{name:"Move item 1 down"}).click();
  await page.screenshot({path:"test-results/public-player-queue.png",fullPage:true});
  await page.getByRole("button",{name:/Continue to Battle Preview/}).click();
  await page.locator(".sight-score svg").first().waitFor();
  await page.locator(".sight-score").evaluate(el=>(el as HTMLElement).dataset.mountCheck="same");
  await page.getByRole("button",{name:"Start Battle",exact:true}).click();
  await expect(page.locator(".in-theatre")).toBeVisible();
  await expect(page.getByRole("button",{name:"Pause",exact:true})).toBeVisible();
  await page.waitForTimeout(3500);
  const before=await page.locator('[data-authoritative-boss-hp]').getAttribute('data-authoritative-boss-hp');
  const exercise=catalog.find(x=>x.number===2001)!;
  const pitches=noteGroups(exercise,"both").flatMap(g=>g.pitches);
  await page.evaluate(p=>(window as unknown as {playNotes:(p:number[])=>void}).playNotes(p),pitches.slice(0,2));
  await expect.poll(async()=>Number(await page.locator('[data-authoritative-boss-hp]').getAttribute('data-authoritative-boss-hp'))).toBe(Number(before)-2);
  const attempt=await page.locator("[data-battle-attempt]").getAttribute("data-battle-attempt");
  await page.evaluate(p=>(window as unknown as {playNotes:(p:number[])=>void}).playNotes(p),[...pitches.slice(2,-2),pitches[0]]);
  await expect(page.locator(".theatre-heading")).toContainText("Loop 2/2");
  await expect(page.locator("[data-battle-attempt]")).toHaveAttribute("data-battle-attempt",attempt!);
  await expect.poll(async()=>Number(await page.locator('[data-authoritative-boss-hp]').getAttribute('data-authoritative-boss-hp'))).toBe(Number(before)-(pitches.length-2)-1);
  await page.waitForTimeout(800); // Let the score crossfade and fitted layout settle before visual capture.
  const bounds=await page.locator('.sight-score').evaluate(el=>({area:el.getBoundingClientRect().toJSON(),systems:[...el.querySelectorAll('.system')].map(x=>x.getBoundingClientRect().toJSON())}));
  for(const ink of bounds.systems){
    expect(ink.top).toBeGreaterThanOrEqual(bounds.area.top+15);
    expect(ink.bottom).toBeLessThanOrEqual(bounds.area.bottom-15);
    expect(ink.width).toBeGreaterThan(bounds.area.width*.5);
  }
  await page.screenshot({path:"test-results/public-theatre.png",fullPage:true});
  await page.getByRole("button",{name:"Pause",exact:true}).click();
  const pausedHP=await page.locator('[data-authoritative-boss-hp]').getAttribute('data-authoritative-boss-hp');
  await page.evaluate(()=>(window as unknown as {playNotes:(p:number[])=>void}).playNotes([50]));
  expect(await page.locator('[data-authoritative-boss-hp]').getAttribute('data-authoritative-boss-hp')).toBe(pausedHP);
  await page.getByRole("button",{name:"Resume",exact:true}).click();
  const nextNotes=noteGroups(catalog.find(e=>e.number===2002)!,"both").flatMap(g=>g.pitches);
  await page.evaluate(p=>(window as unknown as {playNotes:(p:number[])=>void}).playNotes(p),[...pitches.slice(1),nextNotes[0]]);
  await expect(page.locator(".theatre-heading h2")).toHaveText("Schmitt Op. 16 · Exercise 2");
  await expect(page.locator("[data-battle-attempt]")).toHaveAttribute("data-battle-attempt",attempt!);
  await expect.poll(async()=>Number(await page.locator('[data-authoritative-boss-hp]').getAttribute('data-authoritative-boss-hp'))).toBe(Number(before)-(pitches.length-2)-pitches.length-1);
  await page.getByRole("button",{name:"Return to preview"}).click();
  await expect(page.locator(".sight-score")).toHaveAttribute("data-mount-check","same");
  await expect(page.getByRole("button",{name:"Edit Setup",exact:true})).toBeDisabled();
  await expect(page.locator(".setup-columns")).toBeHidden();
  await page.getByRole("button",{name:"End Battle",exact:true}).click();
  expect(errors).toEqual([]);
  await page.waitForTimeout(600);
  for(const [path,width,height] of [["recording",1920,750],["shorts",1080,1920]] as const){
    await page.setViewportSize({width,height});await page.goto(`/obs/${path}`);
    await expect(page.getByRole("complementary",{name:"Boss battle"})).toBeVisible();
    await page.locator(".sight-score svg").first().waitFor();
    await page.waitForTimeout(800);
    await page.screenshot({path:`test-results/public-obs-${path}.png`});
    expect(await page.evaluate(()=>(window as unknown as {midiRequests:number}).midiRequests)).toBe(0);
  }
});
test("Victory holds over the mounted score and a deliberate new attempt dismisses it",async({page})=>{
  await fixture(page,true);await page.goto("/");
  await page.getByRole("button",{name:"Connect MIDI Piano"}).click();
  await page.getByRole("button",{name:"Remove item 1"}).click();
  const exercise=catalog.find(e=>e.number===4001)!;
  await page.getByLabel("Search pieces").fill(exercise.title!);
  await page.getByRole("button",{name:`Add ${exercise.title} to queue`,exact:true}).click();
  await page.getByRole("button",{name:/Continue to Battle Preview/}).click();
  await page.getByRole("button",{name:"Start Battle",exact:true}).click();
  await page.waitForTimeout(3500);
  await page.evaluate(p=>(window as unknown as {playNotes:(p:number[])=>void}).playNotes(p),noteGroups(exercise,"both").flatMap(g=>g.pitches));
  await expect(page.locator(".battle-cinematic")).toHaveAttribute("data-result","victory");
  await expect(page.locator(".battle-cinematic")).toHaveAttribute("data-phase","holding",{timeout:15000});
  await page.waitForTimeout(1000);
  await expect(page.locator(".sight-score svg").first()).toBeAttached();
  await page.screenshot({path:"test-results/public-victory.png",fullPage:true});
  await page.getByRole("button",{name:"Start Battle",exact:true}).click();
  await expect(page.locator(".battle-cinematic")).toHaveCount(0);
  await expect(page.getByRole("status",{name:"Battle start countdown"})).toBeVisible();
});
test("real API rejects unsigned requests and cross-origin session writes",async({request,baseURL})=>{
  expect((await request.post("/api/platform",{data:{action:"gameState"},headers:{Origin:new URL(baseURL!).origin}})).status()).toBe(401);
  expect((await request.post("/api/auth/session",{data:{},headers:{Origin:"https://untrusted.example"}})).status()).toBe(403);
});

for (const signedIn of [false, true]) {
  test(`reset link without the originating PKCE verifier explains the failure (existing session: ${signedIn})`,async({page})=>{
    await fixture(page,signedIn);
    let exchanges=0;
    page.on("request",r=>{if(r.url().includes("grant_type=pkce"))exchanges++;});
    await page.goto("/?recovery=1&code=fixture-unexchanged-code");
    await expect(page.getByRole("alert")).toContainText("different browser");
    await expect(page.getByRole("alert")).toContainText("same browser");
    await expect(page.getByRole("heading",{name:"Choose a new password"})).toHaveCount(0);
    await expect(page.getByRole("heading",{name:"Build your battle."})).toHaveCount(0);
    expect(exchanges).toBe(0);
    await page.getByRole("link",{name:"Return to sign in",exact:true}).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
}

test("verified PKCE recovery shows the password form, survives reload and clears after update",async({page})=>{
  await fixture(page);
  await page.addInitScript(()=>{
    if(location.search.includes("code="))localStorage.setItem("sb-huxmltjtovpxxxupuxdg-auth-token-code-verifier",JSON.stringify("fixture-verifier/recovery"));
  });
  const exchange=page.waitForRequest(r=>r.url().includes("grant_type=pkce"));
  await page.goto("/?recovery=1&code=fixture-recovery-code");
  expect((await exchange).postDataJSON()).toMatchObject({auth_code:"fixture-recovery-code",code_verifier:"fixture-verifier"});
  await expect(page.getByRole("heading",{name:"Choose a new password"})).toBeVisible();
  expect(new URL(page.url()).searchParams.has("code")).toBe(false);
  await page.reload();
  await expect(page.getByRole("heading",{name:"Choose a new password"})).toBeVisible();
  await page.screenshot({path:"test-results/public-password-recovery.png"});
  await page.getByLabel("Password",{exact:true}).fill("Fixture-New-Password-123");
  const update=page.waitForRequest(r=>r.url().includes("/auth/v1/user")&&r.method()==="PUT");
  await page.getByRole("button",{name:"Update password",exact:true}).click();
  expect((await update).postDataJSON().password).toBe("Fixture-New-Password-123");
  await expect(page.getByRole("heading",{name:"Build your battle."})).toBeVisible();
  expect(new URL(page.url()).searchParams.has("recovery")).toBe(false);
  await page.reload();
  await expect(page.getByRole("heading",{name:"Build your battle."})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Choose a new password"})).toHaveCount(0);
});

test("expired recovery links show a useful error without exposing a password form",async({page})=>{
  await fixture(page,true);
  await page.goto("/?recovery=1#error=access_denied&error_code=otp_expired&error_description=fixture");
  await expect(page.getByRole("alert")).toContainText("expired or already been used");
  await expect(page.getByRole("heading",{name:"Choose a new password"})).toHaveCount(0);
});

test("V2 setup, preview, history navigation and reload preserve shared selections",async({page})=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await fixture(page,true);await page.setViewportSize({width:1672,height:1000});await page.goto("/");
  await expect(page.getByRole("heading",{name:"Build your battle."})).toBeVisible();
  await expect(page.getByRole("region",{name:"Player profile"})).toContainText("Test Pianist");
  await expect(page.locator(".music-list>div")).toHaveCount(403); // Existing catalog, excluding the deliberately archived piece.
  for(const name of ["Practice","Survival","Ultimate Boss","Time Attack"]){
    await page.getByRole("button",{name:new RegExp(`^${name} `)}).click();
    await expect(page.getByRole("button",{name:new RegExp(`^${name} `)})).toHaveAttribute("aria-pressed","true");
  }
  await page.getByRole("combobox",{name:"Time Pressure",exact:true}).selectOption("1.15");
  await page.getByRole("combobox",{name:"Hands",exact:true}).selectOption("left");
  await page.getByLabel("Target BPM",{exact:true}).fill("80");
  await page.getByLabel("Easy → Normal → Hard → Expert across loops").check();
  await page.getByRole("button",{name:/Grinwick Fast claws/}).click();
  await page.getByLabel("Search pieces").fill("Schmitt Op. 16 · Exercise 2");
  await page.getByRole("button",{name:"Add Schmitt Op. 16 · Exercise 2 to queue",exact:true}).click();
  await page.getByRole("spinbutton",{name:"Loops"}).first().fill("3");
  await page.getByRole("button",{name:"Move item 2 up"}).click();
  await page.getByRole("button",{name:"Connect MIDI Piano"}).click();
  await expect(page.getByText("Your piano is connected",{exact:true})).toBeVisible();
  await page.getByRole("heading",{name:"Build your battle."}).click();
  await page.screenshot({path:"test-results/v2-setup.png",fullPage:true});
  await page.getByRole("button",{name:/Continue to Battle Preview/}).click();
  await expect(page).toHaveURL(/view=preview/);
  for(const text of ["60 → 80 → 110 → 140 BPM","Tight","Left hand","4 total performances"])await expect(page.locator(".battle-summary")).toContainText(text);
  await page.getByText("Review full sequence",{exact:true}).click();
  await expect(page.locator(".sequence-review li").first()).toContainText("Exercise 2");
  await page.locator(".sight-score svg").first().waitFor();
  await page.locator(".sight-score").evaluate(el=>(el as HTMLElement).dataset.navigationCheck="mounted");
  await expect(page.locator(".history[open]")).toHaveCount(0);
  await page.getByRole("button",{name:"Edit Setup",exact:true}).click();
  await expect(page.getByLabel("Target BPM",{exact:true})).toBeDisabled();
  await page.getByLabel("Easy → Normal → Hard → Expert across loops").uncheck();
  await expect(page.getByLabel("Target BPM",{exact:true})).toHaveValue("80");
  await page.getByLabel("Easy → Normal → Hard → Expert across loops").check();
  await expect(page.getByRole("combobox",{name:"Hands",exact:true})).toHaveValue("left");
  await expect(page.locator(".battle-queue li").first()).toContainText("Exercise 2");
  await expect(page.getByRole("spinbutton",{name:"Loops"}).nth(1)).toHaveValue("3");
  await page.goBack();
  await expect(page.locator(".battle-summary")).toBeVisible();
  await expect(page.locator(".sight-score")).toHaveAttribute("data-navigation-check","mounted");
  expect(await page.evaluate(()=>(window as unknown as {midiRequests:number}).midiRequests)).toBe(1);
  await expect(page.locator("[data-battle-status]")).not.toHaveAttribute("data-battle-status","active");
  await page.reload();
  for(const text of ["60 → 80 → 110 → 140 BPM","Tight","Left hand","4 total performances"])await expect(page.locator(".battle-summary")).toContainText(text);
  await expect(page.getByRole("button",{name:"Start Battle",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Connect MIDI Piano"}).click();
  await expect(page.getByRole("button",{name:"Start Battle",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"Edit Setup",exact:true}).click();
  await page.getByRole("combobox",{name:"Hands",exact:true}).selectOption("both");
  await page.getByRole("button",{name:/Crimson Colossus Brutal/}).click();
  await page.getByRole("button",{name:/Continue to Battle Preview/}).click();
  await page.locator(".sight-score svg").first().waitFor();
  await page.waitForTimeout(1000);
  await page.locator(".summary-heading .eyebrow").click();
  await page.screenshot({path:"test-results/v2-preview.png",fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:"test-results/v2-preview-narrow.png",fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole("button",{name:"Edit Setup",exact:true}).click();
  await page.screenshot({path:"test-results/v2-setup-narrow.png",fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("V2 explains unsupported Web MIDI without a broken connect control",async({page})=>{
  await fixture(page,true,false);
  await page.goto("/");
  await expect(page.getByText("Web MIDI is unavailable in this browser. Use desktop Chrome or Edge.")).toBeVisible();
  await expect(page.getByRole("button",{name:"Connect MIDI Piano"})).toHaveCount(0);
  await page.getByRole("button",{name:/Continue to Battle Preview/}).click();
  await expect(page.getByRole("button",{name:"Start Battle",exact:true})).toBeDisabled();
});

test("mode settings switch immediately, retain preferences, and summarize only applicable rules",async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await fixture(page,true);await page.setViewportSize({width:1672,height:1000});await page.goto('/');
  const mode=(name:string)=>page.getByRole('button',{name:new RegExp(`^${name} `)});
  const controls=page.getByRole('group',{name:'Battle settings',exact:true});
  const summary=page.locator('.battle-summary');
  await mode('Survival').click();
  await expect(controls.getByRole('combobox',{name:'Combat Difficulty',exact:true})).toBeVisible();
  await expect(controls.getByLabel('Target BPM',{exact:true})).toHaveCount(0);
  await expect(controls.getByRole('combobox',{name:'Combat Difficulty',exact:true}).locator('option')).toHaveText(['Easy','Normal','Hard','Expert']);
  await controls.getByRole('combobox',{name:'Combat Difficulty',exact:true}).selectOption('6');
  await mode('Time Attack').click();
  await expect(controls.getByRole('combobox',{name:'Combat Difficulty',exact:true})).toHaveCount(0);
  await controls.getByLabel('Target BPM',{exact:true}).fill('80');
  await controls.getByRole('combobox',{name:'Time Pressure',exact:true}).selectOption('1.3');
  await page.getByLabel('Easy → Normal → Hard → Expert across loops').check();
  await mode('Ultimate Boss').click();
  await expect(controls.getByRole('combobox',{name:'Combat Difficulty',exact:true})).toHaveValue('6');
  await expect(controls.getByLabel('Target BPM',{exact:true})).toBeEnabled();
  await expect(controls.getByLabel('Target BPM',{exact:true})).toHaveValue('80');
  await expect(controls.getByRole('combobox',{name:'Time Pressure',exact:true})).toHaveValue('1.3');
  await expect(page.getByLabel('Easy → Normal → Hard → Expert across loops')).toHaveCount(0);
  await page.getByLabel('Search pieces').fill('Schmitt Op. 16 · Exercise 2');
  await page.getByRole('button',{name:'Add Schmitt Op. 16 · Exercise 2 to queue',exact:true}).click();
  await page.getByRole('spinbutton',{name:'Loops'}).first().fill('2');
  for(const name of ['Ultimate Boss','Practice','Survival','Time Attack']){
    await mode(name).click();
    await page.getByRole('button',{name:/Continue to Battle Preview/}).click();
    await expect(summary.getByText('Both hands',{exact:true})).toBeVisible();
    await expect(summary.getByText('Combat Difficulty',{exact:true})).toHaveCount(name==='Survival'||name==='Ultimate Boss'?1:0);
    await expect(summary.getByText('Time Pressure',{exact:true})).toHaveCount(name==='Time Attack'||name==='Ultimate Boss'?1:0);
    if(name==='Ultimate Boss'){
      await expect(summary).toContainText('80 BPM');await expect(summary).toContainText('Hard');await expect(summary).toContainText('Normal');
      const exercises=[2001,2002].map(n=>catalog.find(e=>e.number===n)!);
      const {battleMusicalBeats,countdownLabel}=await import('../../hosted/battle-modes');
      const seconds=Math.ceil((battleMusicalBeats(exercises[0],2)!+battleMusicalBeats(exercises[1])!)*60/80*1.3);
      await expect(summary).toContainText(countdownLabel(seconds*1000));
      await page.screenshot({path:'test-results/mode-ultimate-preview.png',fullPage:true});
    }
    if(name==='Practice')await expect(summary).toContainText('Self-Paced');
    if(name==='Time Attack')await expect(summary).toContainText('First-loop allowance');
    await page.getByRole('button',{name:'Edit Setup',exact:true}).click();
    if(name==='Practice'){
      await expect(controls.locator('select')).toHaveCount(1);
      await expect(controls.locator('input')).toHaveCount(0);
    }
  }
  await mode('Ultimate Boss').click();
  await expect(controls.getByRole('combobox',{name:'Combat Difficulty',exact:true})).toHaveValue('6');
  await page.screenshot({path:'test-results/mode-ultimate-setup.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/mode-ultimate-narrow.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.reload();
  await expect(controls.getByRole('combobox',{name:'Time Pressure',exact:true})).toHaveValue('1.3');
  await expect(controls.getByRole('combobox',{name:'Combat Difficulty',exact:true})).toHaveValue('6');
  expect(errors).toEqual([]);
});

for(const mode of ['Practice','Survival','Time Attack','Ultimate Boss'])test(`${mode} launches with its selected rules and keeps MIDI scoring immediate`,async({page})=>{
  await fixture(page,true);await page.goto('/');
  await page.getByRole('button',{name:new RegExp(`^${mode} `)}).click();
  if(mode==='Survival'||mode==='Ultimate Boss')await page.getByRole('combobox',{name:'Combat Difficulty',exact:true}).selectOption('10');
  if(mode==='Time Attack'||mode==='Ultimate Boss'){
    await page.getByLabel('Target BPM',{exact:true}).fill('80');
    await page.getByRole('combobox',{name:'Time Pressure',exact:true}).selectOption('1.3');
  }
  await page.getByRole('button',{name:'Connect MIDI Piano'}).click();
  await page.getByRole('button',{name:/Continue to Battle Preview/}).click();
  await page.getByRole('button',{name:'Start Battle',exact:true}).click();
  const intro=page.getByRole('status',{name:'Battle start countdown'}),panel=page.getByRole('complementary',{name:'Boss battle'});
  if(mode==='Practice'){
    await expect(intro).toHaveCount(0);await expect(panel).toHaveCount(0);
  }else{
    await expect(intro).toBeVisible();
    await page.evaluate(()=>(window as unknown as {playNotes:(p:number[])=>void}).playNotes([1]));
    await expect(panel).toHaveAttribute('data-authoritative-player-hp','30');
    await expect(intro).toHaveCount(0,{timeout:6000});
    await expect(panel).toHaveAttribute('data-game-mode',mode==='Survival'?'survival':mode==='Time Attack'?'timeAttack':'ultimateBoss');
  }
  const pitches=noteGroups(catalog.find(e=>e.number===2001)!,'both').flatMap(g=>g.pitches);
  const before=mode==='Practice'?0:Number(await panel.getAttribute('data-authoritative-boss-hp'));
  await page.evaluate(p=>(window as unknown as {playNotes:(p:number[])=>void}).playNotes(p),[1,...pitches.slice(0,2)]);
  await expect(page.locator('.theatre-heading')).toContainText('2 note combo');
  if(mode!=='Practice'){
    await expect(panel).toHaveAttribute('data-authoritative-boss-hp',String(before-2));
    await expect(panel).toHaveAttribute('data-authoritative-player-hp',mode==='Time Attack'?'30':'20');
    await expect(panel.locator('.battle-clock-shields')).toHaveCount(mode==='Survival'?0:1);
  }
  await page.getByRole('button',{name:'End Battle',exact:true}).click();
  await expect(page.locator('.player-xp [role="status"]')).toHaveText('All progress saved');
});
