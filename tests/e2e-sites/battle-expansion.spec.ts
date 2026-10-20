import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {battleView,createBattle,type BattleView} from '../../hosted/boss-battle';
import {defaultBossBattleConfig} from '../../hosted/boss-config';
import {defaultGameSettings} from '../../hosted/game-core';
import {animationById,battleAnimationLibrary} from '../../hosted/battle-animation-library';
const out='../../work/expanded-sprites/browser';

test('every expanded clip loads in the existing preview without affecting progress',async({page})=>{
 test.setTimeout(90000);await mkdir(out,{recursive:true});
 const id=`expanded-preview-${crypto.randomUUID()}`;await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/student/sight-read');const controls=page.getByRole('region',{name:'Pianist progression'});
 await expect(controls.getByText('Connecting progression…')).toHaveCount(0);
 await controls.getByText('Progression & recording controls',{exact:true}).click();
 await controls.getByText('Character animation library',{exact:true}).click();
 const before=await page.request.post('/api/platform',{headers:{origin:'http://127.0.0.1:8787'},data:{action:'gameState'}}).then(r=>r.json());
 const preview=page.getByLabel('Animation preview',{exact:true});
 for(const clip of battleAnimationLibrary.filter(c=>c.tags.includes('expanded'))){
  await page.getByLabel('Preview character').selectOption(clip.characterId);
  await page.getByLabel('Preview action category').selectOption(clip.category);
  await page.getByLabel('Preview animation variant').selectOption(clip.id);
  await expect(preview.locator('[data-animation-id]')).toHaveAttribute('data-animation-id',clip.id);
  await expect(preview.locator('[data-animation-id]')).toHaveAttribute('data-asset-status','ready');
  if(['hero_expression_surprised','boss_idle_laughter_03','grinwick_idle_applause_03'].includes(clip.id)){
   await page.waitForTimeout(300);await preview.screenshot({path:`${out}/${clip.id}.png`});
  }
 }
 const after=await page.request.post('/api/platform',{headers:{origin:'http://127.0.0.1:8787'},data:{action:'gameState'}}).then(r=>r.json());
 expect(after.xp).toBe(before.xp);expect(after.best).toBe(before.best);expect(errors).toEqual([]);
});

