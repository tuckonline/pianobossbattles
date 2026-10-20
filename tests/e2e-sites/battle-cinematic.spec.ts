import {test,expect,type Page} from '@playwright/test';
import {battleView,createBattle,type BattleView} from '../../hosted/boss-battle';
import {defaultBossBattleConfig} from '../../hosted/boss-config';
import {defaultGameSettings} from '../../hosted/game-core';
import {animationById} from '../../hosted/battle-animation-library';
import {visualBody} from '../../hosted/battle-layout';

async function scene(page:Page){
  const id=`cinematic-${crypto.randomUUID()}`,sourceId=crypto.randomUUID(),origin='http://127.0.0.1:8787';
  await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  await page.request.post('/api/platform',{headers:{origin},data:{action:'gameState'}});
  const config={...defaultBossBattleConfig,enabled:true,animationSpeed:.8};let sequence=0;
  const initial=():BattleView=>({...battleView(createBattle(config,150)),attemptId:crypto.randomUUID(),status:'active'});
  const publish=async(battle:BattleView,combo=0)=>{
    const r=await page.request.post('/api/obs',{headers:{origin},data:{sourceId,claim:true,sequence:++sequence,snapshot:{exerciseNumber:7001,title:'Two-Note Footsteps',hand:'both',status:'practicing',accuracy:null,mistakes:battle.mistakes,measure:1,totalMeasures:4,
      game:{sessionId:'cinematic',preview:false,settings:{...defaultGameSettings,bossBattle:config},alerts:[],live:{attemptId:battle.attemptId,sessionId:'cinematic',combo,best:combo,correct:battle.correctHits,incorrect:battle.mistakes,provisionalXP:0,status:battle.status,sequence},battle}}}});
    expect(r.ok(),await r.text()).toBe(true);
  };
  return {initial,publish};
}
async function alphaRect(page:Page,side:string){
  return page.locator(`.battle-fighter-${side} .battle-sprite`).evaluate(canvas=>{
    const c=canvas as HTMLCanvasElement,{data}=c.getContext('2d')!.getImageData(0,0,c.width,c.height);
    let left=c.width,top=c.height,right=0,bottom=0;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>16){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    const r=c.getBoundingClientRect();return {x:r.x+left/c.width*r.width,y:r.y+top/c.height*r.height,width:(right-left+1)/c.width*r.width,height:(bottom-top+1)/c.height*r.height};
  });
}
test('cinematic arena fits alpha silhouettes, stays separated at rest, and restores OFF layout',async({page})=>{
  test.setTimeout(90000);await page.emulateMedia({reducedMotion:'reduce'});const {initial,publish}=await scene(page);let b=initial();await publish(b);
  // Compare the canonical neutral pair at every size. Random idle variants
  // have different drawn silhouettes and must not change halfway through QA.
  await page.clock.setFixedTime(new Date());await page.goto('/obs/score');
  const panel=page.getByRole('complementary',{name:'Boss battle'});
  await expect(panel.locator('[data-asset-status="ready"]')).toHaveCount(2,{timeout:15000});
  for(const size of [{width:1920,height:1080},{width:1920,height:700},{width:1280,height:440},{width:960,height:360}]){
    await page.setViewportSize(size);
    await expect(page.locator('[data-broadcast-ready="true"]')).toBeVisible();
    await expect.poll(async()=>(await panel.boundingBox())!.width).toBeCloseTo(size.width*.22,1);
    // ResizeObserver placement and canvas repaint settle after the CSS viewport.
    await expect.poll(async()=>{const h=await alphaRect(page,'player'),b=await alphaRect(page,'boss');return b.height/h.height;}).toBeGreaterThan(1.1);
    const hero=await alphaRect(page,'player'),boss=await alphaRect(page,'boss');
    expect(hero.y+hero.height).toBeLessThan(boss.y);
    expect(boss.height/hero.height).toBeGreaterThan(1.1);
    const stage=(await page.locator('.battle-stage').boundingBox())!;
    for(const actor of [hero,boss]){
      expect(actor.x).toBeGreaterThanOrEqual(stage.x);expect(actor.x+actor.width).toBeLessThanOrEqual(stage.x+stage.width+1);
      expect(actor.y).toBeGreaterThanOrEqual(stage.y);expect(actor.y+actor.height).toBeLessThanOrEqual(stage.y+stage.height+1);
    }
    expect(stage.height/size.height).toBeCloseTo(.76,2);
    const scoreBounds=await page.locator('.notation .system').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).visibility==='visible').map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right};}));
    expect(scoreBounds.every(r=>r.left>=size.width*.22&&r.right<=size.width)).toBe(true);
    const bars=await panel.getByRole('progressbar').all();
    for(const bar of bars){const r=(await bar.boundingBox())!;expect(r.y).toBeGreaterThanOrEqual(0);expect(r.y+r.height).toBeLessThan(size.height);}
    expect(await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}))).toEqual(size);
    await page.screenshot({path:`../../work/cinematic-idle-${size.width}x${size.height}.png`});
  }
  const enabledInk=await page.locator('.notation > svg').first().elementHandle();
  b={...b,config:{...b.config,enabled:false}};await publish(b);
  await expect(panel).toHaveCount(0);await expect(page.locator('.obs-score-canvas')).not.toHaveClass(/boss-mode/);
  await expect.poll(async()=>(await page.locator('.sight-score').boundingBox())!.width).toBe(960);
  expect(await enabledInk!.evaluate(e=>e===document.querySelector('.notation > svg'))).toBe(true);
});

