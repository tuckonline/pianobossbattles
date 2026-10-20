import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {noteGroups,type Exercise} from '../../hosted/sight-library';
const ex=JSON.parse(readFileSync('hosted/data/repertoire.json','utf8')).find((e:Exercise)=>e.number===7003) as Exercise;
test('Carol opens from Repertoire, grades melody, plays and saves',async({page})=>{
 const id=`carol-${Date.now()}`,headers={'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`};await page.setExtraHTTPHeaders(headers);
 await page.goto('/student/repertoire');await page.getByRole('link',{name:'Practise Carol of the Bells'}).click();await expect(page.getByLabel('Exercise',{exact:true})).toHaveValue('7003');await expect(page.getByLabel('Hands',{exact:true})).toHaveValue('right');await expect(page.getByLabel('Hands',{exact:true}).locator('option')).toHaveCount(1);
 await expect(page.locator('svg .note')).toHaveCount(516);await page.locator('svg').last().scrollIntoViewIfNeeded();await page.screenshot({path:'../../work/carol-render.png'});
 await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();await page.getByRole('button',{name:'Play E♭4',exact:true}).count().then(async count=>{if(count)await page.getByRole('button',{name:'Play E♭4',exact:true}).click();else await page.getByRole('button',{name:'Play D♯4',exact:true}).click();});await page.getByRole('button',{name:'Stop practice',exact:true}).click();
 await page.getByRole('button',{name:'Listen',exact:true}).click();await expect(page.getByRole('button',{name:'Stop listening',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Stop listening',exact:true}).click();
 const r=await page.request.post('/api/platform',{headers:{...headers,origin:'http://127.0.0.1:8787'},data:{action:'sightAttempt',exerciseNumber:7003,hand:'right',played:noteGroups(ex,'right').flatMap(g=>g.pitches)}});expect(r.ok(),await r.text()).toBeTruthy();
 await page.reload();await expect(page.getByLabel('Exercise',{exact:true})).toHaveValue('7003');await expect(page.locator('.practice-best')).toContainText('100%');
 await page.getByLabel('Exercise',{exact:true}).selectOption('7002');await expect(page.getByLabel('Hands',{exact:true})).toHaveValue('both');await expect(page.getByLabel('Tempo',{exact:true})).toHaveCount(0);
});
