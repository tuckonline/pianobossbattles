import {test, expect} from "@playwright/test";
import {defaultGameSettings, type Celebration} from "../../hosted/game-core";

test("streak thresholds fade and repeat after a break; achievements remain one-time", async ({browser}) => {
  test.setTimeout(90000);
  const id = `streak-${crypto.randomUUID()}`;
  const context = await browser.newContext({viewport:{width:320,height:220},extraHTTPHeaders:{"oai-authenticated-user-id":id,"oai-authenticated-user-email":`${id}@example.test`}});
  const streak = await context.newPage(), achievement = await context.newPage();
  let sequence = 0;
  const sourceId = crypto.randomUUID();
  const origin = "http://127.0.0.1:8787";
  const event = (kind: Celebration["kind"], eventId: string, count = 10): Celebration => ({id:eventId,kind,title:kind === "milestone" ? `${count} notes in a row` : "Finding My Rhythm",description:kind === "milestone" ? "Keep it going!" : "Build a 10-note combo.",priority:80,createdAt:Date.now()});
  const publish = async (combo: number, alerts: Celebration[] = [], preview = false) => {
    const r = await context.request.post(`${origin}/api/obs`, {headers:{origin},data:{sourceId,sequence:++sequence,claim:true,snapshot:{
      exerciseNumber:1001,title:"Hanon No. 1",hand:"both",status:"practicing",accuracy:100,mistakes:0,measure:1,totalMeasures:30,
      game:{sessionId:"test",preview,live:{attemptId:"test",sessionId:"test",combo,best:100,correct:combo,incorrect:0,provisionalXP:0,status:"playing",sequence},settings:defaultGameSettings,alerts},
    }}});
    expect(r.ok(),await r.text()).toBe(true);
  };
  try {
    const init = await context.request.post(`${origin}/api/platform`,{headers:{origin},data:{action:'gameState'}});
    expect(init.ok()).toBe(true);
    await streak.goto(`${origin}/obs/streaks`);
    // Old lifetime threshold receipts must not suppress the new behavior.
    await streak.evaluate(user=>localStorage.setItem(`pianopath:streak-shown:obs:${user}:10 notes in a row`,'1'),id);
    await achievement.goto(`${origin}/obs/celebrations`);
    await publish(0);
    await expect(streak.locator('.obs-streak-counter,.game-celebration')).toHaveCount(0);
    await expect(streak.getByRole('main')).toBeEmpty();
    await publish(9);
    await expect(streak.getByRole('main')).toBeEmpty();
    for (const count of [10,25,50,100]) {
      await publish(count,[event('milestone',`streak-${count}`,count)]);
      await expect(streak.locator('.game-celebration strong')).toHaveText(`${count} notes in a row`);
      expect(await streak.locator('.game-celebration').evaluate(e=>getComputedStyle(e).animationName)).toBe('game-fade-in, game-fade-out');
      await expect(achievement.locator('.game-celebration')).toHaveCount(0);
      await expect(streak.getByText('MILESTONE',{exact:true})).toHaveCount(0);
      if(count === 25) await streak.screenshot({path:'../../work/streak-overlay.png',omitBackground:true});
      await expect(streak.locator('.game-celebration')).toHaveCount(0,{timeout:5000});
      await expect(streak.getByRole('main')).toBeEmpty();
    }
    await publish(0);
    await expect(streak.getByRole('main')).toBeEmpty();
    await publish(10,[event('milestone','second-run-10')]);
    await expect(streak.locator('.game-celebration strong')).toHaveText('10 notes in a row');
    await expect(streak.locator('.game-celebration')).toHaveCount(0,{timeout:5000});
    await publish(10,[event('achievement','achievement:finding_my_rhythm')]);
    await expect(achievement.locator('.game-celebration strong')).toHaveText('Finding My Rhythm');
    await expect(achievement.locator('.game-celebration')).toHaveCount(0,{timeout:5000});
    expect(await achievement.evaluate(user=>localStorage.getItem(`pianopath:achievement-shown:obs:${user}:achievement:finding_my_rhythm`),id)).toBe('1');
    await achievement.reload();
    await publish(10,[event('achievement','achievement:finding_my_rhythm'),{...event('record','fresh-record'),title:'New personal best',priority:70}]);
    // The lower-priority new record must appear immediately, with the repeated
    // achievement suppressed even though its timestamp has been refreshed.
    await expect(achievement.locator('.game-celebration strong')).toHaveText('New personal best',{timeout:2500});
    await expect(achievement.locator('.game-celebration')).toHaveCount(0,{timeout:5000});
    await streak.reload();
    await publish(250,[event('milestone','after-reload-25',25),event('milestone','new-250',250),event('achievement','achievement:finding_my_rhythm')]);
    await expect(streak.locator('.game-celebration strong')).toHaveText('25 notes in a row',{timeout:2500});
    await expect(streak.locator('.game-celebration strong')).toHaveText('250 notes in a row',{timeout:5000});
    await expect(achievement.locator('.game-celebration')).toHaveCount(0);
    await publish(25,[event('achievement','preview-replay')],true);
    await expect(achievement.locator('.game-celebration')).toContainText('PREVIEW');
    const state = await context.request.post(`${origin}/api/platform`,{headers:{origin},data:{action:'gameState'}});
    expect(await state.json()).toMatchObject({xp:0,unlocks:[]});
    expect(await streak.evaluate(()=>getComputedStyle(document.body).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  } finally { await context.close(); }
});
