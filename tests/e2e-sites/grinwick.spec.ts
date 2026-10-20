import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {installMidiKeyboard,playNotes} from './helpers/midi';
import {noteGroups,sightLibrary} from '../../hosted/sight-library';
test('Grinwick selection, audience frames, attacks, pressure, results and reconnect',async({browser})=>{
 test.setTimeout(150000);const out='../../work/grinwick-review';await mkdir(out,{recursive:true});
 const id=`grin-${crypto.randomUUID()}`,ctx=await browser.newContext({extraHTTPHeaders:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`},viewport:{width:1920,height:750},recordVideo:{dir:out,size:{width:1920,height:750}}});
 const p=await ctx.newPage(),o=await ctx.newPage(),v=await ctx.newPage();const errors:string[]=[];
 for(const page of [p,o,v]){page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{
  Object.assign(window,{audioStarts:0,audioPeak:0});
  const compressor=AudioContext.prototype.createDynamicsCompressor;
  AudioContext.prototype.createDynamicsCompressor=function(){const node=compressor.call(this),destination=this.createMediaStreamDestination(),analyser=this.createAnalyser();node.connect(destination);node.connect(analyser);
   const recorder=new MediaRecorder(destination.stream),chunks:Blob[]=[];recorder.ondataavailable=e=>chunks.push(e.data);recorder.start();
   Object.assign(window,{finishAudio:()=>new Promise<string>(resolve=>{recorder.onstop=()=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(new Blob(chunks,{type:recorder.mimeType}));};recorder.stop();})});
   const samples=new Float32Array(analyser.fftSize);const measure=()=>{analyser.getFloatTimeDomainData(samples);const w=window as unknown as {audioPeak:number};w.audioPeak=Math.max(w.audioPeak,...samples.map(Math.abs));requestAnimationFrame(measure);};measure();return node;
  };
  const native=AudioContext.prototype.createBufferSource;
  AudioContext.prototype.createBufferSource=function(){const s=native.call(this),start=s.start.bind(s);s.start=(...a:Parameters<typeof start>)=>{(window as unknown as {audioStarts:number}).audioStarts++;return start(...a);};return s;};
 });}
 try{
 await installMidiKeyboard(p);await p.goto('/student/sight-read');
 const controls=p.getByRole('region',{name:'Pianist progression'});
 await expect(controls.getByText('Connecting progression…')).toHaveCount(0);
 await controls.getByText('Progression & recording controls',{exact:true}).click();
 await controls.getByLabel('Boss Battle Mode',{exact:true}).check();
 await controls.getByRole('radio',{name:/Grinwick/}).check();
 await controls.getByLabel('Battle sounds (optional)',{exact:true}).check();
 await controls.getByLabel('Battle audio output',{exact:true}).selectOption('obs');
 await expect.poll(async()=>{const r=await p.request.get('/api/obs');return(await r.json()).snapshot?.game?.settings.bossBattle;}).toMatchObject({bossId:'grinwick',soundEnabled:true,audioOutput:'obs'});
 await p.reload();await controls.getByText('Progression & recording controls',{exact:true}).click();
 await expect(controls.getByRole('radio',{name:/Grinwick/})).toBeChecked();await expect(controls.getByLabel('Battle sounds (optional)',{exact:true})).toBeChecked();await expect(controls.getByLabel('Battle audio output',{exact:true})).toHaveValue('obs');
 await o.goto('/obs/recording?battleAudio=1');await v.setViewportSize({width:1080,height:1920});await v.goto('/obs/shorts');
 for(const page of [o,v]){await expect(page.locator('[data-animation-id="grinwick_idle_01"]')).toHaveAttribute('data-asset-status','ready');}
 await o.locator('body').click({position:{x:10,y:10}});
 await expect(o.locator('.battle-fighter-player [data-asset-status=ready]')).toBeVisible();await expect(v.locator('.battle-fighter-player [data-asset-status=ready]')).toBeVisible();await o.waitForTimeout(200);await o.screenshot({path:`${out}/horizontal-idle.png`});const frameTimes=await o.evaluate(()=>new Promise<number[]>(resolve=>{const times:number[]=[];let last=performance.now();const sample=(now:number)=>{times.push(now-last);last=now;if(times.length<90)requestAnimationFrame(sample);else resolve(times.slice(5));};requestAnimationFrame(sample);}));await writeFile(`${out}/frame-times.json`,JSON.stringify({median:frameTimes.sort((a,b)=>a-b)[Math.floor(frameTimes.length/2)],p95:frameTimes[Math.floor(frameTimes.length*.95)],samples:frameTimes},null,2));await v.screenshot({path:`${out}/vertical-idle.png`});
 await p.getByRole('button',{name:'Connect keyboard',exact:true}).click();
 await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
 await expect(controls.getByRole('radio',{name:/Crimson Colossus/})).toBeDisabled();
 await expect(p.getByLabel('Battle start countdown')).toHaveCount(0,{timeout:8000});
 await expect(o.locator('[data-animation-id="grinwick_cackle"]')).toHaveAttribute('data-asset-status','ready',{timeout:12000});
 await o.screenshot({path:`${out}/cackle.png`});
 const notes=noteGroups(sightLibrary[0],'both').flatMap(g=>g.pitches);
 await playNotes(p,[notes[0]]);await expect(o.locator('[data-animation-id="grinwick_cackle"]')).toHaveCount(0);
 await playNotes(p,[1]);await o.waitForTimeout(100);await o.screenshot({path:`${out}/claw-contact.png`});
 await playNotes(p,notes.slice(1));
 await expect(o.locator('.battle-cinematic')).toHaveAttribute('data-result','victory');
 await expect(o.locator('.battle-cinematic')).toHaveAttribute('data-phase','holding',{timeout:12000});
 await expect(o.locator('.battle-cinematic')).toHaveAttribute('data-boss','grinwick');
 await expect(o.locator('.battle-cinematic')).toHaveAttribute('data-fallback','false');
 await o.screenshot({path:`${out}/victory.png`});await v.screenshot({path:`${out}/vertical-victory.png`});
 expect(await o.evaluate(()=>(window as unknown as {audioStarts:number}).audioStarts)).toBeGreaterThan(0);
 expect(await o.evaluate(()=>(window as unknown as {audioPeak:number}).audioPeak)).toBeGreaterThan(.00001);
 const audio=await o.evaluate(()=>(window as unknown as {finishAudio:()=>Promise<string>}).finishAudio());await writeFile(`${out}/audience-audio.webm`,Buffer.from(audio,'base64'));
 await o.reload();await expect(o.locator('.battle-cinematic')).toHaveAttribute('data-phase','holding');
 await o.locator('body').click({position:{x:10,y:10}});await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
 await expect(p.getByLabel('Battle start countdown')).toHaveCount(0,{timeout:8000});
 await playNotes(p,Array(8).fill(1));
 await expect(o.locator('.battle-cinematic')).toHaveAttribute('data-result','defeat');
 await expect(o.locator('.battle-cinematic')).toHaveAttribute('data-phase','holding',{timeout:12000});
 await o.screenshot({path:`${out}/defeat.png`});await v.screenshot({path:`${out}/vertical-defeat.png`});
 expect(await p.evaluate(()=>(window as unknown as {audioStarts:number}).audioStarts)).toBe(0);
 expect(await v.evaluate(()=>(window as unknown as {audioStarts:number}).audioStarts)).toBe(0);
 expect(await o.evaluate(()=>(window as unknown as {audioStarts:number}).audioStarts)).toBeGreaterThan(0);
 expect(errors).toEqual([]);
 }finally{await ctx.close();await o.video()!.saveAs(`${out}/grinwick-combat.webm`);}
});
