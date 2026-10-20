import {test,expect} from '@playwright/test';
import {sightLibrary,noteGroups} from '../../hosted/sight-library';
import {installMidiKeyboard,playNotes} from './helpers/midi';

test.beforeEach(async({page})=>{
  const id=`sight-progress-${Date.now()}`;
  await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  await installMidiKeyboard(page);
  await page.goto('/student/sight-read');
});

test('three continuous sight-reading loops retain every final note, save each attempt and master immediately',async({page})=>{
  const summary=page.getByRole('region',{name:'Collection progress',exact:true});
  const status=page.getByLabel('Exercise learning status');
  await expect(summary).toContainText('60 not started');
  await expect(status).toHaveText('Status: Not started');
  await expect(page.getByLabel('Exercise',{exact:true}).locator('option')).toHaveCount(60);
  await page.getByRole('button',{name:'Connect keyboard',exact:true}).click();
  await page.getByLabel('Practice loops',{exact:true}).fill('3');
  const saves:{exerciseNumber:number;played:number[];omitClosing:boolean}[]=[];
  page.on('request',r=>{if(r.url().endsWith('/api/platform')&&r.method()==='POST'&&r.postDataJSON()?.action==='sightAttempt')saves.push(r.postDataJSON());});
  await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
  await expect(page.getByLabel('Practice loops',{exact:true})).toBeDisabled();
  const groups=noteGroups(sightLibrary[0],'both'), notes=groups.flatMap(g=>g.pitches);
  await playNotes(page,groups.slice(0,-1).flatMap(g=>g.pitches));
  await expect(page.getByText('Loop 1 of 3',{exact:true})).toBeVisible();
  await expect(page.getByRole('progressbar',{name:'Exercise progress'})).toHaveAttribute('value',String(groups.length-1));
  await playNotes(page,groups.at(-1)!.pitches);
  await expect(page.getByText('Loop 2 of 3',{exact:true})).toBeVisible();
  expect(saves).toHaveLength(0);
  // Loop boundaries must also work when notes arrive before React repaints.
  await playNotes(page,[...notes,...notes]);
  await expect(page.getByText(/3 loops complete · Saved · 100%/)).toBeVisible();
  expect(saves.map(s=>s.played)).toEqual([notes,notes,notes]);
  expect(saves.map(s=>s.omitClosing)).toEqual([false,false,false]);
  await expect(summary).toContainText('1 of 60 mastered');
  await expect(summary).toContainText('0 learning · 0 needs review · 59 not started');
  await expect(status).toHaveText('Status: Mastered');
  await expect(page.getByLabel('Exercise',{exact:true}).locator('option:checked')).toContainText('Mastered');
  await expect(page.locator('.practice-best')).toContainText('3 completed attempts');
  await playNotes(page,notes);
  expect(saves).toHaveLength(3);
  await page.reload();
  await expect(summary).toContainText('1 of 60 mastered');
  await expect(status).toHaveText('Status: Mastered');
  await page.getByLabel('Practice loops',{exact:true}).fill('3');
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:'../../work/sight-progress-loops.png'});
});

test('history, review dates and stream resets use the same saved progress for sight reading',async({page,browser})=>{
  const headers={origin:new URL(page.url()).origin};
  for(const [number,hand,count] of [[2,'right',1],[3,'both',3]] as const){
    for(let i=0;i<count;i++){
      const response=await page.request.post('/api/platform',{headers,data:{action:'sightAttempt',exerciseNumber:number,hand,played:noteGroups(sightLibrary[number-1],hand).flatMap(g=>g.pitches)}});
      expect(response.ok(),await response.text()).toBeTruthy();
    }
  }
  await page.reload();
  const summary=page.getByRole('region',{name:'Collection progress',exact:true});
  await expect(summary).toContainText('1 of 60 mastered');
  await expect(summary).toContainText('1 learning · 0 needs review · 58 not started');
  await page.getByLabel('Exercise',{exact:true}).selectOption('2');
  await expect(page.getByLabel('Exercise learning status')).toHaveText('Status: Learning');
  // The browser resolves review dates as time passes, without mutating history.
  await page.clock.install({time:new Date(Date.now()+8*86400000)});
  await page.getByLabel('Exercise',{exact:true}).selectOption('3');
  await expect(summary).toContainText('0 of 60 mastered');
  await expect(summary).toContainText('1 learning · 1 needs review · 58 not started');
  await expect(page.getByLabel('Exercise learning status')).toHaveText('Status: Needs review');
  await expect(page.getByLabel('Exercise',{exact:true}).locator('option:checked')).toContainText('Needs review');
  const reset=await page.request.post('/api/platform',{headers,data:{action:'resetStreamStats'}});
  expect(reset.ok()).toBeTruthy();
  await page.reload();
  await expect(summary).toContainText('1 learning · 1 needs review · 58 not started');
  await summary.getByText('Collection Progress',{exact:true}).click();
  await expect(summary.getByRole('img')).toHaveAttribute('aria-label','0 Mastered, 1 Learning, 1 Needs review, 58 Not started');
  const other=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':`sight-other-${Date.now()}`,'oai-authenticated-user-email':'sight-other@example.test'}});
  try {
    const otherPage=await other.newPage();await otherPage.goto('http://127.0.0.1:8787/student/sight-read');
    await expect(otherPage.getByRole('region',{name:'Collection progress',exact:true})).toContainText('60 not started');
  } finally {await other.close();}
});

test('either hand can loop with per-loop saves, stop early, and navigate without changing progress rules',async({page})=>{
  await page.getByRole('button',{name:'Connect keyboard',exact:true}).click();
  await page.getByLabel('Practice loops',{exact:true}).fill('0');
  await page.getByLabel('Practice loops',{exact:true}).blur();
  await expect(page.getByLabel('Practice loops',{exact:true})).toHaveValue('1');
  await page.getByLabel('Practice loops',{exact:true}).fill('2');
  await page.getByLabel('Continuous · save after all loops',{exact:true}).uncheck();
  for(const hand of ['right','left'] as const){
    await page.getByLabel('Hands',{exact:true}).selectOption(hand);
    await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
    await playNotes(page,noteGroups(sightLibrary[0],hand).flatMap(g=>g.pitches));
    await expect(page.getByText('Loop 2 of 2',{exact:true})).toBeVisible();
    await expect(page.locator('.practice-best')).toContainText('1 completed attempts');
    await playNotes(page,noteGroups(sightLibrary[0],hand).flatMap(g=>g.pitches));
    await expect(page.getByText(/2 loops complete · Saved · 100%/)).toBeVisible();
    await expect(page.locator('.practice-best')).toContainText('2 completed attempts');
    await expect(page.getByLabel('Exercise learning status')).toHaveText('Status: Learning');
  }
  await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
  await playNotes(page,noteGroups(sightLibrary[0],'left')[0].pitches);
  await page.getByRole('button',{name:'Stop practice',exact:true}).click();
  await expect(page.getByText('Practice stopped. Start again when ready.')).toBeVisible();
  await expect(page.locator('.practice-best')).toContainText('2 completed attempts');
  await page.getByLabel('Exercise',{exact:true}).selectOption('2');
  await expect(page.getByLabel('Exercise learning status')).toHaveText('Status: Not started');
  await page.getByLabel('Exercise',{exact:true}).selectOption('1');
  await expect(page.getByLabel('Exercise learning status')).toHaveText('Status: Learning');
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByLabel('Practice loops',{exact:true})).toBeEnabled();
  await page.locator('.practice-controls-panel').screenshot({path:'../../work/sight-loops-mobile.png'});
});
