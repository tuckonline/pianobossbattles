import {describe,it,expect,vi,afterEach} from "vitest";
import {readFileSync,existsSync} from "node:fs";
import {BattleAnimationSelector,battleAnimationLibrary,canonicalCharacters,registerBattleAnimation,type AnimationCategory,type AnimationContext} from "../hosted/battle-animation-library";
import {BattleAnimationDirector} from "../hosted/battle-animation-director";
import {bossConfigSchema,defaultBossBattleConfig} from "../hosted/boss-config";
import {createBattle,battleView,type BattleView} from "../hosted/boss-battle";
import {loadBattleAsset} from "../hosted/battle-animation-player";
const context:AnimationContext={eventType:"correct",combo:10,hpPercent:100,bossEnraged:false,battleState:"active"};
const initial=():BattleView=>({...battleView(createBattle({...defaultBossBattleConfig,enabled:true},200)),attemptId:"a",status:"active"});
const hit=(b:BattleView,n:number,side:"player"|"boss"="player",at=1000):BattleView=>({...b,revision:b.revision+n,lastAt:at,lastAction:side,
  correctHits:b.correctHits+(side==="player"?n:0),mistakes:b.mistakes+(side==="boss"?n:0),bossHp:b.bossHp-(side==="player"?n:0),playerHp:b.playerHp-(side==="boss"?4*n:0)});
