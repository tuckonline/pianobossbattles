import {test,expect} from "@playwright/test";
import {battleView,createBattle,type BattleView} from "../../hosted/boss-battle";
import {defaultBossBattleConfig} from "../../hosted/boss-config";
import {defaultGameSettings} from "../../hosted/game-core";
test("larger arena fits the score and plays each targeted flame ending once",async({page})=>{
  test.setTimeout(90000);
  const id=`finisher-${crypto.randomUUID()}`,origin="http://127.0.0.1:8787",sourceId=crypto.randomUUID();
  await page.context().setExtraHTTPHeaders({"oai-authenticated-user-id":id,"oai-authenticated-user-email":`${id}@example.test`});
  await page.request.post("/api/platform",{headers:{origin},data:{action:"gameState"}});
  const config={...defaultBossBattleConfig,enabled:true};let sequence=0;
  const active=(attemptId:string):BattleView=>({...battleView(createBattle(config,50)),attemptId,status:"active"});
  const publish=async(battle:BattleView)=>{
    const r=await page.request.post("/api/obs",{headers:{origin},data:{sourceId,claim:true,sequence:++sequence,snapshot:{exerciseNumber:11001,title:"C major scale",hand:"both",status:"practicing",accuracy:null,mistakes:battle.mistakes,measure:1,totalMeasures:4,
      game:{sessionId:"flames",preview:false,settings:{...defaultGameSettings,bossBattle:config},alerts:[],live:{attemptId:battle.attemptId,sessionId:"flames",combo:0,best:0,correct:battle.correctHits,incorrect:battle.mistakes,provisionalXP:0,status:battle.status,sequence},battle}}}});expect(r.ok(),await r.text()).toBe(true);
  };
  await publish(active("blue"));await page.goto("/obs/score");
  const panel=page.getByRole("complementary",{name:"Boss battle"}),fire=page.locator(".battle-finisher");
  await expect(page.locator('[data-broadcast-ready="true"]')).toBeVisible();
  for(const size of [{width:1920,height:700,arena:316.8},{width:1280,height:440,arena:211.2},{width:960,height:360,arena:158.4}]){
    await page.setViewportSize(size);await expect.poll(async()=>(await panel.boundingBox())!.width).toBeCloseTo(size.arena,1);
    await expect.poll(async()=>page.locator(".notation .system").evaluateAll((nodes,edge)=>nodes.filter(n=>getComputedStyle(n).visibility==="visible").every(n=>n.getBoundingClientRect().left>edge),size.arena)).toBe(true);
  }
  await page.setViewportSize({width:1920,height:700});
  const svg=await page.locator(".notation > svg").first().elementHandle();
  const victory={...active("blue"),status:"victory" as const,bossHp:0,correctHits:50,lastAt:Date.now()};await publish(victory);
  await expect(fire).toHaveAttribute("data-finisher-tone","blue");await expect(fire).toHaveAttribute("data-finisher-target","boss");
  await expect(panel.getByRole("progressbar",{name:"boss HP"})).toHaveAttribute("aria-valuenow","0");
  await page.waitForTimeout(800);await page.screenshot({path:"../../work/blue-flame-finish.png"});
  expect(await svg!.evaluate(e=>e===document.querySelector(".notation > svg"))).toBe(true);
  await expect(fire).toHaveCount(0,{timeout:5000});await publish({...victory,lastAt:Date.now()});await page.waitForTimeout(300);await expect(fire).toHaveCount(0);
  await page.reload();await expect(panel).toHaveAttribute("data-battle-status","victory");await expect(fire).toHaveCount(0);
  await publish(active("red"));await expect(panel).toHaveAttribute("data-battle-status","active");
  await publish({...active("red"),status:"defeat",playerHp:0,result:"knockout",mistakes:8,lastAt:Date.now()});
  await expect(fire).toHaveAttribute("data-finisher-tone","red");await expect(fire).toHaveAttribute("data-finisher-target","player");
  await page.waitForTimeout(850);await page.screenshot({path:"../../work/red-flame-finish.png"});
  await publish(active("reset"));await expect(panel).toHaveAttribute("data-battle-status","active");await expect(fire).toHaveCount(0);
  await publish({...active("reset"),status:"defeat",result:"abandoned",lastAt:Date.now()});await expect(panel).toContainText("BATTLE ABANDONED");await expect(fire).toHaveCount(0);
  await page.emulateMedia({reducedMotion:"reduce"});await publish(active("still"));await expect(panel).toHaveAttribute("data-battle-status","active");
  await publish({...active("still"),status:"victory",bossHp:0,lastAt:Date.now()});await expect(fire).toHaveCount(1);
  const still=await fire.evaluate(c=>(c as HTMLCanvasElement).toDataURL());await page.waitForTimeout(200);expect(await fire.evaluate(c=>(c as HTMLCanvasElement).toDataURL())).toBe(still);
  await expect(fire).toHaveCount(0,{timeout:5000});
});
