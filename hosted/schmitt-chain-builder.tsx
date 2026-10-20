import type {Exercise} from './sight-library';
export type ChainChoice={number:number;loops:number};
export function SchmittChainBuilder({library,enabled,setEnabled,choices,setChoices,disabled}:{library:Exercise[];enabled:boolean;setEnabled:(v:boolean)=>void;choices:ChainChoice[];setChoices:(v:ChainChoice[])=>void;disabled:boolean}){
 const move=(i:number,d:number)=>{const next=[...choices];[next[i],next[i+d]]=[next[i+d],next[i]];setChoices(next);};
 return <fieldset disabled={disabled} className="panel"><legend>Schmitt exercise chain</legend>
 <label style={{display:"flex",alignItems:"center",gap:8}}><input style={{width:"auto",margin:0}} type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>Play a continuous exercise chain</label>
 {enabled&&<><p>One battle and one countdown. Each exercise keeps its own loops (1–100). Chains use one boss, even when multi-round battles are enabled.</p>
 <label>Add exercise <select aria-label="Add chain exercise" value="" onChange={e=>{if(e.target.value)setChoices([...choices,{number:Number(e.target.value),loops:1}]);}}><option value="">Choose an exercise…</option>{library.filter(e=>!choices.some(c=>c.number===e.number)).map(e=><option key={e.number} value={e.number}>{e.title??`Exercise ${e.number}`}</option>)}</select></label>
 <ol>{choices.map((c,i)=><li key={c.number} style={{marginBottom:10}}><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={{flex:"1 1 260px"}}>{library.find(e=>e.number===c.number)?.title??`Exercise ${c.number}`}</span>{' '}
 <label style={{display:"flex",alignItems:"center",gap:8,margin:0}}>Loops <input style={{width:76,margin:0}} aria-label={`Chain exercise ${i+1} loops`} type="number" min={1} max={100} value={c.loops} onChange={e=>setChoices(choices.map((x,j)=>j===i?{...x,loops:Math.max(1,Math.min(100,Math.round(Number(e.target.value)||1)))}:x))}/></label>{' '}
 <button type="button" aria-label={`Move chain exercise ${i+1} up`} disabled={!i} onClick={()=>move(i,-1)}>↑</button>{' '}<button type="button" aria-label={`Move chain exercise ${i+1} down`} disabled={i===choices.length-1} onClick={()=>move(i,1)}>↓</button>{' '}<button type="button" aria-label={`Remove chain exercise ${i+1}`} onClick={()=>setChoices(choices.filter((_,j)=>j!==i))}>Remove</button></div></li>)}</ol>
 {!choices.length&&<p>Select at least one exercise.</p>}</>}
 </fieldset>;
}
