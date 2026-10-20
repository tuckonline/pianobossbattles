import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {noteGroups} from '../../hosted/sight-library';
import {schmittLibrary} from '../../hosted/schmitt-library';
import {installMidiKeyboard,playNotes} from './helpers/midi';
test.use({trace:'off'});
const origin='http://127.0.0.1:8787',out='../../work/v9-review';
async function containment(page:Page){
 const viewport=page.viewportSize()!;
 expect(await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}))).toEqual(viewport);
 const score=(await page.locator('.sight-score').boundingBox())!;
 expect(score.width).toBeCloseTo(viewport.width*.78,0);
 const systems=await page.locator('.notation .system').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).visibility==='visible').map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));
 for(const r of systems){expect(r.left).toBeGreaterThanOrEqual(score.x+10);expect(r.right).toBeLessThanOrEqual(score.x+score.width-10);expect(r.top).toBeGreaterThanOrEqual(score.y+10);expect(r.bottom).toBeLessThanOrEqual(viewport.height-10);}
 const hud=await page.locator('.battle-hud,.battle-status').evaluateAll(nodes=>nodes.map(parent=>{const p=parent.getBoundingClientRect();return [...parent.querySelectorAll('.battle-health,.battle-power,.battle-countdown,.battle-shields,.battle-difficulty')].every(el=>{const r=el.getBoundingClientRect();return r.left>=p.left&&r.right<=p.right&&r.top>=p.top-1&&r.bottom<=p.bottom+1;});}));
 expect(hud).toEqual([true,true]);
}
for(const mode of ['survival','timeAttack','ultimateBoss'] as const)test(`V9 ${mode}: real evaluator, HUD, shield/power, persistence and OBS reconnect`,async({browser})=>{
 test.setTimeout(120000);await mkdir(out,{recursive:true});
 const id=`v9-${crypto.randomUUID()}`,ctx=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`},viewport:{width:1920,height:750},...(process.env.V9_VIDEO==='1'?{recordVideo:{dir:out,size:{width:1920,height:1080}}}:{})});
 const p=await ctx.newPage(),obs=await ctx.newPage();
 try{
 await installMidiKeyboard(p);
 await obs.addInitScript(()=>{Object.assign(window,{obsMidi:0,powerEffects:0,shieldEffects:0,enrageNotices:0});Object.defineProperty(navigator,'requestMIDIAccess',{value:()=>{(window as unknown as {obsMidi:number}).obsMidi++;throw Error('OBS requested MIDI');}});});
 await p.goto('/student/practice?collection=schmitt&exercise=2001');
 const controls=p.getByRole('region',{name:'Pianist progression'});
 await expect(controls.getByText('Connecting progression…')).toHaveCount(0);
 await controls.getByText('Progression & recording controls',{exact:true}).click();
 await controls.getByLabel('Boss Battle Mode',{exact:true}).check();
 await controls.getByLabel('Game mode',{exact:true}).selectOption(mode);
 await controls.getByLabel('Combo Power threshold',{exact:true}).fill('10');
 if(mode!=='survival')await controls.getByLabel('Explicit time limit',{exact:true}).fill('120');
 await expect(controls.getByLabel('Continue into new rounds')).toHaveCount(0);
 await obs.goto('/obs/recording');
 const panel=obs.getByLabel('Boss battle',{exact:true}),status=p.getByRole('region',{name:'Practice battle status'});
 await expect(panel).toHaveAttribute('data-game-mode',mode);
 await expect(obs.locator('[data-broadcast-ready="true"]')).toBeVisible();
 await expect(panel.locator('[data-asset-status="ready"]')).toHaveCount(2,{timeout:15000});
 await expect(obs.locator('main')).toHaveAttribute('data-score-transport','direct',{timeout:15000});
 await obs.evaluate(()=>{const seen=new WeakSet<Node>();new MutationObserver(()=>{for(const el of document.querySelectorAll('[data-combo-power="true"],[data-shield-block="true"],.battle-mode-notice')){if(seen.has(el))continue;seen.add(el);const w=window as unknown as {powerEffects:number;shieldEffects:number;enrageNotices:number};if(el.getAttribute('data-combo-power')==='true')w.powerEffects++;if(el.getAttribute('data-shield-block')==='true')w.shieldEffects++;if(el.textContent==='ENRAGED')w.enrageNotices++;}}).observe(document.body,{childList:true,subtree:true});});
 const pitches=noteGroups(schmittLibrary[0],'both').flatMap(g=>g.pitches);
 await p.getByRole('button',{name:'Connect keyboard',exact:true}).click();
 await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
 // These mode checks predate the once-per-attempt countdown. Input is
 // deliberately ignored until FIGHT; assess damage only after it releases.
 await expect(status).toHaveAttribute('data-battle-status','active',{timeout:7000});
 const svg=await obs.locator('.notation > svg').first().elementHandle();
 await playNotes(p,[1]);
 await expect(panel).toHaveAttribute('data-authoritative-player-hp',mode==='timeAttack'?'30':'26');
 await expect(panel).toHaveAttribute('data-authoritative-boss-hp',String(pitches.length));
 if(mode==='timeAttack'){await expect(panel.getByRole('progressbar',{name:'player HP',exact:true})).toHaveCount(0);await expect(status.getByRole('progressbar',{name:'player HP',exact:true})).toHaveCount(0);}
 for(let i=0;i<10;i++){await playNotes(p,[pitches[i]]);await p.waitForTimeout(65);}
 await expect(panel).toHaveAttribute('data-authoritative-boss-hp',String(pitches.length-10));
 await expect.poll(()=>obs.evaluate(()=>(window as unknown as {powerEffects:number}).powerEffects)).toBeGreaterThan(0);
 if(mode==='ultimateBoss'){await expect(status.getByLabel('1 of 3 shields')).toBeVisible();await expect(panel.getByLabel('1 of 3 shields')).toBeVisible();}
 await playNotes(p,[1]);await p.waitForTimeout(400);
 await expect(panel).toHaveAttribute('data-authoritative-player-hp',mode==='timeAttack'?'30':mode==='ultimateBoss'?'26':'22');
 if(mode==='ultimateBoss'){await expect(panel.getByLabel('0 of 3 shields')).toBeVisible();expect(await obs.evaluate(()=>(window as unknown as {shieldEffects:number}).shieldEffects)).toBeGreaterThan(0);}
 expect(await svg!.evaluate(n=>n===document.querySelector('.notation > svg'))).toBe(true);
 // Ordinary control changes are saved but must not change this fight's rules.
 await controls.getByLabel('Game mode',{exact:true}).selectOption(mode==='survival'?'timeAttack':'survival');
 await expect(panel).toHaveAttribute('data-game-mode',mode);
 for(let i=10;i<50;i++){await playNotes(p,[pitches[i]]);await p.waitForTimeout(20);}
 if(mode==='ultimateBoss'){await expect(panel).toHaveAttribute('data-boss-phase','enraged');await expect.poll(()=>obs.evaluate(()=>(window as unknown as {enrageNotices:number}).enrageNotices)).toBe(1);}
 await p.getByRole('button',{name:'Pause practice',exact:true}).click();
 await expect(panel).toHaveAttribute('data-battle-status','paused');
 for(const height of [750,1080]){await obs.setViewportSize({width:1920,height});await expect(obs.locator('[data-broadcast-ready="true"]')).toBeVisible();await obs.waitForTimeout(300);await obs.screenshot({path:`${out}/${mode}-${height}.png`});await containment(obs);}
 const hp=await panel.getAttribute('data-authoritative-boss-hp');
 await obs.reload();await expect(panel).toHaveAttribute('data-battle-status','paused');await expect(panel).toHaveAttribute('data-authoritative-boss-hp',hp!);
 await expect(panel.locator('.battle-mode-notice,.battle-impact')).toHaveCount(0);
 await p.getByRole('button',{name:'Resume practice',exact:true}).click();
 await playNotes(p,pitches.slice(50));await expect(panel).toHaveAttribute('data-battle-status','victory');await expect(status).toContainText('Victory');
 await expect(panel).toHaveAttribute('data-authoritative-boss-hp','0');
 expect(await obs.evaluate(()=>(window as unknown as {obsMidi:number}).obsMidi)).toBe(0);

 const read=async()=>{const r=await p.request.post('/api/platform',{headers:{origin},data:{action:'gameState'}});return r.json();};
 await expect.poll(async()=>(await read()).xp).toBeGreaterThan(0);
 const saved=await read();expect(saved.settings.bossBattle.gameMode).toBe(mode==='survival'?'timeAttack':'survival');
 await p.reload();await p.getByText('Progression & recording controls',{exact:true}).click();await expect(p.getByLabel('Game mode',{exact:true})).toHaveValue(saved.settings.bossBattle.gameMode);
 }finally{await ctx.close();if(process.env.V9_VIDEO==='1')await obs.video()!.saveAs(`${out}/${mode}-gameplay.webm`);}
});

test('V9 timer starts on evaluation, freezes on pause, and times out once without HP damage',async({page})=>{
 const id=`v9-clock-${crypto.randomUUID()}`;await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});await installMidiKeyboard(page);
 await page.goto('/student/practice?collection=schmitt&exercise=2001');const controls=page.getByRole('region',{name:'Pianist progression'});
 await expect(controls.getByText('Connecting progression…')).toHaveCount(0);await controls.getByText('Progression & recording controls',{exact:true}).click();await controls.getByLabel('Boss Battle Mode',{exact:true}).check();await controls.getByLabel('Game mode',{exact:true}).selectOption('timeAttack');await controls.getByLabel('Explicit time limit',{exact:true}).fill('3');
 await page.getByRole('button',{name:'Connect keyboard',exact:true}).click();await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
 const status=page.getByRole('region',{name:'Practice battle status'});await page.waitForTimeout(3300);await expect(status).toHaveAttribute('data-battle-status','active');await expect(status.getByLabel('Battle countdown')).toContainText('00:03');
 await playNotes(page,[1]);await page.getByRole('button',{name:'Pause practice',exact:true}).click();const label=await status.getByLabel('Battle countdown').textContent();await page.waitForTimeout(3500);await expect(status.getByLabel('Battle countdown')).toHaveText(label!);
 await page.getByRole('button',{name:'Resume practice',exact:true}).click();await expect(status).toHaveAttribute('data-battle-status','defeat',{timeout:6000});await expect(status).toContainText('Time up');await expect(status.getByLabel('Battle countdown')).toContainText('00:00');
 await playNotes(page,noteGroups(schmittLibrary[0],'both').flatMap(g=>g.pitches));await expect(status).toHaveAttribute('data-battle-status','defeat');
});
