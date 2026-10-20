import {test,expect,type Page} from '@playwright/test';
import {schmittLibrary} from '../../hosted/schmitt-library';
import {noteGroups} from '../../hosted/sight-library';
import {noteName} from '../../src/domains/music/model';
import {installMidiKeyboard,playNotes} from './helpers/midi';

test.use({viewport:{width:1540,height:850}});
async function setup(page:Page){
  const id=`score-zoom-${Date.now()}`;
  await page.setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  await page.emulateMedia({reducedMotion:'reduce'});
}
async function setSize(page:Page,percent:number){
  const input=page.getByRole('slider',{name:'Score size',exact:true});
  await input.focus();await input.press('Home');
  for(let n=60;n<percent;n+=10)await input.press('ArrowRight');
  await expect(page.locator('.score-size-controls output')).toHaveText(`${percent}%`);
  await expect(page.locator('.notation')).toHaveClass(/notation-user-sized/);
}
async function firstNoteWidth(page:Page){return page.locator('.notation .notehead').first().evaluate(e=>e.getBoundingClientRect().width);}

test('auto fit uses the available area before practice and stays stable through MIDI completion',async({page})=>{
  await setup(page);await installMidiKeyboard(page);
  // Previous hand-tuned percentages must not lock the new automatic layout.
  await page.addInitScript(()=>localStorage.setItem('pianopath-score-size-v1',JSON.stringify({'schmitt-op16':{mode:'custom',percent:170}})));
  await page.goto('/student/practice?collection=schmitt&stream=1');
  await page.getByLabel('Exercise',{exact:true}).selectOption('2028');
  await expect(page.locator('.notation .system')).toHaveCount(1);
  await expect(page.locator('.notation')).toHaveClass(/notation-auto-single/);
  await expect(page.locator('.score-size-controls output')).toHaveText('Auto fit');
  const fit=()=>page.locator('.sight-score').evaluate(e=>{
    const panel=e.getBoundingClientRect(),root=e.querySelector('.notation')!.getBoundingClientRect(),svg=e.querySelector('.notation > svg')!.getBoundingClientRect();
    return {usedHeight:svg.bottom-panel.top,widthRatio:svg.width/root.width,height:svg.height};
  });
  // Either width or height is the limiting dimension; no arbitrary zoom value.
  await expect.poll(async()=>{const r=await fit();return r.usedHeight<=850*.72-24+.5&&(r.widthRatio>.99||r.usedHeight>850*.72-30);}).toBe(true);
  const before=await firstNoteWidth(page);
  await page.getByRole('button',{name:'Connect keyboard',exact:true}).click();
  await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
  await expect(page.locator('.practice-note-current')).toHaveCount(2);
  await expect.poll(()=>page.locator('.notation .system').evaluate(e=>e.getBoundingClientRect().bottom)).toBeLessThan(850*.72-22);
  await expect.poll(()=>page.locator('.notation .system').evaluate(e=>e.getBoundingClientRect().top)).toBeGreaterThanOrEqual(5);
  await page.screenshot({path:'../../work/score-auto-fit-obs.png'});
  const during=await firstNoteWidth(page);
  expect(during).toBeCloseTo(before,1);
  await playNotes(page,noteGroups(schmittLibrary[27],'both').flatMap(g=>g.pitches));
  await expect(page.getByText(/Saved · 100% note accuracy/)).toBeVisible();
  expect(await firstNoteWidth(page)).toBeCloseTo(during,1);
});

