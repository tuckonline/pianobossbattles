import { describe,it,expect } from 'vitest';
import { BattleCinematicController,battleResult,battleResultId,cinematicDefinitions,cinematicFrame,cinematicReceipt,type CinematicInput } from '../hosted/battle-cinematic';
import { defaultCinematicSettings } from '../hosted/cinematic-config';
import { createBattle,battleView,type BattleView } from '../hosted/boss-battle';
import { defaultBossBattleConfig } from '../hosted/boss-config';
import { normalizeGameSettings } from '../hosted/game-settings';
import { CelebrationQueue } from '../hosted/game-core';
const at=100000;
const active=():BattleView=>({...battleView(createBattle({...defaultBossBattleConfig,enabled:true},66)),status:'active',attemptId:'fight-one'});
const input=(battle=active()):CinematicInput=>({battle,exerciseId:2001,bestCombo:26,settings:{...defaultCinematicSettings},enabled:true});
const ended=(result:'victory'|'defeat'|'timeout'):BattleView=>({...active(),status:result==='victory'?'victory':'defeat',result:result==='timeout'?'timeout':result==='defeat'?'knockout':undefined,bossHp:result==='victory'?0:20,playerHp:result==='defeat'?0:26,lastAt:at});
const start=(result:'victory'|'defeat'|'timeout')=>{const c=new BattleCinematicController();c.receive(input(),at-100);c.receive(input(ended(result)),at);return c;};
describe('V11 persistent result presentation isolation and lifecycle',()=>{
 for(const result of ['victory','defeat','timeout'] as const){
  it(`${result} selects its own timeline once, despite duplicate terminal snapshots`,()=>{
   const c=start(result),p=c.playback!;expect(p.result).toBe(result);expect(p.id).toBe(`fight-one:${result}`);
   c.receive(input(ended(result)),at+100);expect(c.playback).toBe(p);
   expect(c.frame(at+10000).phase).toBe('holding');c.receive(input(ended(result)),at+10001);expect(c.playback).toBe(p);expect(c.frame(at+86400000).phase).toBe('holding');
  });
 }
 it('first terminal snapshot restores holding without replaying the sequence',()=>{const c=new BattleCinematicController();c.receive(input(ended('victory')),at);expect(c.frame(at).phase).toBe('holding');expect(c.playback?.restored).toBe(true);const p=c.playback;c.receive(input(ended('victory')),at+20);expect(c.playback).toBe(p);});
 it('persistent receipts restore held results even after an active snapshot retry',()=>{const data=new Map<string,string>(),storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};for(let n=0;n<2;n++){const c=new BattleCinematicController(cinematicReceipt(storage,'player'));c.receive(input(),at-100);c.receive(input(ended('defeat')),at);expect(c.frame(at).phase).toBe(n===0?'preparing':'holding');}});
 it('receipt list is bounded and corrupt/unavailable storage degrades safely',()=>{let raw='bad';const claim=cinematicReceipt({getItem:()=>raw,setItem:(_k,v)=>{raw=v;}},'p');expect(claim('one')).toBe(true);for(let i=0;i<300;i++)claim(String(i));expect(JSON.parse(raw)).toHaveLength(128);expect(cinematicReceipt({getItem:()=>{throw Error('blocked');},setItem:()=>{}},'p')('x')).toBe(true);});
 it('timeline has all deterministic phases with no gaps and time-based end',()=>{for(const result of ['victory','defeat','timeout'] as const){const p=start(result).playback!,d=cinematicDefinitions[result];for(const stage of d.stages){expect(cinematicFrame(p,at+stage.startMs).phase).toBe(stage.id);expect(cinematicFrame(p,at+stage.endMs-.01).phase).toBe(stage.id);}expect(cinematicFrame(p,at+d.durationMs).phase).toBe('holding');}});
 it('legacy autoDismiss cannot expire a held scene; duration only affects animation',()=>{const p=start('victory').playback!;p.settings.durationMultiplier=2;p.settings.autoDismiss=true;expect(cinematicFrame(p,at+8000).phase).toBe('result');expect(cinematicFrame(p,at+9600).phase).toBe('holding');expect(cinematicFrame(p,at+999999).phase).toBe('holding');});
 it.each(['restart','exercise','disabled','bossOff','skip'])('%s cancels safely',kind=>{const c=start('defeat'),b=ended('defeat'),next=input(b);if(kind==='restart')next.battle={...active(),attemptId:'new'};if(kind==='exercise')next.exerciseId=3001;if(kind==='disabled')next.enabled=false;if(kind==='bossOff')next.battle={...b,config:{...b.config,enabled:false}};if(kind==='skip')next.dismissedId=battleResultId(b);c.receive(next,at+100);expect(c.playback).toBeUndefined();});
 it('completion and same battle loop updates preserve the result playback',()=>{const c=start('victory'),p=c.playback;c.receive(input({...ended('victory'),exerciseEnded:true}),at+500);expect(c.playback).toBe(p);});
 it('abandonment and unfinished exercise are not combat defeats',()=>{for(const result of ['abandoned','unfinished'] as const)expect(battleResult({...ended('defeat'),result})).toBeUndefined();});
 it('offline/stale snapshots restore a held result and never replay the attack',()=>{for(const mod of [{offline:true},{}]){const c=new BattleCinematicController();c.receive(input(),at-100);c.receive({...input(ended('victory')),...mod},at+11000);expect(c.frame(at+11000).phase).toBe('holding');expect(c.playback?.restored).toBe(true);}});
 it('network loss, MIDI snapshots, pause and notifications cannot dismiss a held scene',()=>{const c=start('defeat'),p=c.playback;expect(c.frame(at+10000).phase).toBe('holding');c.receive({...input(ended('defeat')),offline:true,bestCombo:80},at+20000);expect(c.playback).toBe(p);c.receive({...input(ended('defeat')),offline:false},at+30000);expect(c.playback).toBe(p);});
 it('disabled cinematics and manual dismissal remain hidden after reconnect',()=>{for(const patch of [{enabled:false},{dismissedId:battleResultId(ended('victory'))}]){const c=new BattleCinematicController();c.receive({...input(ended('victory')),...patch},at);expect(c.playback).toBeUndefined();c.receive({...input(ended('victory')),...patch},at+10000);expect(c.playback).toBeUndefined();}});
 it('never mutates snapshots or invents damage/rewards; captures authoritative stats',()=>{const b=ended('timeout'),before=JSON.stringify(b),c=new BattleCinematicController();c.receive(input(),at-10);c.receive({...input(b),reducedMotion:true},at);expect(c.playback?.reducedMotion).toBe(true);expect(c.playback?.stats.bossHp).toBe(20);expect(c.playback?.stats).not.toHaveProperty('xp');c.cancel();expect(JSON.stringify(b)).toBe(before);});
 it('time attack omits irrelevant player HP',()=>{const c=new BattleCinematicController();c.receive(input(),at-10);const b=ended('timeout');b.config.gameMode='timeAttack';c.receive(input(b),at);expect(c.playback?.stats.playerHp).toBeUndefined();});
 it('old saved profiles receive nested cinematic defaults without losing preferences',()=>{const s=normalizeGameSettings({cinematics:{intensity:'low'},bossBattle:{enabled:true}});expect(s.cinematics).toEqual({...defaultCinematicSettings,intensity:'low'});expect(s.bossBattle.gameMode).toBe('survival');expect(normalizeGameSettings({cinematics:{autoDismiss:true}}).cinematics.autoDismiss).toBe(false);});
 it('notification hold preserves priority and extends cosmetic TTL, without duplicate rewards',()=>{const q=new CelebrationQueue();q.push({id:'a',kind:'achievement',title:'a',description:'a',priority:90,createdAt:at});q.push({id:'b',kind:'milestone',title:'b',description:'b',priority:10,createdAt:at});q.deferBy(60000);expect(q.next(at+61000)?.id).toBe('a');expect(q.next(at+61000)?.id).toBe('b');q.push({id:'a',kind:'achievement',title:'a',description:'a',priority:90,createdAt:at+61000});expect(q.next(at+61000)).toBeUndefined();});
 it('repeated runs only retain one active playback and accept genuinely new fights',()=>{const c=new BattleCinematicController();for(let i=0;i<300;i++){const b={...active(),attemptId:`fight-${i}`};c.receive(input(b),at);c.receive(input({...ended('victory'),attemptId:b.attemptId}),at);expect(c.playback?.attemptId).toBe(b.attemptId);expect(c.frame(at+5000).phase).toBe('holding');}});
});

it('TIME OUT retains all original V10 timing boundaries',()=>{
 const d=cinematicDefinitions.timeout;
 expect(d.durationMs).toBe(3100);expect(d.stages.map(s=>s.startMs)).toEqual([0,100,450,550,700,2750]);
 expect(d.stages.map(s=>s.endMs)).toEqual([100,450,550,700,2750,3100]);expect(d.title).toBe('TIME OUT');
});

it('initial loading placeholders cannot suppress restoration of a held result',()=>{
 const c=new BattleCinematicController();c.receive({...input(),battle:undefined,exerciseId:0},at-100);
 c.receive(input(ended('victory')),at);expect(c.frame(at).phase).toBe('holding');expect(c.playback?.restored).toBe(true);
 c.receive({...input(),battle:undefined,exerciseId:0,offline:true},at+100);expect(c.frame(at+100).phase).toBe('holding');
});
