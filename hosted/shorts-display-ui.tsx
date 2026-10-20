import {useEffect,useRef,useState} from 'react';
import {gameClient,useGame} from './game-client';
import {defaultShortsDisplay,type ShortsDisplay} from './shorts-display';
export function ShortsDisplayControls(){
  const game=useGame(),s=game.player.settings.shortsDisplay??defaultShortsDisplay;
  const [open,setOpen]=useState(false),[fit,setFit]=useState<{effective:number;requested:number;measures:number}>();
  const preview=useRef<HTMLIFrameElement>(null);
  useEffect(()=>{const receive=(event:MessageEvent)=>{
    if(event.origin!==location.origin||event.source!==preview.current?.contentWindow||event.data?.type!=='lpf-shorts-fit')return;
    if([event.data.effective,event.data.requested,event.data.measures].every(Number.isFinite))setFit(event.data);
  };window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[]);
  const set=(patch:Partial<ShortsDisplay>)=>void gameClient.shortsDisplay({...s,...patch});
  return <details className="shorts-display-controls" onToggle={e=>setOpen(e.currentTarget.open)}><summary>Shorts Display</summary>
    <div className="shorts-display-grid"><div>
      <label>Character Scale <output>{s.characterScale}%</output><input aria-label="Character Scale" type="range" min="80" max="140" step="5" value={s.characterScale} disabled={!game.ready} onChange={e=>set({characterScale:+e.target.value})}/></label>
      <button onClick={()=>set({characterScale:110})}>Reset character scale</button>
      <label>Notation Scale <output>{s.notationScale}%</output><input aria-label="Notation Scale" type="range" min="90" max="160" step="5" value={s.notationScale} disabled={!game.ready} onChange={e=>set({notationScale:+e.target.value})}/></label>
      <button onClick={()=>set({notationScale:125})}>Reset notation scale</button>
      <label>Notation View <select aria-label="Notation View" value={s.notationView} onChange={e=>set({notationView:e.target.value as ShortsDisplay['notationView']})}><option value="automatic">Automatic</option><option value="current">Current measure</option><option value="next">Current + next measure</option></select></label>
      <p role="status">{fit?`Notation displayed at ${fit.effective}% · ${fit.measures} measure${fit.measures===1?'':'s'}${fit.effective<fit.requested?' · constrained to keep every note visible':''}`:'Open a practice exercise to measure the notation fit.'}</p>
      <details><summary>Safe margins</summary>{(['safeLeft','safeRight','safeTop','safeBottom'] as const).map(key=><label key={key}>{key.replace('safe','')} margin %<input aria-label={`${key.replace('safe','')} safe margin`} type="number" min={key==='safeTop'||key==='safeBottom'?1:3} max={key==='safeRight'?18:key==='safeTop'?5:key==='safeBottom'?6:15} value={s[key]} onChange={e=>{const n=+e.target.value;if(e.target.validity.valid)set({[key]:n});}}/></label>)}</details>
      <button disabled={!game.ready} onClick={()=>void gameClient.shortsDisplay({...defaultShortsDisplay})}>Reset Shorts Display to defaults</button>
      <p>Saved with your profile. Applies only to Shorts; cinematic scenes keep their own framing. Large character sizes are constrained to their safe idle zones. This preview is silent.</p>
    </div>{open&&<div className="shorts-display-preview"><iframe ref={preview} src="/obs/shorts?displayPreview=1" title="Shorts display preview" tabIndex={-1}/></div>}</div>
  </details>;
}
