import {test,expect,chromium,type Page} from '@playwright/test';
import {defaultGameSettings,type Celebration} from '../../hosted/game-core';
import {battleView,createBattle} from '../../hosted/boss-battle';
import {defaultBossBattleConfig} from '../../hosted/boss-config';
import {noteGroups,type Exercise} from '../../hosted/sight-library';
import {scalesLibrary} from '../../hosted/scales-library';
import {practiceLibrary} from '../../hosted/practice-library';
import {installMidiKeyboard,playNotes} from './helpers/midi';
const origin='http://127.0.0.1:8787';
async function assertLayout(page:Page,boss:boolean){
  const viewport=page.viewportSize()!,banner=(await page.locator('.obs-panel').boundingBox())!,score=(await page.locator('.sight-score').boundingBox())!;
  expect(banner.x).toBe(0);expect(banner.y).toBe(0);expect(banner.width).toBe(viewport.width);
  expect(score.y).toBeCloseTo(banner.height,0);expect(score.y+score.height).toBeCloseTo(viewport.height,0);
  expect(score.width).toBeCloseTo(viewport.width*(boss?.78:1),0);
  await expect.poll(()=>page.locator('.notation .system').evaluateAll(nodes=>{
    const bounds=nodes.filter(n=>getComputedStyle(n).visibility==='visible').map(n=>n.getBoundingClientRect());
    const area=document.querySelector('.sight-score')!.getBoundingClientRect();
    const targets=({1:[.5],2:[.32,.68],3:[.22,.5,.78]} as Record<number,number[]>)[nodes.length];
    return targets ? Math.max(...bounds.map((b,i)=>Math.abs((b.top+b.bottom)/2-area.top-area.height*targets[i]))) : Math.abs((Math.min(...bounds.map(b=>b.top))+Math.max(...bounds.map(b=>b.bottom)))/2-(area.top+area.height/2));
  })).toBeLessThan(2);
  const bounds=await page.locator('.notation .system').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).visibility==='visible').map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
  expect(bounds.length).toBeGreaterThan(0);expect(bounds.length).toBeLessThanOrEqual(3);
  for(const b of bounds){expect(b.x).toBeGreaterThanOrEqual(score.x+10);expect(b.right).toBeLessThanOrEqual(score.x+score.width-10);expect(b.y).toBeGreaterThanOrEqual(score.y+10);expect(b.bottom).toBeLessThanOrEqual(viewport.height-10);}
  expect(await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}))).toEqual(viewport);
  await expect(page.locator('nav,button,input,select,video,iframe,.game-settings')).toHaveCount(0);
}

