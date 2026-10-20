import {useEffect,useRef,useState} from 'react';
import {createBattle,reduceBattle,type BattleState} from './boss-battle';
import {defaultBossBattleConfig} from './boss-config';
import {BossBattlePanel} from './boss-ui';
import type {GameEvent} from './game-core';
import {BattleReplayControls} from './battle-replay-controls';
const fresh=()=>reduceBattle(createBattle({...defaultBossBattleConfig,enabled:true},1000),{type:'start',attemptId:crypto.randomUUID()});
// Explicit opt-in on the practice page only (?battleDebug=1). No game-state
// hook, persistence, MIDI listener or OBS publisher is imported here.
export function BattleChoreographyPreview(){
  const [battle,setBattle]=useState(fresh),[speed,setSpeed]=useState(1),[anchors,setAnchors]=useState(true),[tier,setTier]=useState(0),[interval,setIntervalMs]=useState(125);
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const stop=()=>clearTimeout(timer.current);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  const event=(s:BattleState,outcome:'correct'|'incorrect'|'missed')=>{
    const n=s.revision+1,e:GameEvent={id:`preview-${n}`,version:1,playerId:'preview',sessionId:'preview',attemptId:s.scoringAttemptId,exerciseId:0,sequence:n,timestamp:Date.now(),type:'note.evaluated',payload:{outcome,occurrence:`preview-${n}`,pitch:60+n%12,groupId:String(n),groupSize:1,groupComplete:true}};
    return reduceBattle(s,{type:'evaluate',attemptId:s.scoringAttemptId,events:[e]});
  };
  const play=(count:number,side:'correct'|'incorrect'|'missed'='correct')=>{stop();let remaining=count;const next=()=>{setBattle(s=>event(s,side));if(--remaining>0)timer.current=setTimeout(next,interval);};next();};
  const end=(win:boolean)=>{stop();setBattle(s=>event({...s,status:'active',bossHp:win?1:s.bossHp,playerHp:win?s.playerHp:1},win?'correct':'incorrect'));};
  return <section className="battle-choreography-preview" aria-label="Combat animation laboratory">
    <h3>Combat animation laboratory · Preview only</h3><p>Local simulation. No XP, records, achievements or live OBS changes.</p>
    <div className="boss-options">
      <button onClick={()=>play(1)}>Hero strike</button><button onClick={()=>play(1,'incorrect')}>Boss strike</button><button onClick={()=>play(1,'missed')}>Missed-note reaction</button>
      {[3,8,16].map(n=><button key={n} onClick={()=>play(n)}>{n}-note combination</button>)}
      <button onClick={()=>play(64)}>Hanon-speed stream</button><button onClick={()=>end(true)}>Hero finisher</button><button onClick={()=>end(false)}>Boss finisher</button>
      <button onClick={()=>{stop();setBattle(fresh());}}>Reset to idle</button>
      <button onClick={()=>setBattle(s=>reduceBattle(s,{type:s.status==='paused'?'resume':'pause',attemptId:s.scoringAttemptId}))}>Pause / resume preview</button>
    </div>
    <div className="boss-options">
      <label>Preview playback speed<select value={speed} onChange={e=>setSpeed(+e.target.value)}><option value="0.8">0.8×</option><option value="1">1×</option><option value="1.3">1.3×</option></select></label>
      <label>Preview note spacing<select value={interval} onChange={e=>setIntervalMs(+e.target.value)}>{[250,125,62.5,25].map(n=><option key={n} value={n}>{n} ms</option>)}</select></label>
      <label>Preview combo<select value={tier} onChange={e=>setTier(+e.target.value)}>{[0,10,25,50,100,200].map(n=><option key={n} value={n}>{n} notes</option>)}</select></label>
      <label><input type="checkbox" checked={anchors} onChange={e=>setAnchors(e.target.checked)}/>Contact anchors</label>
    </div>
    <div className="battle-lab-arena"><BossBattlePanel battle={{...battle,config:{...battle.config,animationSpeed:speed}}} combo={tier+battle.correctHits} debug={anchors}/></div>
    <BattleReplayControls/>
  </section>;
}
