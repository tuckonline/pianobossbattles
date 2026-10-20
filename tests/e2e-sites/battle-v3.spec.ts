import {test,expect,chromium} from '@playwright/test';
import {practiceLibrary} from '../../hosted/practice-library';
import {noteGroups} from '../../hosted/sight-library';
import {installMidiKeyboard} from './helpers/midi';
import {battleView,createBattle,reduceBattle} from '../../hosted/boss-battle';
import {defaultBossBattleConfig} from '../../hosted/boss-config';
import {defaultGameSettings,evaluateGame} from '../../hosted/game-core';
test('one hero and boss strike synchronize contact, HP, frame, recoil and recovery; preview stays local',async({page})=>{
  test.setTimeout(90000);const id=`v3-contact-${crypto.randomUUID()}`;
  await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  const read=async()=>{const r=await page.request.post('/api/platform',{headers:{origin:'http://127.0.0.1:8787'},data:{action:'gameState'}});return r.json();};
  await page.goto('/student/practice?battleDebug=1');const controls=page.getByRole('region',{name:'Pianist progression'});
  await expect(controls.getByText('Connecting progression…')).toHaveCount(0);await controls.getByText('Progression & recording controls',{exact:true}).click();
  await page.getByText('Character animation library',{exact:true}).click();const lab=page.getByRole('region',{name:'Combat animation laboratory'}),panel=lab.getByLabel('Boss battle',{exact:true});
  await expect(panel.locator('[data-asset-status="ready"]')).toHaveCount(2);const before=await read();
  await lab.scrollIntoViewIfNeeded();await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+50)));
  for(const [button,side,hp,at] of [['Hero strike','boss','999',64],['Boss strike','player','26',96],['Missed-note reaction','player','22',96]] as const){
    await lab.getByRole('button',{name:button,exact:true}).click();await expect(panel).toHaveAttribute('data-phase','windup');
    const previous=await panel.getByRole('progressbar',{name:`${side} HP`}).getAttribute('aria-valuenow');expect(previous).not.toBe(hp);
    await page.clock.runFor(at-1);expect(await panel.getByRole('progressbar',{name:`${side} HP`}).getAttribute('aria-valuenow')).toBe(previous);
    await page.clock.runFor(17);await expect(panel.getByRole('progressbar',{name:`${side} HP`})).toHaveAttribute('aria-valuenow',hp);
    await expect(panel.locator(`.battle-character-${side}`)).toHaveAttribute('data-animation-category','hitReaction');
    await expect(panel.locator(`.battle-character-${side} canvas`)).toHaveAttribute('data-sprite-frame','1');
    // Playwright's mocked clock drives canvas/timers, not compositor WAAPI.
    // Seek the two movement tracks to the same captured contact for this still.
    await panel.locator('.battle-fighter,.battle-ground-shadow').evaluateAll((nodes,at)=>{for(const n of nodes)for(const a of n.getAnimations()){a.pause();a.currentTime=n.className.includes('boss')?(at===64?0:at):(at===64?at:0);}},at);
    await panel.screenshot({path:`../../work/v3-${button.replaceAll(' ','-')}-contact.png`});
    await panel.locator('.battle-fighter,.battle-ground-shadow').evaluateAll(nodes=>{for(const n of nodes)for(const a of n.getAnimations())a.play();});
    await page.clock.runFor(1200);await expect(panel).toHaveAttribute('data-phase','idle');
  }
  for(const win of [true,false]){
    await lab.getByRole('button',{name:'Reset to idle',exact:true}).click();
    await lab.getByRole('button',{name:win?'Hero finisher':'Boss finisher',exact:true}).click();await expect(panel).toHaveAttribute('data-phase','windup');
    await expect(panel.locator('.battle-outcome')).toHaveCount(0);await page.clock.runFor(400);
    await expect(panel.locator('.battle-outcome')).toContainText(win?'BOSS DEFEATED':'YOU WERE DEFEATED');
    await expect(panel.locator('.battle-finisher')).toHaveAttribute('data-finisher-tone',win?'blue':'red');
    await page.clock.runFor(300);await panel.screenshot({path:`../../work/v3-${win?'victory':'defeat'}.png`});
    await page.clock.runFor(4500);await expect(panel.locator('.battle-outcome,.battle-finisher')).toHaveCount(0);await expect(panel).toHaveAttribute('data-phase','settled');
  }
  await page.clock.resume();const after=await read();expect(after.xp).toBe(before.xp);expect(after.unlocks).toEqual(before.unlocks);expect(after.best).toBe(before.best);
});

