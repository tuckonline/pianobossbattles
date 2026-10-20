import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {schmittLibrary} from '../../hosted/schmitt-library';

test('every Schmitt closing measure stays attached and contained in both OBS layouts',async({browser})=>{
 test.setTimeout(600000);
 const id=`cadence-${crypto.randomUUID()}`,origin='http://127.0.0.1:8787';
 const ctx=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`}});
 try{
 const horizontal=await ctx.newPage(),vertical=await ctx.newPage();
 await horizontal.setViewportSize({width:1920,height:750});await vertical.setViewportSize({width:1080,height:1920});
 await horizontal.request.post('/api/platform',{headers:{origin},data:{action:'gameState'}});
 await horizontal.goto('/obs/recording');await vertical.goto('/obs/shorts');
 const sourceId=crypto.randomUUID();let sequence=0,paired=0;
 await mkdir('../../work/schmitt-cadence',{recursive:true});
 for(const exercise of schmittLibrary){
  const response=await horizontal.request.post('/api/obs',{headers:{origin},data:{sourceId,sequence:++sequence,claim:true,snapshot:{exerciseNumber:exercise.number,title:exercise.title,hand:'both',status:'practicing',accuracy:100,mistakes:0,measure:exercise.right.length,totalMeasures:exercise.right.length,score:{presentationId:String(exercise.number),activeMeasure:exercise.right.length-1,activeBeat:0,feedback:[],size:{mode:"auto",percent:100},compact:true,follow:true,listening:false}}}});
  expect(response.ok(),await response.text()).toBe(true);
  for(const page of [horizontal,vertical]){
   const notation=page.locator('.notation');
   await expect(notation).toHaveAttribute('data-score-presentation',String(exercise.number));
   await expect(notation).toHaveAttribute('data-score-pending','false');
   await expect(notation).toHaveAttribute('data-broadcast-ready','true');
   const measures=await notation.locator('.measure').evaluateAll(nodes=>nodes.map(n=>({visible:getComputedStyle(n).visibility==='visible',notes:n.querySelectorAll('.note').length,rect:(()=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};})()})));
   expect(measures.length).toBe(exercise.right.length);
   const last=measures.at(-1)!;
   expect(last.visible,`Schmitt ${exercise.number-2000} closing measure`).toBe(true);
   if(page===vertical && measures.length>1 && last.notes<=4){expect(measures.at(-2)!.visible,`Schmitt ${exercise.number-2000} orphan closing chord`).toBe(true);paired++;}
   const region=(await page.locator('.sight-score').boundingBox())!;
   for(const m of measures.filter(m=>m.visible)){
    expect(m.rect.left).toBeGreaterThanOrEqual(region.x-1);expect(m.rect.right).toBeLessThanOrEqual(region.x+region.width+1);
    expect(m.rect.top).toBeGreaterThanOrEqual(region.y-1);expect(m.rect.bottom).toBeLessThanOrEqual(region.y+region.height+1);
   }
   if([2001,2007,2008,2213].includes(exercise.number))await page.screenshot({path:`../../work/schmitt-cadence/${exercise.number}-${page===vertical?'vertical':'horizontal'}.png`});
  }
 }
 console.log(`Audited ${schmittLibrary.length} Schmitt exercises in both layouts; ${paired} short closing measures retained with their preceding measure.`);
 }finally{await ctx.close();}
});
