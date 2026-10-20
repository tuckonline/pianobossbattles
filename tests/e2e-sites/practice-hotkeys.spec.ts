import {test,expect} from '@playwright/test';
test('practice shortcuts navigate, start and stop without interfering with controls',async({page})=>{
 const id=`keys-${Date.now()}`;
 await page.setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
 await page.goto('/student/practice?collection=schmitt');
 const exercise=page.getByLabel('Exercise',{exact:true});
 const start=page.getByRole('button',{name:'Start MIDI practice',exact:true});
 await page.keyboard.press('ArrowLeft');await expect(exercise).toHaveValue('2001');
 await page.keyboard.press('ArrowRight');await expect(exercise).toHaveValue('2002');
 await page.keyboard.press('ArrowLeft');await expect(exercise).toHaveValue('2001');
 await page.keyboard.press('Enter');await expect(start).toBeDisabled();
 await page.keyboard.press('ArrowRight');await expect(exercise).toHaveValue('2001');
 await page.keyboard.press('Space');await expect(start).toBeEnabled();
 await expect(page.getByText('Practice stopped. Start again when ready.')).toBeVisible();
 const passes=page.getByLabel('Practice passes',{exact:true});
 await passes.focus();await page.keyboard.press('Enter');await expect(start).toBeEnabled();
 await passes.focus();await page.keyboard.press('ArrowRight');await expect(exercise).toHaveValue('2001');
 await start.click();await page.keyboard.press('Space');await expect(start).toBeEnabled();
 await page.keyboard.press('Enter');await expect(start).toBeDisabled();
 const piano=page.getByRole('button',{name:'Play C4',exact:true});
 await piano.focus();await page.keyboard.press('Space');await expect(start).toBeDisabled();
 await page.locator('body').click({position:{x:5,y:5}});
 await page.keyboard.press('Space');await expect(start).toBeEnabled();
 await exercise.selectOption('2213');await exercise.blur();
 await page.keyboard.press('ArrowRight');await expect(exercise).toHaveValue('2213');
});


