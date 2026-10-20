import {bossClipId} from './boss-registry';
import type {BattleView,BattleRound} from "./boss-battle";
import {BattleAnimationSelector,characterIdle,animationById,battleAnimationLibrary,type AnimationCategory,type AnimationContext,type BattleAnimationDefinition,type AttackContact} from "./battle-animation-library";
import {noteAttackStyle,type BattleNoteAttack,type NoteAttackStyle} from "./battle-note-attacks";
import {cinematicRules,comboTier,combatElapsed,spriteProgress,type CombatClock} from "./battle-timeline";
import type {BattleFinisherCue} from "./battle-finisher";
import {combatMotion,reactionMotion,type ReactionWeight} from './battle-motion-profile';
type Side="player"|"boss";
export type ActorPlayback=CombatClock&{pressure?:number;clip:BattleAnimationDefinition;serial:number;staticLast?:boolean;strike?:NoteAttackStyle;recoilIntensity?:number;reactionWeight?:ReactionWeight;reactionPressure?:number;reactionContact?:AttackContact;freezeUntil?:number;contactDeliveredAt?:number};
export type BattlePresentation={player:ActorPlayback;boss:ActorPlayback;action?:Side;serial:number;strike?:NoteAttackStyle;
  phase?:"idle"|"windup"|"contact"|"recovery"|"finishing"|"settled";
  displayHp?:{player:number;boss:number};tier?:number;pendingCount?:number;combination?:{id:number;hit:number;final:boolean};
  impact?:{id:number;side:Side;at:number;hits:number;damage:number;power:number;label:string;blocked?:boolean;special?:boolean;signaturePhase?:"opening"|"reverse"|"cross"|"crush"};
  finisher?:BattleFinisherCue;outcomeAt?:number;finished?:boolean;roundEnding?:BattleRound};
type Batch={side:Side;hits:number;damage:number;firstAt:number;lastAt:number;revision:number;playerHp:number;bossHp:number;ordinal?:number;note?:BattleNoteAttack;signature?:string;signatureStep?:number;signatureRate?:number;blocked?:boolean;special?:boolean};
type Action={batch:Batch;contactAt:number;chainAt:number;endAt:number;contacted:boolean;finishing:boolean;hold:number;reaction:BattleAnimationDefinition;chain:boolean;strong:boolean};
const freshMetrics=()=>({evaluatedEvents:0,damageEvents:0,visualStrikes:0,visualCombinations:0,coalescedEffects:0,maxQueue:0,latencyTotal:0,latencyCount:0,maxLatencyMs:0});
// Stable per-attempt presentation choices in both audience layouts. This RNG
// never participates in evaluation, damage, difficulty or rewards.
const seededVariation=(seed:string)=>{let state=2166136261;for(const c of seed)state=Math.imul(state^c.charCodeAt(0),16777619);return()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};};
export const battleResponseRules={minimumActionMs:75,...cinematicRules};

