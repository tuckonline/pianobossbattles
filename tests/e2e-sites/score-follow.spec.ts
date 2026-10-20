import { test, expect } from '@playwright/test';
import { systemScrollDelta } from '../../src/components/music/score-follow';
import { practiceLibrary } from '../../hosted/practice-library';
import { noteGroups } from '../../hosted/sight-library';
import { noteName } from '../../src/domains/music/model';
test.use({viewport:{width:1440,height:900},extraHTTPHeaders:{'oai-authenticated-user-id':'follow-e2e','oai-authenticated-user-email':'follow-e2e@example.test'}});

test('geometry predicts next system without sacrificing current notes',()=>{
 const safe={top:180,bottom:650};
 expect(systemScrollDelta({top:400,bottom:560},{top:580,bottom:780},safe,true)).toBe(220);
 expect(systemScrollDelta({top:400,bottom:560},{top:580,bottom:780},safe,false)).toBe(0);
 expect(systemScrollDelta({top:200,bottom:400},{top:420,bottom:620},safe,true)).toBe(20);
 expect(systemScrollDelta({top:300,bottom:600},{top:640,bottom:950},safe,true)).toBe(0);
 expect(systemScrollDelta({top:640,bottom:950},undefined,safe,false)).toBe(460);
 expect(systemScrollDelta({top:50,bottom:200},undefined,safe,false)).toBe(-130);
});

async function trigger(page:any,name:string){
 await page.getByRole('button',{name,exact:true}).evaluate((e:HTMLElement)=>e.click());
}
async function endCue(page:any,system:number){
 return page.locator('.notation .system').nth(system).evaluate((e:Element)=>{
  const notes=Array.from(e.querySelectorAll('.note[data-beat]')).map(n=>{
   const r=(n.querySelector('.notehead')??n).getBoundingClientRect();
   return {x:r.left+r.width/2,beat:Number(n.getAttribute('data-beat'))};
  });
  const lo=Math.min(...notes.map(n=>n.x)),hi=Math.max(...notes.map(n=>n.x));
  return Math.min(...notes.filter(n=>n.x>=lo+(hi-lo)*.92).map(n=>n.beat));
 });
}
async function bounds(page:any){return page.locator('.notation .system').evaluateAll((systems:Element[])=>systems.map(s=>({top:s.getBoundingClientRect().top,bottom:s.getBoundingClientRect().bottom})));}

test('MIDI follows systems predictively in 250ms, stays still between moves, and keeps grading/focus',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('pianopath-score-follow',JSON.stringify({version:2,enabled:true,stream:true,top:10,bottom:28})));
 await page.goto('/student/practice?stream=1');
 await page.locator('.notation .note').first().waitFor();
 await page.getByLabel('Hands',{exact:true}).selectOption('right');
 await page.clock.install();await page.clock.pauseAt(new Date());
 await trigger(page,'Start MIDI practice');
 await page.clock.runFor(300);
 const panelTop=await page.locator('.sight-score').evaluate(e=>e.getBoundingClientRect().top);
 expect(panelTop).toBeGreaterThanOrEqual(-1);
 expect(panelTop).toBeLessThanOrEqual(1);
 const initial=await bounds(page);
 expect(initial[0].top).toBeGreaterThanOrEqual(5);
 expect(initial[1].bottom).toBeLessThanOrEqual(625);
 const firstY=await page.evaluate(()=>scrollY);
 // A stable practice control retains focus while MIDI comes from the simulator.
 await page.getByRole('button',{name:'Stop practice',exact:true}).evaluate(e=>(e as HTMLElement).focus({preventScroll:true}));
 const groups=noteGroups(practiceLibrary[0],'right');
 const awaitCue=await endCue(page,1);
 const target=groups.findIndex(g=>g.beat>=awaitCue);
 // Approach the highlighted end-of-line note positions of system 2.
 for(let i=0;i<target;i++){
  const key=page.getByRole('button',{name:`Play ${noteName(groups[i].pitches[0])}`,exact:true});
  await key.evaluate(e=>{e.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));e.dispatchEvent(new KeyboardEvent('keyup',{key:' ',bubbles:true}));});
  // The next target becomes current immediately. Leave the final transition
  // in progress so the test can send another MIDI note during its animation.
  if(i<target-1) await page.clock.runFor(250);
  if(i===7)expect(await page.evaluate(()=>scrollY)).toBe(firstY);
 }
 const before=await page.evaluate(()=>scrollY);
 await page.clock.runFor(125);
 const middle=await page.evaluate(()=>scrollY);
 expect(middle).toBeGreaterThan(before);
 // MIDI input is still accepted in the middle of the animated transition.
 await page.getByRole('button',{name:`Play ${noteName(groups[target].pitches[0])}`,exact:true}).evaluate(e=>{
  e.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));
  e.dispatchEvent(new KeyboardEvent('keyup',{key:' ',bubbles:true}));
 });
 await page.clock.runFor(150);
 const after=await page.evaluate(()=>scrollY);
 const rects=await bounds(page);
 expect(rects[1].top).toBeGreaterThanOrEqual(5);
 expect(rects[1].top).toBeLessThanOrEqual(7);
 expect(rects[2].bottom).toBeLessThanOrEqual(625);
 await page.clock.runFor(1000);
 expect(await page.evaluate(()=>scrollY)).toBe(after);
 await expect(page.getByRole('progressbar')).toHaveAttribute('value',String(target+1));
 expect(await page.locator('.practice-note-correct').count()).toBe(target+1);
 expect(await page.evaluate(()=>document.activeElement?.textContent)).toBe('Stop practice');
 await trigger(page,'Stop practice');
 await page.clock.runFor(500);
 expect(await page.evaluate(()=>scrollY)).toBe(after);
});

