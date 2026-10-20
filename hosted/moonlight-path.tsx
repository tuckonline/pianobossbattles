import { moonlightLibrary, type MoonlightLesson } from './moonlight-library';
import { progressLabels, progressState, type ProgressMap } from './collection-progress';
import {useEffect,useState} from 'react';
import {validateMoonlightRange,type MoonlightRange} from './moonlight-range';

const stages = [
  {name:'Prepare', detail:'8 small exercises · keys, triplets, octaves and melody control'},
  {name:'Short passages', detail:'19 short passages · original measure numbers match your PDF'},
  {name:'Connect', detail:'5 longer sections · practise the joins and sustain the musical line'},
  {name:'Finale', detail:'The complete first movement · all 69 measures in the original key'},
] as const;

export function MoonlightPath({exercise,disabled,onSelect,progress,range,onRange}: {
  exercise: MoonlightLesson; disabled:boolean; onSelect:(number:number)=>void; progress?:ProgressMap;
  range:MoonlightRange|null; onRange:(range:MoonlightRange|null)=>void;
}) {
  const index=moonlightLibrary.findIndex(e=>e.number===exercise.number);
  const [start,setStart]=useState('1'),[end,setEnd]=useState('3'),[error,setError]=useState('');
  useEffect(()=>{
    const next=range??exercise.sourceMeasures??[1,3];
    setStart(String(next[0]));setEnd(String(next[1]));setError('');
  },[exercise.number,range]);
  return <section className="panel moonlight-path" aria-label="Moonlight learning path">
    <div className="moonlight-path-heading"><strong>Moonlight Sonata · Adagio sostenuto</strong><span>{range?'Custom measure practice':`Step ${index+1} of ${moonlightLibrary.length} · ${exercise.courseStage}`}</span></div>
    <form className="moonlight-range" aria-label="Moonlight measure range" onSubmit={event=>{
      event.preventDefault();if(disabled)return;
      try {validateMoonlightRange(Number(start),Number(end));setError('');onRange([Number(start),Number(end)]);} catch(e){setError((e as Error).message);}
    }}>
      <strong>Practice any measures</strong>
      <p>Choose from the original first movement, measures 1–69. Use the same start and end for one measure.</p>
      <fieldset disabled={disabled}>
        <label>Start measure<input aria-label="Start measure" type="number" min={1} max={69} step={1} required value={start} onChange={e=>setStart(e.target.value)} /></label>
        <label>End measure<input aria-label="End measure" type="number" min={1} max={69} step={1} required value={end} onChange={e=>setEnd(e.target.value)} /></label>
        <button type="submit">Use measures</button>
        {range&&<button className="secondary" type="button" onClick={()=>onRange(null)}>Return to learning path</button>}
      </fieldset>
      {error&&<p role="alert">{error}</p>}
      {range&&<p className="moonlight-range-active" role="status">Selected: {range[0]===range[1]?`measure ${range[0]}`:`measures ${range[0]}–${range[1]}`} · {range[1]-range[0]+1} {range[0]===range[1]?'measure':'measures'}. Choose your hands, then Start MIDI practice or Listen.</p>}
    </form>
    {!range&&<>
    <p>{exercise.learningFocus}</p>
    <p className="moonlight-coaching">{exercise.practiceTip}</p>
    </>}
    <details>
      <summary>View the 33-step learning path</summary>
      <p>Work in order, at your own pace. Try a hand separately, then both. Use Listen before each new passage. Move on after three accurate, comfortable runs with an even pulse; accuracy alone does not measure tone, pedal or physical ease. The full original movement is a longer-term goal.</p>
      <p>MIDI practice checks the notes at your own pace, with no timing or hold requirements. Listen demonstrates the written rhythm when you want a reference.</p>
      <p>The opening direction asks for very delicate playing. Keep the accompaniment quiet beneath the melody, and refer to the PDF for the complete expressive markings and pedal commentary.</p>
      <div className="moonlight-stages">
        {stages.map(stage=><section key={stage.name}>
          <h3>{stage.name}</h3><p>{stage.detail}</p>
          <ol>{moonlightLibrary.filter(e=>e.courseStage===stage.name).map(e=><li key={e.number}>
            <button type="button" disabled={disabled} aria-current={exercise.number===e.number?'step':undefined} onClick={()=>onSelect(e.number)}>
              <span>{e.title}</span><small>{progressLabels[progressState(progress?.[e.number])]}</small>
            </button>
          </li>)}</ol>
        </section>)}
      </div>
      <p>Starter fingerings are suggestions for the preparatory studies. The supplied edition does not print fingerings; its original passages keep that notation. Pedal, voicing and expressive timing require listening and are not graded.</p>
      <a href="/scores/moonlight/Moonlight_Urtext.pdf" target="_blank" rel="noreferrer">Open your complete source PDF ↗</a>
    </details>
  </section>;
}
