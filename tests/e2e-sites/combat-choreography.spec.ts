import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {practiceLibrary} from '../../hosted/practice-library';
import {noteGroups} from '../../hosted/sight-library';
import {createBattle,reduceBattle,battleView} from '../../hosted/boss-battle';
import {defaultBossBattleConfig} from '../../hosted/boss-config';
import {defaultGameSettings,evaluateGame} from '../../hosted/game-core';
import {BattleTraceRecorder,measureBattleTrace} from '../../hosted/battle-replay';
import {installMidiKeyboard} from './helpers/midi';
import {build} from 'esbuild';

const scenarios=[
  {name:'slow',count:6,spacing:650,hand:'right' as const},
  {name:'moderate',count:24,spacing:250,hand:'right' as const},
  {name:'fast-hanon',count:64,spacing:62.5,hand:'right' as const},
  {name:'two-handed-hanon',count:64,spacing:62.5,hand:'both' as const},
  {name:'mixed',count:24,spacing:80,hand:'both' as const},
  {name:'victory',count:8,spacing:30,hand:'both' as const},
  {name:'defeat',count:8,spacing:30,hand:'both' as const},
];
for(const scenario of scenarios)test(`recording choreography: ${scenario.name} (synthetic evaluator input)`,async({browser})=>{
  test.setTimeout(60000);const id=`choreo-${crypto.randomUUID()}`,origin='http://127.0.0.1:8787',out='../../work/choreography-review';await mkdir(out,{recursive:true});
  const context=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`},viewport:{width:1920,height:750},recordVideo:{dir:out,size:{width:1920,height:750}}});
  const page=await context.newPage(),sourceId=crypto.randomUUID(),config={...defaultBossBattleConfig,enabled:true};
  const ex=practiceLibrary[0],groups=noteGroups(ex,scenario.hand),total=scenario.name==='victory'?12:groups.reduce((n,g)=>n+g.pitches.length,0);
  let battle=reduceBattle(createBattle(config,total),{type:'start',attemptId:crypto.randomUUID()}),sequence=0,combo=0,live=false;const played:number[]=[];
  const publish=async()=>{const data={sourceId,claim:true,sequence:++sequence,snapshot:{exerciseNumber:ex.number,title:ex.title,hand:scenario.hand,status:'practicing',accuracy:null,mistakes:battle.mistakes,measure:1,totalMeasures:30,
    game:{sessionId:id,preview:false,settings:{...defaultGameSettings,bossBattle:config},alerts:[],live:{attemptId:battle.attemptId,sessionId:id,combo,best:combo,correct:battle.correctHits,incorrect:battle.mistakes,provisionalXP:0,status:battle.status,sequence},battle:battleView(battle)}}};
    if(page.url().includes('/obs/recording'))await page.evaluate(frame=>(window as unknown as {testPublisher?:{publish:(frame:unknown)=>void}}).testPublisher?.publish(frame),{...data,updatedAt:Date.now()});
    if(!live){const r=await page.request.post('/api/obs',{headers:{origin},data});expect(r.ok(),await r.text()).toBe(true);}};
  try{
    await page.request.post('/api/platform',{headers:{origin},data:{action:'gameState'}});await publish();await page.goto('/obs/recording');
    const panel=page.getByLabel('Boss battle',{exact:true});await expect(panel.locator('[data-asset-status="ready"]')).toHaveCount(2);await expect(page.locator('[data-broadcast-ready="true"]')).toBeVisible();
    // Use the existing production direct transport, bundled into the test
    // page only. HTTP-only publication measures the slower fallback instead.
    const sender=await build({entryPoints:['hosted/obs-direct.ts'],bundle:true,write:false,format:'iife',globalName:'ReplayTransport',platform:'browser'});
    await page.addScriptTag({content:sender.outputFiles[0].text});
    await page.evaluate(sourceId=>{const w=window as unknown as {ReplayTransport:{DirectScorePublisher:new(id:string)=>unknown};testPublisher:unknown};w.testPublisher=new w.ReplayTransport.DirectScorePublisher(sourceId);},sourceId);
    await expect.poll(async()=>{await publish();return page.locator('main').getAttribute('data-score-transport');},{timeout:15000}).toBe('direct');
    live=true;
    await page.waitForTimeout(300);await page.screenshot({path:`${out}/${scenario.name}-idle.png`});
    await panel.evaluate(root=>{
      const w=window as unknown as {review:{frames:number[];contacts:number[];planned:number[];lags:number[];last:number;done:boolean}};w.review={frames:[],contacts:[],planned:[],lags:[],last:performance.now(),done:false};let seen='';
      const draw=(at:number)=>{w.review.frames.push(at-w.review.last);w.review.last=at;if(!w.review.done)requestAnimationFrame(draw);};requestAnimationFrame(draw);
      new MutationObserver(()=>{const impact=root.querySelector<HTMLElement>('[data-contact-at]');if(!impact||seen===impact.dataset.contactAt)return;seen=impact.dataset.contactAt!;
        // During the shared hit-stop, sample actual compositor positions.
        const hero=root.querySelector('.battle-fighter-player')!.getBoundingClientRect(),boss=root.querySelector('.battle-fighter-boss')!.getBoundingClientRect(),isHero=impact.classList.contains('battle-impact-player'),a=isHero?hero:boss,t=isHero?boss:hero;
        w.review.planned.push(Number(root.querySelector<HTMLElement>(`.battle-fighter-${isHero?'player':'boss'}`)?.dataset.contactError??0));w.review.lags.push(Date.now()-Number(impact.dataset.contactAt));
        w.review.contacts.push(Math.hypot(a.x+a.width*(isHero?.86:.43)-t.x-t.width*(isHero?.76:.49),a.y+a.height*(isHero?.47:.48)-t.y-t.height*(isHero?.38:.57)));
      }).observe(root,{subtree:true,childList:true,attributes:true});
    });
    const recorder=new BattleTraceRecorder();recorder.arm();recorder.start({number:ex.number,title:ex.title!},battle,0);
    const start=performance.now();let correct=0,incorrect=0;
    for(let i=0;i<scenario.count;i++){
      const due=start+i*scenario.spacing;if(performance.now()<due)await new Promise(r=>setTimeout(r,due-performance.now()));
      const mistake=scenario.name==='defeat'||(scenario.name==='mixed'&&i%7===4);
      if(mistake){played.push(1);incorrect++;}else{played.push(...groups[correct++].pitches);}
      const evaluated=evaluateGame(ex,scenario.hand,played,{playerId:id,sessionId:id,attemptId:battle.scoringAttemptId,timestamp:Date.now()});combo=evaluated.combo;
      battle=reduceBattle(battle,{type:'evaluate',attemptId:battle.scoringAttemptId,events:evaluated.events});recorder.capture(battle,combo,evaluated.events);await publish();
    }
    const terminal=['victory','defeat'].includes(battle.status);await page.waitForTimeout(terminal?700:1200);
    await expect(panel.getByRole('progressbar',{name:'boss HP'})).toHaveAttribute('aria-valuenow',String(battle.bossHp));
    await expect(panel.getByRole('progressbar',{name:'player HP'})).toHaveAttribute('aria-valuenow',String(battle.playerHp));
    if(terminal)await expect(panel.locator('.battle-outcome')).toBeVisible();
    const metrics=JSON.parse((await panel.getAttribute('data-combat-metrics'))!);
    expect(metrics.damageEvents).toBe(battle.revision);expect(metrics.maxQueue).toBeLessThanOrEqual(6);expect(metrics.maxLatencyMs).toBeLessThan(750);
    const browserStats=await page.evaluate(()=>{const w=window as unknown as {review:{frames:number[];contacts:number[];planned:number[];lags:number[];done:boolean}};w.review.done=true;const frames=w.review.frames.slice(2).sort((a,b)=>a-b);return {frameP95Ms:frames[Math.floor(frames.length*.95)],worstFrameMs:frames.at(-1),contactErrorMaxPx:Math.max(...w.review.contacts),contactSamples:w.review.contacts.length,plannedErrorMaxPx:Math.max(...w.review.planned),contactTimerLagMs:Math.max(...w.review.lags),scrollbars:document.documentElement.scrollHeight>innerHeight||document.documentElement.scrollWidth>innerWidth};});
    expect(browserStats.scrollbars).toBe(false);
    expect(browserStats.plannedErrorMaxPx).toBeLessThan(1);
    expect(browserStats.contactErrorMaxPx).toBeLessThan(25);
    const trace=recorder.stop()!;trace.provenance='synthetic';
    await writeFile(`${out}/${scenario.name}-trace.json`,JSON.stringify(trace));
    const report={scenario,source:'Synthetic inputs evaluated against the actual Hanon No. 1 score; browser recording, not an OBS application capture',metrics,browserStats,deterministicReplay:measureBattleTrace(trace),finalHp:{player:battle.playerHp,boss:battle.bossHp},incorrect};
    await writeFile(`${out}/${scenario.name}-metrics.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({scenario:scenario.name,...metrics,...browserStats}));
    await page.screenshot({path:`${out}/${scenario.name}-end.png`});await page.waitForTimeout(terminal?2500:400);
  }finally{await context.close();await page.video()!.saveAs(`${out}/${scenario.name}.webm`);}
});