test('auto fit responds to camera clearance and viewport size even with following disabled',async({page})=>{
  await setup(page);await page.goto('/student/practice?collection=schmitt&stream=1');
  await page.getByLabel('Exercise',{exact:true}).selectOption('2028');
  await expect(page.locator('.notation .system')).toHaveCount(1);
  await page.getByText('Score following & OBS safe area',{exact:true}).click();
  await page.getByLabel('Auto-follow score',{exact:true}).uncheck();
  await page.getByLabel('Bottom camera · % of window').fill('35');
  await page.getByLabel('Banner overlap · % of window').fill('12');
  const extent=()=>page.locator('.sight-score').evaluate(e=>e.querySelector('.notation > svg')!.getBoundingClientRect().bottom-e.getBoundingClientRect().top);
  await expect.poll(extent).toBeLessThanOrEqual(850*.53-24+.5);
  const large=await firstNoteWidth(page);
  const y=await page.evaluate(()=>scrollY);
  await page.setViewportSize({width:1540,height:600});
  await expect.poll(()=>firstNoteWidth(page)).toBeLessThan(large*.8);
  await expect.poll(extent).toBeLessThanOrEqual(600*.53-24+.5);
  expect(await page.evaluate(()=>scrollY)).toBe(y);
  await page.getByLabel('Auto-follow score',{exact:true}).check();
  await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
  await expect.poll(()=>page.locator('.notation > svg').evaluate(e=>e.getBoundingClientRect().bottom)).toBeLessThanOrEqual(600*.65-24+.5);
  await expect.poll(()=>page.locator('.sight-score').evaluate(e=>e.getBoundingClientRect().top)).toBeGreaterThanOrEqual(600*.12-1);
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.locator('.notation').evaluate(el=>Array.from(el.querySelectorAll(':scope > svg')).every(s=>s.getBoundingClientRect().width<=el.clientWidth+1))).toBe(true);
  await page.screenshot({path:'../../work/score-auto-fit-mobile.png'});
});

test('manual size persists per collection; reset restores the unchanged multi-line layout',async({page})=>{
  await setup(page);await page.goto('/student/practice?collection=moonlight');
  await page.getByLabel('Exercise',{exact:true}).selectOption('9006');
  await expect(page.locator('.notation .system')).toHaveCount(2);
  await expect(page.locator('.notation')).not.toHaveClass(/notation-auto-single/);
  const normal=await firstNoteWidth(page);
  await setSize(page,140);
  await expect.poll(()=>firstNoteWidth(page)).toBeGreaterThan(normal*1.2);
  await page.getByLabel('Exercise',{exact:true}).selectOption('9007');
  await expect(page.locator('.score-size-controls output')).toHaveText('140%');
  await page.reload();await expect(page.locator('.score-size-controls output')).toHaveText('140%');
  await page.getByLabel('Practice collection').selectOption('schmitt');
  await expect(page.locator('.score-size-controls output')).toHaveText('Auto fit');
  await page.getByLabel('Practice collection').selectOption('moonlight');
  await expect(page.locator('.score-size-controls output')).toHaveText('140%');
  await page.getByLabel('Exercise',{exact:true}).selectOption('9006');
  await page.getByRole('button',{name:'Fit viewing area'}).click();
  await expect(page.locator('.notation')).not.toHaveClass(/notation-user-sized/);
  await expect(page.locator('.notation .system')).toHaveCount(2);
  await expect.poll(()=>firstNoteWidth(page)).toBeCloseTo(normal,1);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Fit width',exact:true}).click();
  await expect(page.locator('.notation')).toHaveClass(/notation-fit-width/);
  await expect.poll(()=>page.locator('.notation').evaluate(el=>Array.from(el.querySelectorAll(':scope > svg')).every(s=>s.getBoundingClientRect().width<=el.clientWidth+1))).toBe(true);
});

test('resizing an active exercise preserves MIDI progress and result saving',async({page})=>{
  await setup(page);await page.goto('/student/practice?collection=schmitt');
  await page.getByLabel('Exercise',{exact:true}).selectOption('2013');

  const now=new Date('2026-10-16T12:00:00Z');await page.clock.install({time:now});await page.clock.pauseAt(new Date(now.getTime()+1000));
  await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
  const groups=noteGroups(schmittLibrary[12],'both');
  for(const [i,g] of groups.entries()){
    for(const pitch of g.pitches)await page.getByRole('button',{name:`Play ${noteName(pitch)}`,exact:true}).click();
    await page.clock.runFor(((groups[i+1]?.beat??schmittLibrary[12].durationBeats!)-g.beat)*1000+30);
    if(i===2){
      const before=await page.getByRole('progressbar').getAttribute('value');
      await page.getByRole('button',{name:'Make score smaller'}).click();await page.clock.runFor(200);
      await expect(page.locator('.notation')).toHaveClass(/notation-user-sized/);
      await expect(page.getByRole('progressbar')).toHaveAttribute('value',before!);
      await expect(page.getByLabel('Tempo',{exact:true})).toHaveCount(0);
      await expect(page.locator('.practice-note-correct')).not.toHaveCount(0);
      await expect(page.locator('.practice-note-current')).toHaveCount(2);
    }
  }
  await expect(page.getByText(/Saved · 100% note accuracy/)).toBeVisible();
});