test('unified recording fits ON/OFF, five score types and resizable heights without rebuilding notation',async({page})=>{
  test.setTimeout(120000);const id=`recording-layout-${crypto.randomUUID()}`;
  await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  await page.request.post('/api/platform',{headers:{origin},data:{action:'gameState'}});
  await page.goto('/obs/recording');let sequence=0;const sourceId=crypto.randomUUID();
  for(const size of [{width:1920,height:750},{width:1920,height:600},{width:1280,height:720}]){
    await page.setViewportSize(size);
    for(const exerciseNumber of [11001,2001,9017,10001,4001]){
      const r=await page.request.post('/api/platform',{headers:{origin},data:{action:'practiceExercise',exerciseNumber}});const ex:Exercise=await r.json();
      for(const enabled of [false,true,false]){
        const before=await page.locator('.notation > svg').count()?await page.locator('.notation > svg').first().elementHandle():null;
        const oldTitle=await page.locator('.obs-piece h1').textContent();
        const config={...defaultBossBattleConfig,enabled};
        await page.request.post('/api/obs',{headers:{origin},data:{sourceId,sequence:++sequence,claim:true,snapshot:{exerciseNumber,title:ex.title,hand:'both',status:'ready',accuracy:null,mistakes:0,measure:1,totalMeasures:ex.right.length,
          game:{sessionId:'layout',preview:false,settings:{...defaultGameSettings,bossBattle:config},alerts:[],live:{attemptId:'layout',sessionId:'layout',combo:0,best:0,correct:0,incorrect:0,provisionalXP:0,status:'ready',sequence},battle:battleView(createBattle(config,100))}}}});
        await expect(page.locator('.obs-piece h1')).toHaveText(ex.title!);
        await expect(page.locator('.boss-battle-panel')).toHaveCount(enabled?1:0);
        await expect(page.locator('[data-broadcast-ready="true"]')).toBeVisible();await assertLayout(page,enabled);
        if(oldTitle===ex.title&&before)expect(await before.evaluate(n=>n===document.querySelector('.notation > svg'))).toBe(true);
        if(enabled){
          await expect(page.locator('[data-asset-status="ready"]')).toHaveCount(2);
          const arena=(await page.locator('.battle-stage').boundingBox())!;
          for(const actor of await page.locator('.battle-fighter').all()){const box=(await actor.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(arena.x-1);expect(box.x+box.width).toBeLessThanOrEqual(arena.x+arena.width+1);expect(box.y).toBeGreaterThanOrEqual(arena.y-1);expect(box.y+box.height).toBeLessThanOrEqual(arena.y+arena.height+1);}
        }
        if(size.height===750&&exerciseNumber===11001)await page.screenshot({path:`../../work/recording-${enabled?'boss':'score'}.png`});
      }
    }
  }
});

test('one read-only OBS receiver follows actual MIDI, saved XP/PBs, battles and reconnects',async({browser})=>{
  test.setTimeout(120000);const id=`recording-live-${crypto.randomUUID()}`,headers={'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`};
  const ctx=await browser.newContext({extraHTTPHeaders:headers}),p=await ctx.newPage(),obsBrowser=await chromium.launch(),o=await obsBrowser.newPage({extraHTTPHeaders:headers,viewport:{width:1920,height:750}});
  const writes:string[]=[];
  await o.addInitScript(()=>{
    const stats={midi:0,media:0,streams:0,maxStreams:0};Object.assign(window,{recordingProbe:stats});
    Object.defineProperty(navigator,'requestMIDIAccess',{value:()=>{stats.midi++;throw Error('Recording requested MIDI');}});
    Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:()=>{stats.media++;throw Error('Recording requested camera');}}});
    const Native=window.EventSource;
    window.EventSource=class extends Native{constructor(url:string|URL,options?:EventSourceInit){super(url,options);stats.streams++;stats.maxStreams=Math.max(stats.maxStreams,stats.streams);}override close(){stats.streams--;super.close();}};
  });
  o.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/api/platform'))writes.push(JSON.parse(r.postData()!).action);if(r.method()==='POST'&&r.url().endsWith('/api/obs'))writes.push('publish');});
  try{
    await installMidiKeyboard(p);await p.goto(origin+'/student/practice?collection=scales&exercise=11001');
    const controls=p.getByRole('region',{name:'Pianist progression'});await expect(controls.getByText('Connecting progression…')).toHaveCount(0);
    await controls.getByText('Progression & recording controls',{exact:true}).click();await controls.getByLabel('Boss Battle Mode',{exact:true}).check();
    await expect(p.getByRole('link',{name:'Recording view ↗',exact:true})).toHaveAttribute('href','/obs/recording');
    await o.goto(origin+'/obs/recording');await expect(o.locator('main')).toHaveAttribute('data-score-transport','direct',{timeout:20000});
    await expect(o.locator('[data-broadcast-ready="true"]')).toBeVisible();await expect(o.locator('[data-asset-status="ready"]')).toHaveCount(2);
    const svg=await o.locator('.notation > svg').first().elementHandle();
    await p.getByRole('button',{name:'Connect keyboard',exact:true}).click();await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
    const notes=noteGroups(scalesLibrary[0],'both').flatMap(g=>g.pitches);
    await playNotes(p,notes.slice(0,10));await expect(o.locator('.practice-note-correct')).toHaveCount(10,{timeout:1500});
    await expect(o.locator('.game-combo > strong')).toHaveText('10');
    await expect(o.getByRole('progressbar',{name:'boss HP',exact:true})).toHaveAttribute('aria-valuenow',String(notes.length-10));
    await expect(o.locator('.game-celebration')).toContainText(/Finding My Rhythm|10 notes in a row/);
    await playNotes(p,[1]);await expect(o.locator('.game-combo > strong')).toHaveText('0');await expect(o.getByRole('progressbar',{name:'player HP',exact:true})).toHaveAttribute('aria-valuenow','26');
    expect(await svg!.evaluate(n=>n===document.querySelector('.notation > svg'))).toBe(true);
    await o.reload();await expect(o.locator('main')).toHaveAttribute('data-score-transport','direct',{timeout:20000});
    await expect(o.locator('.practice-note-correct')).toHaveCount(10);await expect(o.getByRole('progressbar',{name:'player HP',exact:true})).toHaveAttribute('aria-valuenow','26');
    await playNotes(p,notes.slice(10));await expect(o.getByRole('progressbar',{name:'boss HP',exact:true})).toHaveAttribute('aria-valuenow','0');
    await expect(o.locator('.battle-cinematic')).toHaveAttribute('data-result','victory');await expect(o.locator('.battle-cinematic')).toContainText('BOSS DEFEATED');
    await expect(o.locator('.battle-outcome,.battle-result,.battle-mode-notice')).toHaveCount(0);
    await expect(o.locator('.obs-best .obs-score')).toHaveText(/\d+%/,{timeout:15000});
    await expect(o.locator('.obs-best p')).toContainText('1 completed attempt');
    const read=async()=>{const r=await p.request.post('/api/platform',{headers:{origin},data:{action:'gameState'}});return r.json();};
    await expect.poll(async()=>(await read()).xp).toBeGreaterThan(0);
    const saved=await read();await expect(o.locator('.game-level small')).toContainText(`${saved.xp.toLocaleString()} XP`,{timeout:10000});
    await o.reload();await expect(o.locator('.game-level small')).toContainText(`${saved.xp.toLocaleString()} XP`);await expect(o.locator('.battle-outcome,.battle-finisher')).toHaveCount(0);
    await expect(o.locator('.battle-cinematic')).toHaveAttribute('data-phase','holding');await expect(o.locator('.battle-cinematic')).toHaveAttribute('data-result','victory');expect((await read()).xp).toBe(saved.xp);
    await p.getByLabel('Exercise',{exact:true}).selectOption('11002');await expect(o.locator('.obs-piece h1')).toHaveText(scalesLibrary[1].title!);await expect(o.locator('.obs-best .obs-score')).toHaveText('—');await expect(o.locator('.battle-cinematic')).toHaveCount(0);
    await assertLayout(o,true);
    const progressBeforeClose=await read();await ctx.close();await o.reload();await expect(o.locator('.obs-piece h1')).toHaveText(scalesLibrary[1].title!);await expect(o.locator('.game-level small')).toContainText(`${progressBeforeClose.xp.toLocaleString()} XP`);
    expect(await o.evaluate(()=>(window as unknown as {recordingProbe:unknown}).recordingProbe)).toEqual({midi:0,media:0,streams:1,maxStreams:1});
    expect(writes.every(a=>a==='practiceExercise')).toBe(true);
  }finally{await ctx.close();await obsBrowser.close();}
});

