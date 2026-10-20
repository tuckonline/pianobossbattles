import {it,expect} from 'vitest';
import {animationById,BattleAnimationSelector} from '../hosted/battle-animation-library';
import {BattleAnimationDirector} from '../hosted/battle-animation-director';
import {createBattle,configureBattle,battleView} from '../hosted/boss-battle';
import {defaultBossBattleConfig,bossConfigSchema} from '../hosted/boss-config';
import {battleSamplePlan,battleSampleCatalog} from '../hosted/battle-sample-plan';
it('keeps selection presentation-only and freezes boss identity during an attempt',()=>{
 const old=createBattle({...defaultBossBattleConfig,enabled:true},66);
 const selected=configureBattle(old,{...old.config,bossId:'grinwick'},66,false);
 expect(selected).toEqual({...old,config:{...old.config,bossId:'grinwick'}});
 expect(bossConfigSchema.parse(selected.config).bossId).toBe('grinwick');
 const active={...selected,status:'active' as const,attemptId:'chain'};
 expect(configureBattle(active,old.config,66,true).config.bossId).toBe('grinwick');
 expect(defaultBossBattleConfig.bossId).toBe('crimson_musical_colossus');
});
it('routes contacts and damage reactions to Grinwick without changing evaluated damage',()=>{
 const b={...battleView(createBattle({...defaultBossBattleConfig,enabled:true,bossId:'grinwick'},100)),status:'active' as const,attemptId:'grin'};
 const director=new BattleAnimationDirector(b,0,0,()=>0);
 const hit={...b,revision:1,correctHits:1,bossHp:99,lastAt:1000,lastAction:'player' as const};
 director.receive(hit,1,1000);
 const windup=director.tick(1000),contact=director.tick(windup.player.holdAt!);
 expect(contact.boss.clip.characterId).toBe('grinwick');expect(contact.boss.clip.category).toBe('hitReaction');
 expect(hit.bossHp).toBe(99);expect(hit.playerHp).toBe(30);
 const selector=new BattleAnimationSelector(()=>0);
 expect(selector.choose('grinwick','lightAttack',{eventType:'mistake',combo:0,hpPercent:100,bossEnraged:false,battleState:'active'},2000)?.characterId).toBe('grinwick');
 for(const id of ['grinwick_cackle','grinwick_goblin_frenzy','grinwick_defeat_01','grinwick_victory_01']){
  const clip=animationById(id)!;expect(clip.asset.type).toBe('spriteSheet');
  if(clip.asset.type==='spriteSheet')expect(new Set(clip.asset.frames).size).toBeGreaterThanOrEqual(4);
 }
});
it('uses distinct limited Grinwick recordings and preserves timeout and hero swings',()=>{
 for(const kind of ['bossSwing','hurt','heavy','pressureTaunt','victory','defeat'] as const){
  const plan=battleSamplePlan(kind,0,'grinwick');
  expect(plan.some(l=>l.sample.startsWith('grin-'))).toBe(true);
  expect(plan.length).toBeLessThanOrEqual(2);
  for(const layer of plan){expect(battleSampleCatalog[layer.sample].duration).toBeLessThan(2);}
 }
 for(const kind of ['timeout','heroSwing','countIn','fight'] as const)
  expect(battleSamplePlan(kind,0,'grinwick')).toEqual(battleSamplePlan(kind,0));
});
it('selects Goblin Frenzy on the existing fourth-mistake signature trigger',()=>{
 const b={...battleView(createBattle({...defaultBossBattleConfig,enabled:true,bossId:'grinwick'},100)),status:'active' as const,attemptId:'grin',mistakes:3,revision:3,playerHp:18};
 const director=new BattleAnimationDirector(b,0,0,()=>0);
 const next={...b,mistakes:4,revision:4,playerHp:14,lastAt:1000,lastAction:'boss' as const};
 director.receive(next,0,1000);
 const view=director.tick(1000);
 expect(view.boss.clip.id).toBe('grinwick_goblin_frenzy');
 const contact=director.tick(view.boss.holdAt!);
 expect(contact.impact?.damage).toBe(4);
 expect(contact.player.clip.characterId).toBe('piano_blade_warrior');
 expect(next.playerHp).toBe(14);
});
