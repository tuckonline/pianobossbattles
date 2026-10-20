import {test,expect} from '@playwright/test';
import {scalesLibrary} from '../../hosted/scales-library';
import {noteGroups} from '../../hosted/sight-library';
import {installMidiKeyboard,playNotes} from './helpers/midi';
test('C-major collection renders, grades and retains progress',async({page})=>{
  test.setTimeout(120000);
  const id=`scales-${Date.now()}`;
  await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  await installMidiKeyboard(page);
  await page.goto('/student/practice?collection=scales');
  await expect(page.getByLabel('Practice collection')).toHaveValue('scales');
  const selector=page.getByLabel('Exercise',{exact:true});
  await expect(selector.locator('option')).toHaveCount(8);
  for(const e of scalesLibrary){
    await selector.selectOption(String(e.number));
    await expect(page.locator('.notation .measure')).toHaveCount(e.right.length);
    await expect(page.locator('.notation .fing').first()).toBeVisible();
    await expect(page.getByRole('region',{name:'Scale practice guide'})).toContainText(e.practiceTip!);
  }
  await selector.selectOption('11006');
  await page.locator('.notation').screenshot({path:'../../work/scales-one-octave.png'});
  await page.getByRole('button',{name:'Connect keyboard',exact:true}).click();
  await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
  await playNotes(page,noteGroups(scalesLibrary[5],'both').flatMap(g=>g.pitches));
  await expect(page.getByText(/Saved · 100% note accuracy/)).toBeVisible();
  await page.reload();
  await expect(selector.locator('option[value="11006"]')).toContainText('Learning');
  await selector.selectOption('11004');
  await page.getByLabel('Hands',{exact:true}).selectOption('right');
  await page.getByRole('button',{name:'Connect keyboard',exact:true}).click();
  await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
  await playNotes(page,noteGroups(scalesLibrary[3],'right').flatMap(g=>g.pitches));
  await expect(page.getByText(/Saved · 100% note accuracy/)).toBeVisible();
});