test('recording notifications fade, repeat streaks, remember achievements and award no progress',async({page})=>{
  test.setTimeout(70000);const id=`recording-alerts-${crypto.randomUUID()}`;
  await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});await page.setViewportSize({width:1920,height:750});
  await page.request.post('/api/platform',{headers:{origin},data:{action:'gameState'}});await page.goto('/obs/recording');
  let sequence=0;const sourceId=crypto.randomUUID();
  const event=(kind:Celebration['kind'],id:string,title:string):Celebration=>({id,kind,title,description:'Practice progress',priority:80,createdAt:Date.now()});
  const publish=async(alerts:Celebration[])=>{
    await page.request.post('/api/obs',{headers:{origin},data:{sourceId,sequence:++sequence,claim:true,snapshot:{exerciseNumber:11001,title:scalesLibrary[0].title,hand:'both',status:'practicing',accuracy:100,mistakes:0,measure:1,totalMeasures:4,
      game:{sessionId:'notifications',preview:false,settings:defaultGameSettings,alerts,live:{attemptId:`attempt-${sequence}`,sessionId:'notifications',combo:10,best:10,correct:10,incorrect:0,provisionalXP:0,status:'playing',sequence}}}}});
  };
  await publish([]);await expect(page.locator('[data-broadcast-ready="true"]')).toBeVisible();
  for(const n of [1,2]){
    await publish([event('milestone',`streak-${n}`,'10 notes in a row')]);await expect(page.locator('.game-celebration strong')).toHaveText('10 notes in a row');
    expect(await page.locator('.game-celebration').evaluate(n=>getComputedStyle(n).animationName)).toBe('game-fade-in, game-fade-out');
    await expect(page.getByText('MILESTONE',{exact:true})).toBeHidden();
    const card=(await page.locator('.game-celebration').boundingBox())!,score=(await page.locator('.sight-score').boundingBox())!;expect(card.y+card.height).toBeLessThanOrEqual(score.y);
    await expect(page.locator('.game-celebration')).toHaveCount(0,{timeout:6000});
  }
  await publish([event('achievement','achievement:first_steps','First Steps')]);await expect(page.locator('.game-celebration strong')).toHaveText('First Steps');await page.waitForTimeout(400);await page.screenshot({path:'../../work/recording-achievement.png'});
  await expect(page.locator('.game-celebration')).toHaveCount(0,{timeout:6000});await page.reload();
  await publish([event('achievement','achievement:first_steps','First Steps'),event('record','new-record','Personal Best')]);await expect(page.locator('.game-celebration strong')).toHaveText('Personal Best');
  const r=await page.request.post('/api/platform',{headers:{origin},data:{action:'gameState'}});expect(await r.json()).toMatchObject({xp:0,unlocks:[]});
});