describe("animation registry",()=>{
  it("provides both canonical characters and all nine categories with multiple core motions",()=>{
    for(const characterId of Object.keys(canonicalCharacters)){
      const clips=battleAnimationLibrary.filter(c=>c.characterId===characterId);
      expect(clips.length).toBeGreaterThanOrEqual(19);
      for(const category of ["idle","lightAttack","heavyAttack","hitReaction","defense","victory","defeat"] as AnimationCategory[])
        expect(clips.filter(c=>c.category===category).length).toBeGreaterThanOrEqual(2);
      for(const category of ["counter","movement"])expect(clips.some(c=>c.category===category)).toBe(true);
    }
    expect(new Set(battleAnimationLibrary.map(c=>c.id)).size).toBe(battleAnimationLibrary.length);
  });
  it("all sheets are packaged, transparent RGBA PNGs with the expected cell geometry",()=>{
    const paths=new Set(battleAnimationLibrary.flatMap(c=>c.asset.type==="spriteSheet"?[c.asset.path]:[]));
    expect(paths.size).toBeGreaterThanOrEqual(9);
    for(const path of paths){const file=`hosted/public${path}`;expect(existsSync(file)).toBe(true);const png=readFileSync(file);
      if(path.includes('/continuity/')){const clip=battleAnimationLibrary.find(c=>c.asset.type==='spriteSheet'&&c.asset.path===path)!;
        if(clip.asset.type==='spriteSheet'){expect(png.readUInt32BE(16)%clip.asset.columns).toBe(0);expect(png.readUInt32BE(20)%clip.asset.rows).toBe(0);expect(png[25]).toBe(6);}continue;}
      const expanded=path.includes('/expanded/'),grin=path.includes('/grinwick/')||path.endsWith('/grinwick.png');
      expect(png.subarray(1,4).toString()).toBe("PNG");expect(png.readUInt32BE(16)).toBe(grin?2048:expanded?1536:1024);expect(png.readUInt32BE(20)).toBe(grin?2048:expanded?1280:1536);expect(png[25]).toBe(6);}
  });
  it("normalizes old saved characters without changing damage settings",()=>{
    expect(bossConfigSchema.parse({...defaultBossBattleConfig,playerId:"beginner_pianist",bossId:"training_dummy",bossDamagePerMistake:30})).toMatchObject({playerId:"piano_blade_warrior",bossId:"crimson_musical_colossus",bossDamagePerMistake:30});
  });
  it("rejects duplicate IDs and invalid frame ranges",()=>{
    expect(()=>registerBattleAnimation(battleAnimationLibrary[0])).toThrow(/Duplicate/);
    expect(()=>registerBattleAnimation({...battleAnimationLibrary[0],id:"bad",asset:{type:"spriteSheet",path:"bad",columns:4,rows:8,frames:[32]}})).toThrow(/Invalid sprite/);
  });
});
describe("weighted selection",()=>{
  it("avoids consecutive identical attacks",()=>{
    const selector=new BattleAnimationSelector(()=>0);let previous="";
    for(let i=0;i<30;i++){const clip=selector.choose("piano_blade_warrior","lightAttack",context,i*500)!;expect(clip.id).not.toBe(previous);previous=clip.id;}
  });
  it("honors weights, cooldowns and eligibility rather than forcing a forbidden clip",()=>{
    const base=battleAnimationLibrary[0];
    const options=[{...base,id:"common",weight:9,cooldownMs:200},{...base,id:"rare",weight:1,cooldownMs:200}];
    expect(new BattleAnimationSelector(()=>.89,options).choose(base.characterId,"idle",context,0)?.id).toBe("common");
    expect(new BattleAnimationSelector(()=>.99,options).choose(base.characterId,"idle",context,0)?.id).toBe("rare");
    const selector=new BattleAnimationSelector(()=>0,options);
    expect(selector.choose(base.characterId,"idle",context,0)?.id).toBe("common");
    expect(selector.choose(base.characterId,"idle",context,1)?.id).toBe("rare");
    expect(selector.choose(base.characterId,"idle",context,2)).toBeUndefined();
    expect(selector.choose(base.characterId,"idle",context,201)).toBeDefined();
  });
  it("supports HP, combo, rage, state and event conditions",()=>{
    const base={...battleAnimationLibrary[0],conditions:{minCombo:25,maxHpPercent:30,bossEnraged:true,battleState:["active"],eventType:["milestone" as const]}};
    const selector=new BattleAnimationSelector(()=>0,[base]);
    expect(selector.choose(base.characterId,"idle",context,0)).toBeUndefined();
    const eligible={...context,eventType:"milestone" as const,combo:25,hpPercent:20,bossEnraged:true};
    expect(selector.choose(base.characterId,"idle",eligible,0)).toBeDefined();
    for(const delta of [{combo:24},{hpPercent:31},{bossEnraged:false},{battleState:"paused"},{eventType:"correct" as const}])
      expect(new BattleAnimationSelector(()=>0,[base]).choose(base.characterId,"idle",{...eligible,...delta},1000)).toBeUndefined();
  });
});
describe("presentation director",()=>{
  it("correct notes attack and damage reactions never mutate combat snapshots",()=>{
    const b=initial(),d=new BattleAnimationDirector(b,0,0,()=>0),next=hit(b,1);const saved=structuredClone(next);
    d.receive(next,1,1000);const view=d.tick(1000);
    expect(view.player.clip.category).toBe("lightAttack");expect(view.boss.clip.category).toBe("idle");expect(d.tick(view.player.holdAt!).boss.clip.category).toBe("hitReaction");expect(next).toEqual(saved);
  });
  it("coalesces 500 rapid notes and retains the mistake before a later correct note",()=>{
    let b=initial();b.bossHp=b.bossMaxHp=1000;const d=new BattleAnimationDirector(b,0,0);
    for(let i=1;i<=500;i++){b=hit(b,1,"player",1000);d.receive(b,i,1000);}
    b=hit(b,1,"boss",1000);d.receive(b,0,1000);b=hit(b,1,"player",1000);d.receive(b,1,1000);
    const sides:string[]=[];let last=0;
    for(let t=1000;t<=2400;t+=2){const p=d.tick(t);if(p.impact&&p.impact.id!==last){last=p.impact.id;sides.push(p.impact.side);}}
    expect(sides[0]).toBe("player");expect(sides).toContain("boss");expect(sides.at(-1)).toBe("player");expect(d.presentation.action).toBeUndefined();expect(d.presentation.displayHp).toEqual({player:26,boss:499});
  });
  it("the first combo tier adds variety without forcing every tenth note into a heavy attack",()=>{
    const b=initial(),d=new BattleAnimationDirector(b,9,0);const next=hit(b,1);
    d.receive(next,10,1000);expect(d.tick(1000).tier).toBe(1);expect(next.bossHp).toBe(199);
  });
  it("low boss HP selects heavy retaliation",()=>{
    const b={...initial(),bossHp:20},d=new BattleAnimationDirector(b,0,0);d.receive(hit(b,1,"boss"),0,1000);
    expect(d.tick(1000).boss.clip.category).toBe("heavyAttack");
  });
  it("pause freezes playback, resumes its clock and does not replay old attacks",()=>{
    const b=initial(),d=new BattleAnimationDirector(b,0,0),next=hit(b,1);d.receive(next,1,1000);const active=d.tick(1000);
    d.receive({...next,status:"paused"},1,1050);expect(d.tick(5000)).toBe(active);
    d.receive(next,1,5050);expect(d.presentation.player.startedAt).toBe(5000);expect(d.tick(5100).action).toBe("player");
    expect(d.tick(5500).action).toBeUndefined();
  });
  it("disconnect invents no attacks; reconnect/initial snapshots do not replay old hits",()=>{
    const b=hit(initial(),8),d=new BattleAnimationDirector(b,8,1000);d.receive(b,8,1000);expect(d.tick(1000).action).toBeUndefined();
    d.receive(hit(b,1),9,1010,true);expect(d.tick(5000).action).toBeUndefined();d.receive(hit(b,1),9,6000);expect(d.tick(6000).action).toBeUndefined();
  });
  it("restart clears pending attacks and abandoned battles do not play a knockout",()=>{
    const b=initial(),d=new BattleAnimationDirector(b,0,0);d.receive(hit(b,1),1,1000);d.receive({...b,attemptId:"new"},1,1001);
    expect(d.tick(1001).action).toBeUndefined();
    d.receive({...b,status:"defeat",result:"abandoned"},1,1100);expect(d.presentation.player.clip.category).toBe("idle");
  });
  it("terminal results interrupt attacks and reconnect holds the final pose",()=>{
    const b=initial(),d=new BattleAnimationDirector(b,0,0),next=hit(b,1);d.receive(next,1,1000);d.tick(1000);
    const win={...next,bossHp:0,status:"victory" as const};d.receive(win,200,1050);
    expect(d.presentation.player.clip.category).toBe("heavyAttack");d.tick(1500);expect(d.presentation.player.clip.category).toBe("victory");expect(d.presentation.boss.clip.category).toBe("defeat");
    expect(d.tick(9000)).toBe(d.presentation);
    const restored=new BattleAnimationDirector(win,200,10000);expect(restored.presentation.player.staticLast).toBe(true);
  });
  it("recovery follows a hit without a block that would falsely imply damage prevention",()=>{
    const b=initial(),d=new BattleAnimationDirector(b,0,0);d.receive(hit(b,3),3,1000);d.tick(1000);
    expect(d.tick(1500).boss.clip.category).not.toBe("defense");expect(d.tick(1900).boss.clip.category).toBe("idle");
  });
  it("idle and reposition selection remains bounded over long sessions",()=>{
    const b=initial(),d=new BattleAnimationDirector(b,0,0);const ids=new Set<string>();
    for(let t=4000;t<120000;t+=4000){const p=d.tick(t);ids.add(p.player.clip.category);}
    expect(ids.has("idle")).toBe(true);expect(ids.has("movement")).toBe(true);
  });
});
describe("replaceable playback formats",()=>{
  afterEach(()=>vi.unstubAllGlobals());
  function imageStub(){vi.stubGlobal("Image",class{width=1024;height=1536;onload?:()=>void;onerror?:()=>void;path="";set src(path:string){this.path=path;queueMicrotask(()=>path.includes("missing")?this.onerror?.():this.onload?.());}});}
  function contextStub(){return {canvas:{width:512,height:384},drawImage:vi.fn(),save:vi.fn(),restore:vi.fn(),scale:vi.fn(),translate:vi.fn(),rotate:vi.fn(),globalAlpha:1};}
  it("reuses prepared playback assets across warmup and repeated strikes",async()=>{
    imageStub();const asset={type:'frameSequence' as const,paths:['/test/cached-pose.png']};
    const [a,b]=await Promise.all([loadBattleAsset(asset),loadBattleAsset(asset)]);
    expect(a).toBe(b);expect(await loadBattleAsset(asset)).toBe(a);
  });
  it("sprite sheet playback addresses the correct cell and holds its last frame",async()=>{
    imageStub();const c=contextStub(),asset=await loadBattleAsset({type:"spriteSheet",path:"/test/sprite.png",columns:4,rows:8,frames:[4,5,6,7]});
    asset.draw(c as unknown as CanvasRenderingContext2D,.5);expect(c.drawImage.mock.calls[0].slice(1)).toEqual([512,192,256,192,0,0,512,384]);
    asset.draw(c as unknown as CanvasRenderingContext2D,1);expect(c.drawImage.mock.calls[1].slice(1,3)).toEqual([768,192]);
  });
  it("frame sequences work without changing selection or combat logic",async()=>{
    imageStub();const c=contextStub(),asset=await loadBattleAsset({type:"frameSequence",paths:["/test/pose1.png","/test/pose2.png"]});
    asset.draw(c as unknown as CanvasRenderingContext2D,1);expect(c.drawImage.mock.calls[0][0].path).toBe("/test/pose2.png");
  });
  it("layered rigs interpolate poses and compose parent transforms",async()=>{
    imageStub();const c=contextStub(),asset=await loadBattleAsset({type:"rigged",width:512,height:384,layers:[
      {id:"torso",path:"/test/torso.png",width:100,height:100,pivotX:50,pivotY:50,poses:[{x:0,y:0},{x:100,y:50}]},
      {id:"arm",parent:"torso",path:"/test/arm.png",width:20,height:70,pivotX:10,pivotY:0,poses:[{x:25,y:10,rotation:0},{x:25,y:10,rotation:90}]},
    ]});
    asset.draw(c as unknown as CanvasRenderingContext2D,.5);expect(c.drawImage).toHaveBeenCalledTimes(2);expect(c.translate).toHaveBeenCalledWith(50,25);expect(c.rotate).toHaveBeenCalledWith(Math.PI/4);expect(asset.continuous).toBe(true);
  });
  it("asset errors reject only playback loading",async()=>{
    imageStub();await expect(loadBattleAsset({type:"frameSequence",paths:["/test/missing.png"]})).rejects.toThrow("artwork unavailable");
  });
});
