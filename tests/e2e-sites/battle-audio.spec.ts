import {test,expect,chromium,type Page,type BrowserContext} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {installMidiKeyboard,playNotes} from './helpers/midi';
import {sightLibrary,noteGroups} from '../../hosted/sight-library';
import {practiceLibrary} from '../../hosted/practice-library';
import {readFileSync} from 'node:fs';
const battleSampleCatalog=JSON.parse(readFileSync(new URL('../../hosted/battle-samples.json',import.meta.url),'utf8')) as Record<string,{url:string}>;

type Probe={starts:{at:number;length:number;energy:number;state:string}[];active:number;maxActive:number};
async function probe(page:Page) {
  await page.addInitScript(()=>{
    const data:Probe={starts:[],active:0,maxActive:0};Object.assign(window,{audioProbe:data});
    const native=AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource=function(){
      const source=native.call(this),start=source.start.bind(source),stop=source.stop.bind(source),contextState=()=>this.state;
      let live=false;const end=()=>{if(live){live=false;data.active--;}};
      source.stop=function(when=0){stop(when);if(when<=this.context.currentTime)end();else setTimeout(end,(when-this.context.currentTime)*1000);};
      source.start=function(...args:Parameters<typeof source.start>){
        const pcm=source.buffer?.getChannelData(0)??[],energy=Array.from(pcm).reduce((n,v)=>n+v*v,0)/Math.max(1,pcm.length);
        data.starts.push({at:Date.now(),length:source.buffer?.duration??0,energy,state:contextState()});
        live=true;data.active++;data.maxActive=Math.max(data.maxActive,data.active);source.addEventListener('ended',end,{once:true});start(...args);
      };return source;
    };
  });
}
const read=(p:Page)=>p.evaluate(()=>(window as unknown as {audioProbe:Probe}).audioProbe);
async function setup(ctx:BrowserContext) {
  const id=`audio-${crypto.randomUUID()}`;
  await ctx.setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  const p=await ctx.newPage();await probe(p);await installMidiKeyboard(p);await p.goto('http://127.0.0.1:8787/student/sight-read');
  const controls=p.getByRole('region',{name:'Pianist progression'});
  await expect(controls.getByText('Connecting progression…')).toHaveCount(0);
  await controls.getByText('Progression & recording controls',{exact:true}).click();
  await controls.getByLabel('Boss Battle Mode',{exact:true}).check();
  await controls.getByLabel('Battle sounds (optional)',{exact:true}).check();
  await p.getByRole('button',{name:'Connect keyboard',exact:true}).click();
  return {p,controls,id};
}
test.use({trace:'off'});
for(const channel of ['chrome','msedge'])test(`${channel}: test effects, volume, mute, refresh and real MIDI presentation`,async()=>{
  const browser=await chromium.launch({channel}),ctx=await browser.newContext({viewport:{width:1920,height:1080}});
  try {
    const {p,controls}=await setup(ctx),status=p.getByTestId('battle-audio-diagnostics');
    await expect(status).toContainText('24/24 loaded');
    for(const name of ['Test hero attack','Test boss attack','Test heavy impact','Test victory sound','Test defeat sound','Test TIME OUT sound']){
      const count=(await read(p)).starts.length;
      await controls.getByRole('button',{name,exact:true}).click();
      await expect.poll(async()=>(await read(p)).starts.length).toBeGreaterThan(count);await p.waitForTimeout(900);
    }
    const sounds=await read(p),baseline=sounds.starts.length;
    expect(baseline).toBeGreaterThanOrEqual(8);expect(sounds.starts.every(s=>s.energy>0&&s.state==='running')).toBe(true);
    for(const duration of [.22,.24,.6,1.25,1.2,.65])expect(sounds.starts.some(s=>Math.abs(s.length-duration)<.001)).toBe(true);
    await controls.getByLabel('Battle volume',{exact:true}).fill('100');await expect(status).toContainText('Master volume: 100%');
    await controls.getByLabel('Battle volume',{exact:true}).fill('0');await expect(status).toContainText('Master volume: 0%');
    await expect(controls.getByRole('button',{name:'Test heavy impact',exact:true})).toBeDisabled();
    await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();await playNotes(p,[60]);await p.waitForTimeout(700);expect((await read(p)).starts).toHaveLength(baseline);
    await controls.getByLabel('Battle volume',{exact:true}).fill('40');
    await playNotes(p,[61]);await expect.poll(async()=>(await read(p)).starts.length).toBeGreaterThan(baseline);
    await p.waitForTimeout(1000);await controls.getByLabel('Battle sounds (optional)',{exact:true}).uncheck();
    const muted=(await read(p)).starts.length;await playNotes(p,[62]);await p.waitForTimeout(700);expect((await read(p)).starts).toHaveLength(muted);
    await controls.getByLabel('Battle sounds (optional)',{exact:true}).check();await expect(status).toContainText('Sound: enabled');
    await mkdir('../../work/battle-audio',{recursive:true});await p.getByRole('group',{name:'Battle audio settings'}).screenshot({path:`../../work/battle-audio/${channel}-diagnostics.png`});
    await expect(p.getByText('All progress saved',{exact:true})).toBeVisible({timeout:15000});await p.reload();
    await controls.getByText('Progression & recording controls',{exact:true}).click();await expect(controls.getByLabel('Battle sounds (optional)',{exact:true})).toBeChecked();await expect(status).toContainText('Master volume: 40%');
    expect((await read(p)).starts).toHaveLength(0);
  } finally {await ctx.close();await browser.close();}
});

