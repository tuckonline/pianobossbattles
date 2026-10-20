import {test,expect} from "@playwright/test";
import {battleView,createBattle,type BattleView} from "../../hosted/boss-battle";
import {defaultBossBattleConfig} from "../../hosted/boss-config";
import {defaultGameSettings} from "../../hosted/game-core";

test("canonical animation library previews both characters without changing progress",async({page})=>{
  test.setTimeout(90000);
  const id=`animation-preview-${crypto.randomUUID()}`,origin="http://127.0.0.1:8787";
  await page.context().setExtraHTTPHeaders({"oai-authenticated-user-id":id,"oai-authenticated-user-email":`${id}@example.test`});
  await page.goto("/student/sight-read");
  const controls=page.getByRole("region",{name:"Pianist progression"});
  await expect(controls.getByText("Connecting progression…")).toHaveCount(0);
  await controls.getByText("Progression & recording controls",{exact:true}).click();
  await controls.getByText("Character animation library",{exact:true}).click();
  const read=async()=>{const r=await page.request.post("/api/platform",{headers:{origin},data:{action:"gameState"}});return r.json();};
  const before=await read();
  const preview=page.getByLabel("Animation preview",{exact:true}),actor=preview.locator(".battle-character");
  for(const character of ["piano_blade_warrior","crimson_musical_colossus"]){
    await page.getByLabel("Preview character").selectOption(character);
    for(const category of ["idle","lightAttack","heavyAttack","hitReaction","defense","counter","movement","victory","defeat"]){
      await page.getByLabel("Preview action category").selectOption(category);
      await expect(actor).toHaveAttribute("data-animation-category",category);
      await expect(actor).toHaveAttribute("data-asset-status","ready");
      await page.getByRole("button",{name:"Replay animation",exact:true}).click();
    }
    await page.getByLabel("Preview action category").selectOption("idle");
    await expect(actor).toHaveAttribute("data-asset-status","ready");
    await preview.screenshot({path:`../../work/${character}-preview.png`});
  }
  const after=await read();expect(after.xp).toBe(before.xp);expect(after.unlocks).toEqual(before.unlocks);expect(after.best).toBe(before.best);expect(after.sessionBest).toBe(before.sessionBest);
  // A real artwork failure safely falls back to the idle sheet.
  await page.route("**/battle/piano-blade-b.png",route=>route.abort());
  await page.reload();await controls.getByText("Progression & recording controls",{exact:true}).click();
  await controls.getByText("Character animation library",{exact:true}).click();
  await page.getByLabel("Preview action category").selectOption("heavyAttack");
  await page.getByLabel("Preview animation variant").selectOption("hero_attack_heavy_cross_01");
  await expect(actor).toHaveAttribute("data-asset-status","fallback");
  expect((await read()).xp).toBe(before.xp);
});

