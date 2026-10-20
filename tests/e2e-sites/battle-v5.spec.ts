import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {practiceLibrary} from '../../hosted/practice-library';
import {noteGroups} from '../../hosted/sight-library';
import {createBattle,reduceBattle,battleView} from '../../hosted/boss-battle';
import {defaultBossBattleConfig} from '../../hosted/boss-config';
import {defaultGameSettings,evaluateGame} from '../../hosted/game-core';
import {BattleTraceRecorder,measureBattleTrace} from '../../hosted/battle-replay';
import {schmittLibrary} from '../../hosted/schmitt-library';
import {build} from 'esbuild';

// DOM trace snapshots walk the entire large notation tree on every publish.
// They distort the latency/FPS benchmark (confirmed by the CPU profiler).
// Videos, explicit stills, measured JSON and evaluator traces remain available.
test.use({trace:'off'});

const shortsReview=process.env.BATTLE_REVIEW_SHORTS==='1',reviewRoute=shortsReview?'/obs/shorts':'/obs/recording';
const recordVideo=process.env.BATTLE_BENCH_NO_VIDEO!=='1',profile=process.env.BATTLE_BENCH_PROFILE==='1';
const scenarios=[
  {name:'hero-signature',count:1,spacing:100,hand:'both' as const},
  {name:'boss-signature',count:4,spacing:900,hand:'both' as const},
  {name:'hero-signature-victory',count:2,spacing:330,hand:'both' as const},
  {name:'boss-signature-defeat',count:4,spacing:900,hand:'both' as const},
  {name:'signature-hanon',count:64,spacing:40,hand:'both' as const},

];
for(const scenario of scenarios)test(`V5 recording: ${scenario.name} (synthetic evaluator input)`,async({browser})=>{
  test.setTimeout(60000);const id=`choreo-${crypto.randomUUID()}`,origin='http://127.0.0.1:8787',out=process.env.BATTLE_REVIEW_DIR??`../../work/v5-review${recordVideo?'':'/without-video'}`,height=Number(process.env.BATTLE_REVIEW_HEIGHT??(shortsReview?1920:750)),width=shortsReview?1080:1920;await mkdir(out,{recursive:true});
  const context=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`},viewport:{width,height},...(recordVideo?{recordVideo:{dir:out,size:{width,height}}}:{})});
  await context.addInitScript(()=>{Object.defineProperty(navigator,'requestMIDIAccess',{value:()=>{throw Error('OBS must not start MIDI');}});});
  const page=await context.newPage(),cdp=profile?await context.newCDPSession(page):undefined;
  const sourceId=crypto.randomUUID(),config={...defaultBossBattleConfig,enabled:true,multiRoundEnabled:scenario.name.startsWith('multi-'),bossDamagePerMistake:scenario.name.startsWith('multi-')?30:scenario.name==='boss-signature-defeat'?8:4};
  const ex=scenario.name==='multi-schmitt'?schmittLibrary[0]:scenario.name.startsWith('hero-signature')?{...practiceLibrary[0],polyphony:[60,64,67].map(pitch=>({pitch,beat:0,beats:1,hand:'right' as const})).concat([{pitch:72,beat:1,beats:1,hand:'right' as const}])}:practiceLibrary[0],groups=noteGroups(ex,scenario.hand),total=groups.reduce((n,g)=>n+g.pitches.length,0);
  let battle=reduceBattle(createBattle(config,total),{type:'start',attemptId:crypto.randomUUID()}),sequence=0,combo=0,live=false;const played:number[]=[];
  const publish=async()=>{const data={sourceId,claim:true,sequence:++sequence,snapshot:{exerciseNumber:ex.number,title:ex.title,hand:scenario.hand,status:'practicing',accuracy:null,mistakes:battle.mistakes,measure:1,totalMeasures:30,
    game:{sessionId:id,preview:false,settings:{...defaultGameSettings,bossBattle:config},alerts:[],live:{attemptId:battle.attemptId,sessionId:id,combo,best:combo,correct:battle.correctHits,incorrect:battle.mistakes,provisionalXP:0,status:battle.status,sequence},battle:battleView(battle)}}};
    if(page.url().includes(reviewRoute))await page.evaluate(frame=>(window as unknown as {testPublisher?:{publish:(frame:unknown)=>void}}).testPublisher?.publish(frame),{...data,updatedAt:Date.now()});
    if(!live){const r=await page.request.post('/api/obs',{headers:{origin},data});expect(r.ok(),await r.text()).toBe(true);}};
  try{
    await page.request.post('/api/platform',{headers:{origin},data:{action:'gameState'}});await publish();await page.goto(reviewRoute);
    const panel=page.getByLabel('Boss battle',{exact:true});await expect(panel.locator('[data-asset-status="ready"]')).toHaveCount(2,{timeout:15000});await expect(page.locator('[data-broadcast-ready="true"]')).toBeVisible();
    // Use the existing production direct transport, bundled into the test
    // page only. HTTP-only publication measures the slower fallback instead.
    const sender=await build({entryPoints:['hosted/obs-direct.ts'],bundle:true,write:false,format:'iife',globalName:'ReplayTransport',platform:'browser'});
    await page.addScriptTag({content:sender.outputFiles[0].text});
    await page.evaluate(sourceId=>{const w=window as unknown as {ReplayTransport:{DirectScorePublisher:new(id:string)=>unknown};testPublisher:unknown};w.testPublisher=new w.ReplayTransport.DirectScorePublisher(sourceId);},sourceId);
    await expect.poll(async()=>{await publish();return page.locator('main').getAttribute('data-score-transport');},{timeout:15000}).toBe('direct');
    live=true;
    await page.waitForTimeout(300);await page.screenshot({path:`${out}/${scenario.name}-idle.png`});
    await panel.evaluate(root=>{
      const w=window as unknown as {review:{frames:number[];contacts:number[];planned:number[];signaturePlanned:number[];gaps:number[];lags:number[];last:number;done:boolean}};w.review={frames:[],contacts:[],planned:[],signaturePlanned:[],gaps:[],lags:[],last:performance.now(),done:false};let seen='';
      const draw=(at:number)=>{w.review.frames.push(at-w.review.last);w.review.last=at;if(!w.review.done)requestAnimationFrame(draw);};requestAnimationFrame(draw);
      new MutationObserver(()=>{const impact=root.querySelector<HTMLElement>('[data-contact-at]');if(!impact||seen===impact.dataset.contactAt)return;seen=impact.dataset.contactAt!;
        // During the shared hit-stop, sample actual compositor positions.
        const hero=root.querySelector('.battle-fighter-player')!.getBoundingClientRect(),boss=root.querySelector('.battle-fighter-boss')!.getBoundingClientRect(),isHero=impact.classList.contains('battle-impact-player'),a=isHero?hero:boss,t=isHero?boss:hero;
        const actor=root.querySelector<HTMLElement>(`.battle-fighter-${isHero?'player':'boss'}`)!;
        if(actor.dataset.signature==='true')w.review.signaturePlanned.push(Number(actor.dataset.contactError??0));
        if(isHero)w.review.gaps.push(Number(actor.dataset.bodySeparation??0));w.review.planned.push(Number(actor.dataset.contactError??0));w.review.lags.push(Date.now()-Number(impact.dataset.contactAt));
        w.review.contacts.push(Math.hypot(a.x+a.width*Number(actor.dataset.weaponX)-t.x-t.width*Number(actor.dataset.targetX),a.y+a.height*Number(actor.dataset.weaponY)-t.y-t.height*Number(actor.dataset.targetY)));
      }).observe(root,{subtree:true,childList:true,attributes:true});
    });
    const recorder=new BattleTraceRecorder();recorder.arm();recorder.start({number:ex.number,title:ex.title!},battle,0);
    if(cdp){await cdp.send('Performance.enable');await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}
    const start=performance.now();let correct=0,incorrect=0;
    for(let i=0;i<scenario.count;i++){
      const due=start+i*scenario.spacing;if(performance.now()<due)await new Promise(r=>setTimeout(r,due-performance.now()));
      const mistake=scenario.name.startsWith('boss-signature')||(scenario.name==='multi-ending'&&i===0)||(scenario.name==='multi-hanon'&&i%16===8)||(scenario.name==='multi-schmitt'&&i===4)||(scenario.name==='multi-mixed'&&i%9===3);
      if(mistake){played.push(1);incorrect++;}else{played.push(...groups[correct++].pitches);}
      const evaluated=evaluateGame(ex,scenario.hand,played,{playerId:id,sessionId:id,attemptId:battle.scoringAttemptId,timestamp:Date.now()});combo=evaluated.combo+(scenario.name.startsWith('hero-signature')?30:0);
      battle=reduceBattle(battle,{type:'evaluate',attemptId:battle.scoringAttemptId,events:evaluated.events});recorder.capture(battle,combo,evaluated.events);await publish();
    }
    const terminal=['victory','defeat'].includes(battle.status);await page.waitForTimeout(terminal?700:1600);
    await expect(panel.getByRole('progressbar',{name:'boss HP'})).toHaveAttribute('aria-valuenow',String(battle.bossHp));
    await expect(panel.getByRole('progressbar',{name:'player HP'})).toHaveAttribute('aria-valuenow',String(battle.playerHp));
    if(terminal){
      await expect(page.locator('.battle-cinematic')).toHaveAttribute('data-result',battle.status);
      await expect(panel.locator('.battle-outcome')).toHaveCount(0);
    }
    if(cdp){await writeFile(`${out}/${scenario.name}.cpuprofile`,JSON.stringify((await cdp.send('Profiler.stop')).profile));console.log('Browser CPU',await cdp.send('Performance.getMetrics'));}
    const metrics=JSON.parse((await panel.getAttribute('data-combat-metrics'))!);
    expect(metrics.damageEvents).toBe(battle.revision);expect(metrics.maxQueue).toBeLessThanOrEqual(6);expect(metrics.maxLatencyMs).toBeLessThan(750);
    const browserStats=await page.evaluate(()=>{const w=window as unknown as {review:{frames:number[];contacts:number[];planned:number[];signaturePlanned:number[];gaps:number[];lags:number[];done:boolean}};w.review.done=true;const frames=w.review.frames.slice(2).sort((a,b)=>a-b);return {frameP95Ms:frames[Math.floor(frames.length*.95)],worstFrameMs:frames.at(-1),contactErrorMaxPx:Math.max(...w.review.contacts),contactSamples:w.review.contacts.length,plannedErrorMaxPx:Math.max(...w.review.planned),signaturePlannedErrorMaxPx:Math.max(0,...w.review.signaturePlanned),minimumHeroBodyGapPx:Math.min(0,...w.review.gaps),contactTimerLagMs:Math.max(...w.review.lags),scrollbars:document.documentElement.scrollHeight>innerHeight||document.documentElement.scrollWidth>innerWidth};});
    expect(browserStats.scrollbars).toBe(false);expect(browserStats.minimumHeroBodyGapPx).toBeGreaterThanOrEqual(-.01);
    await writeFile(`${out}/${scenario.name}-contact-check.json`,JSON.stringify(browserStats,null,2));
    // At 1080 high the unchanged enlarged hero uses nearly the full width.
    // Clamping a returning ordinary opponent can leave <3 px (under 1% of
    // arena width) instead of clipping artwork. Showcase contacts stay <1 px.
    expect(browserStats.plannedErrorMaxPx).toBeLessThan(height>750?3:1);
    expect(browserStats.signaturePlannedErrorMaxPx).toBeLessThan(1);
    if(scenario.name==='signature-hanon')expect(await panel.evaluate(()=> (window as unknown as {review:{signaturePlanned:number[]}}).review.signaturePlanned.length)).toBeGreaterThan(0);
    expect(browserStats.contactErrorMaxPx).toBeLessThan(25);
    const trace=recorder.stop()!;trace.provenance='synthetic';
    await writeFile(`${out}/${scenario.name}-trace.json`,JSON.stringify(trace));
    const report={scenario,recordVideo,source:'Synthetic inputs through the existing evaluator: Hanon No. 1, Schmitt No. 1, and a three-note chord signature fixture; browser capture, not physical MIDI or OBS app',metrics,browserStats,deterministicReplay:measureBattleTrace(trace),finalHp:{player:battle.playerHp,boss:battle.bossHp},round:battle.round,roundWins:battle.roundWins,roundLosses:battle.roundLosses,incorrect};
    await writeFile(`${out}/${scenario.name}-metrics.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({scenario:scenario.name,...metrics,...browserStats}));
    if(config.multiRoundEnabled){expect(battle.roundLosses).toBeGreaterThan(0);await expect(panel.locator('.battle-round-counter')).toContainText(`ROUND ${battle.round!.number}`);}
    await page.screenshot({path:`${out}/${scenario.name}-end.png`});await page.waitForTimeout(terminal?2500:400);
    if(scenario.name==='multi-hanon'){
      live=false;await publish();await page.reload();await expect(panel.locator('.battle-round-counter')).toContainText(`ROUND ${battle.round!.number}`);
      await expect(panel.getByRole('progressbar',{name:'boss HP'})).toHaveAttribute('aria-valuenow',String(battle.bossHp));await expect(panel.locator('.battle-outcome,.battle-finisher')).toHaveCount(0);
    }
  }finally{await context.close();if(recordVideo)await page.video()!.saveAs(`${out}/${scenario.name}.webm`);}
});

test('V9 migrates saved multi-round preferences without changing difficulty or XP',async({page})=>{
 const id=`v9-legacy-${crypto.randomUUID()}`,origin='http://127.0.0.1:8787';
 await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
 const command=(data:object)=>page.request.post('/api/platform',{headers:{origin},data}).then(r=>r.json());
 const before=await command({action:'gameState'});
 await command({action:'gameSettings',settings:{...defaultGameSettings,bossBattle:{...defaultBossBattleConfig,enabled:true,multiRoundEnabled:true,bossDamagePerMistake:30}}});
 const after=await command({action:'gameState'});
 expect(after.settings.bossBattle).toMatchObject({multiRoundEnabled:false,gameMode:'survival',bossDamagePerMistake:30});
 expect(after.xp).toBe(before.xp);expect(after.unlocks).toEqual(before.unlocks);
 await page.goto('/student/practice');await page.getByText('Progression & recording controls',{exact:true}).click();
 await expect(page.getByLabel('Continue into new rounds')).toHaveCount(0);await expect(page.getByLabel('Game mode',{exact:true})).toHaveValue('survival');
});
