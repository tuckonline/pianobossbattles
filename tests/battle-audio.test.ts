import {normalizeGameSettings} from '../hosted/game-settings';
import {defaultPlayerAudio,inheritedPlayerAudio,playerAudioConfig,selectPlayerAudio} from '../hosted/player-audio';
import {describe,it,expect,vi} from 'vitest';
import {BattleAudioEngine,type BattleSound} from '../hosted/battle-audio';
import {combatAudioCues} from '../hosted/battle-audio-cues';
import {defaultBossBattleConfig,bossConfigSchema} from '../hosted/boss-config';
import {createBattle,reduceBattle,battleView} from '../hosted/boss-battle';
import {BattleAnimationDirector} from '../hosted/battle-animation-director';

function setup(running=true,recordings=false) {
  let now=1000;
  const param=()=>({value:0,setTargetAtTime:vi.fn(),cancelScheduledValues:vi.fn()});
  const sources:{buffer?:AudioBuffer;start:ReturnType<typeof vi.fn>;stop:ReturnType<typeof vi.fn>;connect:ReturnType<typeof vi.fn>;disconnect:ReturnType<typeof vi.fn>;onended?:()=>void}[]=[];
  const master={gain:param(),connect:vi.fn()};
  const context={state:running?'running':'suspended',currentTime:0,sampleRate:48000,destination:{},onstatechange:null as null|(()=>void),
    resume:vi.fn(async()=>{context.state='running';context.onstatechange?.();}),
    decodeAudioData:vi.fn(async()=>({duration:.25,getChannelData:()=>new Float32Array([0,.2,.1,0])})),
    createGain:vi.fn(()=>({...master,gain:param(),disconnect:vi.fn()})),
    createDynamicsCompressor:()=>({threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect:vi.fn()}),
    createBuffer:(_channels:number,length:number)=>{const data=new Float32Array(length);return {getChannelData:()=>data};},
    createBufferSource:()=>{const source={start:vi.fn(),stop:vi.fn(),connect:vi.fn(),disconnect:vi.fn()};sources.push(source);return source;},
  };
  const load=vi.fn(async()=>{if(!recordings)throw Error('test fallback');return new ArrayBuffer(8);});
  const engine=new BattleAudioEngine(()=>context as unknown as AudioContext,()=>now,load);
  engine.configure({...defaultBossBattleConfig,soundEnabled:true});engine.own(true,'test');engine.unlock();
  return {engine,context,sources,load,time:(n:number)=>{now=n;}};
}
describe('shared battle audio',()=>{
  it('upgrades existing saved sound settings without changing their volume',()=>{
    const config=bossConfigSchema.parse({soundEnabled:true,volume:.17});
    expect(config).toMatchObject({soundEnabled:true,volume:.17,audioOutput:'practice'});
    expect(bossConfigSchema.parse({...config,audioOutput:'obs'}).audioOutput).toBe('obs');
  });
  it.each(['heroSwing','bossSwing','heroImpact','hurt','heavy','power','victory','defeat','timeout','countIn','fight','pressureTaunt','pressureTension'] as BattleSound[])('%s generates a short, non-silent, bounded sample',kind=>{
    const {engine,sources}=setup();expect(engine.play(kind,'one')).toBe(true);
    const data=sources[0].buffer!.getChannelData(0);
    expect(data.length/48000).toBeLessThanOrEqual(.85);expect(data.some(n=>Math.abs(n)>.05)).toBe(true);
    expect(data.every(n=>Number.isFinite(n)&&Math.abs(n)<=.95)).toBe(true);
    expect(data[0]).toBe(0);expect(Math.abs(data[data.length-1])).toBeLessThan(.001);
  });
  it('deduplicates re-rendered contact events and drops stale cues',()=>{
    const {engine,sources,time}=setup();engine.play('heroImpact','same');time(2000);
    expect(engine.play('heroImpact','same')).toBe(false);expect(engine.play('heavy','stale',1000)).toBe(false);
    expect(sources).toHaveLength(1);
  });
  it('mute and zero volume stop active effects, and ownership prevents duplicate output',()=>{
    const {engine,sources,time}=setup();engine.play('heavy','first');
    engine.configure({...defaultBossBattleConfig,soundEnabled:false});expect(sources[0].stop).toHaveBeenCalled();
    expect(engine.play('heavy','muted')).toBe(false);
    engine.configure({...defaultBossBattleConfig,soundEnabled:true,volume:0});expect(engine.play('heavy','zero')).toBe(false);
    engine.configure({...defaultBossBattleConfig,soundEnabled:true,volume:.2});engine.own(false,'other tab');
    expect(engine.play('heavy','other')).toBe(false);time(2000);expect(engine.play('heavy','test',2000,true)).toBe(true);
  });
  it('uses the full slider range through the master gain',()=>{
    const {engine,context}=setup();
    for(const volume of [0,.04,.1,.2]){engine.configure({...defaultBossBattleConfig,soundEnabled:true,volume});expect(engine.snapshot().volume).toBe(volume);}
    expect(context.createGain.mock.results[0].value.gain.setTargetAtTime).toHaveBeenLastCalledWith(.2,0,.008);
  });
  it('blocked autoplay is diagnosed, and old effects are never replayed on resume',async()=>{
    const {engine,context,sources}=setup();context.state='suspended';
    expect(engine.play('heroSwing','blocked')).toBe(false);expect(engine.snapshot().error).toContain('blocked');
    engine.unlock();await Promise.resolve();expect(engine.snapshot().unlocked).toBe(true);
    expect(engine.play('heroSwing','blocked')).toBe(false);expect(sources).toHaveLength(0);
    expect(engine.play('heroSwing','fresh')).toBe(true);
  });
  it('reports Web Audio failure without throwing into gameplay',()=>{
    const engine=new BattleAudioEngine(()=>{throw new Error('device unavailable');});
    expect(()=>engine.unlock()).not.toThrow();expect(engine.snapshot().error).toBe('device unavailable');
  });
  it('bounds simultaneous effects and coalesces rapid passages',()=>{
    const {engine,sources,time}=setup();
    for(let i=0;i<100;i++){time(1000+i*2);engine.play('heroImpact',`hit:${i}`);}
    expect(sources.length).toBeLessThanOrEqual(4);expect(engine.snapshot().dropped).toBeGreaterThan(90);
    sources.forEach(s=>s.onended?.());expect(engine.snapshot().active).toBe(0);
  });
  it('major attacks and results take priority over a full ordinary-effect bus',()=>{
    const {engine,sources,time}=setup();
    for(let i=0;i<4;i++){time(1000+i*100);engine.play('heroImpact',`ordinary:${i}`);}
    expect(engine.snapshot().active).toBe(3);
    time(2000);
    expect(engine.play('power','power')).toBe(true);expect(engine.snapshot().active).toBe(4);
    expect(engine.play('victory','win')).toBe(true);expect(sources[0].stop).toHaveBeenCalled();expect(engine.snapshot().active).toBeLessThanOrEqual(4);
  });
});

