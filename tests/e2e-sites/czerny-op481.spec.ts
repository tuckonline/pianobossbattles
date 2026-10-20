import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const data=JSON.parse(readFileSync('hosted/data/czerny-op481.json','utf8'));
import {noteGroups,type Exercise} from '../../hosted/sight-library';
test('checked Op481 selection loads, renders fingerings, navigates, plays and saves',async({page})=>{
 const id=`op481-${Date.now()}`;
 const headers={'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`};
 await page.setExtraHTTPHeaders(headers);
 await page.goto('/student/practice?collection=czerny481');
 const select=page.getByLabel('Exercise',{exact:true});
 await expect(select).toHaveValue('6001');
 await expect(select.locator('option')).toHaveCount(2);
 await expect(page.getByRole('region',{name:'Collection progress',exact:true})).toContainText('0 of 2 mastered');
 await expect(page.locator('svg .fing').first()).toBeAttached();
 await page.locator('svg').last().screenshot({path:'../../work/op481-render-1.png'});
 await page.keyboard.press('ArrowRight');
 await expect(select).toHaveValue('6002');
 await expect(page.locator('svg .fing').first()).toBeAttached();
 await page.locator('svg').last().screenshot({path:'../../work/op481-render-2.png'});
 await page.getByRole('button',{name:'Listen',exact:true}).click();
 await expect(page.getByRole('button',{name:'Stop listening',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Stop listening',exact:true}).click();
 const r=await page.request.post('/api/platform',{headers:{...headers,origin:'http://127.0.0.1:8787'},data:{action:'sightAttempt',exerciseNumber:6002,hand:'both',played:noteGroups(data[1] as Exercise,'both').flatMap(g=>g.pitches)}});
 expect(r.ok(),await r.text()).toBeTruthy();
 await page.reload();
 await expect(page.getByRole('region',{name:'Collection progress',exact:true})).toContainText('1 learning');
 expect((await page.request.get('/scores/czerny-op481.pdf')).ok()).toBeTruthy();
});


