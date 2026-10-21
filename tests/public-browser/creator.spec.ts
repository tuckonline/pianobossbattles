import {test,expect,type Page} from '@playwright/test';
import {fixture,catalog} from './creator-fixture';
import {defaultCreatorPreferences} from '../../public-app/creator-config';
import type {OverlayState,OverlaySnapshot} from '../../hosted/obs-state';
import {noteGroups,practicePass} from '../../hosted/sight-library';
async function creator(page:Page,admin=true){
 await fixture(page,true,true,admin);
 let preferences={...defaultCreatorPreferences},snapshot:OverlaySnapshot|null=null,sequence=0,sourceId='',revoked=false;
 await page.route('**/api/creator',async r=>{
  if(!admin)return r.fulfill({status:403,json:{error:'Creator access requires an administrator account.'}});
  if(r.request().method()==='POST'){const b=r.request().postDataJSON();if(b.action==='preferences')preferences=b.preferences;if(b.action==='revoke')revoked=true;if(b.action==='rotate')revoked=false;return r.fulfill({json:{token:b.action==='rotate'?'a'.repeat(43):null}});}
  return r.fulfill({json:{preferences}});
 });
 await page.route('**/api/creator/stream**',r=>{
  if(new URL(r.request().url()).searchParams.has('rtc'))return r.fulfill({json:{active:false,offers:[]}});
  if(r.request().method()==='POST'){const b=r.request().postDataJSON();snapshot=b.snapshot;sequence=b.sequence;sourceId=b.sourceId;}
  return r.fulfill({json:{accepted:true}});
 });
 return {get preferences(){return preferences;},get snapshot(){return snapshot;},set snapshot(s){snapshot=s;},get revoked(){return revoked;},state:():OverlayState=>({snapshot,sequence,sourceId,updatedAt:Date.now(),best:null,attempts:0,creator:preferences,viewerKey:'fixture-viewer'})};
}
async function viewer(page:Page,state:Awaited<ReturnType<typeof creator>>,vertical=false,audible=false){
 await fixture(page,false); // No viewer login or MIDI permission, fixture merely instruments requests.
 await page.route('**/api/creator/view**',r=>{
  if(state.revoked)return r.fulfill({status:401,json:{error:'Viewing link revoked'}});
  const u=new URL(r.request().url());
  if(u.pathname.endsWith('/score'))return r.fulfill({json:catalog.find(e=>e.number===Number(u.searchParams.get('number')))});
  if(u.searchParams.has('rtc'))return r.fulfill({json:{active:false,offers:[]}});
  return r.fulfill({json:state.state()});
 });
 await page.setViewportSize(vertical?{width:1080,height:1920}:{width:1920,height:750});
 await page.goto('/creator/obs/'+(vertical?'vertical':'horizontal')+(audible?'?battleAudio=1':'')+'#view='+'a'.repeat(43));
 await expect(page.locator('.creator-output')).toBeVisible();
}
test('creator control access is gated before MIDI or gameplay mounts',async({page})=>{
 await creator(page,false);await page.goto('/creator');await expect(page.getByRole('alert')).toContainText('administrator');
 await expect(page.getByRole('button',{name:'Start MIDI Practice'})).toHaveCount(0);
 expect(await page.evaluate(()=>(window as unknown as {midiRequests:number}).midiRequests)).toBe(0);
});
test('one studio drives both layouts, continuous loops, independent settings and reconnect',async({page,context})=>{
 test.setTimeout(90000);const state=await creator(page);await page.goto('/creator');
 await page.getByLabel('Game mode',{exact:true}).selectOption('survival');
 await page.getByLabel('Boss',{exact:true}).selectOption('grinwick');
 await page.getByLabel('Add music',{exact:true}).selectOption('2001');await page.getByRole('button',{name:'Add to chain'}).click();
 await page.getByLabel('Loops',{exact:true}).fill('2');
 await page.getByLabel('Add music',{exact:true}).selectOption('2002');await page.getByRole('button',{name:'Add to chain'}).click();
 await page.getByRole('button',{name:'Connect MIDI Piano'}).click();
 await page.getByLabel('Notation appearance',{exact:true}).selectOption('night');
 await page.getByLabel('Character scale',{exact:true}).fill('120');
 await page.getByRole('button',{name:'Save creator settings'}).click();
 await expect(page.getByRole('status').filter({hasText:'Creator settings saved'})).toBeVisible();
 const horizontal=await context.newPage(),vertical=await context.newPage();await viewer(horizontal,state);await viewer(vertical,state,true);
 await page.getByRole('button',{name:'Start MIDI Practice'}).click();
 await expect.poll(()=>!!state.snapshot?.game?.battle?.countdown).toBe(true);
 const started=state.snapshot!.game!.battle!.countdown!.startedAt;
 await page.waitForTimeout(3500);
 await expect(horizontal.locator('.creator-output')).toHaveAttribute('data-notation-preset','night');
 await expect(vertical.locator('.sight-score svg').first()).toBeVisible();
 const first=catalog.find(e=>e.number===2001)!;
 const pitches=noteGroups(practicePass(first,true),'both').flatMap(g=>g.pitches);
 await page.evaluate(p=>(window as unknown as {playNotes:(n:number[])=>void}).playNotes(p),pitches);
 await expect.poll(()=>state.snapshot?.game?.battle?.chain?.pass).toBe(2);
 expect(state.snapshot!.game!.battle!.countdown!.startedAt).toBe(started);
 await page.evaluate(p=>(window as unknown as {playNotes:(n:number[])=>void}).playNotes(p),noteGroups(first,'both').flatMap(g=>g.pitches));
 await expect.poll(()=>state.snapshot?.exerciseNumber).toBe(2002);
 expect(state.snapshot!.game!.battle!.countdown!.startedAt).toBe(started);
 await expect(horizontal.locator('.creator-output-banner strong')).toContainText('Exercise 2');
 await expect(vertical.locator('.creator-output-banner strong')).toContainText('Exercise 2');
 for(const v of [horizontal,vertical]){
  expect(await v.evaluate(()=>(window as unknown as {midiRequests:number}).midiRequests)).toBe(0);
  expect(await v.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  expect(await v.locator('.creator-output').evaluate(e=>{const r=e.getBoundingClientRect();return r.x===0&&r.y===0&&r.width===innerWidth&&r.height===innerHeight;})).toBe(true);
 }
 const arena=await horizontal.locator('.creator-arena').boundingBox(),score=await horizontal.locator('.creator-score').boundingBox();
 expect(arena!.width).toBe(1920);expect(score!.width).toBe(1920);expect(score!.y).toBeCloseTo(arena!.y+arena!.height,0);
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 for(const v of [horizontal,vertical])await expect(v.getByRole('progressbar',{name:'boss HP',exact:true})).toHaveAttribute('aria-valuenow',String(state.snapshot!.game!.battle!.bossHp));
 await page.screenshot({path:'test-results/creator-studio.png',fullPage:true});
 await horizontal.screenshot({path:'test-results/creator-horizontal.png'});await vertical.screenshot({path:'test-results/creator-vertical.png'});
 await horizontal.reload();await expect(horizontal.locator('.creator-output-banner strong')).toContainText('Exercise 2');
 await page.getByRole('button',{name:'Resume',exact:true}).click();expect(state.snapshot!.game!.battle!.countdown!.startedAt).toBe(started);
 await page.getByRole('button',{name:'Revoke viewing links'}).click();await expect(horizontal.locator('.creator-output-banner strong')).toHaveText('Piano Boss Battles');
 await horizontal.close();await vertical.close();
});
test('terminal creator scenes restore held on reconnect for both orientations',async({page,context})=>{
 test.setTimeout(90000);const state=await creator(page);await page.goto('/creator');await page.getByLabel('Add music',{exact:true}).selectOption('2001');await page.getByRole('button',{name:'Add to chain'}).click();
 await expect.poll(()=>!!state.snapshot?.game?.battle).toBe(true);
 const base=structuredClone(state.snapshot!);
 for(const result of ['victory','defeat','timeout'] as const){
  const snapshot=structuredClone(base),b=snapshot.game!.battle!;b.attemptId=crypto.randomUUID();b.status=result==='victory'?'victory':'defeat';b.result=result==='timeout'?'timeout':result==='defeat'?'knockout':undefined;b.config.enabled=true;b.lastAt=Date.now();b.playerHp=result==='defeat'?0:30;b.bossHp=result==='victory'?0:10;
  // Freeze the fixture publisher before presenting an already-terminal scene.
  await page.route('**/api/creator/stream**',r=>r.fulfill({json:{accepted:true,active:false,offers:[]}}));state.snapshot=snapshot;
  for(const portrait of [false,true]){const v=await context.newPage();await viewer(v,state,portrait);await expect(v.locator('.battle-cinematic')).toHaveAttribute('data-phase','holding');await v.screenshot({path:`test-results/creator-${result}-${portrait?'vertical':'horizontal'}.png`});await v.reload();await expect(v.locator('.battle-cinematic')).toHaveAttribute('data-phase','holding');await v.close();}
 }
});

async function audioProbe(page:Page){await page.addInitScript(()=>{
 Object.assign(window,{audioStarts:0});const native=AudioContext.prototype.createBufferSource;
 AudioContext.prototype.createBufferSource=function(){const source=native.call(this),start=source.start.bind(source);source.start=function(...args:Parameters<typeof source.start>){(window as unknown as {audioStarts:number}).audioStarts++;return start(...args);};return source;};
});}
const starts=(p:Page)=>p.evaluate(()=>(window as unknown as {audioStarts:number}).audioStarts);
test('creator audience audio has one owner and reconnect never replays prior cues',async({page,context})=>{
 test.setTimeout(60000);const state=await creator(page);await audioProbe(page);await page.goto('/creator');
 await page.getByLabel('Add music',{exact:true}).selectOption('2001');await page.getByRole('button',{name:'Add to chain'}).click();await page.getByRole('button',{name:'Connect MIDI Piano'}).click();
 const h=await context.newPage(),v=await context.newPage();await audioProbe(h);await audioProbe(v);await viewer(h,state,false,true);await viewer(v,state,true,true);
 await h.locator('body').click({position:{x:10,y:10}});await v.locator('body').click({position:{x:10,y:10}});
 await page.getByRole('button',{name:'Start MIDI Practice'}).click();await page.waitForTimeout(3500);
 const groups=noteGroups(catalog.find(e=>e.number===2001)!,'both');
 for(const group of groups.slice(0,5)){await page.evaluate(p=>(window as unknown as {playNotes:(n:number[])=>void}).playNotes(p),group.pitches);await page.waitForTimeout(220);}
 await expect.poll(()=>starts(h)).toBeGreaterThan(0);expect(await starts(v)).toBe(0);expect(await starts(page)).toBe(0);
 await page.getByRole('button',{name:'Pause',exact:true}).click();await h.reload();await expect(h.locator('.creator-output')).toBeVisible();await h.locator('body').click({position:{x:10,y:10}});await page.waitForTimeout(700);expect(await starts(h)).toBe(0);
 await page.getByLabel('Designated audio source',{exact:true}).selectOption('vertical');await page.getByRole('button',{name:'Save creator settings'}).click();await page.waitForTimeout(700);
 await page.getByRole('button',{name:'Resume',exact:true}).click();
 for(const group of groups.slice(5,10)){await page.evaluate(p=>(window as unknown as {playNotes:(n:number[])=>void}).playNotes(p),group.pitches);await page.waitForTimeout(220);}
 await expect.poll(()=>starts(v)).toBeGreaterThan(0);expect(await starts(h)).toBe(0);expect(await starts(page)).toBe(0);
 await page.getByRole('button',{name:'Pause',exact:true}).click();const before=await starts(page);await page.getByRole('button',{name:'Preview sound here'}).click();await expect.poll(()=>starts(page)).toBeGreaterThan(before);
 await h.close();await v.close();
});

test('creator viewer backs off storage failures and reconnects without a reload',async({page})=>{
 await fixture(page,false);let reads=0,unavailable=true;
 await page.route('**/api/creator/view**',r=>{
  const path=new URL(r.request().url());
  if(path.pathname.endsWith('/exchange'))return r.fulfill({json:{}});
  reads++;
  return unavailable?r.fulfill({status:503,json:{error:'Storage unavailable'}}):r.fulfill({json:{snapshot:null,sequence:0,updatedAt:Date.now(),creator:defaultCreatorPreferences,best:null,attempts:0}});
 });
 await page.goto('/creator/obs/horizontal#view='+'a'.repeat(43));
 await expect.poll(()=>reads).toBe(1);
 await page.waitForTimeout(2000);expect(reads).toBe(1);
 await expect.poll(()=>reads,{timeout:5000}).toBe(2);
 await page.waitForTimeout(2000);expect(reads).toBe(2);
 unavailable=false;
 await expect.poll(()=>reads,{timeout:8000}).toBeGreaterThan(2);
 await expect(page.locator('.creator-output')).toBeVisible();
});