// Presentation only: bounded chronological combinations of accepted events.
// All damage has already happened in reduceBattle, never in these timers.
export class BattleAnimationDirector {
  private selector:BattleAnimationSelector;
  private previous:BattleView;
  private latest:BattleView;
  private roundTransition?:{ended:BattleView;started:number;until:number;pausedAt?:number};
  private combo:number;
  private queue:Batch[]=[];
  private active?:Action;
  private serial=0;
  private idleAt=0;
  private idleCycles=0;
  private frozen=false;
  private frozenAt=0;
  private resultKey="";
  private settleAt=0;
  private lastAttacks:Partial<Record<Side,string>>={};
  private lastComboFinisher=0;
  private celebratedCombo=0;
  private skipped=0;
  private metrics=freshMetrics();
  private combinationId=0;
  presentation:BattlePresentation;
  constructor(initial:BattleView,combo=0,now=Date.now(),private random?:()=>number,private rules={...cinematicRules}){
    this.selector=new BattleAnimationSelector(random??seededVariation(initial.attemptId??""));this.previous=initial;this.latest=initial;this.combo=combo;
    this.presentation=this.rest(initial,now);this.idleAt=now+3500;
    if(this.terminal(initial))this.finishPose(initial,now,true);
  }
  private terminal(b:BattleView){return (b.status==="victory"||b.status==="defeat")&&(!b.result||b.result==="knockout"||b.result==="timeout");}
  private play(clip:BattleAnimationDefinition,now:number,staticLast=false):ActorPlayback{return {clip,startedAt:now,serial:++this.serial,staticLast};}
  private rest(b:BattleView,now:number):BattlePresentation{return {player:this.play(characterIdle(b.config.playerId),now),boss:this.play(characterIdle(b.config.bossId),now),serial:++this.serial,phase:"idle",displayHp:{player:b.playerHp,boss:b.bossHp},tier:comboTier(this.combo),pendingCount:0};}
  private select(side:Side,category:AnimationCategory,now:number,event:AnimationContext["eventType"],exclude:string[]=[],signature?:string,revision?:number){
    const b=this.previous,id=side==="player"?b.config.playerId:b.config.bossId;
    const omitted=battleAnimationLibrary.filter(c=>signature?c.id!==signature:c.tags.includes('signature')).map(c=>c.id);
    return this.selector.choose(id,category,{eventType:event,combo:this.combo,hpPercent:100*(side==="player"?b.playerHp/b.config.playerMaxHp:b.bossHp/b.bossMaxHp),bossEnraged:b.bossHp/b.bossMaxHp<=.25,battleState:b.status},now,[...exclude,...omitted],revision===undefined||this.random?undefined:seededVariation(`${b.attemptId}:${side}:${revision}`)())??characterIdle(id);
  }
  private finishPose(b:BattleView,now:number,restored=false){
    const win=b.status==="victory";this.queue=[];this.active=undefined;this.resultKey=`${b.round?.id??b.attemptId}:${b.status}`;
    this.presentation={...this.presentation,player:this.play(this.select("player",win?"victory":"defeat",now,win?"victory":"defeat"),now,restored),
      boss:this.play(this.select("boss",win?"defeat":"victory",now,win?"defeat":"victory"),now,restored),action:undefined,strike:undefined,
      displayHp:{player:b.playerHp,boss:b.bossHp},serial:++this.serial,phase:restored?"settled":"finishing",finished:true,pendingCount:0,roundEnding:!restored&&b.config.multiRoundEnabled?b.round:undefined,
      ...(restored?{finisher:undefined,impact:undefined,outcomeAt:undefined}:{})};
    this.settleAt=restored?0:now+cinematicRules.finishDurationMs;
  }
  private start(batch:Batch,now:number,finishing=false){
    if(batch.special)batch={...batch,signature:'hero_azure_cross',signatureStep:3};
    const b=this.previous,side=batch.side,target=side==="player"?"boss":"player",tier=comboTier(this.combo);
    // A terminal update may arrive midway through the showcase. Resolve its
    // final approved HP endpoint with the same attack identity before collapse.
    if(finishing&&this.active?.batch.signature&&this.active.batch.side===side)
      batch={...batch,signature:side==='player'?'hero_azure_cross':bossClipId(b.config.bossId,'boss_crimson_crushing_strike'),signatureStep:side==='player'?3:1};
    if((!finishing||side==='boss')&&!batch.signature){
      // Two-hand exercises commonly deliver two approved notes per group.
      // Borrow only the immediately following, already-evaluated hero batch
      // for a three-contact showcase; never wait for notes or cross a mistake.
      const next=this.queue[0],join=side==='player'&&batch.hits<3&&next?.side==='player'&&!next.signature&&!next.special?next:undefined;
      const age=now-batch.firstAt,rate=age<110?1:1.4;
      const signatureClips=['hero_azure_blade_rush','hero_azure_reverse','hero_azure_cross'].map(id=>animationById(id)!);
      const contactSpan=signatureClips.reduce((ms,clip,i)=>ms+clip.contact!.impactTimeMs+(i<2?clip.contact!.hitStopMs+clip.choreography!.followThroughMs:0),0)/(rate*b.config.animationSpeed);
      const candidate=side==='player'&&batch.hits+(join?.hits??0)>=3&&this.combo>=25&&this.queue.length<=3&&age<280&&age+contactSpan<this.rules.maxVisualAgeMs?'hero_azure_blade_rush':side==='boss'&&b.mistakes>0&&b.mistakes%4===0?bossClipId(b.config.bossId,'boss_crimson_crushing_strike'):undefined;
      const special=candidate?this.select(side,'heavyAttack',now,'milestone',[],candidate):undefined;
      if(special?.tags.includes('signature')){
        if(side==='player'){
          if(join){this.queue.shift();batch={...join,hits:batch.hits+join.hits,damage:batch.damage+join.damage,firstAt:batch.firstAt};}
          const amount=Math.floor(batch.hits/3),parts=[amount,amount,batch.hits-amount*2],clips=['hero_azure_blade_rush','hero_azure_reverse','hero_azure_cross'];
          let remaining=batch.damage;
          // A dense passage uses a 40% quicker version of the same key poses.
          // Its final contact still fits the existing 650 ms freshness budget.
          const beats=parts.map((hits,i)=>{const damage=i===2?remaining:Math.min(hits,remaining);remaining-=damage;return {...batch,hits,damage,bossHp:batch.bossHp+remaining,signature:clips[i],signatureStep:i+1,signatureRate:rate};});
          batch=beats[0];this.queue.unshift(...beats.slice(1));this.metrics.maxQueue=Math.max(this.metrics.maxQueue,this.queue.length);
        }else batch={...batch,signature:special.id,signatureStep:1};
      }
    }
    const chain=!!this.active&&!this.active.finishing&&this.active.batch.side===side&&batch.firstAt-this.active.batch.lastAt<=this.rules.batchWindowMs&&now<this.active.endAt;
    const hit=chain?(this.presentation.combination?.hit??0)+batch.hits:batch.hits;
    const final=batch.signature?batch.signatureStep===3:chain&&hit>=3&&!this.queue.length;
    if(!chain){this.combinationId++;this.metrics.visualCombinations++;}
    this.metrics.visualStrikes++;
    const milestone=side==='player'&&this.combo>=12&&Math.floor(this.combo/12)>this.lastComboFinisher;
    if(milestone)this.lastComboFinisher=Math.floor(this.combo/12);
    if(this.combo<12)this.lastComboFinisher=0;
    const heavy=finishing||final||!!batch.signature||milestone||(side==="player"?batch.hits>=3||!!(batch.note&&noteAttackStyle(batch.note).chordSize>1):b.bossHp/b.bossMaxHp<=.25||(b.config.gameMode==='ultimateBoss'&&b.phase==='aggressive'));
    const category:AnimationCategory=heavy?"heavyAttack":"lightAttack";
    // Rotate the three regular attacks even on repeated C notes. Pitch still
    // controls the slash angle/chord accents, never the number of damage events.
    const regular=()=>animationById((side==='player'
      ?['hero_attack_light_slash_01','hero_attack_dash_02','hero_attack_light_rising_01']
      :b.config.bossId==='grinwick'
        ?['grinwick_attack_light_slash_01','grinwick_attack_hop_02','grinwick_attack_spin_02']
        :['boss_attack_light_slash_01','boss_attack_light_lunge_01','boss_attack_sweep_02'])[Math.max(0,(batch.ordinal??batch.revision)-1)%3]);
    let clip=batch.signature?animationById(batch.signature):finishing?animationById(bossClipId(b.config.bossId,`${side==="player"?"hero":"boss"}_attack_heavy_cross_01`)):heavy?this.select(side,category,now,"milestone",this.lastAttacks[side]?[this.lastAttacks[side]!]:[],undefined,batch.revision):regular();
    if(!clip?.contact)clip=this.select(side,"lightAttack",now,side==="player"?"correct":"mistake");
    // Cooldowns may exhaust the weighted pool. A known authored light strike
    // is safer than treating the idle fallback as an attack with contact data.
    if(!clip.contact)clip=animationById(bossClipId(b.config.bossId,`${side==="player"?"hero":"boss"}_attack_light_slash_01`))!;
    // Heavy and regular pools share the same immediate-repeat protection.
    if(!finishing&&!batch.signature&&this.lastAttacks[side]===clip!.id){
      const alternate=this.select(side,category,now,side==="player"?"correct":"mistake",[clip!.id],undefined,batch.revision);if(alternate.contact)clip=alternate;
    }
    this.lastAttacks[side]=clip!.id;
    const contact=clip!.contact!,choreography=clip!.choreography,speed=b.config.animationSpeed*(batch.signatureRate??(chain&&!final&&!batch.signature?1.15:1));
    const impact=(finishing&&!choreography?150:contact.impactTimeMs)/speed;
    const hold=choreography?contact.hitStopMs/speed:finishing||heavy&&side==='boss'?combatMotion.hitStop.bossHeavy:heavy?combatMotion.hitStop.medium:combatMotion.hitStop.light;
    const duration=(chain&&!batch.signature?Math.min(clip!.durationMs,heavy?280:220):clip!.durationMs)/speed,recovery=(chain&&!final?70:contact.recoveryMs)/speed;
    let strike=batch.note?{...noteAttackStyle(batch.note),hits:batch.hits}:side==="player"?{key:60,chordSize:1,power:1,angle:-32,arcs:1,hits:batch.hits,label:""}:undefined;
    if(strike&&choreography)strike={...strike,angle:batch.signatureStep===2?35:-35,arcs:final?2:1,power:choreography.impactPower};
    this.active={batch,contactAt:now+impact,chainAt:now+impact+hold+(choreography?.followThroughMs??this.rules.followThroughMs)/speed,endAt:now+duration+hold+recovery,contacted:false,finishing,hold,chain,strong:heavy,reaction:batch.blocked?animationById('hero_defense_guard_01')!:choreography?animationById(bossClipId(b.config.bossId,choreography.reactionId))!:chain&&!heavy&&this.presentation[target].clip.category==="hitReaction"?this.presentation[target].clip:this.select(target,"hitReaction",now,side==="player"?"correct":"mistake")};
    const defender=this.presentation[target];
    // Hold the defender's current pose and position through anticipation. The
    // stage aims at that visible position, including an unfinished recoil.
    const heldDefender={...defender,serial:++this.serial,startedAt:now-combatElapsed(defender,now),holdAt:now,holdMs:impact,freezeUntil:now+impact};
    this.presentation={...this.presentation,[target]:heldDefender,[side]:{...this.play(clip!,now),strike,durationMs:duration,contactMs:impact,holdAt:now+impact,holdMs:hold,recoveryMs:recovery},
      action:side,strike,impact:undefined,serial:++this.serial,phase:"windup",tier,pendingCount:this.queue.length,combination:{id:this.combinationId,hit,final},finished:false};
  }
  private enqueue(batch:Batch){
    const active=this.active;
    // Give a counterattack a timely turn without reordering it. Collapse the
    // consecutive pending attacks before it into their final HP endpoint.
    if(this.queue.at(-1)?.side!==batch.side&&this.queue.length>1){
      for(let i=this.queue.length-1;i>0;i--){const left=this.queue[i-1],right=this.queue[i];
        if(left.side!==right.side||left.signature||right.signature||left.special||right.special||left.blocked||right.blocked)break;
        this.queue[i-1]={...right,hits:left.hits+right.hits,damage:left.damage+right.damage,firstAt:left.firstAt};
        this.queue.splice(i,1);this.metrics.coalescedEffects++;
      }
    }
    // Preserve separate contacts for small combinations. Only simultaneous
    // written chord tones share the in-flight strike. Dense streams coalesce
    // adjacent queued actions, never across a counterattack.
    const tail=this.queue.at(-1)??(!active?.contacted&&!active?.finishing?active?.batch:undefined);
    const sameChord=!!tail?.note&&!!batch.note&&tail.note.groupId===batch.note.groupId&&batch.note.expectedSize>1;
    const dense=this.queue.length>=2&&tail!==active?.batch;
    if(tail&&!tail.signature&&!batch.signature&&!tail.special&&!batch.special&&!tail.blocked&&!batch.blocked&&tail.side===batch.side&&(dense||(sameChord&&batch.lastAt-tail.firstAt<=this.rules.batchWindowMs))){
      this.metrics.coalescedEffects+=batch.hits;
      tail.hits+=batch.hits;tail.damage+=batch.damage;tail.lastAt=batch.lastAt;tail.revision=batch.revision;tail.playerHp=batch.playerHp;tail.bossHp=batch.bossHp;
      if(batch.note&&(!tail.note||noteAttackStyle(batch.note).chordSize>=noteAttackStyle(tail.note).chordSize))tail.note=batch.note;
      if(active?.batch===tail){const strike=tail.note?{...noteAttackStyle(tail.note),hits:tail.hits}:this.presentation.strike;
        this.presentation={...this.presentation,strike,[tail.side]:{...this.presentation[tail.side],strike},serial:++this.serial};}
    }else this.queue.push(batch);
    // Exceptional bursts may skip old VISUALS only; retained authoritative HP
    // endpoints reconcile all damage. Displayed attacks keep their source order.
    if(this.queue.length>this.rules.maxPendingBatches){this.skipped+=this.queue[0].hits;this.queue.shift();}
    this.metrics.maxQueue=Math.max(this.metrics.maxQueue,this.queue.length);
  }
  receive(b:BattleView,combo:number,now:number,offline=false){
    const old=this.latest,changed=b.attemptId!==old.attemptId;
    if(!changed&&b.revision<old.revision)return;
    const accepted=Math.max(0,b.correctHits-(changed?0:old.correctHits))+Math.max(0,b.mistakes-(changed?0:old.mistakes));
    this.latest=b;this.combo=combo;
    const cancel=changed||offline||!b.config.enabled||!b.config.multiRoundEnabled||!!b.exerciseEnded;
    if(cancel&&this.roundTransition){this.roundTransition=undefined;this.queue=[];this.active=undefined;this.settleAt=0;this.resultKey="";this.previous={...b,revision:b.revision};this.presentation=this.rest(b,now);}
    const roundChanged=b.config.multiRoundEnabled&&b.round&&old.round&&b.round.id!==old.round.id;
    if(!cancel&&!this.roundTransition&&roundChanged){
      const ended=b.recentRounds?.find(r=>r.id===old.round?.id);
      // Do not replay a chain of stale endings after a coalesced frame/reconnect.
      if(ended&&b.round!.number===old.round!.number+1&&now-(ended.endedAt??0)<650){
        const terminal:BattleView={...old,status:ended.result==='victory'?'victory':'defeat',result:'knockout',round:ended,playerHp:ended.playerHp,bossHp:ended.bossHp,bossMaxHp:ended.bossMaxHp,lastAt:ended.endedAt!,revision:ended.endRevision!,combatCues:b.combatCues?.filter(c=>c.roundId===ended.id)};
        this.roundTransition={ended:terminal,started:now,until:now+b.config.roundTransitionMs};
        this.receiveCurrent(terminal,combo,now);this.presentation={...this.presentation,roundEnding:ended};
      }else {this.queue=[];this.active=undefined;this.settleAt=0;this.resultKey="";this.previous=b;this.presentation=this.rest(b,now);}
    }
    if(this.roundTransition){
      const transition=this.roundTransition;
      if(b.status==='paused'){
        transition.pausedAt??=now;this.receiveCurrent({...transition.ended,status:'paused'},combo,now);
      }else if(transition.pausedAt!==undefined){
        const delay=now-transition.pausedAt;transition.started+=delay;transition.until+=delay;transition.pausedAt=undefined;this.receiveCurrent(transition.ended,combo,now);
      }
      // 420 ms preserves final contact + recoil + collapse. Pending music then
      // takes precedence over the optional longer result pose.
      if(b.revision>(b.round?.startRevision??b.revision)||(b.round?.number??0)>transition.ended.round!.number+1)
        transition.until=Math.min(transition.until,Math.max(now,transition.started+420));
    }else this.receiveCurrent(b,combo,now,offline);
    this.metrics.evaluatedEvents+=accepted;this.metrics.damageEvents+=accepted;
  }
  private receiveCurrent(b:BattleView,combo:number,now:number,offline=false){
    const old=this.previous,newAttempt=b.attemptId!==old.attemptId;
    if(!newAttempt&&b.revision<old.revision)return;
    const changed=newAttempt||b.config.playerId!==old.config.playerId||b.config.bossId!==old.config.bossId;
    if(changed){this.queue=[];this.active=undefined;this.resultKey="";this.settleAt=0;this.lastAttacks={};this.selector=new BattleAnimationSelector(this.random??seededVariation(b.attemptId??""));this.lastComboFinisher=0;this.celebratedCombo=0;this.skipped=0;this.metrics=freshMetrics();this.previous=b;this.combo=combo;this.presentation=this.rest(b,now);this.idleAt=now+3500;}
    else this.tick(now);
    if(newAttempt&&b.config.bossId==='grinwick'&&b.countdown&&!b.countdown.releasedAt&&!offline){this.presentation={...this.presentation,boss:this.play(animationById('grinwick_entrance')!,now)};}
    const wasFrozen=this.frozen;this.frozen=offline||b.status==="paused";
    if(this.frozen&&!wasFrozen)this.frozenAt=now;
    if(wasFrozen&&!this.frozen){
      const delay=now-this.frozenAt,shift=(a:ActorPlayback)=>({...a,startedAt:a.startedAt+delay,holdAt:a.holdAt===undefined?undefined:a.holdAt+delay,freezeUntil:a.freezeUntil===undefined?undefined:a.freezeUntil+delay});
      this.presentation={...this.presentation,player:shift(this.presentation.player),boss:shift(this.presentation.boss),serial:++this.serial};
      if(this.active){this.active.contactAt+=delay;this.active.chainAt+=delay;this.active.endAt+=delay;}
      this.queue.forEach(q=>{q.firstAt+=delay;q.lastAt+=delay;});this.idleAt+=delay;
    }
    this.previous=b;this.combo=combo;
    if(this.terminal(b)){
      if(offline){this.finishPose(b,now,true);return;}
      if(this.resultKey===`${b.round?.id??b.attemptId}:${b.status}`)return;
      this.resultKey=`${b.round?.id??b.attemptId}:${b.status}`;this.queue=[];
      if(offline||now-b.lastAt>2000||changed){this.finishPose(b,now,true);return;}
      if(b.result==='timeout'){this.finishPose(b,now);this.presentation={...this.presentation,outcomeAt:now,finisher:{id:this.resultKey,attemptId:b.attemptId,target:'player',tone:'red',startedAt:now}};return;}
      const side=b.status==="victory"?"player":"boss",hp=this.presentation.displayHp!;
      this.start({side,hits:Math.max(1,side==="player"?b.correctHits-old.correctHits:b.mistakes-old.mistakes),damage:side==="player"?hp.boss-b.bossHp:hp.player-b.playerHp,firstAt:now,lastAt:now,revision:b.revision,playerHp:b.playerHp,bossHp:b.bossHp,note:side==="player"?b.noteAttacks?.at(-1):undefined},now,true);return;
    }
    if(offline){this.queue=[];this.active=undefined;this.presentation=this.rest(b,now);return;}
    if(b.status==="paused")return;
    if(b.status!=="active"){if(b.status!==old.status){this.queue=[];this.active=undefined;this.presentation=this.rest(b,now);}return;}
    const baseRevision=changed?0:old.revision;
    if(b.revision<=baseRevision||now-b.lastAt>=2000)return;
    const cues=b.combatCues?.filter(c=>c.revision>baseRevision).sort((a,z)=>a.revision-z.revision);
    if(cues?.length&&cues[0].revision>baseRevision+1){
      // A reconnect or very large coalesced frame exceeded the journal. Restore
      // the missing prefix rather than inventing its mixed-event ordering.
      const first=cues[0];this.skipped+=first.revision-baseRevision-1;this.queue=[];this.active=undefined;
      this.presentation={...this.rest(b,now),displayHp:{player:Math.min(b.config.playerMaxHp,first.playerHp+(first.side==="boss"?(first.damage??b.config.bossDamagePerMistake):0)),boss:Math.min(b.bossMaxHp,first.bossHp+(first.side==="player"?1:0))}};
    }
    if(!cues?.length){
      // Old publishers have counters but no mixed-event chronology. Preserve
      // totals until that page refreshes to the V3 event journal.
      const correct=b.correctHits-(changed?0:old.correctHits),mistakes=b.mistakes-(changed?0:old.mistakes);
      if(correct>0)this.enqueue({side:"player",revision:b.revision,ordinal:b.correctHits-correct+1,hits:correct,damage:correct,firstAt:now,lastAt:now,playerHp:changed?b.config.playerMaxHp:old.playerHp,bossHp:b.bossHp,note:b.noteAttacks?.at(-1)});
      if(mistakes>0)this.enqueue({side:"boss",revision:b.revision,ordinal:b.mistakes-mistakes+1,hits:mistakes,damage:mistakes*b.config.bossDamagePerMistake,firstAt:now,lastAt:now,playerHp:b.playerHp,bossHp:b.bossHp});
    }else {
      // Derive per-side ordinals from accepted counters, including when an OBS
      // viewer receives several journal entries in one snapshot or opens late.
      const ordinal={player:b.correctHits-cues.filter(c=>c.side==='player').length,boss:b.mistakes-cues.filter(c=>c.side==='boss').length};
      for(const c of cues)this.enqueue({...c,ordinal:++ordinal[c.side],hits:1,damage:c.damage??(c.side==="player"?1:b.config.bossDamagePerMistake),firstAt:Math.min(now,c.at),lastAt:Math.min(now,c.at)});
    }
  }
  tick(now:number):BattlePresentation{
    if(this.frozen)return this.presentation;
    if(this.roundTransition&&now>=this.roundTransition.until){
      this.roundTransition=undefined;this.queue=[];this.active=undefined;this.settleAt=0;this.resultKey="";
      const live=this.latest,round=live.round!;
      this.previous={...live,revision:round.startRevision,combatCues:[],correctHits:0,mistakes:0};
      this.presentation=this.rest({...live,playerHp:round.playerMaxHp,bossHp:round.bossMaxHp},now);
      this.receiveCurrent(live,this.combo,now);
      if(!this.queue.length&&!this.active)this.presentation=this.rest(live,now);
    }
    const b=this.previous;
    if(this.settleAt&&now>=this.settleAt){this.settleAt=0;this.presentation={...this.presentation,phase:"settled",finisher:undefined,impact:undefined,serial:++this.serial};}
    const a=this.active;
    if(a&&!a.contacted&&now>=a.contactAt){
      // A delayed browser timer must not reveal recoil after the weapon has
      // already left contact. Align sprite and compositor to the delivered
      // contact, then recover together. Authoritative damage is unaffected.
      const late=now-a.contactAt;
      // Longer stalls fast-forward normally; they must not extend old combat.
      if(late>0&&late<100){const actor=this.presentation[a.batch.side];a.contactAt=now;a.chainAt+=late;a.endAt+=late;
        this.presentation={...this.presentation,[a.batch.side]:{...actor,startedAt:actor.startedAt+late,holdAt:now,contactDeliveredAt:now}};}
      a.contacted=true;const target=a.batch.side==="player"?"boss":"player",attacker=this.presentation[a.batch.side],hp=this.presentation.displayHp!;
      const damage=Math.max(0,target==="boss"?hp.boss-a.batch.bossHp:hp.player-a.batch.playerHp);
      const choreography=attacker.clip.choreography;
      const enrageAccent=a.batch.side==='boss'&&b.config.gameMode==='ultimateBoss'?(b.phase==='enraged'?1.2:b.phase==='aggressive'?1.1:1):1;
      const at=a.contactAt,power=Math.min(2.5,(choreography?.impactPower??Math.max(this.presentation.strike?.power??1,1+(this.presentation.tier??0)*.16+(a.batch.hits>1?.2:0)))*enrageAccent);
      const latency=Math.max(0,now-a.batch.firstAt);this.metrics.latencyTotal+=latency;this.metrics.latencyCount++;this.metrics.maxLatencyMs=Math.max(this.metrics.maxLatencyMs,latency);
      const prior=this.presentation[target],small=a.chain&&!a.strong;
      const weight:ReactionWeight=choreography?.phase==='cross'||choreography?.phase==='crush'||a.finishing?'heavy':choreography?.phase==='opening'?'light':a.strong?'medium':'light';
      const pressure=a.chain?Math.min(5,(prior.reactionPressure??1)+a.batch.hits):Math.min(5,a.batch.hits),motion=reactionMotion(target,weight,pressure);
      this.presentation={...this.presentation,[a.batch.side]:{...attacker,...(late<100?{contactDeliveredAt:at}:{})},[target]:{...this.play(a.reaction,at),holdAt:at,holdMs:a.hold,startProgress:choreography?.reactionStart??(small?Math.min(.7,Math.max(.25,spriteProgress(prior.clip,prior,at))):.25),durationMs:(choreography?.reactionDurationMs??motion.durationMs)/b.config.animationSpeed,recoveryMs:motion.recoveryMs/b.config.animationSpeed,recoilIntensity:choreography?attacker.clip.contact!.recoilIntensity:motion.force,reactionWeight:weight,reactionPressure:pressure,reactionContact:attacker.clip.contact},
        displayHp:{player:a.batch.playerHp,boss:a.batch.bossHp},phase:"contact",serial:++this.serial,
        impact:{id:++this.serial,side:a.batch.side,at,hits:a.batch.hits,damage,power,blocked:a.batch.blocked,special:a.batch.special,signaturePhase:choreography?.phase,label:a.batch.blocked?'SHIELD BLOCK':a.batch.special?'COMBO POWER · AZURE RUSH':a.batch.signature?(a.batch.side==='player'?(a.batch.signatureStep===3?'AZURE BLADE RUSH':''):attacker.clip.label):this.presentation.strike?.label||(a.batch.hits>1?`${a.batch.hits} hits`:"")},
        ...(a.finishing?{finisher:{id:this.resultKey,attemptId:b.attemptId,target,tone:target==="boss"?"blue" as const:"red" as const,startedAt:at,compact:!!this.roundTransition},outcomeAt:at+a.hold+80}:{})};
    }
    if(a?.finishing){if(now>=a.chainAt+80)this.finishPose(b,a.chainAt+80);return this.presentation;}
    if(this.terminal(b))return this.presentation;
    // Leave room for the authored approach: the limit applies to CONTACT,
    // rather than merely allowing an old action to start at the deadline.
    while(this.queue.length){
      const next=this.queue[0],approach=next.signature?animationById(next.signature)!.contact!.impactTimeMs/(b.config.animationSpeed*(next.signatureRate??1)):150;
      if(now-next.firstAt<=this.rules.maxVisualAgeMs-approach)break;
      this.skipped+=this.queue.shift()!.hits;
    }
    // A coalesced frame can arrive with every retained visual already stale.
    // Reconcile its authoritative endpoint even when no strike ever starts.
    if(!this.queue.length&&!this.active&&(this.presentation.displayHp?.player!==b.playerHp||this.presentation.displayHp?.boss!==b.bossHp))
      this.presentation={...this.presentation,displayHp:{player:b.playerHp,boss:b.bossHp},serial:++this.serial};
    if(!this.queue.length&&a&&now>=a.endAt+cinematicRules.maxVisualAgeMs){this.active=undefined;this.presentation=this.rest(b,now);this.idleAt=now+3500;return this.presentation;}
    if(this.queue.length&&(!this.active||now>=this.active.chainAt)){this.start(this.queue.shift()!,now);return this.presentation;}
    if(a&&now>=a.endAt){this.active=undefined;this.presentation=this.rest(b,now);this.idleAt=now+3500;
      if(this.combo>=25&&Math.floor(this.combo/25)>this.celebratedCombo){
        this.celebratedCombo=Math.floor(this.combo/25);
        const clip=animationById('hero_celebration_03')!;
        this.presentation={...this.presentation,player:this.play(clip,now)};this.idleAt=now+clip.durationMs;
      }}
    else if(a?.contacted&&now>=a.chainAt&&this.presentation.phase!=="recovery")this.presentation={...this.presentation,phase:"recovery",serial:++this.serial};
    if(!this.active&&!this.queue.length&&now>=this.idleAt&&["active","ready","idle"].includes(b.status)){
      const movement=++this.idleCycles%3===0,category=movement?"movement":"idle";
      this.presentation={...this.presentation,player:this.play(this.select("player",category,now,"idle"),now),boss:this.play(this.select("boss",category,now,"idle"),now),serial:++this.serial};this.idleAt=now+(movement?700:4000);}
    return this.presentation;
  }
  nextWakeAt(now:number):number|undefined{
    if(this.frozen)return;
    const transitionWake=this.roundTransition?.until;
    const a=this.active;
    if(a){const wake=!a.contacted?a.contactAt:a.finishing?a.chainAt+80:this.queue.length?Math.max(now,a.chainAt):this.presentation.phase==="contact"?a.chainAt:a.endAt;return Math.min(wake,transitionWake??Infinity);}
    if(transitionWake)return transitionWake;
    if(this.settleAt)return this.settleAt;
    if(this.terminal(this.previous)||!["active","ready","idle"].includes(this.previous.status))return;
    return this.queue.length?now:this.idleAt;
  }
  diagnostics(now:number){return {...this.metrics,averageLatencyMs:this.metrics.latencyCount?this.metrics.latencyTotal/this.metrics.latencyCount:0,phase:this.presentation.phase,pending:this.queue.length,pendingHits:this.queue.reduce((n,q)=>n+q.hits,0),skippedVisualHits:this.skipped,
    contactInMs:this.active?Math.max(0,this.active.contactAt-now):0,roundTransition:!!this.roundTransition,roundNumber:this.latest.round?.number,displayHp:this.presentation.displayHp,authoritativeHp:{player:this.latest.playerHp,boss:this.latest.bossHp}};}
}
