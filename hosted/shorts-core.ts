import {z} from 'zod';
import type {BattleView} from './boss-battle';
import {enrageMultipliers, gameModeRegistry} from './battle-modes';

export const shortsRules={version:1, maxEvents:3000, maxDurationMs:2*60*60*1000, targetSeconds:30,
  platformMaxSeconds:180, platformChecked:'2026-10-19', platformSource:'https://support.google.com/youtube/answer/15424877',
  comboThresholds:[50,100,200,250,500,1000], lowHpRatio:.25, lastSeconds:5, dedupeMs:8000};
const finite=z.number().finite();
export const shortsEventSchema=z.object({id:z.string().max(240),segment:z.string().uuid(),atMs:finite.min(0).max(shortsRules.maxDurationMs),
  kind:z.enum(['attempt','checkpoint','damage','combo','combo-broken','special','victory','defeat','timeout','achievement','record','level','marker','pause','stop']),
  exercise:z.number().int().nonnegative(),title:z.string().max(240),attempt:z.string().max(64),
  combo:finite.nonnegative(),hp:finite.nonnegative(),maxHp:finite.positive(),bossHp:finite.nonnegative(),bossMax:finite.positive(),
  nextDamage:finite.nonnegative(),shields:finite.nonnegative(),health:z.boolean(),mode:z.string().max(24),bpm:finite.nonnegative(),loops:z.number().int().min(1).max(100),
  timeMs:finite.nonnegative().nullable(),progress:finite.min(0).max(1),conditions:z.string().max(240).optional(),detail:z.string().max(240).optional(),priority:finite.optional()});
export type ShortsEvent=z.infer<typeof shortsEventSchema>;
export const clipEditSchema=z.object({id:z.string().max(240),start:finite.min(0),end:finite.min(0),hook:z.string().max(100),
  hookVisible:z.boolean(),contextVisible:z.boolean(),decision:z.enum(['suggested','approved','rejected']),exportStatus:z.enum(['not-exported','kit-downloaded','verified'])});
export type ClipEdit=z.infer<typeof clipEditSchema>;
export const shortsSessionSchema=z.object({version:z.literal(1),id:z.string().uuid(),revision:z.number().int().nonnegative(),title:z.string().max(160),
  startedAt:z.string().datetime(),endedAt:z.string().datetime().optional(),status:z.enum(['recording','paused','stopped','interrupted']),profile:z.literal('vertical-1080x1920'),
  events:z.array(shortsEventSchema).max(shortsRules.maxEvents),segments:z.array(z.object({id:z.string().uuid(),startMs:finite.nonnegative(),endMs:finite.nonnegative().optional(),reason:z.string().max(100)})).max(100),
  anchors:z.array(z.object({markerId:z.string().max(240),videoSeconds:finite.nonnegative()})).max(200),
  edits:z.array(clipEditSchema).max(500),targetSeconds:finite.min(10).max(180),maxSeconds:finite.min(10).max(180),
  file:z.object({name:z.string().max(260),size:finite.nonnegative(),lastModified:finite.nonnegative(),duration:finite.nonnegative(),width:finite.nonnegative(),height:finite.nonnegative()}).optional(),
  warning:z.string().max(300).optional()});
export type ShortsSession=z.infer<typeof shortsSessionSchema>;
export const shortsBroadcastSchema=z.object({sessionId:z.string().uuid(),status:z.enum(['recording','paused','stopped','interrupted']),marker:z.string().max(30).optional(),markerUntil:finite.optional()});