test('Listen uses the same rendered systems; reduced motion jumps immediately and stop cancels follow',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>{
  const original=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){Object.assign(window,{previewMedia:this});return original.call(this);};
 });
 await page.goto('/student/practice?stream=1');
 await page.locator('.notation .note').first().waitFor();
 await trigger(page,'Listen');
 await expect(page.getByRole('button',{name:'Stop listening',exact:true})).toBeEnabled();
 await expect.poll(async()=> (await bounds(page))[0].top).toBeLessThan(250);
 await page.evaluate(t=>{const m=(window as any).previewMedia as HTMLAudioElement;m.currentTime=t;}, (await endCue(page,1))+.05);
 await expect.poll(async()=> (await bounds(page))[1].top).toBeLessThan(250);
 expect((await bounds(page))[2].bottom).toBeLessThanOrEqual(625);
 await trigger(page,'Stop listening');
 const y=await page.evaluate(()=>scrollY);
 await page.waitForTimeout(400);
 expect(await page.evaluate(()=>scrollY)).toBe(y);
});


test('shallow stream viewport keeps a whole system above the reserved camera',async({page})=>{
 await page.setViewportSize({width:1920,height:540});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/student/practice?stream=1');
 await page.locator('.notation .note').first().waitFor();
 await trigger(page,'Start MIDI practice');
 await expect.poll(async()=> (await bounds(page))[0].top).toBeGreaterThanOrEqual(5);
 await expect.poll(async()=> (await bounds(page))[0].bottom).toBeLessThanOrEqual(366);
});


test('first line scrolls at the rendered yellow-mark region and keeps both staves visible',async({page})=>{
 await page.setViewportSize({width:1920,height:760});
 await page.goto('/student/practice?stream=1');
 await page.locator('.notation .note').first().waitFor();
 await page.clock.install(); await page.clock.pauseAt(new Date());
 await trigger(page,'Start MIDI practice');
 await page.clock.runFor(450);
 const start=await bounds(page);
 const safeBottom=760*.72-24;
 expect(start[1].bottom).toBeLessThanOrEqual(safeBottom+1);
 const startY=await page.evaluate(()=>scrollY);
 const groups=noteGroups(practiceLibrary[0],'both');
 const cue=await endCue(page,0);
 const target=groups.findIndex(g=>g.beat>=cue);
 for(let i=0;i<target;i++){
  for(const pitch of groups[i].pitches){
   await page.getByRole('button',{name:`Play ${noteName(pitch)}`,exact:true}).evaluate(e=>{
    e.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));
    e.dispatchEvent(new KeyboardEvent('keyup',{key:' ',bubbles:true}));
   });
  }
  await page.clock.runFor(250);
  if(i===target-2) expect(await page.evaluate(()=>scrollY)).toBe(startY);
 }
 await page.clock.runFor(300);
 const end=await bounds(page);
 expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(startY);
 expect(end[0].top).toBeGreaterThanOrEqual(5);
 expect(end[0].top).toBeLessThanOrEqual(7);
 expect(end[1].bottom).toBeLessThanOrEqual(safeBottom+1);
 await expect(page.getByRole('progressbar')).toHaveAttribute('value',String(target));
 await page.clock.runFor(1000);
 expect((await bounds(page))[1].bottom).toBe(end[1].bottom);
});