test('one selected OBS output: contact timing, MIDI independence, silent previews and reconnect',async({browser})=>{
  test.setTimeout(90000);
  const ctx=await browser.newContext({viewport:{width:1920,height:750}});
  const obsCtx=await browser.newContext({viewport:{width:1920,height:750}});
  try {
    const {p,controls,id}=await setup(ctx);
    await obsCtx.setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
    await controls.getByLabel('Battle audio output',{exact:true}).selectOption('obs');
    const obs=await obsCtx.newPage(),preview=await ctx.newPage();await probe(obs);await probe(preview);
    await obs.addInitScript(()=>{Object.defineProperty(navigator,'requestMIDIAccess',{value:()=>{throw Error('OBS must not subscribe to MIDI');}});});
    await obs.goto('http://127.0.0.1:8787/obs/recording?battleAudio=1');await preview.goto('http://127.0.0.1:8787/obs/recording');
    await expect(obs.locator('[data-broadcast-ready=true]')).toBeVisible();await obs.locator('body').click({position:{x:15,y:15}});
    await expect(controls.getByTestId('obs-audio-diagnostics')).toContainText('unlocked',{timeout:20000});
    await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();await expect(obs.locator('.boss-battle-panel')).toHaveAttribute('data-battle-status','active');
    const notes=noteGroups(sightLibrary[0],'both').flatMap(g=>g.pitches);
    await playNotes(p,notes.slice(0,2));
    await expect.poll(async()=>(await read(obs)).starts.length).toBeGreaterThanOrEqual(2);
    const contact=Number(await obs.locator('[data-contact-at]').first().getAttribute('data-contact-at'));
    const cues=(await read(obs)).starts;
    expect(cues.some(c=>Math.abs(c.at-contact)<80&&c.length===.28)).toBe(true);
    expect((await read(p)).starts).toHaveLength(0);expect((await read(preview)).starts).toHaveLength(0);
    // Same-profile duplicate recording sources cannot own the sound bus together.
    const duplicate=await obsCtx.newPage();await probe(duplicate);await duplicate.goto('http://127.0.0.1:8787/obs/recording?battleAudio=1');await expect(duplicate.locator('[data-broadcast-ready=true]')).toBeVisible();
    await playNotes(p,notes.slice(2));await expect(obs.locator('.battle-cinematic')).toHaveAttribute('data-phase','holding',{timeout:12000});
    expect((await read(duplicate)).starts).toHaveLength(0);expect((await read(obs)).starts.filter(c=>c.length===1.25)).toHaveLength(1);
    expect((await read(obs)).maxActive).toBeLessThanOrEqual(4);await duplicate.close();
    const before=await p.request.get('http://127.0.0.1:8787/api/obs');const old=(await before.json()).gamePlayer;
    await obs.reload();await expect(obs.locator('.battle-cinematic')).toHaveAttribute('data-phase','holding');await obs.waitForTimeout(1000);
    expect((await read(obs)).starts).toHaveLength(0);
    const after=await p.request.get('http://127.0.0.1:8787/api/obs');expect((await after.json()).gamePlayer.xp).toBe(old.xp);
    await obs.screenshot({path:'../../work/battle-audio/victory-held.png'});
  }finally{await obsCtx.close();await ctx.close();}
});

