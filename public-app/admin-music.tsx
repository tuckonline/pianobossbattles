/* eslint-disable @next/next/no-html-link-for-pages -- Independent Vite SPA. */
import {useCallback,useEffect,useRef,useState} from 'react';
import {announceMusicPublication,watchMusicPublication} from './music-updates';
import {collectionName} from './music-labels';
import type {MusicRow} from './music-service';
import './admin-music.css';
type Library={collections:{id:string;name:string;published:boolean;total:number;available:number}[];pieces:MusicRow[]};
export function AdminMusic(){
 const [library,setLibrary]=useState<Library>(),[error,setError]=useState(''),[denied,setDenied]=useState(false),[busy,setBusy]=useState(false);
 const [selected,setSelected]=useState(''),[search,setSearch]=useState(''),[filter,setFilter]=useState('all'),[notice,setNotice]=useState('');
 const inFlight=useRef(false);
 const request=useCallback(async(patch?:{kind:'piece'|'collection';id:string|number;published:boolean})=>{
  if(inFlight.current)return;inFlight.current=true;
  setBusy(true);if(patch)setNotice('');setError('');
  try{const r=await fetch('/api/admin/music',{method:patch?'POST':'GET',headers:patch?{'Content-Type':'application/json'}:undefined,body:patch?JSON.stringify(patch):undefined,cache:'no-store'});const data=await r.json();if(!r.ok){setDenied(r.status===403);throw Error(data.error??'Unable to load music.');}setLibrary(data);setDenied(false);if(patch){announceMusicPublication();setNotice('Publication settings saved. Open tabs update immediately; other players refresh automatically within a few seconds.');}}
  catch(e){setError((e as Error).message);}finally{setBusy(false);inFlight.current=false;}
 },[]);
 useEffect(()=>{void request();return watchMusicPublication(()=>void request());},[request]);
 const pieces=library?.pieces.filter(p=>(!selected||p.collection===selected)&&`${p.title} ${collectionName(p.collection)}`.toLowerCase().includes(search.toLowerCase())&&(filter==='all'||(filter==='available'?p.available:!p.available)))??[];
 return <div className="admin-music"><header><div><span className="eyebrow">PIANO BOSS BATTLES · ADMINISTRATION</span><h1>Music Library Manager</h1><p>Choose the music players can see and play.</p></div><a href="/">Back to your battle setup</a></header>
  {error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {!denied&&!library&&<p role="status">{busy?'Checking administrator access…':'Music library unavailable.'}</p>}
  {!denied&&<button disabled={busy} onClick={()=>void request()}>Refresh library</button>}
  {!denied&&library&&<div className="admin-music-columns"><section className="setup-section"><h2>Collections</h2><p>Turning a collection off hides every piece without changing its individual setting.</p>
   <button aria-pressed={!selected} onClick={()=>setSelected('')}>All collections</button>
   <ul className="admin-collections">{library.collections.map(c=><li key={c.id}><button className="collection-select" aria-pressed={selected===c.id} onClick={()=>setSelected(c.id)}><strong>{c.name}</strong><small>{c.available} available / {c.total} pieces</small></button><button disabled={busy} aria-label={`Publish ${c.name} collection`} aria-pressed={c.published} onClick={()=>void request({kind:'collection',id:c.id,published:!c.published})}>{c.published?'Published':'Unpublished'}</button></li>)}</ul>
  </section><section className="setup-section"><h2>{selected?collectionName(selected):'All pieces'}</h2><div className="admin-music-filters"><label>Search pieces<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label><label>Availability<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All pieces</option><option value="available">Publicly available</option><option value="unavailable">Unavailable to players</option></select></label></div>
   <p>{pieces.length} matching pieces</p><ul className="admin-pieces">{pieces.map(p=><li key={p.number}><div><strong>{p.title}</strong><small>{collectionName(p.collection)}</small><span>{p.available?'Publicly available':!p.collectionPublished?'Unavailable · collection unpublished':'Unavailable · piece unpublished'}</span></div><button disabled={busy} aria-label={`Publish ${p.title}`} aria-pressed={p.published} onClick={()=>void request({kind:'piece',id:p.number,published:!p.published})}>{p.published?'Published':'Unpublished'}</button><a href={`/?music=${p.number}`}>Test piece</a></li>)}</ul>
   {!pieces.length&&<p>No matching pieces.</p>}
  </section></div>}
 </div>;
}
