import {useEffect,useRef,useState} from 'react';
import {battleRecorder,parseBattleTrace,replayFrame,type BattleTrace} from './battle-replay';
import {BossBattlePanel} from './boss-ui';
import type {BattleView} from './boss-battle';

export function BattleReplayControls(){
  const [status,setStatus]=useState('No practice recording'),[trace,setTrace]=useState<BattleTrace>(),[frame,setFrame]=useState<{battle:BattleView;combo:number}>();
  const [replayId,setReplayId]=useState(0);
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>{const poll=setInterval(()=>setStatus(battleRecorder.armed?'Armed — start a new MIDI exercise':battleRecorder.recording?`Recording evaluator results · ${battleRecorder.trace?.frames.length??0} updates`:battleRecorder.trace?.stoppedReason??'No practice recording'),500);return()=>{clearInterval(poll);clearTimeout(timer.current);};},[]);
  const download=()=>{const data=battleRecorder.stop();if(!data)return;setTrace(data);
    const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`piano-combat-${data.exercise.number}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const replay=()=>{if(!trace)return;clearTimeout(timer.current);const epoch=Date.now(),start=performance.now();let i=1;
    setReplayId(n=>n+1);setFrame({battle:replayFrame(trace.frames[0],epoch),combo:trace.frames[0].combo});
    const advance=()=>{while(i<trace.frames.length&&trace.frames[i].atMs<=performance.now()-start){const f=trace.frames[i++];setFrame({battle:replayFrame(f,epoch),combo:f.combo});}
      if(i<trace.frames.length)timer.current=setTimeout(advance,Math.max(1,trace.frames[i].atMs-(performance.now()-start)));};if(i<trace.frames.length)timer.current=setTimeout(advance,Math.max(16,trace.frames[i].atMs));};
  return <section aria-label="Recorded combat replay"><h4>Capture actual practice and replay locally</h4>
    <p>Arm capture, then start Hanon or Schmitt with Boss Mode enabled. Stop and download after playing. Capture observes the existing evaluator; replay never updates XP, HP in your live battle, achievements or OBS.</p>
    <div className="boss-options"><button onClick={()=>{battleRecorder.arm();setStatus('Armed — start a new MIDI exercise');}}>Record next practice</button>
      <button onClick={download}>Stop & download recording</button>
      <label>Load practice recording<input type="file" accept="application/json,.json" onChange={async e=>{try{const file=e.target.files?.[0];if(!file)return;if(file.size>16000000)throw Error('Recording exceeds 16 MB');setTrace(parseBattleTrace(await file.text()));}catch(err){setStatus(err instanceof Error?err.message:'Invalid recording');}}}/></label>
      <button disabled={!trace} onClick={replay}>Replay recording</button>
      <button onClick={()=>{clearTimeout(timer.current);setFrame(undefined);}}>Stop replay</button></div>
    <p role="status">{status}</p>{trace&&<p>{trace.exercise.title} · {trace.provenance==='synthetic'?'Synthetic test data':'Captured evaluator results — device provenance is not certified'}</p>}
    {frame&&<div className="battle-lab-arena"><BossBattlePanel key={replayId} battle={frame.battle} combo={frame.combo} debug recording/></div>}
  </section>;
}
