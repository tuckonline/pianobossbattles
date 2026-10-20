import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {installMidiKeyboard,playNotes} from './helpers/midi';
import {schmittLibrary} from '../../hosted/schmitt-library';
import {noteGroups,practicePass} from '../../hosted/sight-library';
const out='../../work/timed-challenge';
async function hudFits(page:Page){
 const boxes=await page.locator('.battle-hud').evaluate(el=>{
  const hud=el.getBoundingClientRect();
  return [...el.querySelectorAll('.battle-countdown,.battle-health,.battle-power,.battle-shields')].map(c=>{
   const r=c.getBoundingClientRect();return {name:c.className,fits:r.left>=hud.left&&r.right<=hud.right&&r.top>=hud.top-1&&r.bottom<=hud.bottom+1};
  });
 });
 expect(boxes.every(b=>b.fits),JSON.stringify(boxes)).toBe(true);
 const uncovered=await page.getByLabel('Battle countdown').evaluate(el=>{
  const r=el.getBoundingClientRect(),top=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
  return top===el||!!top&&el.contains(top);
 });
 expect(uncovered).toBe(true);
 expect(await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}))).toEqual(page.viewportSize());
}
test('progressive speed: Schmitt loops and exercises, one intro, synchronized readable clocks, pause and reconnect',async({browser})=>{
 test.setTimeout(120000);await mkdir(out,{recursive:true});const id=`tempo-${crypto.randomUUID()}`;
 const context=await browser.newContext({viewport:{width:1920,height:750},extraHTTPHeaders:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`}});
 const p=await context.newPage(),h=await context.newPage(),v=await context.newPage(),errors:string[]=[];
 for(const page of [p,h,v])page.on('pageerror',e=>errors.push(e.message));
 try{
 await installMidiKeyboard(p);await p.goto('/student/practice?collection=schmitt&exercise=2007');
 const controls=p.getByRole('region',{name:'Pianist progression'}),status=p.getByRole('region',{name:'Practice battle status'});
 await expect(controls.getByText('Connecting progression…')).toHaveCount(0);
 await controls.getByText('Progression & recording controls',{exact:true}).click();
 await controls.getByLabel('Boss Battle Mode',{exact:true}).check();
 await controls.getByLabel('Game mode',{exact:true}).selectOption('timeAttack');
 await controls.getByLabel('Progressive speed challenge',{exact:true}).check();
 await controls.getByLabel('Explicit time limit',{exact:true}).fill('28');
 await p.getByLabel('Play a continuous exercise chain',{exact:true}).check();
 for(let i=0;i<4;i++){
  await p.getByLabel('Add chain exercise',{exact:true}).selectOption(String(schmittLibrary[6+i].number));
  await p.getByLabel(`Chain exercise ${i+1} loops`,{exact:true}).fill(i===0?'2':'1');
 }
 await h.goto('/obs/recording');await v.setViewportSize({width:1080,height:1920});await v.goto('/obs/shorts');
 for(const page of [h,v])await expect(page.getByLabel('Boss battle',{exact:true}).locator('[data-asset-status=ready]')).toHaveCount(2,{timeout:15000});
 await p.getByRole('button',{name:'Connect keyboard',exact:true}).click();
 await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
 await expect(status).toHaveAttribute('data-battle-status','active',{timeout:7000});
 const snapshot=async()=>p.request.get('/api/obs',{maxRetries:2}).then(r=>r.json()).then(r=>r.snapshot.game.battle);
 const first=await snapshot(),stages=[];
 for(let pass=0;pass<5;pass++){
  const stage=['EASY · 60 BPM','NORMAL · 80 BPM','HARD · 110 BPM','EXPERT · 140 BPM','EXPERT · 140 BPM'][pass];
  await expect.poll(async()=>(await snapshot()).loop.number).toBe(pass+1);
  for(const page of [h,v]){await expect(page.locator('.battle-tempo-stage')).toHaveText(stage);await expect(page.getByLabel('Battle start countdown')).toHaveCount(0);await hudFits(page);}
  const state=await snapshot();stages.push({pass:pass+1,stage,limitMs:state.timer.limitMs});
  expect(state.attemptId).toBe(first.attemptId);expect(state.countdown).toEqual(first.countdown);
  if(pass===2){
   await p.getByRole('button',{name:'Pause practice',exact:true}).click();
   for(const [page,name] of [[h,'horizontal'],[v,'vertical']] as const){
    await expect(page.getByLabel('Boss battle',{exact:true})).toHaveAttribute('data-battle-status','paused');
    await page.screenshot({path:`${out}/${name}.png`});
    const clock=await page.getByLabel('Battle countdown').innerText();
    await page.reload();await expect(page.getByLabel('Battle countdown')).toHaveText(clock,{useInnerText:true});
    await expect(page.getByLabel('Battle start countdown')).toHaveCount(0);
   }
   await p.getByRole('button',{name:'Resume practice',exact:true}).click();
  }
  if(pass===4){
   // This stage is already running before its first note; waiting cannot grant
   // unlimited practice time. Capture the real low-clock styling and timeout.
   await expect(h.getByLabel('Battle countdown')).toHaveAttribute('data-warning','red',{timeout:15000});
   await p.getByRole('button',{name:'Pause practice',exact:true}).click();
   for(const [page,name] of [[h,'horizontal'],[v,'vertical']] as const){
    await expect(page.getByLabel('Battle countdown')).toHaveAttribute('data-running','false');
    await page.screenshot({path:`${out}/${name}-urgent.png`});
   }
   await p.waitForTimeout(1300);await expect(status).toHaveAttribute('data-battle-status','paused');
   await p.getByRole('button',{name:'Resume practice',exact:true}).click();
   await expect(status).toHaveAttribute('data-battle-status','defeat',{timeout:5000});
   expect((await snapshot()).result).toBe('timeout');break;
  }
  const index=pass<2?6:pass+5,omit=pass===0;
  await playNotes(p,noteGroups(practicePass(schmittLibrary[index],omit),'both').flatMap(g=>g.pitches));
 }
 expect(stages.map(s=>s.limitMs)).toEqual([28000,21000,16000,12000,12000]);
 expect(errors).toEqual([]);await writeFile(`${out}/stages.json`,JSON.stringify(stages,null,2));
 }finally{await context.close();}
});