describe('approved recording bank',()=>{
  it('reserves major-cue priority independently of ordinary cooldown and preserves TIME OUT gain',()=>{
    const {engine,time,context}=setup();engine.play('heroImpact','ordinary');time(1010);
    expect(engine.play('power','major')).toBe(true);
    time(1020);expect(engine.play('heavy','too-close-major')).toBe(false);
    engine.play('timeout','result');expect(context.createGain.mock.results.at(-1)!.value.gain.value).toBe(1);
  });
  it('loads and decodes once before tests, then plays recordings without fetching at contact',async()=>{
    const {engine,context,load,sources}=setup(true,true);
    await engine.preload();expect(load).toHaveBeenCalledTimes(30);expect(context.decodeAudioData).toHaveBeenCalledTimes(30);
    expect(engine.snapshot().assets).toContain('30/30 loaded');
    expect(engine.play('heroSwing','sample')).toBe(true);expect(sources[0].buffer!.getChannelData(0)[1]).toBeCloseTo(.2);
    await engine.preload();expect(load).toHaveBeenCalledTimes(30);
  });
  it('keeps loading/failure non-blocking and never replays a cue after samples become ready',async()=>{
    const {engine,sources}=setup();expect(engine.play('heroImpact','pending')).toBe(true);
    await engine.preload();expect(engine.snapshot().assets).toContain('Missing:');
    expect(engine.play('heroImpact','pending')).toBe(false);expect(sources).toHaveLength(1);
  });
  it('spaces vocal accents, bounds rapid priority cues and discards pending test audio after mute',async()=>{
    const {engine,sources,time}=setup(true,true);await engine.preload();
    engine.play('hurt','a');expect(sources).toHaveLength(2);sources.forEach(s=>s.onended?.());
    time(1200);engine.play('hurt','b');expect(sources).toHaveLength(3);sources.at(-1)?.onended?.();
    time(2200);engine.play('heavy','c');expect(sources).toHaveLength(5);
    time(2250);expect(engine.play('heavy','rapid')).toBe(false);
    const test=engine.test('victory');engine.configure({...defaultBossBattleConfig,soundEnabled:false});await test;
    expect(engine.snapshot().lastDecision).toBe('Sound disabled');expect(sources).toHaveLength(5);
  });
});