test('real-time OBS contact anchors align; cinematic captures preserve score and combat ordering',async({browser})=>{
  test.setTimeout(90000);const id=`v3-realtime-${crypto.randomUUID()}`,origin='http://127.0.0.1:8787';
  const context=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`},viewport:{width:1920,height:1080},recordVideo:{dir:'../../work/v3-recordings',size:{width:1280,height:720}}}),page=await context.newPage();
  const config={...defaultBossBattleConfig,enabled:true},sourceId=crypto.randomUUID();let sequence=0,state=reduceBattle(createBattle(config,1000),{type:'start',attemptId:crypto.randomUUID()});
  const publish=async(combo=0)=>{const r=await page.request.post('/api/obs',{headers:{origin},data:{sourceId,claim:true,sequence:++sequence,snapshot:{exerciseNumber:1001,title:'Hanon No. 1',hand:'both',status:'practicing',accuracy:null,mistakes:state.mistakes,measure:1,totalMeasures:30,
    game:{sessionId:'v3-realtime',preview:false,settings:{...defaultGameSettings,bossBattle:config},alerts:[],live:{attemptId:state.attemptId,sessionId:'v3-realtime',combo,best:combo,correct:state.correctHits,incorrect:state.mistakes,provisionalXP:0,status:state.status,sequence},battle:battleView(state)}}}});expect(r.ok(),await r.text()).toBe(true);};
  try{
    await page.request.post('/api/platform',{headers:{origin},data:{action:'gameState'}});await publish();await page.goto(origin+'/obs/score');
    const panel=page.getByRole('complementary',{name:'Boss battle'});await expect(panel.locator('[data-asset-status="ready"]')).toHaveCount(2);await expect(page.locator('[data-broadcast-ready="true"]')).toBeVisible();
    await page.screenshot({path:'../../work/v3-idle.png'});
    await panel.evaluate(root=>{
      const w=window as unknown as {contacts:{side:string;distance:number}[]};w.contacts=[];let seen='';
      new MutationObserver(()=>{const impact=root.querySelector('[data-contact-at]');if(!impact||seen===impact.getAttribute('data-contact-at'))return;seen=impact.getAttribute('data-contact-at')!;
        requestAnimationFrame(()=>{const hero=root.querySelector('.battle-fighter-player')!.getBoundingClientRect(),boss=root.querySelector('.battle-fighter-boss')!.getBoundingClientRect(),side=impact.classList.contains('battle-impact-player')?'player':'boss',a=side==='player'?hero:boss,t=side==='player'?boss:hero;
          const actor=root.querySelector<HTMLElement>(`.battle-fighter-${side}`)!;
          const dx=a.x+a.width*Number(actor.dataset.weaponX)-t.x-t.width*Number(actor.dataset.targetX),dy=a.y+a.height*Number(actor.dataset.weaponY)-t.y-t.height*Number(actor.dataset.targetY);
          w.contacts.push({side,distance:Math.hypot(dx,dy),...{dx,dy}});});
      }).observe(root,{subtree:true,childList:true,attributes:true});
    });
    const ex={...practiceLibrary[0],polyphony:[{pitch:60,beat:0,beats:1,hand:'right' as const},{pitch:62,beat:1,beats:1,hand:'right' as const}]};
    const played:number[]=[];
    for(const [name,pitch] of [['hero',60],['boss',1],['follow-up',62]] as const){
      const observed=await page.evaluate(()=>(window as unknown as {contacts:unknown[]}).contacts.length);
      played.push(pitch);const result=evaluateGame(ex,'both',played,{playerId:id,sessionId:'v3-realtime',attemptId:state.scoringAttemptId,timestamp:Date.now()});state=reduceBattle(state,{type:'evaluate',attemptId:state.scoringAttemptId,events:result.events});await publish(name==='follow-up'?50:0);
      await expect.poll(()=>page.evaluate(()=>(window as unknown as {contacts:unknown[]}).contacts.length)).toBeGreaterThan(observed);await page.screenshot({path:`../../work/v3-realtime-${name}.png`});await expect(panel).toHaveAttribute('data-phase','idle');
    }
    const contacts=await page.evaluate(()=>(window as unknown as {contacts:{side:string;distance:number}[]}).contacts);console.log('Contact anchor separation (px)',contacts);
    expect(contacts.length).toBeGreaterThanOrEqual(3);expect(Math.max(...contacts.map(c=>c.distance))).toBeLessThan(22);
    for(const win of [true,false]){
      state=reduceBattle(createBattle(config,1),{type:'start',attemptId:crypto.randomUUID()});await publish();
      // Wait for the new battle snapshot, not the previous battle's idle pose.
      // Otherwise HTTP fallback may coalesce start + completion as a restore.
      await expect(panel).toHaveAttribute('data-authoritative-boss-hp','1');await expect(panel).toHaveAttribute('data-battle-status','active');
      if(!win)state={...state,playerHp:4};const result=evaluateGame(ex,'both',[win?60:1],{playerId:id,sessionId:'v3-realtime',attemptId:state.scoringAttemptId,timestamp:Date.now()});state=reduceBattle(state,{type:'evaluate',attemptId:state.scoringAttemptId,events:result.events});await publish();
      await expect(panel.locator('.battle-outcome')).toBeVisible();await page.waitForTimeout(500);await page.screenshot({path:`../../work/v3-realtime-${win?'victory':'defeat'}.png`});await page.waitForTimeout(3600);
    }
  }finally{await context.close();}
});

for(const bpm of [60,120,240])test(`two-handed Hanon at ${bpm} BPM groups notes without losing damage or accumulating delay`,async({browser})=>{
  test.setTimeout(120000);const id=`v3-hanon-${bpm}-${crypto.randomUUID()}`,headers={'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`};
  const context=await browser.newContext({extraHTTPHeaders:headers}),p=await context.newPage(),obsBrowser=await chromium.launch(),obs=await obsBrowser.newPage({extraHTTPHeaders:headers,viewport:{width:1920,height:1080}});
  try{
    await installMidiKeyboard(p);await p.goto('http://127.0.0.1:8787/student/practice?collection=hanon&exercise=1001');
    const controls=p.getByRole('region',{name:'Pianist progression'});await expect(controls.getByText('Connecting progression…')).toHaveCount(0);
    await controls.getByText('Progression & recording controls',{exact:true}).click();await controls.getByLabel('Boss Battle Mode',{exact:true}).check();
    await obs.goto('http://127.0.0.1:8787/obs/score');await expect(obs.locator('main')).toHaveAttribute('data-score-transport','direct',{timeout:20000});
    await expect(obs.locator('[data-asset-status="ready"]')).toHaveCount(2);const ink=await obs.locator('.notation > svg').first().elementHandle();
    await p.getByRole('button',{name:'Connect keyboard',exact:true}).click();await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
    const panel=obs.getByRole('complementary',{name:'Boss battle'});await expect(panel).toHaveAttribute('data-battle-status','active');
    await obs.evaluate(()=>{
      const w=window as unknown as {v3:{maxPending:number;frames:number[];impacts:number;done:boolean}};w.v3={maxPending:0,frames:[],impacts:0,done:false};
      const root=document.querySelector('.boss-battle-panel')!;let last=performance.now(),contact='';
      const draw=(now:number)=>{w.v3.frames.push(now-last);last=now;w.v3.maxPending=Math.max(w.v3.maxPending,Number(root.getAttribute('data-pending-batches')));const c=root.querySelector('[data-contact-at]')?.getAttribute('data-contact-at');if(c&&c!==contact){w.v3.impacts++;contact=c;}if(!w.v3.done)requestAnimationFrame(draw);};requestAnimationFrame(draw);
    });
    const groups=noteGroups(practiceLibrary[0],'both'),count=64,notes=groups.slice(0,count).map(g=>g.pitches),total=groups.reduce((n,g)=>n+g.pitches.length,0),played=notes.flat().length;
    await p.evaluate(async({notes,interval})=>{for(const group of notes){(window as unknown as {sendMidi:(m:number[][])=>void}).sendMidi(group.flatMap(pitch=>[[0x90,pitch,90],[0x80,pitch,0]]));await new Promise(r=>setTimeout(r,interval));}},{notes,interval:15000/bpm});
    const ended=Date.now();await expect(panel.getByRole('progressbar',{name:'boss HP'})).toHaveAttribute('aria-valuenow',String(total-played),{timeout:1000});
    expect(Date.now()-ended).toBeLessThan(800);await expect(panel).toHaveAttribute('data-authoritative-boss-hp',String(total-played));
    await expect(panel.getByRole('progressbar',{name:'player HP'})).toHaveAttribute('aria-valuenow','30');
    await expect(panel).toHaveAttribute('data-phase','idle',{timeout:1500});
    const stats=await obs.evaluate(()=>{const s=(window as unknown as {v3:{maxPending:number;frames:number[];impacts:number;done:boolean}}).v3;s.done=true;const sorted=s.frames.sort((a,b)=>a-b);return {maxPending:s.maxPending,impacts:s.impacts,p95FrameMs:sorted[Math.floor(sorted.length*.95)]};});
    console.log('Hanon',bpm,stats);expect(stats.maxPending).toBeLessThanOrEqual(6);expect(stats.impacts).toBeGreaterThan(5);expect(stats.impacts).toBeLessThanOrEqual(played);
    expect(await ink!.evaluate(n=>n===document.querySelector('.notation > svg'))).toBe(true);
    await obs.screenshot({path:`../../work/v3-hanon-${bpm}-settled.png`});
  }finally{await context.close();await obsBrowser.close();}
});