test('attacks overlap visually, recoil and return smoothly; endings are temporary and contained',async({page})=>{
  test.setTimeout(90000);const {initial,publish}=await scene(page);let b=initial();
  await page.setViewportSize({width:1920,height:700});await publish(b);await page.goto('/obs/score');
  const panel=page.getByRole('complementary',{name:'Boss battle'}),hero=panel.locator('.battle-character-player'),boss=panel.locator('.battle-character-boss');
  await expect(panel.locator('[data-asset-status="ready"]')).toHaveCount(2);
  const notation=await page.locator('.notation > svg').first().elementHandle();
  const home=await page.locator('.battle-fighter').evaluateAll(nodes=>nodes.map(n=>({left:(n as HTMLElement).style.left,top:(n as HTMLElement).style.top})));
  await page.clock.install();
  for(const side of ['player','boss'] as const){
    b={...b,revision:b.revision+1,lastAction:side,lastAt:await page.evaluate(()=>Date.now()),correctHits:b.correctHits+(side==='player'?1:0),bossHp:side==='boss'?25:149,mistakes:side==='boss'?1:0,playerHp:side==='boss'?26:30};
    await publish(b,side==='player'?10:0);
    const attacker=side==='player'?hero:boss,defender=side==='player'?boss:hero;
    await expect(attacker).toHaveAttribute('data-animation-category',/lightAttack|heavyAttack/);
    await expect(defender).toHaveAttribute('data-animation-category','hitReaction');
    // Freeze director timers too, so recovery cannot replace the movement
    // tracks halfway through the geometry/shadow assertions below.
    await page.clock.setFixedTime(new Date(await page.evaluate(()=>Date.now())));
    // Freeze the actual composited transforms at the strike, without touching HP.
    await page.locator('.battle-fighter,.battle-ground-shadow').evaluateAll(nodes=>{for(const n of nodes)for(const a of n.getAnimations()){a.pause();a.currentTime=Number(a.effect!.getTiming().duration)*.55;}});
    await page.waitForTimeout(32); // Flush the composited transforms before capture.
    const rects=await page.locator('.battle-fighter').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,z:getComputedStyle(n).zIndex};}));
    expect(rects[0].bottom).toBeGreaterThan(rects[1].y);
    expect(rects[0].right).toBeGreaterThan(rects[1].x);
    expect(rects[side==='player'?0:1].z).toBe('5');
    for(const actor of ['player','boss']){
      const fighter=(await page.locator(`.battle-fighter-${actor}`).boundingBox())!,shadow=(await page.locator(`.battle-ground-shadow-${actor}`).boundingBox())!;
      expect(shadow.x+shadow.width/2-fighter.x).toBeCloseTo(fighter.width*(actor==='player'?.60:.5),0);
      expect(shadow.y-fighter.y).toBeCloseTo(fighter.height*(actor==='player'?.98:.93),0);
      await expect(page.locator(`.battle-ground-shadow-${actor}`)).toHaveCSS('z-index','1');
    }
    const stage=(await page.locator('.battle-stage').boundingBox())!;
    // Browser layout rounds subpixel coordinates; allow one physical pixel.
    for(let i=0;i<rects.length;i++){
      const r=rects[i],clip=animationById((await (i===0?hero:boss).getAttribute('data-animation-id'))!)!,c=clip.contact;
      const body=c?.visualBounds&&c.bodyBounds?visualBody({x:r.x,y:r.y,width:r.right-r.x,height:r.bottom-r.y},c.bodyBounds,c.mirrored):{x:r.x,y:r.y,width:r.right-r.x,height:r.bottom-r.y};
      expect(body.x).toBeGreaterThanOrEqual(stage.x-1);expect(body.x+body.width).toBeLessThanOrEqual(stage.x+stage.width+1);expect(body.y).toBeGreaterThanOrEqual(stage.y-1);expect(body.y+body.height).toBeLessThanOrEqual(stage.y+stage.height+1);
    }
    const heroArt=await alphaRect(page,'player'),bossArt=await alphaRect(page,'boss');
    expect(heroArt.y+heroArt.height).toBeGreaterThan(bossArt.y);
    await page.screenshot({path:`../../work/cinematic-${side}-strike-recoil.png`});
    await page.locator('.battle-fighter,.battle-ground-shadow').evaluateAll(nodes=>{for(const n of nodes)for(const a of n.getAnimations())a.play();});
    await page.clock.setSystemTime(new Date());
    await page.waitForTimeout(1400);
    await expect(hero).toHaveAttribute('data-animation-category','idle');await expect(boss).toHaveAttribute('data-animation-category','idle');
    await expect(panel.locator('.battle-fighter[data-motion-phase="rest"]')).toHaveCount(2);
    expect(await page.locator('.battle-fighter').evaluateAll(nodes=>nodes.map(n=>({left:(n as HTMLElement).style.left,top:(n as HTMLElement).style.top})))).toEqual(home);
    expect(await page.locator('.battle-fighter').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).transform==='none'&&getComputedStyle(n).zIndex==='2'))).toBe(true);
    await page.screenshot({path:`../../work/cinematic-return-after-${side}.png`});
  }
  expect(await notation!.evaluate(e=>e===document.querySelector('.notation > svg'))).toBe(true);
  for(const victory of [true,false]){
    b=initial();await publish(b);await expect(panel).toHaveAttribute('data-battle-status','active');
    b={...b,status:victory?'victory':'defeat',bossHp:victory?0:140,playerHp:victory?26:0,correctHits:victory?150:10,result:victory?undefined:'knockout',lastAt:await page.evaluate(()=>Date.now())};await publish(b);
    await expect(panel.locator('.battle-outcome')).toContainText(victory?'BOSS DEFEATED':'YOU WERE DEFEATED');
    await expect(panel.locator('.battle-finisher')).toHaveAttribute('data-finisher-tone',victory?'blue':'red');
    await page.waitForTimeout(850);await page.screenshot({path:`../../work/cinematic-${victory?'victory':'defeat'}.png`});
    await expect(panel.locator('.battle-outcome')).toHaveCount(0,{timeout:5000});
    await page.reload();await expect(panel).toHaveAttribute('data-battle-status',b.status);await expect(panel.locator('.battle-outcome,.battle-finisher')).toHaveCount(0);
  }
});