for(const result of ['defeat','timeout'] as const)test(`${result} audio plays once, held and reconnected scenes stay silent`,async({browser})=>{
  const ctx=await browser.newContext({viewport:{width:1920,height:750}});
  try {
    const {p,controls}=await setup(ctx);await controls.getByLabel('Also show over my practice score',{exact:true}).check();
    await controls.getByLabel('Game mode',{exact:true}).selectOption(result==='timeout'?'timeAttack':'survival');
    if(result==='timeout')await controls.getByLabel('Explicit time limit',{exact:true}).fill('1');
    else await controls.getByLabel('Boss difficulty',{exact:true}).selectOption('30');
    await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();await playNotes(p,result==='defeat'?[1]:[60]);
    await expect(p.locator('.battle-cinematic')).toHaveAttribute('data-phase','holding',{timeout:12000});
    const duration=result==='defeat'?1.2:.65;expect((await read(p)).starts.filter(c=>c.length===duration)).toHaveLength(1);
    const count=(await read(p)).starts.length;await playNotes(p,[61,62,63]);await p.waitForTimeout(1200);expect((await read(p)).starts).toHaveLength(count);
    await p.locator('.battle-cinematic').screenshot({path:`../../work/battle-audio/${result}-held.png`});
    await p.reload();await p.waitForTimeout(1200);expect((await read(p)).starts).toHaveLength(0);
  }finally{await ctx.close();}
});

test('strict Chrome autoplay policy reports a blocked OBS source and unlocks only after Interact',async({browser})=>{
  const strict=await chromium.launch({channel:'chrome',args:['--autoplay-policy=document-user-activation-required']}),ctx=await browser.newContext(),obsCtx=await strict.newContext({viewport:{width:1920,height:750}});
  try {
    const {p,controls,id}=await setup(ctx);
    await controls.getByLabel('Battle audio output',{exact:true}).selectOption('obs');
    await obsCtx.setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
    const obs=await obsCtx.newPage();await probe(obs);await obs.goto('http://127.0.0.1:8787/obs/recording?battleAudio=1');
    await expect(controls.getByTestId('obs-audio-diagnostics')).toContainText('suspended',{timeout:20000});
    await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
    await expect(obs.locator('.boss-battle-panel')).toHaveAttribute('data-battle-status','active');
    const groups=noteGroups(sightLibrary[0],'both');
    await playNotes(p,groups[0].pitches);await p.waitForTimeout(1000);
    expect((await read(obs)).starts).toHaveLength(0);
    await obs.locator('.sight-score').click({position:{x:100,y:100}});
    await expect(controls.getByTestId('obs-audio-diagnostics')).toContainText('OBS audio: running · unlocked',{timeout:10000});
    expect((await read(obs)).starts).toHaveLength(0); // no queued stale playback on unlock
    await playNotes(p,groups[1].pitches);
    await expect.poll(async()=>(await read(obs)).starts.length).toBeGreaterThan(0);
    expect((await read(p)).starts).toHaveLength(0);
  }finally{await obsCtx.close();await ctx.close();await strict.close();}
});