export function nextHitDamage(b:BattleView){return Math.min(b.config.playerMaxHp,Math.ceil(b.config.bossDamagePerMistake*(gameModeRegistry[b.config.gameMode].enrage?enrageMultipliers[b.phase??'normal']:1)));}
export function challengeHook(b?:BattleView){
  if(!b?.config.enabled)return 'BUILD YOUR NEXT NOTE STREAK';
  if(b.status==='victory')return 'BOSS DEFEATED';
  if(b.status==='defeat')return b.result==='timeout'?'TIME OUT':'ANOTHER ATTEMPT. ANOTHER CHANCE.';
  const mode=gameModeRegistry[b.config.gameMode];
  if(mode.health&&b.playerHp>0&&b.playerHp<=nextHitDamage(b)&&!(b.shields??0))return 'ONE MORE MISTAKE AND I LOSE';
  if(mode.timed)return 'CAN I BEAT THE CLOCK?';
  return 'EVERY WRONG NOTE HURTS ME';
}
export function eventEvidence(b:BattleView){return {hp:b.playerHp,maxHp:b.config.playerMaxHp,bossHp:b.bossHp,bossMax:b.bossMaxHp||1,nextDamage:nextHitDamage(b),
  shields:b.shields??0,health:gameModeRegistry[b.config.gameMode].health,mode:b.config.gameMode,bpm:b.config.selectedBpm,loops:b.loopCount??1,
  timeMs:b.timer?Math.max(0,b.timer.limitMs-b.timer.elapsedMs):null,progress:Math.min(1,Math.max(0,1-b.bossHp/(b.bossMaxHp||1))),
  conditions:[b.config.gameMode,b.config.playerMaxHp,b.config.bossDamagePerMistake,b.expectedNotes,b.config.selectedBpm,b.loopCount??1,b.timer?.limitMs??0,b.config.multiRoundEnabled].join(':')};}