test('opt-in evaluator capture downloads and replays without changing durable progress',async({page})=>{
  test.setTimeout(60000);const id=`capture-${crypto.randomUUID()}`;await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  await installMidiKeyboard(page);await page.goto('/student/practice?collection=hanon&exercise=1001&battleDebug=1');
  const controls=page.getByRole('region',{name:'Pianist progression'});await expect(controls.getByText('Connecting progression…')).toHaveCount(0);
  await controls.getByText('Progression & recording controls',{exact:true}).click();await controls.getByLabel('Boss Battle Mode',{exact:true}).check();await page.getByText('Character animation library',{exact:true}).click();
  const replay=page.getByRole('region',{name:'Recorded combat replay'});await replay.getByRole('button',{name:'Record next practice'}).click();
  await page.getByRole('button',{name:'Connect keyboard',exact:true}).click();await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
  const pitches=noteGroups(practiceLibrary[0],'both').slice(0,8).flatMap(g=>g.pitches);
  await page.evaluate(pitches=>{(window as unknown as {sendMidi:(m:number[][])=>void}).sendMidi(pitches.flatMap(p=>[[0x90,p,90],[0x80,p,0]]));},pitches);
  const downloadPromise=page.waitForEvent('download');await replay.getByRole('button',{name:'Stop & download recording'}).click();const download=await downloadPromise;await download.saveAs('../../work/choreography-review/capture-smoke.json');
  const snapshot=()=>page.request.post('/api/platform',{headers:{origin:'http://127.0.0.1:8787'},data:{action:'gameState'}}).then(r=>r.json());
  await page.waitForTimeout(1500);const before=await snapshot();await replay.getByRole('button',{name:'Replay recording',exact:true}).click();await page.waitForTimeout(1500);const after=await snapshot();expect(after.xp).toBe(before.xp);expect(after.unlocks).toEqual(before.unlocks);
});
