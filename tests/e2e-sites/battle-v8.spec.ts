import {test,expect} from '@playwright/test';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {battleView,createBattle} from '../../hosted/boss-battle';
import {defaultBossBattleConfig} from '../../hosted/boss-config';
import {defaultGameSettings} from '../../hosted/game-core';

test('V8 same-viewport pose comparison retains body scale and foot registration',async({page})=>{
  test.setTimeout(90000);const out='../../work/v8-review/poses',id=`scale-${crypto.randomUUID()}`;await mkdir(out,{recursive:true});
  await page.setViewportSize({width:1920,height:750});
  await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  const config={...defaultBossBattleConfig,enabled:true},battle={...battleView(createBattle(config,66)),status:'active',attemptId:id};
  await page.request.post('/api/platform',{headers:{origin:'http://127.0.0.1:8787'},data:{action:'gameState'}});
  const response=await page.request.post('/api/obs',{headers:{origin:'http://127.0.0.1:8787'},data:{sourceId:crypto.randomUUID(),claim:true,sequence:1,snapshot:{exerciseNumber:2001,title:'Schmitt Op. 16 · Exercise 1',hand:'both',status:'practicing',accuracy:null,mistakes:0,measure:1,totalMeasures:3,game:{sessionId:id,preview:false,settings:{...defaultGameSettings,bossBattle:config},alerts:[],live:{attemptId:id,sessionId:id,combo:0,best:0,correct:0,incorrect:0,provisionalXP:0,status:'active',sequence:1},battle}}}});
  expect(response.ok(),await response.text()).toBe(true);
  await page.goto('/obs/recording');await expect(page.locator('[data-asset-status="ready"]')).toHaveCount(2,{timeout:15000});await expect(page.locator('[data-broadcast-ready="true"]')).toBeVisible();
  const bundled=await build({stdin:{contents:`export {loadBattleAsset} from './hosted/battle-animation-player';export {animationById} from './hosted/battle-animation-library';export {pianoBladeRegistration,heroGroundShift} from './hosted/battle-sprite-registration';`,resolveDir:process.cwd()},bundle:true,write:false,format:'iife',globalName:'ScaleReview',platform:'browser'});
  await page.addScriptTag({content:bundled.outputFiles[0].text});await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));
  // Pose study: freeze the live scene at the same guard origin and draw each
  // authored pose through the production asset loader. Live contact/motion is
  // verified separately by the evaluator-driven V5 tests, not simulated here.
  const poses=[['Idle','hero_idle_01',0],['Attack anticipation','hero_azure_blade_rush',0],['First slash','hero_azure_blade_rush',2],['Reverse slash','hero_azure_reverse',2],['Azure finisher','hero_azure_cross',1],['Recovery','hero_azure_cross',4],['Dash','hero_movement_advance_01',1],['Light slash','hero_attack_light_slash_01',1]] as const;
  const rows=[];
  for(const [label,id,frame] of poses){
    const row=await page.evaluate(async({label,id,frame})=>{
      const api=(window as unknown as {ScaleReview:typeof import('../../hosted/battle-animation-player')&typeof import('../../hosted/battle-animation-library')&typeof import('../../hosted/battle-sprite-registration')}).ScaleReview;
      const clip=api.animationById(id)!,asset=await api.loadBattleAsset(clip.asset),canvas=document.querySelector<HTMLCanvasElement>('.battle-fighter-player .battle-sprite')!,ctx=canvas.getContext('2d')!;
      ctx.clearRect(0,0,canvas.width,canvas.height);asset.draw(ctx,(frame+.01)/asset.frameCount);
      const actor=document.querySelector('.battle-fighter-player')!.getBoundingClientRect(),r=canvas.getBoundingClientRect(),ref=api.pianoBladeRegistration;
      const unit=Math.min(canvas.width/ref.canvas.width,canvas.height/ref.canvas.height);
      const sx=r.width/canvas.width*unit,sy=r.height/canvas.height*unit;
      return {label,id,frame,pixelsPerSourceX:sx,pixelsPerSourceY:sy,referenceScale:actor.width/ref.reference.width,groundY:actor.bottom,canvasWidth:r.width,actorWidth:actor.width};
    },{label,id,frame});rows.push(row);
    expect(row.pixelsPerSourceX/row.referenceScale).toBeCloseTo(1,3);expect(row.pixelsPerSourceY/row.referenceScale).toBeCloseTo(1,3);
    expect(row.groundY).toBe(rows[0].groundY);expect(row.actorWidth).toBe(rows[0].actorWidth);expect(row.canvasWidth).toBe(rows[0].canvasWidth);
    await page.screenshot({path:`${out}/${label.toLowerCase().replaceAll(' ','-')}.png`});
  }
  const shadow=await page.locator('.battle-ground-shadow-player').boundingBox();expect(shadow!.y+shadow!.height/2).toBeCloseTo(rows[0].groundY,0);
  await writeFile(`${out}/registration-measurements.json`,JSON.stringify(rows,null,2));
});


