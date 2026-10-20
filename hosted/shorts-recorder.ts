import {shortsRules,shortsSessionSchema,eventEvidence,type ShortsEvent,type ShortsSession} from './shorts-core';
import type {BattleState} from './boss-battle';
import type {GameLive} from './game-client';
import type {Celebration} from './game-core';

type Observed={battle:BattleState;live:GameLive;alerts:Celebration[];preview:boolean};
const DB_NAME='pianopath-shorts-v1';
async function localStore(owner:string,value?:ShortsSession|null):Promise<ShortsSession|undefined>{
  return new Promise((resolve,reject)=>{
    const open=indexedDB.open(DB_NAME,1);open.onupgradeneeded=()=>open.result.createObjectStore('drafts');open.onerror=()=>reject(open.error);
    open.onsuccess=()=>{const db=open.result,tx=db.transaction('drafts',value===undefined?'readonly':'readwrite'),store=tx.objectStore('drafts');
      const request=value===undefined?store.get(owner):value===null?store.delete(owner):store.put(value,owner);
      tx.oncomplete=()=>{resolve(value===undefined?request.result:value??undefined);db.close();};tx.onerror=()=>{reject(tx.error);db.close();};};
  });
}
export async function shortsApi<T>(path='',body?:unknown):Promise<T>{
  const r=await fetch(`/api/shorts${path}`,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
  const result=await r.json();if(!r.ok)throw Error(result.error??'Unable to save Shorts metadata');return result;
}
class ShortsRecorder {
  state={session:undefined as ShortsSession|undefined,saved:'',error:'',localSaved:false};
  private owner='';private listeners=new Set<()=>void>();private origin=0;private base=0;private segment='';
  private before?:Observed;private exercise={number:0,title:''};private seen=new Set<string>();private flushTimer?:ReturnType<typeof setTimeout>;
  private busy=false;private dirty=false;private bytes=0;private markerUntil=0;private markerText='';private load?:Promise<void>;private release?:()=>void;
  subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
  snapshot=()=>this.state;
  private emit(){this.state={...this.state};for(const fn of this.listeners)fn();}
  private exitCheckpoint=()=>{
    if(!this.owner||!this.state.session)return;
    try{localStorage.setItem(`pianopath-shorts-exit:${this.owner}`,JSON.stringify(this.state.session));}
    catch{this.state.error='Exit checkpoint unavailable. Wait for Cloud saved before closing.';}
  };
  async connect(owner:string){
    if(this.owner===owner)return this.load;
    this.owner=owner;window.addEventListener('pagehide',this.exitCheckpoint);
    this.load=(async()=>{try{let draft=await localStore(owner);const exit=localStorage.getItem(`pianopath-shorts-exit:${owner}`);
      if(exit){const last=shortsSessionSchema.parse(JSON.parse(exit));if(!draft||last.startedAt>draft.startedAt||(last.id===draft.id&&last.revision>draft.revision))draft=last;}
      if(draft){const s=shortsSessionSchema.parse(draft);
      if(s.status==='recording'){s.status='interrupted';s.warning='Page reloaded. Resume a new segment and align fresh sync markers.';s.revision++;if(s.segments.length)s.segments.at(-1)!.endMs=s.events.at(-1)?.atMs??0;}
      this.state.session=s;this.bytes=JSON.stringify(s.events).length*2;this.seen=new Set(s.events.map(e=>e.id));this.emit();
    }}catch{this.state.error='Local recording recovery is unavailable. Export your timeline before closing.';this.emit();}})();return this.load;
  }
  select(exercise:{number:number;title:string}){this.exercise=exercise;}
  private now(){return Math.min(shortsRules.maxDurationMs,this.base+Math.max(0,performance.now()-this.origin));}
  async start(){
    await this.load;if(!this.owner)throw Error('Wait for your profile to load.');
    if(!navigator.locks)throw Error('Use Chrome or Edge with Web Locks for safe single-tab capture.');
    await new Promise<void>((resolve,reject)=>{void navigator.locks.request(`pianopath-shorts:${this.owner}`,{ifAvailable:true},async lock=>{
      if(!lock){reject(Error('Another practice tab is capturing Shorts. Stop it there first.'));return;}
      const held=new Promise<void>(done=>{this.release=done;});resolve();await held;
    });});
    this.origin=performance.now();this.base=0;this.segment=crypto.randomUUID();this.seen.clear();this.bytes=0;
    this.state={session:{version:1,id:crypto.randomUUID(),revision:0,title:`Practice · ${new Date().toLocaleDateString()}`,startedAt:new Date().toISOString(),status:'recording',profile:'vertical-1080x1920',events:[],segments:[{id:this.segment,startMs:0,reason:'Recording started'}],anchors:[],edits:[],targetSeconds:30,maxSeconds:180},saved:'',error:'',localSaved:false};
    this.mark();this.changed();
  }
  async resume(){
    const s=this.state.session;if(!s||s.status==='recording'||s.status==='stopped')return;
    if(s.segments.length>=100)throw Error('Segment limit reached. Stop capture, then start a new recording.');
    if(!this.release){await new Promise<void>((resolve,reject)=>{void navigator.locks.request(`pianopath-shorts:${this.owner}`,{ifAvailable:true},async lock=>{
      if(!lock){reject(Error('Another tab owns this recording.'));return;}const held=new Promise<void>(done=>{this.release=done;});resolve();await held;
    });});}
    this.base=s.events.at(-1)?.atMs??0;this.origin=performance.now();this.segment=crypto.randomUUID();s.status='recording';
    s.segments.push({id:this.segment,startMs:this.base,reason:'Resumed / discontinuity'});this.mark();this.changed();
  }
  pause(){const s=this.state.session;if(!s||s.status!=='recording')return;this.mark();this.add('pause','pause:'+crypto.randomUUID());s.segments.at(-1)!.endMs=this.now();s.status='paused';this.changed();}
  stop(){const s=this.state.session;if(!s||s.status==='stopped')return;if(s.status==='recording'){this.add('stop','stop:'+crypto.randomUUID());s.segments.at(-1)!.endMs=this.now();}s.status='stopped';s.endedAt=new Date().toISOString();this.release?.();this.release=undefined;this.changed();void this.flush();}
  mark(){if(this.state.session?.status!=='recording')return;this.markerText=`SYNC ${this.state.session.events.filter(e=>e.kind==='marker').length+1}`;
    this.markerUntil=Date.now()+2500;this.add('marker',`marker:${crypto.randomUUID()}`,this.markerText);this.changed();}
  broadcast(){const s=this.state.session;return s?{sessionId:s.id,status:s.status,marker:this.markerText,markerUntil:this.markerUntil}:undefined;}
  observe(state:Observed){
    const previous=this.before;this.before={...state,live:{...state.live},battle:{...state.battle},alerts:[...state.alerts]};
    const s=this.state.session;if(!s||s.status!=='recording'||state.preview)return;
    const b=state.battle,l=state.live,p=previous?.live;
    if(l.attemptId&&p?.attemptId!==l.attemptId)this.add('attempt',`${l.attemptId}:attempt`);
    if(l.incorrect>(p?.incorrect??0)&&l.attemptId===p?.attemptId){this.add('damage',`${l.attemptId}:error:${l.incorrect}`);if((p?.combo??0)>=50&&l.combo<p!.combo)this.add('combo-broken',`${l.attemptId}:broken:${l.incorrect}`,`${p!.combo}-note streak ended`);}
    for(const threshold of shortsRules.comboThresholds)if(l.combo>=threshold&&(p?.combo??0)<threshold)this.add('combo',`${l.attemptId}:streak:${l.sequence}:${threshold}`,undefined,threshold);
    if(b.attemptId===previous?.battle.attemptId&&(b.power?.activations??0)>(previous.battle.power?.activations??0))this.add('special',`${b.attemptId}:power:${b.power!.activations}`);
    if(b.config.enabled&&(b.status==='victory'||b.status==='defeat')&&b.result!=='abandoned'&&b.result!=='unfinished'&&(b.status!==previous?.battle.status||b.attemptId!==previous?.battle.attemptId))this.add(b.result==='timeout'?'timeout':b.status,`${b.attemptId}:result:${b.status}:${b.result}`);
    for(const alert of state.alerts)if(alert.kind!=='milestone'&&!previous?.alerts.some(a=>a.id===alert.id))this.add(alert.kind,alert.id,alert.title,undefined,alert.priority);
    if(!s.events.length||this.now()-(s.events.at(-1)?.atMs??0)>5000)this.add('checkpoint',`checkpoint:${crypto.randomUUID()}`);
    if(this.now()>=shortsRules.maxDurationMs||s.events.length>=shortsRules.maxEvents-2||this.bytes>1200000){s.warning='Capture limit reached; gameplay continues. Start another recording.';this.stop();}
  }
  private add(kind:ShortsEvent['kind'],id:string,detail?:string,combo?:number,priority?:number){
    const s=this.state.session,b=this.before?.battle,l=this.before?.live;if(!s||!b||!l||this.seen.has(id)||s.events.length>=shortsRules.maxEvents)return;
    this.seen.add(id);s.events.push({id,kind,atMs:this.now(),segment:this.segment,exercise:this.exercise.number,title:this.exercise.title.slice(0,240),attempt:l.attemptId,
      combo:combo??l.combo,...eventEvidence(b),detail,priority});this.bytes+=JSON.stringify(s.events.at(-1)).length*2;this.changed();
  }
  private changed(){this.dirty=true;this.state.session!.revision++;this.state.localSaved=false;this.state.saved="";this.emit();if(!this.flushTimer)this.flushTimer=setTimeout(()=>{this.flushTimer=undefined;void this.flush();},1000);}
  async flush(){
    if(this.busy||!this.dirty||!this.state.session)return;this.busy=true;this.dirty=false;
    const saved=structuredClone(this.state.session);
    try{await localStore(this.owner,saved);this.state.localSaved=saved.revision===this.state.session?.revision;this.emit();await shortsApi('',{session:saved});this.state.saved=saved.revision===this.state.session?.revision?new Date().toLocaleTimeString():"";this.state.error='';}
    catch(e){this.state.error=e instanceof Error?e.message:'Unable to save';this.dirty=true;}
    finally{this.busy=false;this.emit();if(this.dirty&&!this.flushTimer)this.flushTimer=setTimeout(()=>{this.flushTimer=undefined;void this.flush();},4000);}
  }
}
export const shortsRecorder=new ShortsRecorder();
