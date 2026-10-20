import {test,expect} from '@playwright/test';
test('banner follows a separate browser promptly and falls back when streaming is unavailable',async({browser})=>{
 const id=`obs-fast-${Date.now()}`;
 const headers={'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`};
 const practiceContext=await browser.newContext({extraHTTPHeaders:headers});
 const overlayContext=await browser.newContext({extraHTTPHeaders:headers});
 const practice=await practiceContext.newPage(),overlay=await overlayContext.newPage();
 try {
  await practice.goto('http://127.0.0.1:8787/student/practice?collection=schmitt');
  await practice.getByLabel('Exercise',{exact:true}).selectOption('2032');
  await overlay.goto('http://127.0.0.1:8787/obs');
  await expect(overlay.locator('h1')).toHaveText('Schmitt Op. 16 · Exercise 32');
  // This also verifies the server cadence, independently of cached UI state.
  const gaps=await overlay.evaluate(async()=>{
   const abort=new AbortController();
   const response=await fetch('/api/obs?stream=1',{signal:abort.signal});
   const reader=response.body!.getReader(),decoder=new TextDecoder();
   let text='';const times:number[]=[];
   while(times.length<3){
    const {value,done}=await reader.read();if(done)break;
    text+=decoder.decode(value,{stream:true});
    const events=text.split('\n\n');text=events.pop()!;
    for(const event of events)if(event.startsWith('data:'))times.push(performance.now());
   }
   abort.abort();return times.slice(1).map((t,i)=>t-times[i]);
  });
  expect(gaps).toHaveLength(2);
  for(const gap of gaps)expect(gap).toBeLessThan(1000);
  await practice.getByLabel('Hands',{exact:true}).selectOption('right');
  await expect(overlay.locator('.obs-hands')).toContainText('Right hand',{timeout:1500});
  await overlay.route('**/api/obs?stream=1',r=>r.abort());
  await overlay.reload();
  await expect(overlay.locator('.obs-hands')).toContainText('Right hand');
  await practice.getByLabel('Hands',{exact:true}).selectOption('left');
  await expect(overlay.locator('.obs-hands')).toContainText('Left hand',{timeout:1500});
 } finally {await practiceContext.close();await overlayContext.close();}
});
