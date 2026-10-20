import {classicalLibrary,classicalStages,type ClassicalLesson} from './classical-library';
import {progressLabels,progressState,type ProgressMap} from './collection-progress';

export function ClassicalPath({exercise,disabled,onSelect,progress}: {
  exercise:ClassicalLesson;disabled:boolean;onSelect:(number:number)=>void;progress?:ProgressMap;
}) {
  const stage=classicalStages[exercise.courseStage-1];
  return <section className="panel moonlight-path" aria-label="Classical Foundations learning path">
    <div className="moonlight-path-heading"><strong>Classical Foundations · 48 exercises</strong><span>Step {exercise.step} of 48 · Stage {exercise.courseStage}: {stage.title}</span></div>
    <p><strong>Focus:</strong> {exercise.learningFocus}</p>
    <p className="moonlight-coaching">{exercise.practiceTip}</p>
    <p><strong>Stage checkpoint:</strong> {stage.checkpoint}</p>
    <details>
      <summary>View the 48-step learning path</summary>
      <p>Follow the order, learning each hand separately before combining them. Move on when the notes feel familiar and your hands remain comfortable. Revisit earlier studies whenever a new pattern feels difficult.</p>
      <p>MIDI checks notes at your own pace. Use Listen for the written rhythm; tone, relaxation and phrasing need your own listening as well as the accuracy score.</p>
      <div className="moonlight-stages">
        {classicalStages.map((part,index)=><section key={part.title}>
          <h3>{index*6+1}–{index*6+6} · {part.title}</h3><p>{part.focus}</p>
          <ol>{classicalLibrary.filter(e=>e.courseStage===index+1).map(e=><li key={e.number}>
            <button type="button" disabled={disabled} aria-current={exercise.number===e.number?'step':undefined} onClick={()=>onSelect(e.number)}>
              <span>{e.title}</span><small>{progressLabels[progressState(progress?.[e.number])]}</small>
            </button>
          </li>)}</ol>
        </section>)}
      </div>
      <p>Original PianoPath miniatures and familiar technical patterns, with suggested fingerings. Stages describe this collection’s learning path, not examination grades. Existing studies have new positions in the sequence; their saved progress is retained.</p>
    </details>
  </section>;
}
