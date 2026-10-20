import {test,expect} from '@playwright/test';
import {classicalLibrary} from '../../hosted/classical-library';
import {noteGroups} from '../../hosted/sight-library';
import {installMidiKeyboard,playNotes} from './helpers/midi';

const study=(id:number)=>classicalLibrary.find(e=>e.number===id)!;
test.beforeEach(async({page})=>{
  const id=`classical-48-${Date.now()}`;
  await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  await installMidiKeyboard(page);
  await page.goto('/student/practice?collection=classical');
});

test('all 48 steps render with fingerings and the eight-stage path follows course order',async({page})=>{
  test.setTimeout(180000);
  await page.setViewportSize({width:1440,height:1000});
  const selector=page.getByLabel('Exercise',{exact:true});
  const path=page.getByRole('region',{name:'Classical Foundations learning path'});
  await expect(selector.locator('option')).toHaveCount(48);
  await expect(selector).toHaveValue('8025');
  await expect(page.getByRole('region',{name:'Collection progress',exact:true})).toContainText('48 not started');
  await path.getByText('View the 48-step learning path',{exact:true}).click();
  await expect(path.getByRole('heading',{level:3})).toHaveCount(8);
  await expect(path.getByRole('button')).toHaveCount(48);
  await path.screenshot({path:'../../work/classical48-path.png'});
  await path.getByRole('button',{name:'3. Five-Note Ladder Not started',exact:true}).click();
  await expect(selector).toHaveValue('8027');
  await page.locator('body').click({position:{x:5,y:5}});
  await page.keyboard.press('ArrowRight');
  await expect(selector).toHaveValue('8001');
  await expect(path).toContainText('Step 4 of 48');
  await page.keyboard.press('ArrowLeft');
  await expect(selector).toHaveValue('8027');
  await path.getByText('View the 48-step learning path',{exact:true}).click();
  for(const ex of classicalLibrary){
    await selector.selectOption(String(ex.number));
    await expect(page.locator('.notation .measure')).toHaveCount(ex.right.length);
    await expect(page.locator('.notation .fing').first()).toBeVisible();
    await expect(path).toContainText(`Step ${ex.step} of 48`);
    if([8025,8028,8035,8039,8048].includes(ex.number))
      await page.locator('.notation').screenshot({path:`../../work/classical48-${ex.number}.png`});
  }
  await page.setViewportSize({width:390,height:844});
  await path.getByText('View the 48-step learning path',{exact:true}).click();
  await path.screenshot({path:'../../work/classical48-path-mobile.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('old history stays attached to the same piece at its new course position',async({page})=>{
  const result=await page.request.post('/api/platform',{headers:{origin:new URL(page.url()).origin},data:{
    action:'sightAttempt',exerciseNumber:8001,hand:'both',played:noteGroups(study(8001),'both').flatMap(g=>g.pitches),
  }});
  expect(result.ok(),await result.text()).toBeTruthy();
  await page.reload();
  const selector=page.getByLabel('Exercise',{exact:true});
  await expect(selector.locator('option[value="8001"]')).toContainText('4. Five-Finger Promenade');
  await expect(selector.locator('option[value="8001"]')).toContainText('Learning');
  await expect(selector.locator('option[value="8025"]')).toContainText('Not started');
  await selector.selectOption('8001');
  await expect(page.locator('.practice-best')).toContainText('1 completed attempts');
  await page.getByRole('button',{name:'Connect keyboard',exact:true}).click();
  await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
  await playNotes(page,noteGroups(study(8001),'both').flatMap(g=>g.pitches));
  await expect(page.getByText(/Saved · 100% note accuracy/)).toBeVisible();
  await expect(page.locator('.practice-best')).toContainText('2 completed attempts');
});

test('new chord and rest studies grade and update progress immediately',async({page})=>{
  const selector=page.getByLabel('Exercise',{exact:true});
  const path=page.getByRole('region',{name:'Classical Foundations learning path'});
  await page.getByRole('button',{name:'Connect keyboard',exact:true}).click();
  await selector.selectOption('8041');
  await expect(page.locator('.notation .chord').first()).toBeVisible();
  const notes=noteGroups(study(8041),'both').flatMap(g=>g.pitches);
  for(let attempt=0;attempt<3;attempt++){
    await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
    await expect(path.getByRole('button',{includeHidden:true}).first()).toBeDisabled();
    await playNotes(page,notes);
    await expect(page.getByText(/Saved · 100% note accuracy/)).toBeVisible();
  }
  await expect(selector.locator('option:checked')).toContainText('Mastered');
  await expect(page.getByRole('region',{name:'Collection progress',exact:true})).toContainText('1 of 48 mastered');
  await selector.selectOption('8028');
  await expect(page.locator('.notation .rest').first()).toBeVisible();
  await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
  await playNotes(page,noteGroups(study(8028),'both').flatMap(g=>g.pitches));
  await expect(page.getByText(/Saved · 100% note accuracy/)).toBeVisible();
  await expect(page.getByRole('region',{name:'Collection progress',exact:true})).toContainText('1 learning');
});

test('the finale supports each hand, full MIDI grading, Listen and the independent OBS source',async({page})=>{
  await page.getByLabel('Exercise',{exact:true}).selectOption('8048');
  await page.getByRole('button',{name:'Connect keyboard',exact:true}).click();
  const obs=await page.context().newPage();
  try{
    await obs.goto('/obs');
    await expect(obs.locator('h1')).toHaveText('48. Festival Rondo');
    for(const hand of ['right','left','both'] as const){
      await page.getByLabel('Hands',{exact:true}).selectOption(hand);
      await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
      // A full burst verifies grading is independent of elapsed time and rests.
      await playNotes(page,noteGroups(study(8048),hand).flatMap(g=>g.pitches));
      await expect(page.getByText(/Saved · 100% note accuracy/)).toBeVisible();
    }
    await expect(obs.getByText('100%',{exact:true}).first()).toBeVisible();
    await page.evaluate(()=>{
      const original=HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play=function(){Object.assign(window,{classicalAudio:this});return original.call(this);};
    });
    await page.getByRole('button',{name:'Listen',exact:true}).click();
    await expect(page.getByRole('button',{name:'Stop listening',exact:true})).toBeVisible();
    await expect(page.getByLabel('Exercise',{exact:true})).toBeDisabled();
    const duration=await page.evaluate(()=>(window as unknown as {classicalAudio:HTMLMediaElement}).classicalAudio.duration);
    expect(duration).toBeCloseTo(96.08,1);
    await page.getByRole('button',{name:'Stop listening',exact:true}).click();
    await expect(page.getByLabel('Exercise',{exact:true})).toBeEnabled();
  }finally{await obs.close();}
});
