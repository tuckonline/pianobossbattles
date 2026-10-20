import type {BattleAnimationDefinition,AnimationCategory,BattleAsset,CharacterId} from './battle-animation-library';

// New illustrated key poses complement the approved A/B libraries. Coordinates
// refer to fixed body windows, so a wider sword never shrinks the character.
export function registerExpandedAnimations(register:(clip:BattleAnimationDefinition)=>void,find:(id:string)=>BattleAnimationDefinition|undefined){
  const asset=(who:'hero'|'boss'|'grinwick',frames:number[]):BattleAsset=>({
    type:'spriteSheet',path:`/battle/expanded/${who}.png`,columns:4,rows:4,frames,
    registrationBounds:who==='hero'?{x:80,y:72,width:211,height:188}:who==='boss'?{x:90,y:50,width:200,height:188}:{x:100,y:165,width:312,height:300},
    canvasBounds:who==='grinwick'?{x:0,y:0,width:512,height:512}:{x:0,y:0,width:384,height:320},
  });
  const characters:Record<string,CharacterId>={hero:'piano_blade_warrior',boss:'crimson_musical_colossus',grinwick:'grinwick'};
  const add=(who:'hero'|'boss'|'grinwick',id:string,category:AnimationCategory,label:string,frames:number[],durationMs:number,options:Partial<BattleAnimationDefinition>={})=>{
    register({id:`${who}_${id}`,characterId:characters[who],category,label,asset:asset(who,frames),durationMs,
      weight:1,cooldownMs:category==='idle'?6500:0,priority:category==='victory'||category==='defeat'?100:category==='heavyAttack'?60:30,
      tags:['expanded'],holdLast:category==='victory'||category==='defeat',...options});
  };
  const attack=(who:'hero'|'boss'|'grinwick',id:string,label:string,frames:number[],source:string,durationMs:number,impactTimeMs:number,impactFrame:number,options:Partial<BattleAnimationDefinition>={})=>{
    const base=find(source)!;
    // Measured weapon edges in the packed impact drawings, transformed through
    // the fixed registration window. Hop aims high; slam contacts low.
    const anchors:Record<string,{x:number;y:number}>={
      hero_attack_dash_02:{x:1.09,y:.39},hero_attack_spin_02:{x:1.015,y:.40},
      hero_attack_final_salute_02:{x:1.015,y:.40},
      boss_attack_sweep_02:{x:.035,y:.66},boss_attack_body_slam_02:{x:.13,y:.94},
      grinwick_attack_hop_02:{x:.05,y:-.06},grinwick_attack_spin_02:{x:-.08,y:.39},
      grinwick_attack_last_stand_02:{x:-.08,y:.39},
    };
    add(who,id,base.category,label,frames,durationMs,{
      motion:base.motion,contact:{...base.contact!,impactFrame,impactTimeMs,
        weaponOrigin:who==='hero'?{x:.58,y:.55}:{x:.55,y:.45},
        weaponAnchor:anchors[`${who}_${id}`],
        ...(id==='attack_hop_02'?{targetAnchor:{x:.50,y:.35},targetRegion:{name:'upperTorso' as const,x:.42,y:.27,width:.20,height:.20}}:{}),
        // Meet the inner torso so the wide sweep's trailing foot also
        // retains arena clearance in the narrow horizontal OBS sidebar.
        ...(who==='boss'&&id==='attack_sweep_02'?{targetAnchor:{x:.39,y:.58},targetRegion:{name:'upperTorso' as const,x:.32,y:.44,width:.20,height:.24}}:{}),
        bodyBounds:who==='hero'?{x:.32,y:.23,width:.31,height:.70}:{x:.28,y:.25,width:.48,height:.65},
        visualBounds:who==='hero'?{x:-.3,y:-.2,width:1.6,height:1.2}:{x:-.25,y:-.25,width:1.5,height:1.25}},
      poseTimesMs:frames.map((_,i)=>i<=impactFrame?Math.round(i*impactTimeMs/impactFrame):Math.round(impactTimeMs+(i-impactFrame)*(durationMs-impactTimeMs-25)/(frames.length-impactFrame-1))),
      ...options,
    });
  };
  attack('hero','attack_dash_02','Quick forward dash',[4,5,6,7],'hero_attack_light_lunge_01',240,64,1);
  attack('hero','attack_spin_02','Twin-blade spinning finisher',[0,1,2,3,8],'hero_attack_heavy_cross_01',360,96,1,{cooldownMs:1600,tags:['expanded','milestone','finisher'],conditions:{minCombo:12}});
  attack('hero','attack_final_salute_02','Dramatic final sword strike',[8,12,1,3,7],'hero_attack_heavy_cross_01',380,110,2,{cooldownMs:2000,tags:['expanded','finisher'],conditions:{minCombo:24}});
  add('hero','idle_focus_03','idle','Determined focused glance',[8,7,8],2400,{motion:'settle',conditions:{minCombo:10},loop:true});
  add('hero','idle_smirk_04','idle','Confident combat-ready smirk',[7,8,7],2600,{motion:'settle',loop:true});
  add('hero','idle_desperation_05','idle','Low-health resolve',[10,11,8],1600,{conditions:{maxHpPercent:25},motion:'settle'});
  add('hero','expression_surprised','idle','Surprised into nervous recovery',[8,9,10,8],1400,{conditions:{eventType:[]},tags:['expanded','pressure']});
  add('hero','hit_frustrated_04','hitReaction','Frustrated recovery',[9,11,8],260,{motion:'recoil'});
  add('hero','hit_exhausted_05','hitReaction','Heavy exhausted recovery',[11,14,11,8],360,{motion:'recoil',conditions:{maxHpPercent:35}});
  add('hero','victory_salute_03','victory','Heroic sword salute',[8,12,13],1100);
  add('hero','victory_exhausted_04','victory','Exhausted but victorious',[11,14],1100);
  add('hero','defeat_kneeling_03','defeat','Defeated bowed kneel',[11,14,15],1100);
  add('hero','celebration_03','idle','Quick combo celebration',[7,12,7,8],650,{conditions:{eventType:[],minCombo:25},tags:['expanded','celebration']});

  attack('boss','attack_sweep_02','Wide weighted claw sweep',[0,1,2,3],'boss_attack_light_slash_01',320,96,1);
  attack('boss','attack_body_slam_02','Heavy body slam',[4,5,6,7],'boss_attack_heavy_cross_01',440,160,2,{cooldownMs:1400});
  add('boss','idle_laughter_03','idle','Menacing laughter and claw flex',[8,9,8,9,8],2800,{motion:'settle',loop:true});
  add('boss','idle_intimidation_04','idle','Chest-beating intimidation',[8,10,11,8],2500,{motion:'settle',cooldownMs:10000});
  add('boss','idle_enraged_05','idle','Enraged last stand',[8,11,10,11],1800,{conditions:{maxHpPercent:25},motion:'settle'});
  add('boss','hit_stunned_04','hitReaction','Stunned expression and heavy stagger',[12,13,7],380,{motion:'recoil'});
  add('boss','hit_furious_05','hitReaction','Furious combo recoil',[12,11,8],340,{motion:'recoil',conditions:{minCombo:12}});
  add('boss','victory_dominant_03','victory','Dominant raised-claw roar',[10,11,15],1300);
  add('boss','defeat_collapse_03','defeat','Dramatic sideways collapse',[12,13,14],1300);

  attack('grinwick','attack_hop_02','Hopping claw uppercut',[0,1,2,3],'grinwick_attack_light_lunge_01',220,80,1);
  attack('grinwick','attack_spin_02','Spinning double-claw slash',[4,5,6,7],'grinwick_attack_light_rising_01',240,80,1);
  attack('grinwick','attack_last_stand_02','Frantic last-stand slash',[11,15,5,7],'grinwick_attack_heavy_cross_01',320,110,2,{conditions:{maxHpPercent:30},cooldownMs:1500});
  add('grinwick','idle_applause_03','idle','Mocking applause and pointing',[8,9,8,9,12],1900,{motion:'settle',cooldownMs:8000});
  add('grinwick','idle_foot_tap_04','idle','Impatient foot tap and smug grin',[12,7,12,3],2100,{motion:'settle',loop:true});
  add('grinwick','idle_panic_05','idle','Low-health panic and tantrum',[10,11,10,15],1200,{conditions:{maxHpPercent:25},motion:'settle'});
  add('grinwick','hit_surprised_04','hitReaction','Wide-eyed elastic recoil',[10,13,3],240,{motion:'recoil'});
  add('grinwick','hit_tantrum_05','hitReaction','Furious temper tantrum',[10,11,15,7],300,{motion:'recoil',conditions:{minCombo:12}});
  add('grinwick','victory_mocking_03','victory','Smug applause victory',[8,9,12,8],1000);
  add('grinwick','defeat_tumble_03','defeat','Dizzy backward tumble',[10,13,14],1000);
}