for(const bossId of ['crimson_musical_colossus','grinwick'] as const)test(`expanded contact poses in horizontal and vertical OBS: ${bossId}`,async({browser})=>{
 test.setTimeout(120000);await mkdir(out,{recursive:true});
 const id=`expanded-obs-${crypto.randomUUID()}`,sourceId=crypto.randomUUID(),origin='http://127.0.0.1:8787';
 const context=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`}});
 const horizontal=await context.newPage(),vertical=await context.newPage(),pages=[horizontal,vertical],errors:string[]=[];
 for(const p of pages)p.on('pageerror',e=>errors.push(e.message));
 await horizontal.setViewportSize({width:1920,height:750});await vertical.setViewportSize({width:1080,height:1920});
 const config={...defaultBossBattleConfig,enabled:true,bossId,animationSpeed:1};
 let b:BattleView={...battleView(createBattle(config,1000)),attemptId:id,status:'active'},sequence=0,direct=false;
 const publish=async()=>{const data={sourceId,claim:true,sequence:++sequence,snapshot:{exerciseNumber:7001,title:'Two-Note Footsteps',hand:'both',status:'practicing',accuracy:null,mistakes:b.mistakes,measure:1,totalMeasures:4,
  game:{sessionId:id,preview:false,settings:{...defaultGameSettings,bossBattle:config},alerts:[],live:{attemptId:id,sessionId:id,combo:b.correctHits,best:b.correctHits,correct:b.correctHits,incorrect:b.mistakes,provisionalXP:0,status:b.status,sequence},battle:b}}};
  if(direct)await horizontal.evaluate(frame=>(window as unknown as {testPublisher:{publish:(f:unknown)=>void}}).testPublisher.publish(frame),{...data,updatedAt:await horizontal.evaluate(()=>Date.now())});
  else{const r=await horizontal.request.post('/api/obs',{headers:{origin},data});expect(r.ok(),await r.text()).toBe(true);}
 };
 try{
  await horizontal.request.post('/api/platform',{headers:{origin},data:{action:'gameState'}});await publish();
  await horizontal.goto('/obs/recording');await vertical.goto('/obs/shorts');
  for(const p of pages){await expect(p.locator('.battle-character[data-asset-status=ready]')).toHaveCount(2,{timeout:15000});}
  const sender=await build({entryPoints:['hosted/obs-direct.ts'],bundle:true,write:false,format:'iife',globalName:'ExpansionTransport',platform:'browser'});
  await horizontal.addScriptTag({content:sender.outputFiles[0].text});
  await horizontal.evaluate(sourceId=>{const w=window as unknown as {ExpansionTransport:{DirectScorePublisher:new(id:string)=>unknown};testPublisher:unknown};w.testPublisher=new w.ExpansionTransport.DirectScorePublisher(sourceId);},sourceId);
  direct=true;await expect.poll(async()=>{await publish();return horizontal.locator('main').getAttribute('data-score-transport');}).toBe('direct');
  await expect(vertical.locator('main')).toHaveAttribute('data-score-transport','direct');
  await horizontal.screenshot({path:`${out}/${bossId}-horizontal-idle.png`});await vertical.screenshot({path:`${out}/${bossId}-vertical-idle.png`});
  for(const p of pages)await p.evaluate(()=>{
   // Freeze each newly created native movement before its real wall clock can
   // finish while the test advances the independently controlled JS clock.
   new MutationObserver(()=>{
    for(const node of document.querySelectorAll('.battle-fighter,.battle-ground-shadow'))for(const a of node.getAnimations())
     if(a.playState==='running')a.pause();
   }).observe(document.querySelector('.battle-stage')!,{subtree:true,childList:true,attributes:true});
  });
  const clockAt=Date.now()+1000;
  await Promise.all(pages.map(async p=>{await p.clock.install({time:clockAt});await p.clock.pauseAt(clockAt+1000);}));
  const advance=async(ms:number)=>{await Promise.all(pages.map(p=>p.clock.runFor(ms)));};
  const metrics=[];
  for(const side of ['player','boss'] as const)for(let n=0;n<3;n++){
   const now=await horizontal.evaluate(()=>Date.now()),revision=b.revision+1;
   b={...b,revision,lastAt:now,lastAction:side,correctHits:b.correctHits+(side==='player'?1:0),mistakes:b.mistakes+(side==='boss'?1:0),bossHp:b.bossHp-(side==='player'?1:0),playerHp:b.playerHp-(side==='boss'?4:0)};
   b.combatCues=[...(b.combatCues??[]),{revision,at:now,side,outcome:side==='player'?'correct':'incorrect',playerHp:b.playerHp,bossHp:b.bossHp,damage:side==='player'?1:4}];
   await publish();await advance(32);
   const actor=horizontal.locator(`.battle-fighter-${side} [data-animation-id]`),clipId=await actor.getAttribute('data-animation-id'),clip=animationById(clipId!)!;
   expect(clip.contact,clipId!).toBeDefined();
   // Read phase at delivery; contactInMs is a render-time snapshot, not a live countdown.
   for(let elapsed=0;elapsed<400 && await horizontal.getByLabel('Boss battle',{exact:true}).getAttribute('data-phase')!=='contact';elapsed++)await advance(1);
   await expect(horizontal.getByLabel('Boss battle',{exact:true})).toHaveAttribute('data-phase','contact');
   await advance(16);
   for(const [layout,p] of [['horizontal',horizontal],['vertical',vertical]] as const){
    // Playwright's JS clock freezes the actual contact drawing; explicitly
    // scrub the native compositor to that same authored instant for inspection.
    await p.evaluate(({side,at})=>{
     for(const a of document.getAnimations())a.pause();
     for(const a of document.querySelector(`.battle-fighter-${side}`)!.getAnimations())a.currentTime=at;
     for(const a of document.querySelector(`.battle-ground-shadow-${side}`)!.getAnimations())a.currentTime=at;
     const target=side==='player'?'boss':'player';
     for(const a of document.querySelector(`.battle-fighter-${target}`)!.getAnimations())a.currentTime=0;
     for(const a of document.querySelector(`.battle-ground-shadow-${target}`)!.getAnimations())a.currentTime=0;
    },{side,at:clip.contact!.impactTimeMs});
    await expect(p.locator(`.battle-fighter-${side} [data-animation-id]`)).toHaveAttribute('data-animation-id',clipId!);
    await expect(p.locator(`.battle-fighter-${side} canvas`)).toHaveAttribute('data-sprite-frame',String(clip.contact!.impactFrame));
    const error=Number(await p.locator(`.battle-fighter-${side}`).getAttribute('data-contact-error'));
    expect(error,`${layout} ${clipId}`).toBeLessThan(1);
    const actual=await p.evaluate(side=>{
     const a=document.querySelector<HTMLElement>(`.battle-fighter-${side}`)!,d=document.querySelector<HTMLElement>(`.battle-fighter-${side==='player'?'boss':'player'}`)!;
     const ar=a.getBoundingClientRect(),dr=d.getBoundingClientRect();
     return Math.hypot(ar.x+ar.width*Number(a.dataset.weaponX)-dr.x-dr.width*Number(a.dataset.targetX),ar.y+ar.height*Number(a.dataset.weaponY)-dr.y-dr.height*Number(a.dataset.targetY));
    },side);
    if(actual>=3){
     const diagnostic=await p.evaluate(()=>Array.from(document.querySelectorAll<HTMLElement>('.battle-fighter')).map(n=>({
      side:n.className,data:{...n.dataset},transform:getComputedStyle(n).transform,rect:n.getBoundingClientRect().toJSON(),
      animations:n.getAnimations().map(a=>({time:a.currentTime,state:a.playState,timing:a.effect!.getTiming(),frames:(a.effect as KeyframeEffect).getKeyframes()})),
     })));
     console.log(JSON.stringify(diagnostic));
    }
    expect(actual,`${layout} ${clipId} compositor contact`).toBeLessThan(3);
    await p.screenshot({path:`${out}/${bossId}-${layout}-${side}-${n+1}.png`});
    metrics.push({layout,clip:clipId,error,actual,frame:await p.locator(`.battle-fighter-${side} canvas`).getAttribute('data-sprite-frame'),impactFrame:clip.contact!.impactFrame});
   }
   for(const p of pages)await p.evaluate(()=>{for(const node of document.querySelectorAll('.battle-fighter,.battle-ground-shadow'))for(const a of node.getAnimations())a.finish();});
   await advance(900);
  }
  const hp=JSON.parse((await horizontal.getByLabel('Boss battle',{exact:true}).getAttribute('data-combat-metrics'))!);
  expect(hp.authoritativeHp).toEqual({player:b.playerHp,boss:b.bossHp});
  await writeFile(`${out}/${bossId}-contacts.json`,JSON.stringify(metrics,null,2));expect(errors).toEqual([]);
 }finally{await context.close();}
});
