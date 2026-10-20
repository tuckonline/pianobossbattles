import {test,expect,chromium} from '@playwright/test';
import {installMidiKeyboard,playNotes} from './helpers/midi';
import {noteGroups} from '../../hosted/sight-library';
import {scalesLibrary} from '../../hosted/scales-library';

test('evaluated notes reach score and battle promptly across separate browsers',async({browser})=>{
  test.setTimeout(90000);
  const id=`battle-latency-${crypto.randomUUID()}`,headers={'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`};
  const context=await browser.newContext({extraHTTPHeaders:headers}),p=await context.newPage();
  const obsBrowser=await chromium.launch(),obs=await obsBrowser.newPage({extraHTTPHeaders:headers,viewport:{width:1920,height:700}});
  try {
    await installMidiKeyboard(p);await p.goto('http://127.0.0.1:8787/student/practice?collection=scales&exercise=11001');
    const controls=p.getByRole('region',{name:'Pianist progression'});
    await expect(controls.getByText('Connecting progression…')).toHaveCount(0);
    await controls.getByText('Progression & recording controls',{exact:true}).click();
    await controls.getByLabel('Boss Battle Mode',{exact:true}).check();
    await obs.goto('http://127.0.0.1:8787/obs/score');
    await expect(obs.locator('main')).toHaveAttribute('data-score-transport','direct',{timeout:20000});
    await expect(obs.locator('[data-asset-status="ready"]')).toHaveCount(2);
    await p.route('**/api/obs',async route=>{if(route.request().method()==='POST')await new Promise(r=>setTimeout(r,900));await route.continue();});
    await p.getByRole('button',{name:'Connect keyboard',exact:true}).click();
    await p.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
    await expect(obs.locator('.boss-battle-panel')).toHaveAttribute('data-battle-status','active');
    const sprite=await obs.locator('.battle-fighter-player canvas').elementHandle();
    const notes=noteGroups(scalesLibrary[0],'both').flatMap(g=>g.pitches),attacks:number[]=[],scores:number[]=[];
    for(let i=0;i<8;i++){
      await obs.evaluate(pitch=>{
        const w=window as unknown as {attackAt:number;scoreAt:number};w.attackAt=0;w.scoreAt=0;
        const root=document.querySelector('.notation')!,before=root.querySelectorAll('.practice-note-correct').length;
        const score=new MutationObserver(()=>{if(root.querySelectorAll('.practice-note-correct').length>before){requestAnimationFrame(()=>{w.scoreAt=Date.now();});score.disconnect();}});
        score.observe(root,{attributes:true,subtree:true});
        const hero=document.querySelector('.battle-fighter-player')!;
        const attack=new MutationObserver(()=>{if(hero.getAttribute('data-attack-key')===String(pitch)){requestAnimationFrame(()=>{w.attackAt=Date.now();});attack.disconnect();}});
        attack.observe(hero,{attributes:true});
      },notes[i]);
      const sent=await p.evaluate(pitch=>{const at=Date.now();(window as unknown as {sendMidi:(messages:number[][])=>void}).sendMidi([[0x90,pitch,90],[0x80,pitch,0]]);return at;},notes[i]);
      await expect.poll(()=>obs.evaluate(()=>(window as unknown as {attackAt:number}).attackAt)).toBeGreaterThan(0);
      const times=await obs.evaluate(()=>({attack:(window as unknown as {attackAt:number}).attackAt,score:(window as unknown as {scoreAt:number}).scoreAt}));
      attacks.push(times.attack-sent);scores.push(times.score-sent);
      // Space the next tone beyond the visual chord window while letting its
      // attack arrive during the preceding clip, as in steady two-hand practice.
      await p.waitForTimeout(Math.max(0,155-(Date.now()-sent)));
    }
    console.log('MIDI-to-visible-attack latency (ms):',attacks.join(', '));
    console.log('MIDI-to-visible-score latency (ms):',scores.join(', '));
    expect(Math.max(...attacks)).toBeLessThan(100);
    expect(Math.max(...scores)).toBeLessThan(200);
    expect(await sprite!.evaluate(node=>node===document.querySelector('.battle-fighter-player canvas'))).toBe(true);
    await playNotes(p,[1]);
    await expect(obs.getByRole('progressbar',{name:'player HP'})).toHaveAttribute('aria-valuenow','26');
  } finally {await context.close();await obsBrowser.close();}
});
