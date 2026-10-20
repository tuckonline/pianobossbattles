import {test,expect,chromium} from "@playwright/test";
import {installMidiKeyboard,playNotes} from "./helpers/midi";
import {noteGroups} from "../../hosted/sight-library";
import {scalesLibrary} from "../../hosted/scales-library";

test("direct score follows separate browser processes despite slow cloud writes, then reconnects",async({browser})=>{
  test.setTimeout(90000);
  const id=`direct-${crypto.randomUUID()}`,headers={"oai-authenticated-user-id":id,"oai-authenticated-user-email":`${id}@example.test`};
  const context=await browser.newContext({extraHTTPHeaders:headers});
  const obsBrowser=await chromium.launch();
  const obs=await obsBrowser.newPage({extraHTTPHeaders:headers,viewport:{width:1280,height:440}});
  const p=await context.newPage(),origin="http://127.0.0.1:8787";
  try {
    await installMidiKeyboard(p);await p.goto(`${origin}/student/practice?collection=scales&exercise=11001`);
    const controls=p.getByRole('region',{name:'Pianist progression'});
    await controls.getByText('Progression & recording controls',{exact:true}).click();
    await controls.getByLabel('Boss Battle Mode',{exact:true}).check();
    await obs.goto(`${origin}/obs/score`);
    const main=obs.locator("main.obs-score-canvas");
    await expect(main).toHaveAttribute("data-score-transport","direct",{timeout:20000});
    const svg=await obs.locator(".notation > svg").first().elementHandle();
    // Real HTTP writes are delayed; BroadcastChannel/shared browser storage
    // cannot bridge these separate browser processes.
    await p.route("**/api/obs",async route=>{if(route.request().method()==="POST")await new Promise(r=>setTimeout(r,900));await route.continue();});
    await p.getByRole("button",{name:"Connect keyboard",exact:true}).click();
    await p.getByRole("button",{name:"Start MIDI practice",exact:true}).click();
    const notes=noteGroups(scalesLibrary[0],"both").flatMap(g=>g.pitches),latencies:number[]=[];
    for(let i=0;i<10;i++) {
      await obs.evaluate(()=>{
        const root=document.querySelector(".notation")!;
        const w=window as unknown as {notePaintAt:number};w.notePaintAt=0;
        const before=root.querySelectorAll(".practice-note-correct").length;
        const observer=new MutationObserver(()=>{if(root.querySelectorAll(".practice-note-correct").length>before){w.notePaintAt=Date.now();observer.disconnect();}});
        observer.observe(root,{attributes:true,subtree:true});
      });
      const sent=Date.now();await playNotes(p,[notes[i]]);
      await expect(obs.locator(".practice-note-correct")).toHaveCount(i+1,{timeout:350});
      const received=await obs.evaluate(()=>(window as unknown as {notePaintAt:number}).notePaintAt);
      latencies.push(received-sent);
    }
    console.log("Direct score MIDI-to-paint latency (ms):",latencies.join(", "));
    expect(Math.max(...latencies)).toBeLessThan(200);
    expect(await svg!.evaluate(e=>e===document.querySelector(".notation > svg"))).toBe(true);
    await playNotes(p,notes.slice(10,20));
    await expect(obs.locator(".practice-note-correct")).toHaveCount(20,{timeout:350});
    await expect(obs.getByRole('progressbar',{name:'boss HP'})).toHaveAttribute('aria-valuenow',String(notes.length-20),{timeout:350});
    await playNotes(p,[1]);await expect(obs.getByRole('progressbar',{name:'player HP'})).toHaveAttribute('aria-valuenow','26',{timeout:350});
    await obs.reload();await expect(main).toHaveAttribute("data-score-transport","direct",{timeout:20000});
    await expect(obs.locator(".practice-note-correct")).toHaveCount(20);
    await p.getByRole('button',{name:'Stop practice',exact:true}).click();
    await p.getByLabel("Exercise",{exact:true}).selectOption("11002");
    await expect(main).toHaveAttribute("aria-label",`OBS score only: ${scalesLibrary[1].title}`);
    await expect(obs.locator(".practice-note-correct")).toHaveCount(0);
  } finally {await context.close();await obsBrowser.close();}
});

test("score fallback stays current without WebRTC or SSE",async({browser})=>{
  const id=`fallback-${crypto.randomUUID()}`,headers={"oai-authenticated-user-id":id,"oai-authenticated-user-email":`${id}@example.test`};
  const pContext=await browser.newContext({extraHTTPHeaders:headers}),oContext=await browser.newContext({extraHTTPHeaders:headers});
  const p=await pContext.newPage(),o=await oContext.newPage(),origin="http://127.0.0.1:8787";
  try {
    await o.addInitScript(()=>Object.defineProperty(window,"RTCPeerConnection",{value:undefined}));
    await o.route("**/api/obs?stream=1*",r=>r.abort());
    await installMidiKeyboard(p);await p.goto(`${origin}/student/practice?collection=scales&exercise=11001`);await o.goto(`${origin}/obs/score`);
    await expect(o.locator(".notation > svg").first()).toBeVisible();
    await expect(o.locator("main")).toHaveAttribute("data-score-transport","cloud");
    await p.getByRole("button",{name:"Connect keyboard",exact:true}).click();await p.getByRole("button",{name:"Start MIDI practice",exact:true}).click();
    const notes=noteGroups(scalesLibrary[0],"both").flatMap(g=>g.pitches);
    await playNotes(p,notes.slice(0,6));
    await expect(o.locator(".practice-note-correct")).toHaveCount(6,{timeout:600});
    await pContext.setOffline(true);await playNotes(p,notes.slice(6,8));await pContext.setOffline(false);
    await expect(o.locator(".practice-note-correct")).toHaveCount(8,{timeout:5000});
  }finally{await pContext.close();await oContext.close();}
});
