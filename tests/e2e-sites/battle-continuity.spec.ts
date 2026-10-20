import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {battleAnimationLibrary} from '../../hosted/battle-animation-library';
import {build} from 'esbuild';
import {practiceLibrary} from '../../hosted/practice-library';
import {noteGroups} from '../../hosted/sight-library';
import {createBattle,reduceBattle,battleView} from '../../hosted/boss-battle';
import {defaultBossBattleConfig} from '../../hosted/boss-config';
import {defaultGameSettings,evaluateGame} from '../../hosted/game-core';
test('real registry inspector steps every clip and pauses, loops and transitions without game events',async({page})=>{
 test.setTimeout(180000);
 const id=`continuity-${crypto.randomUUID()}`;
 await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/student/sight-read?battleDebug=1');
 const controls=page.getByRole('region',{name:'Pianist progression'});
 await expect(controls.getByText('Connecting progression…')).toHaveCount(0);
 await controls.getByText('Progression & recording controls',{exact:true}).click();
 await controls.getByText('Character animation library',{exact:true}).click();
 const game=()=>page.request.post('/api/platform',{headers:{origin:'http://127.0.0.1:8787'},data:{action:'gameState'}}).then(r=>r.json());
 const before=await game(),inspector=page.getByRole('region',{name:'Pose continuity inspector'}),sprite=inspector.locator('canvas');
 for(const clip of battleAnimationLibrary){
  await page.getByLabel('Preview character').selectOption(clip.characterId);
  await page.getByLabel('Preview action category').selectOption(clip.category);
  await page.getByLabel('Preview animation variant').selectOption(clip.id);
  await expect(inspector.locator('[data-animation-id]')).toHaveAttribute('data-asset-status','ready');
  await expect(sprite).toHaveAttribute('data-sprite-frame','0');
  await inspector.getByRole('button',{name:'Next pose',exact:true}).click();
  await expect(sprite).toHaveAttribute('data-sprite-frame','1');
  await inspector.getByRole('button',{name:'Previous pose',exact:true}).click();
  await expect(sprite).toHaveAttribute('data-sprite-frame','0');
 }
 await page.getByLabel('Preview character').selectOption('piano_blade_warrior');
 await page.getByLabel('Preview action category').selectOption('lightAttack');
 await page.getByLabel('Preview animation variant').selectOption('hero_attack_light_slash_01');
 await inspector.getByLabel('Playback speed').selectOption('0.5');
 await inspector.getByLabel('Loop preview').check();
 await inspector.getByRole('button',{name:'Play from start'}).click();
 await page.waitForTimeout(700);
 await inspector.getByRole('button',{name:'Pause poses'}).click();
 const paused=await sprite.getAttribute('data-sprite-frame');await page.waitForTimeout(150);
 await expect(sprite).toHaveAttribute('data-sprite-frame',paused!);
 await inspector.getByLabel('Then transition to').selectOption('hero_idle_01');
 await inspector.getByLabel('Loop preview').uncheck();
 await inspector.getByLabel('Playback speed').selectOption('1');
 await inspector.getByRole('button',{name:'Play from start'}).click();
 await expect(inspector.locator('[data-animation-id]')).toHaveAttribute('data-animation-id','hero_idle_01');
 await inspector.getByRole('button',{name:'Pause poses'}).click();
 await mkdir('../../work/continuity-reference/browser',{recursive:true});
 await inspector.screenshot({path:'../../work/continuity-reference/browser/inspector.png'});
 const after=await game();expect(after.xp).toBe(before.xp);expect(after.best).toBe(before.best);expect(errors).toEqual([]);
});