it.each(['correct','incorrect','missed'] as const)('audio follows the existing %s presentation contact, without changing battle state',outcome=>{
  let b=reduceBattle(createBattle({...defaultBossBattleConfig,enabled:true},100),{type:'start',attemptId:'attempt'});
  const d=new BattleAnimationDirector(battleView(b),0,0,()=>0);
  b=reduceBattle(b,{type:'evaluate',attemptId:'attempt',events:[{id:'note',version:1,playerId:'p',sessionId:'s',attemptId:'attempt',exerciseId:1,sequence:1,timestamp:1000,type:'note.evaluated',payload:{outcome,occurrence:'note-1',pitch:60}}]});
  const before=JSON.stringify(b);d.receive(battleView(b),1,1000);const windup=d.tick(1000),actor=outcome==='correct'?'player':'boss';
  const swing=combatAudioCues(b,windup,false);expect(swing[0].kind).toBe(actor==='player'?'heroSwing':'bossSwing');
  expect(swing[0].at).toBeLessThan(windup[actor].holdAt!);expect(swing[0].at).toBeGreaterThanOrEqual(1000);
  const contact=d.tick(windup[actor].holdAt!),cues=combatAudioCues(b,contact,false);
  expect(cues[0].at).toBe(contact.impact!.at);expect(cues[0].kind).toBe(actor==='player'?'heroImpact':'hurt');
  const heavy={...contact,impact:{...contact.impact!,signaturePhase:'crush' as const,side:'boss' as const}};
  expect(combatAudioCues(b,heavy,false)[0].kind).toBe('heavy');
  expect(combatAudioCues(b,{...contact,impact:{...contact.impact!,side:'player',special:true}},false)[0].kind).toBe('power');
  expect(JSON.stringify(b)).toBe(before);
});
it('restored results are silent; compact results sound only when cinematics are disabled',()=>{
  const b={...createBattle({...defaultBossBattleConfig,enabled:true},100),status:'defeat' as const,result:'timeout' as const,attemptId:'a'};
  const d=new BattleAnimationDirector(battleView(b),0,1000);
  expect(combatAudioCues(b,d.presentation,false)).toEqual([]);
  expect(combatAudioCues(b,{...d.presentation,finished:true,outcomeAt:1000},false)[0].kind).toBe('timeout');
  expect(combatAudioCues(b,{...d.presentation,finished:true,outcomeAt:1000},true)).toEqual([]);
});


describe('learner audio presets',()=>{
 it('defaults new accounts to Focus and preserves old enabled, muted and OBS choices',()=>{
  expect(normalizeGameSettings({}).playerAudio.mode).toBe('focus');
  const old={...defaultBossBattleConfig,soundEnabled:true,volume:.17};
  expect(normalizeGameSettings({bossBattle:old}).playerAudio).toEqual({mode:'cinematic',volume:.17});
  expect(inheritedPlayerAudio({...old,soundEnabled:false}).mode).toBe('focus');
  expect(normalizeGameSettings({bossBattle:{...old,audioOutput:'obs'}})).toMatchObject({playerAudio:{mode:'focus'},bossBattle:{soundEnabled:true,volume:.17,audioOutput:'obs'}});
 });
 it('presets affect only the local battle mix and never rewrite the OBS configuration',()=>{
  const audience={...defaultBossBattleConfig,soundEnabled:true,volume:.13,audioOutput:'obs' as const};
  for(const mode of ['focus','immersive','cinematic'] as const){
   const preference=selectPlayerAudio(mode,defaultPlayerAudio);
   expect(playerAudioConfig(audience,preference)).toMatchObject({soundEnabled:false,audioOutput:'obs'});
   expect(audience).toMatchObject({soundEnabled:true,volume:.13,audioOutput:'obs'});
  }
  expect(selectPlayerAudio('immersive',defaultPlayerAudio).volume).toBe(.04);
  expect(selectPlayerAudio('cinematic',defaultPlayerAudio).volume).toBe(.08);
 });
 it('Focus and zero volume silence the battle bus while Immersive and Cinematic use the existing engine',()=>{
  const {engine,time,sources}=setup();
  engine.configure(playerAudioConfig(defaultBossBattleConfig,defaultPlayerAudio));
  expect(engine.play('heroImpact','focus')).toBe(false);
  for(const mode of ['immersive','cinematic'] as const){time(mode==='immersive'?2000:3000);engine.configure(playerAudioConfig(defaultBossBattleConfig,selectPlayerAudio(mode,defaultPlayerAudio)));expect(engine.play('heroImpact',mode)).toBe(true);}
  engine.configure(playerAudioConfig(defaultBossBattleConfig,{mode:'cinematic',volume:0}));
  expect(engine.play('heroImpact','zero')).toBe(false);expect(sources).toHaveLength(2);
  expect(sources.every(s=>s.stop.mock.calls.length>0)).toBe(true);
 });
});