test("OBS varies articulated actions, holds endings, respects reduced motion and keeps notation clear",async({page})=>{
  test.setTimeout(90000);
  const id=`animation-obs-${crypto.randomUUID()}`,origin="http://127.0.0.1:8787",sourceId=crypto.randomUUID();
  await page.context().setExtraHTTPHeaders({"oai-authenticated-user-id":id,"oai-authenticated-user-email":`${id}@example.test`});
  await page.request.post("/api/platform",{headers:{origin},data:{action:"gameState"}});
  await page.setViewportSize({width:1920,height:700});
  let sequence=0;const config={...defaultBossBattleConfig,enabled:true};
  let b:BattleView={...battleView(createBattle(config,150)),attemptId:"animation-test",status:"active"};
  const publish=async(combo=0)=>{
    const r=await page.request.post("/api/obs",{headers:{origin},data:{sourceId,claim:true,sequence:++sequence,snapshot:{exerciseNumber:7001,title:"Two-Note Footsteps",hand:"both",status:"practicing",accuracy:null,mistakes:b.mistakes,measure:1,totalMeasures:4,
      game:{sessionId:"animation",preview:false,settings:{...defaultGameSettings,bossBattle:config},alerts:[],live:{attemptId:b.attemptId,sessionId:"animation",combo,best:combo,correct:b.correctHits,incorrect:b.mistakes,provisionalXP:0,status:b.status,sequence},battle:b}}}});expect(r.ok(),await r.text()).toBe(true);
  };
  await publish();await page.goto("/obs/score");
  const panel=page.getByRole("complementary",{name:"Boss battle"}),hero=panel.locator(".battle-character-player"),boss=panel.locator(".battle-character-boss");
  await expect(hero).toHaveAttribute("data-asset-status","ready");await expect(boss).toHaveAttribute("data-asset-status","ready");
  await expect(page.locator('[data-broadcast-ready="true"]')).toBeVisible();
  await page.screenshot({path:"../../work/canonical-battle-ready.png"});
  const notation=await page.locator(".notation > svg").first().elementHandle();
  const seen=new Set<string>();
  for(let i=1;i<=6;i++){
    b={...b,revision:i,correctHits:i,bossHp:150-i,lastAction:"player",lastAt:Date.now()};await publish(i);
    await expect(hero).toHaveAttribute("data-animation-category","lightAttack");seen.add((await hero.getAttribute("data-animation-id"))!);
    await expect(boss).toHaveAttribute("data-animation-category","hitReaction");
    await expect(hero).toHaveAttribute("data-animation-category","idle",{timeout:3000});
  }
  expect(seen.size).toBeGreaterThanOrEqual(2);
  b={...b,revision:10,correctHits:10,bossHp:140,lastAt:Date.now()};await publish(10);
  await expect(hero).toHaveAttribute("data-animation-category","heavyAttack");
  await expect(panel.getByRole("progressbar",{name:"boss HP"})).toHaveAttribute("aria-valuenow","140");
  expect(await notation!.evaluate(e=>e===document.querySelector(".notation > svg"))).toBe(true);
  await page.emulateMedia({reducedMotion:"reduce"});
  await expect(hero).toHaveAttribute("data-animation-category","idle");
  const canvas=hero.locator("canvas"),snapshot=await canvas.evaluate(c=>(c as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(250);expect(await canvas.evaluate(c=>(c as HTMLCanvasElement).toDataURL())).toBe(snapshot);
  await page.emulateMedia({reducedMotion:"no-preference"});
  // Smaller OBS source dimensions keep the entire battle panel outside notation.
  for(const size of [{width:1280,height:440},{width:960,height:360}]){
    await page.setViewportSize(size);await expect.poll(async()=>{const edge=(await panel.boundingBox())!.width;return page.locator(".notation .system").evaluateAll((nodes,edge)=>nodes.filter(n=>getComputedStyle(n).visibility==="visible").every(n=>n.getBoundingClientRect().left>=edge),edge);}).toBe(true);
    await page.screenshot({path:`../../work/canonical-battle-${size.width}.png`});
  }
  b={...b,status:"victory",revision:150,correctHits:150,bossHp:0,lastAt:Date.now()};await publish(150);
  await expect(panel).toHaveAttribute("data-battle-status","victory");await expect(hero).toHaveAttribute("data-animation-category","victory");await expect(boss).toHaveAttribute("data-animation-category","defeat");
  await page.waitForTimeout(1300);await page.screenshot({path:"../../work/canonical-battle-victory.png"});
  await page.reload();await expect(hero).toHaveAttribute("data-animation-category","victory");await expect(hero).toHaveAttribute("data-asset-status","ready");
  const restored=await hero.locator("canvas").evaluate(c=>(c as HTMLCanvasElement).toDataURL());await page.waitForTimeout(250);expect(await hero.locator("canvas").evaluate(c=>(c as HTMLCanvasElement).toDataURL())).toBe(restored);
});