for(const [name,count,spacing] of [['single',1,650],['moderate',24,250],['fast-hanon',64,62.5]] as const)
test(`refined poses preserve evaluation and bounded rendering during ${name} notes`,async({browser})=>{
 const out='../../work/continuity-reference/browser',id=`cont-${crypto.randomUUID()}`,sourceId=crypto.randomUUID();
 await mkdir(out,{recursive:true});
 const context=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`},
   viewport:{width:1920,height:750},recordVideo:{dir:out,size:{width:1920,height:750}}});
 const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const config={...defaultBossBattleConfig,enabled:true},ex=practiceLibrary[0],groups=noteGroups(ex,'both');
 let state=reduceBattle(createBattle(config,1000),{type:'start',attemptId:id}),sequence=0,combo=0,direct=false;
 const publish=async()=>{
  const data={sourceId,claim:true,sequence:++sequence,snapshot:{exerciseNumber:ex.number,title:ex.title,hand:'both',status:'practicing',accuracy:null,mistakes:0,measure:1,totalMeasures:30,
   game:{sessionId:id,preview:false,settings:{...defaultGameSettings,bossBattle:config},alerts:[],live:{attemptId:id,sessionId:id,combo,best:combo,correct:state.correctHits,incorrect:0,provisionalXP:0,status:state.status,sequence},battle:battleView(state)}}};
  if(direct)await page.evaluate(frame=>(window as unknown as {continuityPublisher:{publish:(f:unknown)=>void}}).continuityPublisher.publish(frame),{...data,updatedAt:Date.now()});
  else {const response=await page.request.post('/api/obs',{headers:{origin:'http://127.0.0.1:8787'},data});expect(response.ok(),await response.text()).toBe(true);}
 };
 try{
  await page.request.post('/api/platform',{headers:{origin:'http://127.0.0.1:8787'},data:{action:'gameState'}});
  await publish();await page.goto('/obs/recording');
  const panel=page.getByLabel('Boss battle',{exact:true});
  await expect(panel.locator('[data-asset-status=ready]')).toHaveCount(2);
  const sender=await build({entryPoints:['hosted/obs-direct.ts'],bundle:true,write:false,format:'iife',globalName:'ContinuityTransport',platform:'browser'});
  await page.addScriptTag({content:sender.outputFiles[0].text});
  await page.evaluate(sourceId=>{
   const w=window as unknown as {ContinuityTransport:{DirectScorePublisher:new(id:string)=>unknown};continuityPublisher:unknown};
   w.continuityPublisher=new w.ContinuityTransport.DirectScorePublisher(sourceId);
  },sourceId);
  direct=true;
  await expect.poll(async()=>{await publish();return page.locator('main').getAttribute('data-score-transport');}).toBe('direct');
  await page.evaluate(()=>{
   const w=window as unknown as {continuityFrames:number[];continuityDone:boolean};w.continuityFrames=[];w.continuityDone=false;
   let last=performance.now();const frame=(t:number)=>{w.continuityFrames.push(t-last);last=t;if(!w.continuityDone)requestAnimationFrame(frame);};requestAnimationFrame(frame);
  });
  const played:number[]=[],start=performance.now();
  for(let n=0;n<count;n++){
   const due=start+n*spacing;if(due>performance.now())await new Promise(r=>setTimeout(r,due-performance.now()));
   played.push(...groups[n].pitches);
   const evaluation=evaluateGame(ex,'both',played,{playerId:id,sessionId:id,attemptId:state.scoringAttemptId,timestamp:Date.now()});
   combo=evaluation.combo;state=reduceBattle(state,{type:'evaluate',attemptId:state.scoringAttemptId,events:evaluation.events});
   await publish();
  }
  await page.waitForTimeout(1500);
  await expect(panel.getByRole('progressbar',{name:'boss HP'})).toHaveAttribute('aria-valuenow',String(state.bossHp));
  const metrics=JSON.parse((await panel.getAttribute('data-combat-metrics'))!);
  expect(metrics.damageEvents).toBe(state.revision);expect(metrics.maxQueue).toBeLessThanOrEqual(6);expect(metrics.maxLatencyMs).toBeLessThan(750);
  const frames=await page.evaluate(()=>{
   const w=window as unknown as {continuityFrames:number[];continuityDone:boolean};w.continuityDone=true;
   return w.continuityFrames.slice(2).sort((a,b)=>a-b);
  });
  await writeFile(`${out}/${name}-metrics.json`,JSON.stringify({metrics,frameMedianMs:frames[Math.floor(frames.length*.5)],frameP95Ms:frames[Math.floor(frames.length*.95)],source:'Synthetic Hanon evaluation; actual browser renderer; not native OBS'},null,2));
  await page.screenshot({path:`${out}/${name}-end.png`});expect(errors).toEqual([]);
 }finally{await context.close();await page.video()!.saveAs(`${out}/${name}.webm`);}
});
