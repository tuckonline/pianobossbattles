import {test,expect} from '@playwright/test';

test('pre-V9 settings responses cannot blank practice or profile after load/reload',async({page})=>{
  const id=`legacy-settings-${crypto.randomUUID()}`;
  await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  let legacyReads=0;
  await page.route('**/api/platform',async route=>{
    const response=await route.fetch();
    if(route.request().postDataJSON()?.action!=='gameState'){await route.fulfill({response});return;}
    const body=await response.json();
    if(body.settings)delete body.settings.cinematics;
    const boss=body.settings?.bossBattle;
    if(boss){
      legacyReads++;
      for(const key of ['gameMode','selectedBpm','allowanceMultiplier','explicitTimeLimitSeconds','powerThreshold','adaptivePower'])delete boss[key];
      boss.enabled=true;boss.bossDamagePerMistake=15;boss.multiRoundEnabled=true;
    }
    await route.fulfill({response,json:body});
  });
  await page.goto('/student/practice?collection=schmitt&exercise=2001');
  await expect(page.locator('.progress-save-status')).toContainText('All progress saved');
  await page.getByText('Progression & recording controls',{exact:true}).click();
  await expect(page.getByLabel('Game mode',{exact:true})).toHaveValue('survival');
  await expect(page.getByLabel('Enable OBS cinematics',{exact:true})).toBeChecked();
  await expect(page.getByLabel('Boss Battle Mode',{exact:true})).toBeChecked();
  await expect(page.getByRole('region',{name:'Practice battle status'})).toContainText('Brutal');
  await page.reload();
  await expect(page.locator('.progress-save-status')).toContainText('All progress saved');
  await expect(page.getByRole('button',{name:'Start MIDI practice',exact:true})).toBeVisible();
  await page.goto('/student/profile');
  await expect(page.getByRole('region',{name:'Saved pianist progress'})).toBeVisible();
  await expect(page.locator('.progress-save-status')).toContainText('All progress saved');
  expect(legacyReads).toBeGreaterThan(1);expect(errors).toEqual([]);
});
