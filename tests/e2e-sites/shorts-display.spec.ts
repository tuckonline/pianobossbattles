import {test,expect,type Page} from '@playwright/test';
import {defaultGameSettings} from '../../hosted/game-core';
import {defaultShortsDisplay,type ShortsDisplay} from '../../hosted/shorts-display';
import {battleView,createBattle} from '../../hosted/boss-battle';
import {defaultBossBattleConfig} from '../../hosted/boss-config';
import type {GameMode} from '../../hosted/battle-modes';
const origin='http://127.0.0.1:8787';
async function fixture(page:Page){
  const id=`v13-${crypto.randomUUID()}`,sourceId=crypto.randomUUID();let sequence=0;
  await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  const command=async(data:object)=>{const r=await page.request.post('/api/platform',{headers:{origin},data});expect(r.ok(),await r.text()).toBe(true);return r.json();};
  await command({action:'gameState'});
  const send=async(exerciseNumber=2001,measure=1,gameMode:GameMode='survival')=>{
    const e=await command({action:'practiceExercise',exerciseNumber});const config={...defaultBossBattleConfig,enabled:true,gameMode};
    const b=battleView(createBattle(config,100));b.attemptId=id;b.status='active';
    const r=await page.request.post('/api/obs',{headers:{origin},data:{sourceId,claim:true,sequence:++sequence,snapshot:{exerciseNumber,title:e.title,hand:'both',status:'practicing',accuracy:98,mistakes:1,measure,totalMeasures:e.right.length,
      game:{battle:b,settings:{...defaultGameSettings,bossBattle:config},sessionId:id,preview:false,alerts:[],live:{attemptId:id,sessionId:id,combo:20,best:20,correct:20,incorrect:1,provisionalXP:40,status:'playing',sequence}}}}});expect(r.ok(),await r.text()).toBe(true);
  };
  const set=async(display:Partial<ShortsDisplay>)=>command({action:'gameSettings',settings:{...defaultGameSettings,shortsDisplay:{...defaultShortsDisplay,...display}}});
  return {send,set,command};
}
async function contained(page:Page){
  await expect(page.locator('[data-broadcast-ready=true]')).toBeVisible({timeout:15000});
  await expect.poll(()=>page.locator('.notation .measure').evaluateAll(measures=>{
    const area=document.querySelector('.sight-score')!.getBoundingClientRect(),style=getComputedStyle(document.querySelector('.sight-score')!);
    const shapes=measures.filter(m=>getComputedStyle(m).visibility==='visible').flatMap(m=>[...m.querySelectorAll('use,path,text,line,polygon,polyline,rect,circle,ellipse')]).filter(n=>!n.closest('defs,clipPath,mask'));
    return Math.max(...shapes.map(n=>n.getBoundingClientRect()).filter(b=>b.width||b.height).map(b=>Math.max(area.left+parseFloat(style.paddingLeft)-b.left,b.right-area.right+parseFloat(style.paddingRight),area.top+parseFloat(style.paddingTop)-b.top,b.bottom-area.bottom+parseFloat(style.paddingBottom))));
  })).toBeLessThanOrEqual(.5);
}
test('default and extreme scales contain full notation; windows follow measures without re-engraving',async({page})=>{
  test.setTimeout(90000);const f=await fixture(page);await f.send();await page.setViewportSize({width:1080,height:1920});await page.goto('/obs/shorts');await contained(page);
  await expect(page.locator('.shorts-view')).toHaveAttribute('data-character-scale','110');await expect(page.locator('.sight-score')).toHaveAttribute('data-notation-scale','125');
  await expect(page.locator('[data-asset-status=ready]')).toHaveCount(2);await page.screenshot({path:'../../work/v13/default-portrait.png'});
  const svg=await page.locator('.notation > svg').first().elementHandle(),revision=await page.locator('.notation').getAttribute('data-broadcast-fit-revision');
  for(const scale of [90,160])for(const view of ['current','next','automatic'] as const){
    await f.set({notationScale:scale,notationView:view,characterScale:scale===90?80:140});
    await expect(page.locator('.sight-score')).toHaveAttribute('data-notation-scale',String(scale));await expect(page.locator('.sight-score')).toHaveAttribute('data-notation-view',view);await contained(page);
    await expect(page.locator('.notation')).toHaveAttribute('data-broadcast-window',view==='next'?'2':'1');
    expect(await svg!.evaluate(el=>el.isConnected)).toBe(true);expect(await page.locator('.notation').getAttribute('data-broadcast-fit-revision')).toBe(revision);
    expect(Number(await page.locator('.notation').getAttribute('data-broadcast-effective-scale'))).toBeLessThanOrEqual(scale);
    await page.screenshot({path:`../../work/v13/scale-${scale}-${view}.png`});
  }
  await f.send(2001,2);await expect(page.locator('.notation')).toHaveAttribute('data-broadcast-first','1');await contained(page);expect(await svg!.evaluate(el=>el.isConnected)).toBe(true);
  await f.send(2001,3);await expect(page.locator('.notation')).toHaveAttribute('data-broadcast-first','2');await contained(page);
  await f.set({notationView:'next',notationScale:160});await f.send(11001,2);await expect(page.locator('.shorts-exercise')).toContainText('C major');await contained(page);await page.screenshot({path:'../../work/v13/simple-next.png'});
  await page.reload();await expect(page.locator('.sight-score')).toHaveAttribute('data-notation-view','next');await contained(page);
  expect(await page.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight}))).toEqual({w:1080,h:1920});
});
test('Shorts Display controls save, update another OBS view and leave battle identity and progress intact',async({page,context})=>{
  test.setTimeout(60000);const f=await fixture(page);await f.send();await page.goto('/shorts');await page.getByText('Shorts Display',{exact:true}).click();
  await expect(page.getByLabel('Character Scale',{exact:true})).toHaveValue('110');await expect(page.getByLabel('Notation Scale',{exact:true})).toHaveValue('125');
  const obs=await context.newPage();await obs.setViewportSize({width:1080,height:1920});await obs.goto('/obs/shorts');await contained(obs);
  const attempt=await obs.locator('.boss-battle-panel').getAttribute('data-battle-attempt'),before=await f.command({action:'gameState'});
  await page.getByLabel('Character Scale',{exact:true}).fill('140');await page.getByLabel('Notation Scale',{exact:true}).fill('160');await page.getByLabel('Notation View',{exact:true}).selectOption('next');
  await expect(obs.locator('.shorts-view')).toHaveAttribute('data-character-scale','140');await expect(obs.locator('.sight-score')).toHaveAttribute('data-notation-scale','160');await expect(obs.locator('.sight-score')).toHaveAttribute('data-notation-view','next');
  await expect(page.locator('.shorts-display-controls [role=status]')).toContainText('Notation displayed at');
  await expect(obs.locator('.boss-battle-panel')).toHaveAttribute('data-battle-attempt',attempt!);await expect(obs.locator('.boss-battle-panel')).toHaveAttribute('data-authoritative-boss-hp','100');
  const after=await f.command({action:'gameState'});expect(before.xp).toBe(0);expect(Array.isArray(before.unlocks)).toBe(true);expect(after.xp).toBe(before.xp);expect(after.unlocks).toEqual(before.unlocks);
  await page.screenshot({path:'../../work/v13/display-controls.png',fullPage:true});await page.reload();await page.getByText('Shorts Display',{exact:true}).click();await expect(page.getByLabel('Character Scale',{exact:true})).toHaveValue('140');
  await page.getByRole('button',{name:'Reset Shorts Display to defaults',exact:true}).click();await expect(obs.locator('.shorts-view')).toHaveAttribute('data-character-scale','110');await expect(obs.locator('.sight-score')).toHaveAttribute('data-notation-scale','125');
});
test('power is a single thinner player HUD resource in all modes and both recording formats',async({page})=>{
  test.setTimeout(60000);const f=await fixture(page);
  for(const route of ['shorts','recording'])for(const mode of ['survival','timeAttack','ultimateBoss'] as const){
    await f.send(2001,1,mode);await page.setViewportSize(route==='shorts'?{width:1080,height:1920}:{width:1920,height:1080});await page.goto(`/obs/${route}`);await contained(page);
    await expect(page.locator('.battle-power')).toHaveCount(1);await expect(page.locator('.battle-hud .battle-power')).toHaveCount(1);await expect(page.locator('.battle-status .battle-power')).toHaveCount(0);
    const power=(await page.locator('.battle-power').boundingBox())!,hud=(await page.locator('.battle-hud').boundingBox())!;
    expect(power.y).toBeGreaterThanOrEqual(hud.y);expect(power.y+power.height).toBeLessThanOrEqual(hud.y+hud.height+1);
    if(mode!=='timeAttack'){
      const hp=(await page.getByRole('progressbar',{name:'player HP',exact:true}).boundingBox())!,bar=(await page.getByRole('progressbar',{name:'Combo Power',exact:true}).boundingBox())!;
      expect(power.y).toBeGreaterThan(hp.y+hp.height);expect(bar.height/hp.height).toBeGreaterThanOrEqual(.6);expect(bar.height/hp.height).toBeLessThanOrEqual(.7);
    }else await expect(page.getByRole('progressbar',{name:'player HP',exact:true})).toHaveCount(0);
    if(mode==='ultimateBoss'){const shield=(await page.locator('.battle-hud .battle-shields').boundingBox())!;expect(shield.y).toBeGreaterThanOrEqual(power.y+power.height);}
    const footer=(await page.locator('.battle-status').boundingBox())!;
    for(const part of await page.locator('.battle-status > *').all()){const box=(await part.boundingBox())!;expect(box.y).toBeGreaterThanOrEqual(footer.y);expect(box.y+box.height).toBeLessThanOrEqual(footer.y+footer.height);}
    await page.screenshot({path:`../../work/v13/${route}-${mode}.png`});
    if(route==='recording'){
      await page.setViewportSize({width:1920,height:750});await contained(page);
      const header=(await page.locator('.battle-hud').boundingBox())!;
      for(const part of await page.locator('.battle-hud > *').all()){
        const box=(await part.boundingBox())!;expect(box.y).toBeGreaterThanOrEqual(header.y);expect(box.y+box.height).toBeLessThanOrEqual(header.y+header.height);
      }
      await page.screenshot({path:`../../work/v13/horizontal-750-${mode}.png`});
    }
    if(mode==='ultimateBoss')for(const icon of await page.locator('.battle-hud .battle-shields svg').all())expect((await icon.boundingBox())!.height).toBeGreaterThanOrEqual(10);
  }
});
