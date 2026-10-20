import type { BossBattleConfig } from './boss-config';
import {battleSampleCatalog,battleSamplePlan,type SampleId} from './battle-sample-plan';

export type BattleSound = 'heroSwing' | 'bossSwing' | 'heroImpact' | 'hurt' | 'heavy' | 'power' | 'victory' | 'defeat' | 'timeout' | 'countIn' | 'fight' | 'pressureTaunt' | 'pressureTension';
export type AudioOutput = 'practice' | 'obs';
export type AudioDiagnostics = {
  context: string; unlocked: boolean; enabled: boolean; volume: number; output: AudioOutput;
  owner: boolean; status: string; error: string; played: number; dropped: number; active: number;
  lastCue: string; assets: string; lastDecision: string;
};
type Voice = {source: AudioBufferSourceNode; gain: GainNode};
const durations: Record<BattleSound, number> = {heroSwing:.13,bossSwing:.2,heroImpact:.2,hurt:.24,heavy:.4,power:.36,victory:.85,defeat:.8,timeout:.65,countIn:.14,fight:.32,pressureTaunt:.32,pressureTension:.42};
const results = new Set<BattleSound>(['victory','defeat','timeout']);

// Preloaded approved samples, with the original synthesis as a diagnosed fallback.
// All voices share one compressed master bus; MIDI never waits for audio.
export class BattleAudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private compressor?: DynamicsCompressorNode;
  private samples = new Map<BattleSound, AudioBuffer>();
  private recordings = new Map<SampleId,AudioBuffer>();
  private loading?:Promise<void>;
  private failedAssets=new Set<SampleId>();
  private variation=new Map<BattleSound,number>();
  private bossId='crimson_musical_colossus';
  private lastVocal=-Infinity;
  private voices = new Set<Voice>();
  private listeners = new Set<()=>void>();
  private seen = new Set<string>();
  private lastGroup = new Map<string, number>();
  private state: AudioDiagnostics = {context:'not created',unlocked:false,enabled:false,volume:.08,output:'practice',owner:false,status:'Waiting for settings',error:'',played:0,dropped:0,active:0,lastCue:'None',lastDecision:'No combat cue yet',assets:'Approved Sonniss sounds · waiting for audio unlock'};
  constructor(private createContext = () => new AudioContext({latencyHint:'interactive'}), private now = () => Date.now(),private loadAsset=(url:string)=>fetch(url,{signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.arrayBuffer();})) {}
  subscribe = (fn:()=>void) => {this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
  snapshot = () => this.state;
  private update(value:Partial<AudioDiagnostics>) {this.state={...this.state,...value};for(const fn of this.listeners)fn();}
  configure(config: Pick<BossBattleConfig,'soundEnabled'|'volume'|'audioOutput'> & Partial<Pick<BossBattleConfig,'bossId'>>) {
    this.bossId=config.bossId??'crimson_musical_colossus';
    const volume=Math.max(0,Math.min(.2,config.volume));
    if(this.state.enabled===config.soundEnabled&&this.state.volume===volume&&this.state.output===config.audioOutput)return;
    this.update({enabled:config.soundEnabled,volume,output:config.audioOutput});
    if(this.master&&this.context)this.master.gain.setTargetAtTime(config.soundEnabled?volume:0,this.context.currentTime,.008);
    if(!config.soundEnabled||volume===0)this.stop();
  }
  own(owner:boolean,status:string) {if(owner!==this.state.owner||status!==this.state.status){this.update({owner,status});if(!owner)this.stop();}}
  private ensure() {
    if(this.context&&this.context.state!=='closed')return this.context;
    const c=this.context=this.createContext(),master=this.master=c.createGain(),compressor=this.compressor=c.createDynamicsCompressor();
    master.gain.value=this.state.enabled?this.state.volume:0;
    compressor.threshold.value=-16;compressor.knee.value=12;compressor.ratio.value=8;compressor.attack.value=.003;compressor.release.value=.1;
    master.connect(compressor);compressor.connect(c.destination);
    c.onstatechange=()=>this.update({context:c.state,unlocked:c.state==='running'});
    this.update({context:c.state,unlocked:c.state==='running'});
    this.recordings.clear();this.loading=undefined;
    void this.preload();
    return c;
  }
  preload() {
    if(this.loading)return this.loading;
    const c=this.context;if(!c)return Promise.resolve();
    this.update({assets:`Loading approved Sonniss sounds · ${this.recordings.size}/${Object.keys(battleSampleCatalog).length}`});
    const missing=(Object.keys(battleSampleCatalog) as SampleId[]).filter(id=>!this.recordings.has(id));
    this.loading=Promise.all(missing.map(async id=>{
      try {
        const bytes=await this.loadAsset(battleSampleCatalog[id].url),buffer=await c.decodeAudioData(bytes);
        if(c!==this.context)return;
        if(!Number.isFinite(buffer.duration)||buffer.duration<=0||buffer.duration>2)throw new Error('Invalid sample duration');
        this.recordings.set(id,buffer);this.failedAssets.delete(id);
      }catch{this.failedAssets.add(id);}
    })).then(()=>{
      this.update({assets:`Approved Sonniss sounds · ${this.recordings.size}/${Object.keys(battleSampleCatalog).length} loaded${this.failedAssets.size?` · Missing: ${[...this.failedAssets].join(', ')} · Synthesized fallback active`: ' · TIME OUT: original synthesized cue'}`});
      if(this.failedAssets.size)this.loading=undefined; // explicit next unlock/test can retry
    });
    return this.loading;
  }
  // Call synchronously inside Start/Test/checkbox gestures. Never await in MIDI code.
  unlock() {
    try {
      const c=this.ensure();
      void this.preload();
      if(c.state!=='running')void c.resume().then(()=>this.update({context:c.state,unlocked:c.state==='running',error:''})).catch(e=>this.fail(e));
      else this.update({context:c.state,unlocked:true,error:''});
    } catch(e) {this.fail(e);}
  }
  private fail(error:unknown) {this.update({error:error instanceof Error?error.message:String(error)});}
  stop() {
    for(const voice of [...this.voices]) {
      try {const at=this.context!.currentTime;voice.gain.gain.cancelScheduledValues(at);voice.gain.gain.setTargetAtTime(0,at,.004);voice.source.stop(at+.02);}catch{/* Already ended. */}
    }
  }
  private sample(kind:BattleSound,c:AudioContext) {
    const saved=this.samples.get(kind);if(saved)return saved;
    const duration=durations[kind],buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=buffer.getChannelData(0);
    let seed=731,filtered=0;
    for(let i=0;i<data.length;i++) {
      const t=i/c.sampleRate,p=t/duration;
      seed=(Math.imul(seed,1664525)+1013904223)|0;
      const noise=(seed>>>0)/2147483648-1;filtered=.88*filtered+.12*noise;
      const attack=Math.min(1,t/.006),env=attack*Math.pow(1-p,2);
      let v=0;
      if(kind==='heroSwing'||kind==='bossSwing')v=(noise-filtered)*Math.sin(Math.PI*p)*.5*(kind==='bossSwing'?1.2:1);
      else if(kind==='pressureTaunt'||kind==='pressureTension')v=(Math.sin(2*Math.PI*(kind==='pressureTension'?330:130)*t)+.25*Math.sin(2*Math.PI*347*t))*env*.2;
      else if(kind==='countIn'||kind==='fight')v=(Math.sin(2*Math.PI*(kind==='fight'?440:220)*t)+.25*Math.sin(2*Math.PI*880*t))*env*.35;
      else if(results.has(kind)) {
        const notes=kind==='victory'?[330,415,494,660]:kind==='defeat'?[220,185,147,110]:[392,294,196];
        for(let n=0;n<notes.length;n++) {const age=t-n*.105;if(age>=0)v+=Math.sin(2*Math.PI*notes[n]*age)*Math.min(1,age/.008)*Math.exp(-age*6)*.22;}
        v*=Math.min(1,(duration-t)/.08);
      } else {
        const heavy=kind==='heavy'||kind==='power',bass=heavy?65:kind==='hurt'?115:230;
        v=(Math.sin(2*Math.PI*(bass*t+35*(1-Math.exp(-t*25))/25))*(heavy?.8:.4)+filtered*(kind==='hurt'?.7:.4))*env;
        v+=Math.sin(2*Math.PI*(kind==='power'?1480:1900)*t)*Math.exp(-t*35)*attack*.12;
        v+=(noise-filtered)*Math.exp(-t*65)*attack*.2;
      }
      data[i]=Math.max(-.95,Math.min(.95,v));
    }
    this.samples.set(kind,buffer);return buffer;
  }
  play(kind:BattleSound,id:string,at=this.now(),preview=false) {
    if(this.seen.has(id))return false;
    this.seen.add(id);if(this.seen.size>2048)this.seen.delete(this.seen.values().next().value!);
    const current=this.now();
    // Blocked, muted and stale cues are discarded, never replayed after unlock.
    const reason=!this.state.enabled?'Sound disabled':this.state.volume===0?'Volume is zero':!preview&&!this.state.owner?'Another output owns audio':current-at>350?'Stale cue discarded':'';
    if(reason){if(this.state.lastDecision!==reason)this.update({lastDecision:reason});return false;}
    const c=this.context;
    if(!c||c.state!=='running'){this.update({error:'Audio is blocked or not unlocked. Use Start MIDI practice or Test Battle Sound. For OBS, use Interact and click inside the source.',context:c?.state??'not created',unlocked:false});return false;}
    const group=results.has(kind)?'result':kind==='heavy'||kind==='power'?'major':kind.endsWith('Swing')?'swing':'impact',priority=results.has(kind)||group==='major',cooldown=results.has(kind)?0:priority?180:group==='swing'?110:90;
    if(current-(this.lastGroup.get(group)??-Infinity)<cooldown||(!priority&&this.voices.size>=3)){this.update({dropped:this.state.dropped+1});return false;}
    try {
      if(group==='result')this.stop();
      const index=this.variation.get(kind)??0,plan=battleSamplePlan(kind,index,this.bossId);
      const primary=plan[0]&&this.recordings.get(plan[0].sample);
      const layers=primary?plan.filter((layer,i)=>i===0||this.recordings.has(layer.sample)&&(group==='result'||this.voices.size<3&&(!layer.vocal||current-this.lastVocal>=900))):[];
      const selected=primary?layers.map(layer=>({buffer:this.recordings.get(layer.sample)!,gain:layer.gain,vocal:layer.vocal})): [{buffer:this.sample(kind,c),gain:kind==='timeout'?1:.65,vocal:false}];
      for(const layer of selected){
        if(this.voices.size>=4){const oldest=this.voices.values().next().value!;oldest.source.stop();oldest.source.disconnect();oldest.gain.disconnect();this.voices.delete(oldest);}
        const source=c.createBufferSource(),gain=c.createGain(),voice={source,gain};
        source.buffer=layer.buffer;gain.gain.value=layer.gain;source.connect(gain);gain.connect(this.master!);
        this.voices.add(voice);source.onended=()=>{source.disconnect();gain.disconnect();this.voices.delete(voice);this.update({active:this.voices.size});};
        source.start();if(layer.vocal)this.lastVocal=current;
      }
      this.variation.set(kind,index+1);this.lastGroup.set(group,current);
      this.update({played:this.state.played+1,active:this.voices.size,lastCue:kind,lastDecision:'Played',error:''});return true;
    }catch(e){this.fail(e);return false;}
  }
  async test(kind:BattleSound) {
    this.unlock();
    // Only a test gesture may await resume; regular combat never queues playback.
    try {if(this.context?.state!=='running')await this.context?.resume();}catch(e){this.fail(e);return;}
    await this.preload();
    this.play(kind,`test:${this.now()}:${Math.random()}`,this.now(),true);
  }
}
export const battleAudio = new BattleAudioEngine();

