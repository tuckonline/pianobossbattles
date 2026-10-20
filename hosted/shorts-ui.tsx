import Link from './navigation';
import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {shortsRecorder,shortsApi} from './shorts-recorder';
import {shortsSessionSchema,shortsRules,rankHighlights,mappedInterval,type ShortsSession,type Highlight,type ClipEdit} from './shorts-core';
import './shorts.css';
import {ShortsDisplayControls} from './shorts-display-ui';
function download(name:string,data:string,type='application/json'){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function ShortsCaptureControls(){
  const state=useSyncExternalStore(shortsRecorder.subscribe,shortsRecorder.snapshot),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const s=state.session,active=s?.status==='recording';
  const run=async(fn:()=>void|Promise<void>)=>{setBusy(true);try{await fn();setError('');}catch(e){setError(String(e));}finally{setBusy(false);}};
  return <details className="shorts-capture-controls"><summary>Shorts recording & highlights{s?.status==='recording'?' · Capturing':''}</summary>
    <p>Record OBS in a 1080 × 1920 scene using <a href="/obs/shorts" target="_blank" rel="noreferrer">Shorts view ↗</a>. Place your keyboard camera in the transparent band (default: y=1248, height=480). These controls capture the timeline; start/stop the video in OBS separately.</p>
    <div className="row"><button disabled={busy||!!s&&s.status!=='stopped'} onClick={()=>void run(()=>shortsRecorder.start())}>Start Shorts capture</button>
      <button disabled={!active||busy} onClick={()=>shortsRecorder.mark()}>Show sync marker</button>
      {active?<button onClick={()=>shortsRecorder.pause()}>Pause capture</button>:<button disabled={!s||s.status==='stopped'||busy} onClick={()=>void run(()=>shortsRecorder.resume())}>Resume capture</button>}
      <button disabled={!s||s.status==='stopped'} onClick={()=>shortsRecorder.stop()}>Stop capture</button>
      <a href="/shorts" target="_blank" rel="noreferrer">Review Shorts ↗</a>
      {s&&<button onClick={()=>download(`shorts-${s.id}.json`,JSON.stringify(s,null,2))}>Back up timeline</button>}</div>
    <p>Show a marker after OBS starts recording, and another after the final cinematic finishes. Match each marker’s first visible frame in the review page. Pause/resume capture whenever OBS pauses; resume creates a separate segment.</p>
    {s&&<p role="status">{s.status} · {s.events.length} events · {state.saved?`Cloud saved ${state.saved}`:state.localSaved?'Saved on this browser':'Saving…'}{s.warning?` · ${s.warning}`:''}</p>}
    {(error||state.error)&&<p role="alert">{error||state.error}</p>}
    <ShortsDisplayControls/>
  </details>;
}
type Listing={id:string;title:string;status:string;startedAt:string;revision:number};
export function ShortsStudio(){
  const [list,setList]=useState<Listing[]>([]),[session,setSession]=useState<ShortsSession>(),[error,setError]=useState(''),[saved,setSaved]=useState(''),[busy,setBusy]=useState(false);
  const [url,setUrl]=useState(''),[selected,setSelected]=useState<string>(),[playing,setPlaying]=useState(false),[time,setTime]=useState(0),[videoError,setVideoError]=useState('');
  const [camera,setCamera]=useState(25),[arena,setArena]=useState(40);
  const video=useRef<HTMLVideoElement>(null),linked=useRef<File|undefined>(undefined);
  const highlights=useMemo(()=>session?rankHighlights(session):[],[session]);
  const current=highlights.find(h=>h.id===selected),mapping=session&&current?mappedInterval(session,current):undefined;
  const edit=session?.edits.find(e=>e.id===selected);
  const clipEnd=edit?.end??mapping?.end;
  const refresh=()=>shortsApi<Listing[]>().then(setList).catch(e=>setError(e.message));
  useEffect(()=>{void refresh();},[]);
  useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);
  async function save(next:ShortsSession){setBusy(true);setError('');try{next={...next,revision:next.revision+1};await shortsApi('',{session:next});setSession(next);setSaved(new Date().toLocaleTimeString());}catch(e){setError(String(e));}finally{setBusy(false);}}
  async function open(id:string){setError('');setUrl('');linked.current=undefined;setSelected(undefined);try{setSession(await shortsApi<ShortsSession>(`?id=${encodeURIComponent(id)}`));}catch(e){setError(String(e));}}
  function changeEdit(h:Highlight,patch:Partial<ClipEdit>){if(!session)return;const map=mappedInterval(session,h);const old=session.edits.find(e=>e.id===h.id);
    const value:ClipEdit={id:h.id,start:map.start??0,end:map.end??0,hook:'',hookVisible:false,contextVisible:false,decision:'suggested',exportStatus:'not-exported',...old,...patch};
    setSession({...session,edits:[...session.edits.filter(e=>e.id!==h.id),value]});setSaved('Unsaved edits');}
  function preview(h:Highlight){if(!session)return;setSelected(h.id);const m=mappedInterval(session,h),e=session.edits.find(e=>e.id===h.id);if(video.current&&m.start!==undefined){video.current.currentTime=e?.start??m.start;setPlaying(true);void video.current.play().catch(()=>setVideoError('Use the video Play button to begin.'));}}
  async function exportClip(h:Highlight){
    if(!session)return;const m=mappedInterval(session,h),e=session.edits.find(e=>e.id===h.id);setError('');
    if(m.error||!e||e.decision!=='approved'){setError(m.error??'Approve the clip before exporting.');return;}
    if(!linked.current){setError('Link the original recording before exporting.');return;}
    if(!(e.start>=0&&e.start<=m.climax!&&e.end>=m.payoff!&&e.end<=session.file!.duration&&e.end>e.start&&e.end-e.start<=session.maxSeconds)){setError('The trim must include the highlight and its full cinematic payoff, and fit the recording and duration limit.');return;}
    if(session.file!.height/session.file!.width<1.7){setError('Link the vertical OBS recording. This exporter does not crop your horizontal scene.');return;}
    setBusy(true);
    try{
      const plan={version:1,recordingId:session.id,clipId:h.id,source:session.file,start:e.start,end:e.end,hook:'',context:'',hookVisible:false,contextVisible:false,
        output:{width:1080,height:1920,maxFps:60,videoCodec:'libx264',audioCodec:'aac',audioTrack:0},evidence:{kind:h.event.kind,reasons:h.reasons,climax:m.climax,payoff:m.payoff}};
      const response=await fetch('/shorts-export.py');if(!response.ok)throw Error('Exporter download failed. Try again.');
      const encoded=btoa(Array.from(new TextEncoder().encode(JSON.stringify(plan)),n=>String.fromCharCode(n)).join(''));
      download(`export-short-${session.id.slice(0,8)}.py`,(await response.text()).replace('__PLAN_BASE64__',encoded),'text/x-python');
      await save({...session,edits:session.edits.map(x=>x.id===h.id?{...x,exportStatus:'kit-downloaded'}:x)});
    }catch(e){setError(String(e));}finally{setBusy(false);}
  }
  const locked=!!session&&['recording','paused'].includes(session.status);
  return <main className="shorts-studio"><h1>Shorts Studio</h1><p className="shorts-intro">Find the story in your practice. Record vertically, match your sync markers, then review the moments worth sharing.</p>
    <div className="row"><Link href="/student/practice">← Back to practice</Link><a href={`/obs/shorts?camera=${camera}&battle=${arena}`} target="_blank" rel="noreferrer">Open vertical OBS view ↗</a></div>
    <ShortsDisplayControls/>
    <details className="studio-panel"><summary>OBS setup & export guide</summary><p>Use a separate 1080 × 1920 OBS scene at 60 FPS. Add the vertical view as a Browser Source at the same size. Place your camera below it in the transparent band. No camera is captured by the website.</p>
      <div className="row"><label>Camera height % <input type="number" min="15" max="35" value={camera} onChange={e=>setCamera(Math.min(35,Math.max(15,+e.target.value)))}/></label><label>Battle height % <input type="number" min="30" max="50" value={arena} onChange={e=>setArena(Math.min(50,Math.max(30,+e.target.value)))}/></label></div>
      <p>Camera: y={Math.round((90-camera)*19.2)} px, height={Math.round(camera*19.2)} px. Sheet music occupies {90-camera-arena}% of the frame. Use the link above after changing dimensions.</p>
      <ol className="export-help"><li>Start OBS recording, then start Shorts capture on the practice page. Show a sync marker before playing.</li><li>After the final result animation, show another marker, wait three seconds, then stop capture and OBS recording. Add markers around every recording pause/reconnect.</li><li>Import an MP4 recording below. OBS can remux MKV to MP4 without re-encoding (File → Remux Recordings).</li><li>Match the first visible frame of at least two markers per segment. Review the suggested continuous clip and approve it.</li><li>Download the local export kit. Install <a href="https://www.python.org/downloads/" target="_blank" rel="noreferrer">Python</a> and <a href="https://ffmpeg.org/download.html" target="_blank" rel="noreferrer">FFmpeg</a> once. Run <code>python export-short-….py</code>, select your original video, and the kit creates an MP4 beside it. No local server is installed.</li><li>Import the exported MP4 here to review it. Nothing is uploaded to YouTube.</li></ol>
      <p>Original recorded audio is retained at its existing level and encoded to AAC. Piano and combat effects already mixed into one OBS track cannot be adjusted separately; balance battle sounds before recording. Video previews use your browser’s volume control.</p>
      <p>Current platform guidance: <a href={shortsRules.platformSource} target="_blank" rel="noreferrer">vertical or square Shorts up to three minutes</a> (checked {shortsRules.platformChecked}). The limit below is configurable up to that verified limit.</p></details>
    <section className="studio-panel"><div className="row"><label>Recording session <select aria-label="Recording session" value={session?.id??''} onChange={e=>void open(e.target.value)}><option value="">Choose a recording…</option>{list.map(r=><option key={r.id} value={r.id}>{r.title} · {r.status}</option>)}</select></label><button onClick={()=>void refresh()}>Refresh recordings</button></div>
      {!list.length&&<p>Start a Shorts capture from the practice page to collect your first highlights.</p>}
      <label>Restore timeline backup <input type="file" accept=".json" onChange={async e=>{try{const f=e.target.files?.[0];if(!f)return;if(f.size>1900000)throw Error('Backup too large');const s=shortsSessionSchema.parse(JSON.parse(await f.text()));if(s.status==='recording'||s.status==='paused')s.status='interrupted';setSession(s);setError('');}catch(e){setError(String(e));}}}/></label>
    </section>
    {error&&<p role="alert" className="studio-warning">{error}</p>}
    {session&&<><p className="status-line">{session.events.length} timeline events · {session.segments.length} segments · {saved?`Save status: ${saved}`:'Cloud recording loaded'}</p>{locked&&<p className="studio-warning">This capture is still open. Stop capture in the practice tab before editing. Then reload this recording.</p>}
    <div className="studio-columns"><div><section className="studio-panel"><h2>1. Link & align</h2><label>Original OBS recording <input disabled={locked||busy} type="file" accept="video/*,.mkv" onChange={e=>{const f=e.target.files?.[0];if(!f)return;linked.current=f;setUrl(URL.createObjectURL(f));setVideoError('');setPlaying(false);setSelected(undefined);}}/></label>
      <p className="reason">Video stays on this device. Re-select it after a reload. {session.file&&`Linked: ${session.file.name}`}</p>
      <p>Seek the video to the first frame showing each SYNC label. Enter its time, or use “Use current frame.” At least two markers must surround the full clip.</p>
      {session.events.filter(e=>e.kind==='marker').map(m=><div className="sync-grid" key={m.id}><label>{m.detail} · segment {session.segments.findIndex(p=>p.id===m.segment)+1} <small>({(m.atMs/1000).toFixed(2)}s)</small></label><input aria-label={`${m.detail} video seconds`} disabled={locked||busy} type="number" min="0" step="0.01" value={session.anchors.find(a=>a.markerId===m.id)?.videoSeconds??''} onChange={e=>{const anchors=session.anchors.filter(a=>a.markerId!==m.id);if(e.target.value!=='')anchors.push({markerId:m.id,videoSeconds:+e.target.value});setSession({...session,anchors});setSaved('Unsaved edits');}}/><button disabled={!url||locked||busy} onClick={()=>{setSession({...session,anchors:[...session.anchors.filter(a=>a.markerId!==m.id),{markerId:m.id,videoSeconds:video.current?.currentTime??0}]});setSaved('Unsaved edits');}}>Use current frame for {m.detail}</button><span/></div>)}
      <div className="row"><label>Target seconds <input disabled={locked} type="number" min="10" max="180" value={session.targetSeconds} onChange={e=>setSession({...session,targetSeconds:Math.min(180,Math.max(10,+e.target.value))})}/></label><label>Maximum seconds <input disabled={locked} type="number" min="10" max="180" value={session.maxSeconds} onChange={e=>setSession({...session,maxSeconds:Math.min(180,Math.max(10,+e.target.value))})}/></label></div>
      <button disabled={locked||busy} onClick={()=>void save(session)}>Save timeline & edits</button></section>
    <h2>2. Your suggested Shorts <small>({highlights.length})</small></h2>
    {!highlights.length&&<p>No highlight thresholds were reached in this recording yet. More practice will provide more moments.</p>}
    {highlights.map(h=>{const m=mappedInterval(session,h),e=session.edits.find(e=>e.id===h.id);return <article className="clip-card" key={h.id} data-decision={e?.decision??'suggested'}><h3>{h.title}</h3><p className="reason">Score {h.score} · {h.event.kind} · {h.reasons.join(', ').replaceAll('-',' ')}</p><p>{h.event.title} · {h.event.mode} · {h.event.loops} loops</p>
      {m.error?<p className="studio-warning">{m.error}</p>:<p>{(e?.start??m.start!).toFixed(2)}–{(e?.end??m.end!).toFixed(2)}s · {((e?.end??m.end!)-(e?.start??m.start!)).toFixed(1)} seconds</p>}
      {!m.error&&<div className="row"><label>In <input type="number" min="0" max={m.climax} step=".01" disabled={locked} value={e?.start??m.start} onChange={v=>changeEdit(h,{start:+v.target.value})}/></label><label>Out <input type="number" min={m.payoff} max={session.file?.duration} step=".01" disabled={locked} value={e?.end??m.end} onChange={v=>changeEdit(h,{end:+v.target.value})}/></label></div>}
      <div className="row"><button disabled={!url||!!m.error} onClick={()=>preview(h)}>Preview clip</button><button disabled={locked||!!m.error} aria-pressed={e?.decision==='approved'} onClick={()=>changeEdit(h,{decision:'approved'})}>Approve</button><button disabled={locked} aria-pressed={e?.decision==='rejected'} onClick={()=>changeEdit(h,{decision:'rejected'})}>Reject</button><button disabled={locked||busy||e?.decision!=='approved'||!!m.error} onClick={()=>void exportClip(h)}>Export MP4 locally</button></div>
      <p className="status-line">{e?.decision??'Suggested'} · {e?.exportStatus==='kit-downloaded'?'Export kit downloaded; run it locally, then review the MP4':e?.exportStatus==='verified'?'Export reviewed':'Not exported'}</p>
    </article>;})}</div>
    <aside className="studio-preview"><h2>3. Review the footage</h2><div className="preview-stage"><video ref={video} src={url||undefined} controls playsInline preload="metadata" onError={()=>setVideoError('This file cannot be previewed. Remux the recording to MP4 in OBS, then import that file.')} onLoadedMetadata={()=>{const v=video.current,f=linked.current;if(!v||!f||!Number.isFinite(v.duration))return;const file={name:f.name,size:f.size,lastModified:f.lastModified,duration:v.duration,width:v.videoWidth,height:v.videoHeight};setSession(s=>s?{...s,file}:s);setSaved('Unsaved edits');}}
      onTimeUpdate={()=>{const v=video.current;if(!v)return;setTime(v.currentTime);if(playing&&clipEnd!==undefined&&v.currentTime>=clipEnd){v.pause();setPlaying(false);}}}/>
      </div>
      <p>{time.toFixed(3)} seconds</p><div className="row"><button disabled={!url} onClick={()=>{if(video.current){video.current.pause();video.current.currentTime=Math.max(0,video.current.currentTime-1/60);}}}>− frame (60 FPS)</button><button disabled={!url} onClick={()=>{if(video.current){video.current.pause();video.current.currentTime+=1/60;}}}>+ frame</button></div>
      {videoError&&<p role="alert">{videoError}</p>}<p>Clean gameplay and original audio only. Add editorial hooks and captions later in CapCut or your editor. Existing text baked into an older recording cannot be removed.</p>
      <label>Review exported MP4 <input type="file" accept="video/mp4" onChange={e=>{const f=e.target.files?.[0];if(!f)return;linked.current=undefined;setSelected(undefined);setPlaying(false);setUrl(URL.createObjectURL(f));}}/></label>
      <p>To relink the source for another export, use “Original OBS recording.”</p></aside></div></>}
  </main>;
}
