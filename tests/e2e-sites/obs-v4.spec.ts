import {test,expect} from '@playwright/test';
import {defaultGameSettings} from '../../hosted/game-core';
import {battleView,createBattle} from '../../hosted/boss-battle';
import {defaultBossBattleConfig} from '../../hosted/boss-config';
import {scalesLibrary} from '../../hosted/scales-library';
import {musicXml} from '../../hosted/sight-library';

test('V4 banner proportions, responsive controls and three-system ink stay stable during notes',async({page})=>{
  test.setTimeout(90000);
  const origin='http://127.0.0.1:8787',id=`v4-layout-${crypto.randomUUID()}`,sourceId=crypto.randomUUID();let sequence=0;
  await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  await page.request.post('/api/platform',{headers:{origin},data:{action:'gameState'}});
  const base=scalesLibrary[0],fixture={...base,measuresPerSystem:4,right:[...base.right,...base.right,...base.right],left:[...base.left,...base.left,...base.left],notationUrl:undefined};
  const xml=musicXml(fixture);
  await page.route('**/api/platform',async route=>{
    if(route.request().postDataJSON()?.action==='practiceExercise')await route.fulfill({json:{...fixture,notationXml:xml}});else await route.continue();
  });
  const publish=async(enabled:boolean,measure=1,status:'ready'|'practicing'|'stopped'|'complete'='ready',expanded=false)=>{
    const config={...defaultBossBattleConfig,enabled};
    await page.request.post('/api/platform',{headers:{origin},data:{action:'gameSettings',settings:{...defaultGameSettings,expanded,bossBattle:config}}});
    const r=await page.request.post('/api/obs',{headers:{origin},data:{sourceId,sequence:++sequence,claim:true,snapshot:{exerciseNumber:base.number,title:'C major: three complete systems with fingering and ledger lines — '+ 'Long exercise title '.repeat(7),hand:'both',status,accuracy:status==='ready'?null:98,mistakes:1,measure,totalMeasures:12,
      game:{sessionId:'v4',preview:false,settings:{...defaultGameSettings,expanded,bossBattle:config},alerts:[],live:{attemptId:'v4',sessionId:'v4',combo:1234,best:1234,correct:100,incorrect:1,provisionalXP:0,status:'ready',sequence},battle:battleView(createBattle(config,100))}}}});
    expect(r.ok()).toBe(true);
  };
  await publish(false);await page.goto('/obs/recording');
  const root=page.locator('[data-broadcast-ready=true]');
  await expect(root).toBeVisible();await expect(page.locator('.notation .system')).toHaveCount(3);
  for(const size of [{width:1920,height:750},{width:1920,height:600},{width:1280,height:720},{width:960,height:650},{width:650,height:600}]){
    await page.setViewportSize(size);
    for(const enabled of [false,true]){
      await publish(enabled,1,'ready',true);await expect(page.locator('.boss-battle-panel')).toHaveCount(enabled?1:0);
      await expect(page.locator('.game-record-detail')).toHaveCount(1);
      if(enabled)await expect(page.locator('[data-asset-status="ready"]')).toHaveCount(2);
      const area=(await page.locator('.sight-score').boundingBox())!;
      await expect.poll(()=>page.locator('.notation .system').evaluateAll(nodes=>{
        const a=document.querySelector('.sight-score')!.getBoundingClientRect();return Math.max(...nodes.map((n,i)=>{const b=n.getBoundingClientRect();return Math.abs((b.top+b.bottom)/2-a.top-a.height*[.22,.5,.78][i]);}));
      })).toBeLessThan(1);
      const ink=await page.locator('.notation .system').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,visible:getComputedStyle(n).visibility};}));
      ink.forEach((b,i)=>{expect(b.visible).toBe('visible');expect(b.x).toBeGreaterThanOrEqual(area.x+10);expect(b.right).toBeLessThanOrEqual(area.x+area.width-10);expect(b.y).toBeGreaterThanOrEqual(area.y+10);expect(b.bottom).toBeLessThanOrEqual(size.height-10);if(i)expect(b.y).toBeGreaterThan(ink[i-1].bottom);});
      await expect(page.getByText(/Ready to play|Ready to battle|BATTLE IN PROGRESS/i)).toHaveCount(0);
      await expect(page.locator('.battle-brand,.obs-status,.battle-result')).toHaveCount(0);
      const banner=(await page.locator('.obs-panel').boundingBox())!;
      const parts=await page.locator('.obs-piece,.obs-brand,.game-level,.game-combo,.game-record-detail,.obs-best,.obs-attempt').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom};}));
      parts.forEach(b=>{expect(b.x).toBeGreaterThanOrEqual(0);expect(b.right).toBeLessThanOrEqual(size.width);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.bottom).toBeLessThanOrEqual(banner.height+1);});
      expect(await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}))).toEqual(size);
      if(size.width===1920){
        expect(banner.height).toBe(112);
        const title=(await page.locator('.obs-piece').boundingBox())!,hud=(await page.locator('.game-hud').boundingBox())!;
        expect(hud.x/1920).toBeCloseTo(.34,2);expect(hud.width/(1920-34-36)).toBeCloseTo(.42,2);expect(title.width).toBeGreaterThan(620);
        await expect(page.locator('.obs-piece h1')).toHaveCSS('font-size','30px');await expect(page.locator('.game-combo strong')).toHaveCSS('font-size','32px');
        await expect(page.locator('.game-level small')).toHaveCSS('font-size','12px');
        expect((await page.locator('.game-xp-track').boundingBox())!.height).toBe(8);
        expect(await page.locator('.obs-piece h1').evaluate(n=>n.scrollWidth>n.clientWidth)).toBe(true);
        if(size.height===750)await page.screenshot({path:`../../work/v4-three-systems-${enabled?'on':'off'}.png`});
      }
    }
  }
  await page.setViewportSize({width:1920,height:750});await publish(true);await page.waitForTimeout(200);
  const svg=await page.locator('.notation > svg').first().elementHandle(),revision=await root.getAttribute('data-broadcast-fit-revision');
  const transforms=await page.locator('.system').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('transform')));
  await publish(true,9,'practicing');await expect(page.locator('.obs-progress')).toContainText('Measure 9 / 12');
  expect(await root.getAttribute('data-broadcast-fit-revision')).toBe(revision);
  expect(await page.locator('.system').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('transform')))).toEqual(transforms);
  expect(await svg!.evaluate(n=>n===document.querySelector('.notation > svg'))).toBe(true);
  await publish(true,9,'stopped');await expect(page.locator('.obs-status')).toHaveText('Paused');
  await publish(true,12,'complete');await expect(page.locator('.obs-status')).toHaveText('Attempt completed');
});