test('rapid two-handed Hanon keeps the unified score, HUD and combat responsive; defeat is contained',async({browser})=>{
  test.setTimeout(60000);const id=`recording-rapid-${crypto.randomUUID()}`,headers={'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`};
  const ctx=await browser.newContext({extraHTTPHeaders:headers}),p=await ctx.newPage(),obsBrowser=await chromium.launch(),o=await obsBrowser.newPage({extraHTTPHeaders:headers,viewport:{width:1920,height:750}});
  try{
    await installMidiKeyboard(p);await p.goto(origin+'/student/practice?collection=hanon&exercise=1001');
    const controls=p.getByRole('region',{name:'Pianist progression'});await expect(controls.getByText('Connecting progression…')).toHaveCount(0);
    await controls.getByText('Progression & recording controls',{exact:true}).click();await controls.getByLabel('Boss Battle Mode',{exact:true}).check();
    await o.goto(origin+'/obs/recording');await expect(o.locator('main')).toHaveAttribute('data-score-transport','direct',{timeout:20000});await expect(o.locator('[data-asset-status="ready"]')).toHaveCount(2);
    await p.getByRole('button',{name:'Connect keyboard',exact:true}).click();await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
    const svg=await o.locator('.notation > svg').first().elementHandle();
    await o.evaluate(()=>{const stats={frames:[] as number[],pending:0,done:false};Object.assign(window,{streamStats:stats});let last=performance.now();const frame=(now:number)=>{stats.frames.push(now-last);last=now;stats.pending=Math.max(stats.pending,Number(document.querySelector('.boss-battle-panel')?.getAttribute('data-pending-batches')));if(!stats.done)requestAnimationFrame(frame);};requestAnimationFrame(frame);});
    const groups=noteGroups(practiceLibrary[0],'both'),notes=groups.slice(0,64).map(g=>g.pitches),total=groups.flatMap(g=>g.pitches).length;
    await p.evaluate(async(notes)=>{for(const group of notes){(window as unknown as {sendMidi:(m:number[][])=>void}).sendMidi(group.flatMap(p=>[[0x90,p,90],[0x80,p,0]]));await new Promise(r=>setTimeout(r,62.5));}},notes);
    await expect(o.locator('.game-combo > strong')).toHaveText('128');await expect(o.getByRole('progressbar',{name:'boss HP',exact:true})).toHaveAttribute('aria-valuenow',String(total-128),{timeout:800});
    expect(await svg!.evaluate(n=>n===document.querySelector('.notation > svg'))).toBe(true);
    const stats=await o.evaluate(()=>{const s=(window as unknown as {streamStats:{frames:number[];pending:number;done:boolean}}).streamStats;s.done=true;s.frames.sort((a,b)=>a-b);return {maxPending:s.pending,p95FrameMs:s.frames[Math.floor(s.frames.length*.95)]};});console.log('Unified Hanon 240 BPM',stats);expect(stats.maxPending).toBeLessThanOrEqual(6);
    await playNotes(p,[1,1,1,1,1,1,1,1]);await expect(o.locator('.battle-cinematic')).toHaveAttribute('data-result','defeat');await expect(o.locator('.battle-cinematic')).toContainText('YOU WERE DEFEATED');
    await expect(o.locator('.battle-outcome,.battle-result,.battle-mode-notice')).toHaveCount(0);await expect(o.locator('.battle-cinematic')).toHaveAttribute('data-phase','holding');
    await assertLayout(o,true);await o.screenshot({path:'../../work/recording-defeat.png'});
  }finally{await ctx.close();await obsBrowser.close();}
});