export function isObsAudioSource() {
  return typeof window!=='undefined'&&('obsstudio' in window||new URLSearchParams(location.search).get('battleAudio')==='1');
}

// Exclusive within a browser profile. The persisted output destination prevents
// practice/OBS echoes across profiles. Other legacy overlays never claim audio.
export function claimBattleAudio(user:string,role:AudioOutput,eligible:boolean) {
  let disposed=false,release:(()=>void)|undefined,busy=false;
  const selected=()=>eligible&&battleAudio.snapshot().output===role&&battleAudio.snapshot().enabled;
  const attempt=()=>{
    if(disposed)return;
    if(!selected()){release?.();release=undefined;battleAudio.own(false,eligible?'Audio routed to the other output or disabled':'Silent browser preview · sound output is reserved for OBS');return;}
    if(release||busy)return;
    if(!navigator.locks){battleAudio.own(false,'Audio ownership unavailable. Use a current browser over HTTPS.');return;}
    busy=true;
    void navigator.locks.request(`pianopath-battle-audio:${user}`,{ifAvailable:true},async lock=>{
      busy=false;if(disposed||!selected())return;
      if(!lock){battleAudio.own(false,'Another tab owns battle audio');return;}
      battleAudio.own(true,role==='obs'?'OBS Browser Source output':'Practice browser output');
      // OBS may allow autoplay. If not, no policy bypass: Interact supplies a gesture.
      if(role==='obs')battleAudio.unlock();
      await new Promise<void>(resolve=>{release=resolve;});
      release=undefined;
    }).catch(()=>{busy=false;battleAudio.own(false,'Could not claim audio output');});
  };
  const gesture=()=>{if(selected())battleAudio.unlock();};
  window.addEventListener('pointerdown',gesture);window.addEventListener('click',gesture);window.addEventListener('keydown',gesture);
  const unsubscribe=battleAudio.subscribe(()=>{if(!selected()){release?.();release=undefined;battleAudio.own(false,'Audio routed to the other output or disabled');} });
  const timer=setInterval(attempt,500);attempt();
  return()=>{disposed=true;clearInterval(timer);unsubscribe();release?.();battleAudio.own(false,'Audio output closed');window.removeEventListener('pointerdown',gesture);window.removeEventListener('click',gesture);window.removeEventListener('keydown',gesture);};
}
