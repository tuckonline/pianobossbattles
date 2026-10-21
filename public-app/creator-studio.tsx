/* eslint-disable @next/next/no-html-link-for-pages -- Independent Vite workspace. */
import {useEffect,useMemo,useState,type CSSProperties} from 'react';
import type {User} from '@supabase/supabase-js';
import {SightReading,type PracticeControls} from '../hosted/sight-reading';
import {gameClient,useGame} from '../hosted/game-client';
import {MidiSetup} from '../src/components/midi/setup';
import {bossProfiles,type BossId} from '../hosted/boss-registry';
import {BossBattlePanel} from '../hosted/boss-ui';
import {battleView} from '../hosted/boss-battle';
import {shortsBattleLayout} from '../hosted/shorts-layout';
import {useBattleAudioOutput} from '../hosted/battle-audio-ui';
import {battleAudio} from '../hosted/battle-audio';
import type {ChainEntry} from '../hosted/schmitt-chain';
import type {Hand} from '../hosted/sight-library';
import {useMusicCatalog} from './catalog';
import {useQueueScores} from './queue-scores';
import {BattleSettings} from './battle-settings';
import {creatorPreferencesSchema,type CreatorPreferences} from './creator-config';
import {notationPresets} from '../src/components/music/notation-presets';
import './creator.css';
async function control(body?:unknown){const r=await fetch('/api/creator',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);const d=await r.json();if(!r.ok)throw Error(d.error??'Creator Studio unavailable');return d;}
export function CreatorStudio({user}:{user:User}){
 const [preferences,setPreferences]=useState<CreatorPreferences>(),[error,setError]=useState('');
 useEffect(()=>{let live=true;void control().then(d=>{if(live)setPreferences(creatorPreferencesSchema.parse(d.preferences));}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[]);
 if(!preferences)return <section className="creator-studio"><h1>Creator Studio</h1><p role={error?'alert':'status'}>{error||'Checking creator access…'}</p><a href="/">Back to website</a></section>;
 return <Studio user={user} initial={preferences}/>;
}
function Studio({user,initial}:{user:User;initial:CreatorPreferences}){
 const {catalog,error:catalogError}=useMusicCatalog(user.id),game=useGame();
 const [preferences,setPreferences]=useState(initial),[saved,setSaved]=useState('Creator settings saved'),[error,setError]=useState(''),[token,setToken]=useState('');
 const [audition,setAudition]=useState(false);
 const [connected,setConnected]=useState(false),[hand,setHand]=useState<Hand>('both'),[selected,setSelected]=useState(''),[draft,setDraft]=useState<ChainEntry[]>([]),[busy,setBusy]=useState(false);
 const {queue,ready,error:scoreError}=useQueueScores(draft,catalog??[]);
 const config=game.player.settings.bossBattle;
 // Creator playback is audience-only; ordinary player's saved sound mode is
 // never overwritten. Tests can explicitly audition a cue in this browser.
 const silent=useMemo(()=>({...config,soundEnabled:audition,volume:preferences.volume,audioOutput:'obs' as const}),[config,audition,preferences.volume]);
 useBattleAudioOutput(silent,game.player.userId,'practice',false);
 const palette=notationPresets[preferences.notation],style={'--notation-paper':palette.paper,'--notation-ink':palette.ink,'--notation-current':palette.current,'--notation-correct':palette.correct,'--notation-incorrect':palette.incorrect} as CSSProperties;
 const library=useMemo(()=>[...new Map([...(catalog??[]),...queue.map(e=>e.exercise)].map(e=>[e.number,e])).values()],[catalog,queue]);
 function update(patch:Partial<typeof config>){void gameClient.settings({...game.player.settings,bossBattle:{...config,...patch}});}
 async function save(){setSaved('Saving…');try{const parsed=creatorPreferencesSchema.parse(preferences);await control({action:'preferences',preferences:parsed});setSaved('Creator settings saved');setError('');}catch(e){setError((e as Error).message);setSaved('Unsaved changes');}}
 async function links(action:'rotate'|'revoke'){try{const d=await control({action});setToken(d.token??'');setError('');}catch(e){setError((e as Error).message);}}
 function move(index:number,offset:number){setDraft(q=>{const next=[...q],at=index+offset;if(at<0||at>=q.length)return q;[next[index],next[at]]=[next[at],next[index]];return next;});}
 const field=(key:keyof CreatorPreferences,label:string,min:number,max:number,step=1)=><label>{label}<input aria-label={label} type="range" min={min} max={max} step={step} value={Number(preferences[key])} onChange={e=>{setPreferences(p=>({...p,[key]:Number(e.target.value)}));setSaved('Unsaved changes');}}/><output>{Math.round(Number(preferences[key])*(key==='volume'?500:1))}{key==='volume'?'%':''}</output></label>;
 const render=(c:PracticeControls)=><section className="creator-studio" data-notation-preset={preferences.notation} style={style}>
  <header><div><small>PIANO BOSS BATTLES · PRIVATE WORKSPACE</small><h1>Creator Studio</h1><p>One MIDI battle. Two synchronized recording views.</p></div><a href="/">Back to player website</a></header>
  {(error||catalogError||scoreError)&&<p role="alert">{error||catalogError||scoreError}</p>}
  <div className="creator-columns"><section className="creator-card"><h2>Battle control</h2><MidiSetup onConnectionChange={setConnected}/>
   <fieldset disabled={c.running||busy}><label>Game mode<select aria-label="Game mode" value={config.gameMode} onChange={e=>update({enabled:true,gameMode:e.target.value as typeof config.gameMode})}>{[['practice','Practice'],['survival','Survival'],['timeAttack','Time Attack'],['ultimateBoss','Ultimate Boss']].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
   <label>Boss<select aria-label="Boss" value={config.bossId} onChange={e=>update({bossId:e.target.value as BossId})}>{Object.values(bossProfiles).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
   <BattleSettings config={config} hand={hand} update={update} onHandChange={next=>{setHand(next);setDraft(q=>q.filter(e=>(!e.exercise.singleHand||e.exercise.singleHand===next)&&(!e.exercise.bothHandsOnly||next==='both')));}}/>
   <label>Add music<select aria-label="Add music" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose a piece</option>{catalog?.filter(e=>e.available&&(!e.singleHand||e.singleHand===hand)&&(!e.bothHandsOnly||hand==='both')).map(e=><option key={e.number} value={e.number}>{e.title}</option>)}</select></label><button disabled={!selected} onClick={()=>{const exercise=catalog?.find(e=>e.number===Number(selected));if(exercise)setDraft(q=>[...q,{exercise,loops:1}]);}}>Add to chain</button>
   <ol className="creator-queue">{draft.map((entry,i)=><li key={`${i}:${entry.exercise.number}`}><span>{entry.exercise.title}</span><label>Loops<input type="number" min="1" max="100" value={entry.loops} onChange={e=>setDraft(q=>q.map((x,j)=>j===i?{...x,loops:Math.max(1,Math.min(100,Number(e.target.value)||1))}:x))}/></label><button aria-label={`Move piece ${i+1} up`} onClick={()=>move(i,-1)}>↑</button><button aria-label={`Move piece ${i+1} down`} onClick={()=>move(i,1)}>↓</button><button aria-label={`Remove piece ${i+1}`} onClick={()=>setDraft(q=>q.filter((_,j)=>j!==i))}>×</button></li>)}</ol></fieldset>
   <div className="creator-controls"><button disabled={c.running||busy||!connected||!ready||!queue.length||!game.ready||!!game.recoveryError} onClick={async()=>{setBusy(true);try{const r=await fetch('/api/music/authorize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entries:queue.map(e=>({number:e.exercise.number,loops:e.loops})),hand})});if(!r.ok)throw Error('Selected music is unavailable.');c.start();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Start MIDI Practice</button><button disabled={!c.running} onClick={c.pause}>{c.paused?'Resume':'Pause'}</button><button disabled={!c.running} onClick={c.stop}>Stop battle</button></div><p role="status">{c.message||`${connected?'MIDI connected':'Connect your piano'} · ${c.running?'Battle active':'Ready'} · Loop ${c.pass}/${c.total}`}</p>
  </section><section className="creator-card"><h2>Recording presentation</h2><p>Separate from player preferences. Save to update both OBS sources.</p>
   <label>Notation appearance<select aria-label="Notation appearance" value={preferences.notation} onChange={e=>setPreferences(p=>({...p,notation:e.target.value as CreatorPreferences['notation']}))}>{Object.entries(notationPresets).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></label>
   {field('notationScale','Notation scale',90,160,5)}<label>Measures shown<select aria-label="Measures shown" value={preferences.measures} onChange={e=>setPreferences(p=>({...p,measures:e.target.value as CreatorPreferences['measures']}))}><option value="automatic">Automatic fit</option><option value="current">Current measure</option><option value="next">Current and next</option></select></label>
   {field('characterScale','Character scale',80,140,5)}{field('horizontalArenaHeightPercent','Horizontal arena height (%)',40,65)}{field('arenaPercent','Vertical arena height (%)',30,50)}{field('cameraPercent','Vertical camera reservation (%)',15,35)}{field('hudScale','HUD readability (%)',90,120,5)}
   <h3>Audience audio</h3><label><input type="checkbox" checked={preferences.soundEnabled} onChange={e=>setPreferences(p=>({...p,soundEnabled:e.target.checked}))}/> Enable audience battle effects</label><label>Designated audio source<select aria-label="Designated audio source" value={preferences.audioOwner} onChange={e=>setPreferences(p=>({...p,audioOwner:e.target.value as 'horizontal'|'vertical'}))}><option value="horizontal">Horizontal only</option><option value="vertical">Vertical only</option></select></label>{field('volume','Effects volume',0,.2,.01)}
   <button disabled={audition||preferences.volume===0} onClick={async()=>{setAudition(true);battleAudio.configure({...silent,soundEnabled:true});try{await battleAudio.test('heroSwing');await new Promise(resolve=>setTimeout(resolve,800));}finally{setAudition(false);battleAudio.configure({...silent,soundEnabled:false});}}}>Preview sound here</button><p>The control page stays silent except this test. In OBS enable “Control audio via OBS” on the designated source and set Audio Monitoring to Monitor Off. Route that mixer channel to both recording tracks in OBS/Aitum; verify each recording separately.</p>
   <button onClick={()=>void save()}>Save creator settings</button><output role="status">{saved}</output>
  </section></div>
  <section className="creator-card creator-monitor"><h2>Live confidence monitor</h2><div><BossBattlePanel battle={battleView(game.battle)} combo={game.live.combo} layoutOverride={shortsBattleLayout}/>{c.score}</div></section>
  <section className="creator-card"><h2>Private OBS viewing links</h2><p>Read-only, valid for 30 days. Creating new links revokes previous links. Keep them private; they grant access only to this live recording session.</p><button onClick={()=>void links('rotate')}>Create / rotate viewing links</button> <button onClick={()=>void links('revoke')}>Revoke viewing links</button>
   {token&&(['horizontal','vertical'] as const).map(view=>{const url=`${location.origin}/creator/obs/${view}#view=${token}`;return <label key={view}>{view==='horizontal'?'Horizontal — 1920 × 750':'Vertical — 1080 × 1920'}<input readOnly value={url} onFocus={e=>e.target.select()}/><button onClick={()=>void navigator.clipboard.writeText(url).catch(()=>setError('Select and copy the URL manually.'))}>Copy {view} URL</button></label>;})}
   <p>Horizontal: place your separate keyboard camera below the 750-pixel website source. Vertical: layer the Aitum/OBS keyboard camera behind the transparent reserved area. No webcam or microphone capture occurs here.</p>
  </section>
 </section>;
 if(!catalog||!library.length)return <p role="status">{catalogError||'Loading creator music…'}</p>;
 return <SightReading library={library} attempts={[]} practice hideHeading experience={{entries:queue,hand,canStart:ready&&connected&&!!queue.length&&game.ready&&!game.recoveryError,render}}/>;
}