for(const spacing of [35,90])test(`rapid two-handed Hanon at ${spacing}ms limits sound density without delaying evaluated progress`,async({browser})=>{
  const ctx=await browser.newContext();
  try {
    const {p}=await setup(ctx);let assetRequests=0;p.on('request',r=>{if(r.url().includes('/audio/sonniss-v1/'))assetRequests++;});await expect(p.getByText('All progress saved',{exact:true})).toBeVisible({timeout:15000});await p.goto('http://127.0.0.1:8787/student/practice?collection=hanon&exercise=1001');
    const controls=p.getByRole('region',{name:'Pianist progression'});
    await expect(controls.getByText('Connecting progression…')).toHaveCount(0);
    await controls.getByText('Progression & recording controls',{exact:true}).click();
    await expect(controls.getByLabel('Battle sounds (optional)',{exact:true})).toBeChecked();
    const groups=noteGroups(practiceLibrary[0],'both');
    await p.getByRole('button',{name:'Connect keyboard',exact:true}).click();await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
    await expect(p.getByTestId('battle-audio-diagnostics')).toContainText('24/24 loaded');const warmedRequests=assetRequests;
    for(const group of groups.slice(0,60)){await playNotes(p,group.pitches);await p.waitForTimeout(spacing);}
    await p.waitForTimeout(1000);
    const response=await p.request.get('http://127.0.0.1:8787/api/obs'),battle=(await response.json()).snapshot.game.battle;
    expect(battle.correctHits).toBe(groups.slice(0,60).reduce((n,g)=>n+g.pitches.length,0));expect(battle.mistakes).toBe(0);
    const sounds=await read(p);expect(sounds.starts.length).toBeGreaterThan(0);expect(sounds.starts.length).toBeLessThan(battle.correctHits);expect(sounds.maxActive).toBeLessThanOrEqual(4);
    expect(assetRequests).toBe(warmedRequests); // no fetch/decode on the note path
    await controls.getByLabel('Battle sounds (optional)',{exact:true}).uncheck();const before=sounds.starts.length;
    for(const group of groups.slice(60,70))await playNotes(p,group.pitches);await p.waitForTimeout(1000);
    expect((await read(p)).starts).toHaveLength(before);
  }finally{await ctx.close();}
});

test('missing recordings report fallback and recover without replaying old contacts',async({browser})=>{
  const ctx=await browser.newContext();
  try{
    await ctx.route('**/audio/sonniss-v1/**',route=>route.fulfill({status:404,body:'Missing test asset'}));
    const {p,controls}=await setup(ctx),status=p.getByTestId('battle-audio-diagnostics');
    await expect(status).toContainText('Synthesized fallback active');
    await controls.getByRole('button',{name:'Test heavy impact',exact:true}).click();
    await expect.poll(async()=>(await read(p)).starts.length).toBe(1);
    expect((await read(p)).starts[0].length).toBe(.4);
    await ctx.unroute('**/audio/sonniss-v1/**');await p.waitForTimeout(250);
    await controls.getByRole('button',{name:'Test victory sound',exact:true}).click();
    await expect(status).toContainText('24/24 loaded');
    await expect.poll(async()=>(await read(p)).starts.length).toBe(2);
    expect((await read(p)).starts[1].length).toBe(1.25);
    await p.waitForTimeout(1500);expect((await read(p)).starts).toHaveLength(2);
  }finally{await ctx.close();}
});

test('the four-voice worst-case mix retains headroom at default and maximum volume',async({browser})=>{
  const ctx=await browser.newContext();
  try{
    const {p}=await setup(ctx);
    const levels=await p.evaluate(async url=>{
      const bytes=await (await fetch(url)).arrayBuffer(),results=[];
      for(const volume of [.08,.2]){
        const c=new OfflineAudioContext(1,48000,48000),buffer=await c.decodeAudioData(bytes.slice(0));
        const master=c.createGain(),compressor=c.createDynamicsCompressor();master.gain.value=volume;
        compressor.threshold.value=-16;compressor.knee.value=12;compressor.ratio.value=8;compressor.attack.value=.003;compressor.release.value=.1;
        master.connect(compressor);compressor.connect(c.destination);
        // Four identical, in-phase heavy impacts are harsher than normal mixed cues.
        for(let i=0;i<4;i++){const source=c.createBufferSource();source.buffer=buffer;source.connect(master);source.start(0);}
        const pcm=(await c.startRendering()).getChannelData(0);let peak=0,energy=0;
        for(const v of pcm){peak=Math.max(peak,Math.abs(v));energy+=v*v;}
        results.push({volume,peak,rms:Math.sqrt(energy/pcm.length)});
      }
      return results;
    },battleSampleCatalog.crush.url);
    expect(levels.every(l=>l.peak>0&&l.peak<.95)).toBe(true);
    expect(levels[0].rms).toBeLessThan(.05);expect(levels[0].peak).toBeLessThan(.25);
    await mkdir('../../work/sonniss-integration',{recursive:true});
    const {writeFile}=await import('node:fs/promises');await writeFile('../../work/sonniss-integration/mix-headroom.json',JSON.stringify(levels,null,2));
  }finally{await ctx.close();}
});
