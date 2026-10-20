import {test,expect,type Page} from '@playwright/test';
import {battleView,createBattle,reduceBattle} from '../../hosted/boss-battle';
import {defaultBossBattleConfig} from '../../hosted/boss-config';
import {defaultGameSettings,evaluateGame} from '../../hosted/game-core';
import {noteGroups,sightLibrary,type Exercise} from '../../hosted/sight-library';
import {installMidiKeyboard,playNotes,sendMidi} from './helpers/midi';

async function user(page:Page){
  const id=`note-attacks-${crypto.randomUUID()}`;
  await page.context().setExtraHTTPHeaders({'oai-authenticated-user-id':id,'oai-authenticated-user-email':`${id}@example.test`});
}
const origin='http://127.0.0.1:8787';

test('real evaluated two-hand chords reach OBS; separated tones, wrong keys and controls stay honest',async({page})=>{
  await user(page);await installMidiKeyboard(page);await page.goto('/student/sight-read');
  const controls=page.getByRole('region',{name:'Pianist progression'});
  await expect(controls.getByText('Connecting progression…')).toHaveCount(0);
  await controls.getByText('Progression & recording controls',{exact:true}).click();
  await controls.getByLabel('Boss Battle Mode',{exact:true}).check();
  await page.getByRole('button',{name:'Connect keyboard',exact:true}).click();
  await page.getByRole('button',{name:'Start MIDI practice',exact:true}).click();
  const obs=await page.context().newPage();await obs.setViewportSize({width:1920,height:700});await obs.goto('/obs/score');
  const battle=obs.getByRole('complementary',{name:'Boss battle'}),hero=battle.locator('.battle-fighter-player');
  await expect(battle.locator('[data-asset-status="ready"]')).toHaveCount(2);
  await expect(battle).toHaveAttribute('data-battle-status','active');
  // Short attacks may start and finish between Playwright assertion polls.
  // Observe every rendered key/chord signature rather than racing that window.
  await hero.evaluate(node=>{
    const w=window as unknown as {seenStrikes:{key:number;size:number}[]};w.seenStrikes=[];
    new MutationObserver(()=>{const key=node.getAttribute('data-attack-key'),size=node.getAttribute('data-chord-size');if(key&&size)w.seenStrikes.push({key:Number(key),size:Number(size)});}).observe(node,{attributes:true});
  });
  const saw=async(key:number,size:number)=>expect.poll(()=>obs.evaluate(({key,size})=>(window as unknown as {seenStrikes:{key:number;size:number}[]}).seenStrikes.some(s=>s.key===key&&s.size===size),{key,size})).toBe(true);
  const groups=noteGroups(sightLibrary[0],'both'),target=groups.flatMap(g=>g.pitches).length;
  expect(groups[0].pitches).toHaveLength(2);
  await playNotes(page,[...groups[0].pitches].reverse());
  await saw(Math.min(...groups[0].pitches),2);
  await expect(battle.getByRole('progressbar',{name:'boss HP'})).toHaveAttribute('aria-valuenow',String(target-2));
  await expect(battle.locator('.battle-character-player')).toHaveAttribute('data-animation-category','idle');
  await playNotes(page,[groups[1].pitches[0]]);
  await saw(groups[1].pitches[0],1);
  await expect(battle.locator('.battle-character-player')).toHaveAttribute('data-animation-category','idle');
  await playNotes(page,[groups[1].pitches[1]]);
  await saw(groups[1].pitches[1],1);
  await expect(battle.getByRole('progressbar',{name:'boss HP'})).toHaveAttribute('aria-valuenow',String(target-4));
  await expect(battle.locator('.battle-character-player')).toHaveAttribute('data-animation-category','idle');
  await sendMidi(page,[[0x80,60,0],[0x90,62,0],[0xb0,64,127],[0xb0,64,0]]);
  await obs.waitForTimeout(200);
  await expect(battle.getByRole('progressbar',{name:'boss HP'})).toHaveAttribute('aria-valuenow',String(target-4));
  await playNotes(page,[1]);
  await expect(battle.getByRole('progressbar',{name:'player HP'})).toHaveAttribute('aria-valuenow','26');
  await expect(battle.locator('.battle-character-boss')).toHaveAttribute('data-animation-category','lightAttack');
  await expect(battle.getByRole('progressbar',{name:'boss HP'})).toHaveAttribute('aria-valuenow',String(target-4));
  await page.getByRole('button',{name:'Stop practice',exact:true}).click();await obs.close();
});