export type Highlight={id:string;event:ShortsEvent;title:string;score:number;reasons:string[];startMs:number;endMs:number;hook:string;payoffMs:number};
export function rankHighlights(s:ShortsSession):Highlight[]{
  const events=[...new Map(s.events.map(e=>[e.id,e])).values()].sort((a,b)=>a.atMs-b.atMs||a.id.localeCompare(b.id));
  const candidates:Highlight[]=[];
  for(const e of events){
    let title='',score=0;const reasons:string[]=[];
    if(e.kind==='victory'){
      title='Boss defeated';score=80;reasons.push('confirmed-victory');
      if(e.health&&e.hp>0&&e.hp/e.maxHp<=shortsRules.lowHpRatio){title='Clutch victory';score+=25;reasons.push('low-remaining-hp');}
      if(e.timeMs!==null&&e.timeMs<=shortsRules.lastSeconds*1000){title='Last-second victory';score+=30;reasons.push('actual-timer-under-five-seconds');}
      const prior=events.filter(p=>p.exercise===e.exercise&&p.conditions===e.conditions&&p.attempt!==e.attempt&&p.atMs<e.atMs&&['defeat','timeout'].includes(p.kind)).at(-1);
      if(prior&&e.progress-prior.progress>=.2){reasons.push('improved-after-failed-attempt');score+=15;}
    }else if(e.kind==='defeat'){title='A fight to the finish';score=45+e.progress*30;reasons.push(e.progress>=.75?'defeat-after-substantial-progress':'confirmed-defeat');}
    else if(e.kind==='timeout'){title='Against the clock';score=65+e.progress*15;reasons.push('confirmed-timeout');}
    else if(e.kind==='damage'&&e.health&&e.hp>0&&e.hp/e.maxHp<=shortsRules.lowHpRatio){title='Near defeat';score=65;reasons.push('survived-with-low-hp');}
    else if(e.kind==='combo'){title=`${e.combo} notes in a row`;score=40+Math.min(35,e.combo/10);reasons.push('evaluated-combo-threshold');}
    else if(e.kind==='combo-broken'){title='A streak comes to an end';score=45;reasons.push('evaluated-error-broke-long-streak');}
    else if(e.kind==='special'){title='Combo Power unleashed';score=60;reasons.push('confirmed-power-activation');}
    else if(['achievement','record','level'].includes(e.kind)){title=e.detail??e.kind;score=e.kind==='record'?72:55+Math.min(20,(e.priority??0)/10);reasons.push(`confirmed-${e.kind}`);}
    if(!score)continue;
    const segment=s.segments.find(p=>p.id===e.segment);if(!segment)continue;
    const terminal=['victory','defeat','timeout'].includes(e.kind);
    // Include the entire existing cinematic and a short final hold. Never jump
    // across an OBS pause/reconnect or splice different attempts into a victory.
    const payoffMs=e.kind==='victory'?6500:e.kind==='defeat'?6000:e.kind==='timeout'?4500:3500;
    const attempt=events.find(p=>p.segment===e.segment&&p.attempt===e.attempt&&p.kind==='attempt');
    const startMs=Math.max(segment.startMs,attempt?.atMs??segment.startMs,e.atMs-Math.max(terminal?15000:5000,s.targetSeconds*1000-payoffMs));
    const endMs=e.atMs+payoffMs;
    const hook=e.kind==='victory'?(reasons.includes('low-remaining-hp')?'I ALMOST LOST THIS PIANO BOSS FIGHT':'CAN I DEFEAT THIS PIANO BOSS?'):
      e.kind==='timeout'?'CAN I BEAT THE CLOCK?':e.kind==='combo'?`${e.combo} NOTES. ONE STREAK.`:
      e.health&&e.hp>0&&e.hp<=e.nextDamage&&e.shields===0?'ONE MORE MISTAKE AND I LOSE':title.toUpperCase();
    candidates.push({id:e.id,event:e,title,score:Math.round(score),reasons,startMs,endMs,hook,payoffMs});
  }
  const ranked=candidates.sort((a,b)=>b.score-a.score||a.event.atMs-b.event.atMs||a.id.localeCompare(b.id));
  return ranked.filter((h,i)=>!ranked.slice(0,i).some(p=>p.event.segment===h.event.segment&&p.event.attempt===h.event.attempt&&Math.abs(p.event.atMs-h.event.atMs)<shortsRules.dedupeMs));
}
export function mappedInterval(s:ShortsSession,h:Highlight){
  const segment=s.segments.find(p=>p.id===h.event.segment)!;
  const anchors=s.anchors.map(a=>({a,event:s.events.find(e=>e.id===a.markerId&&e.kind==='marker'&&e.segment===segment.id)})).filter(p=>p.event).sort((a,b)=>a.event!.atMs-b.event!.atMs);
  if(anchors.length<2)return {error:'Match at least two sync markers from this segment to the video.'};
  const first=anchors[0],last=anchors.at(-1)!,delta=last.event!.atMs-first.event!.atMs;
  const rate=(last.a.videoSeconds-first.a.videoSeconds)/(delta/1000);
  if(delta<1000||rate<.95||rate>1.05)return {error:'Sync markers disagree. Check their video timestamps or split at an OBS pause.'};
  if(anchors.some(p=>Math.abs(p.a.videoSeconds-(first.a.videoSeconds+(p.event!.atMs-first.event!.atMs)/1000*rate))>.15))return {error:'Recording has a discontinuity between markers. Resume in a new segment and align it separately.'};
  if(h.startMs<first.event!.atMs||h.endMs>last.event!.atMs||h.endMs>(segment.endMs??Infinity))return {error:'This story is outside the aligned markers or its full payoff was not recorded.'};
  const map=(ms:number)=>first.a.videoSeconds+(ms-first.event!.atMs)/1000*rate;
  const start=map(h.startMs),end=map(h.endMs);
  if(start<0||!s.file||end>s.file.duration+.05)return {error:'The linked recording does not contain this complete clip.'};
  if(end-start>s.maxSeconds)return {error:'The full story exceeds your maximum duration. Review a shorter interval.'};
  return {start,end,climax:map(h.event.atMs),payoff:map(h.endMs),error:undefined};
}