test('mapped keys and growing chord strikes stay contained, move their shadows and leave notation and progress intact',async({page})=>{
  test.setTimeout(90000);await user(page);
  const read=async()=>{const r=await page.request.post('/api/platform',{headers:{origin},data:{action:'gameState'}});return r.json();};
  const before=await read(),sourceId=crypto.randomUUID(),attemptId=crypto.randomUUID();let sequence=0;
  const config={...defaultBossBattleConfig,enabled:true,animationSpeed:.8};
  let state=reduceBattle(createBattle(config,1000),{type:'start',attemptId});
  const groups=[[60],[62],[60,64],[60,64,67],[60,64,67,72],[60,64,67,72,76]];
  // A local evaluator fixture exercises larger chords through the real snapshot
  // transport. It is presentation-only and never submits a practice attempt.
  const exercise:Exercise={...sightLibrary[0],polyphony:groups.flatMap((pitches,beat)=>pitches.map(pitch=>({pitch,beat,beats:1,hand:'right' as const})))};
  const played:number[]=[];
  const publish=async()=>{
    const b=battleView(state);
    const r=await page.request.post('/api/obs',{headers:{origin},data:{sourceId,claim:true,sequence:++sequence,snapshot:{exerciseNumber:7001,title:'Two-Note Footsteps',hand:'both',status:'practicing',accuracy:null,mistakes:0,measure:1,totalMeasures:4,
      game:{sessionId:'note-visual',preview:false,settings:{...defaultGameSettings,bossBattle:config},alerts:[],live:{attemptId,sessionId:'note-visual',combo:b.correctHits,best:b.correctHits,correct:b.correctHits,incorrect:0,provisionalXP:0,status:'active',sequence},battle:b}}}});
    expect(r.ok(),await r.text()).toBe(true);
  };
  await publish();await page.setViewportSize({width:1920,height:700});await page.goto('/obs/score');
  const panel=page.getByRole('complementary',{name:'Boss battle'}),hero=panel.locator('.battle-fighter-player');
  await expect(panel.locator('[data-asset-status="ready"]')).toHaveCount(2);
  await expect(page.locator('[data-broadcast-ready="true"]')).toBeVisible();
  const notation=await page.locator('.notation > svg').first().elementHandle();
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+100)));
  const signatures:string[]=[];
  for(const pitches of groups){
    played.push(...pitches);
    const result=evaluateGame(exercise,'both',played,{playerId:'test',sessionId:'note-visual',attemptId,timestamp:await page.evaluate(()=>Date.now())});
    state=reduceBattle(state,{type:'evaluate',attemptId,events:result.events});await publish();
    await expect.poll(async()=>{await page.clock.runFor(40);return hero.getAttribute('data-chord-size');}).toBe(String(pitches.length));
    await expect(hero).toHaveAttribute('data-attack-key',String(pitches[0]));
    await expect(hero.locator('.battle-note-strike path')).toHaveCount(pitches.length);
    signatures.push((await hero.locator('.battle-note-strike g').getAttribute('transform'))!);
    await page.locator('.battle-fighter,.battle-ground-shadow,.battle-note-strike,.battle-impact').evaluateAll(nodes=>{
      for(const n of nodes)for(const a of n.getAnimations()){a.pause();a.currentTime=Number(a.effect!.getTiming().duration)*.45;}
    });
    await page.clock.runFor(160);
    const fighter=(await hero.boundingBox())!,shadow=(await panel.locator('.battle-ground-shadow-player').boundingBox())!;
    expect(shadow.x+shadow.width/2-fighter.x).toBeCloseTo(fighter.width*.5,0);
    expect(shadow.y-fighter.y).toBeCloseTo(fighter.height*.93,0);
    await expect(panel.getByRole('progressbar',{name:'boss HP'})).toHaveAttribute('aria-valuenow',String(1000-played.length));
    await page.screenshot({path:`../../work/note-attack-${pitches.length}-${pitches[0]}.png`});
    await page.locator('.battle-fighter,.battle-ground-shadow,.battle-note-strike,.battle-impact').evaluateAll(nodes=>{for(const n of nodes)for(const a of n.getAnimations())a.play();});
    await page.clock.runFor(1500);
    await expect(panel.locator('.battle-character-player')).toHaveAttribute('data-animation-category','idle');
    await expect(panel.locator('.battle-fighter[data-motion-phase="rest"]')).toHaveCount(2);
    expect(await notation!.evaluate(e=>e===document.querySelector('.notation > svg'))).toBe(true);
  }
  await page.clock.resume();
  expect(signatures[0]).not.toBe(signatures[1]);
  await page.reload();await expect(panel.locator('.battle-note-strike')).toHaveCount(0);
  const after=await read();expect(after.xp).toBe(before.xp);expect(after.unlocks).toEqual(before.unlocks);
});
