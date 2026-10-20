import { z } from "zod";
import {battleAudio,isObsAudioSource} from './battle-audio';
import { overlaySnapshot, type OverlaySnapshot, type OverlayState } from "./obs-state";

export type ScoreFrame = {sourceId:string;sequence:number;updatedAt:number;snapshot:OverlaySnapshot};
const frameSchema=z.object({sourceId:z.string().uuid(),sequence:z.number().int().positive(),updatedAt:z.number(),snapshot:overlaySnapshot});
const MAX_FRAME_BYTES=60000;
// Read-only diagnostics travel back over the existing authenticated score peer.
// They cannot carry evaluation events, settings changes, HP or reward writes.
const audioStatusSchema=z.object({type:z.literal('battle-audio-status'),data:z.object({
  context:z.string().max(30),unlocked:z.boolean(),enabled:z.boolean(),volume:z.number().min(0).max(.2),output:z.enum(['practice','obs']),
  owner:z.boolean(),status:z.string().max(160),error:z.string().max(500),played:z.number().nonnegative(),dropped:z.number().nonnegative(),active:z.number().min(0).max(4),lastCue:z.string().max(50),lastDecision:z.string().max(160),assets:z.string().max(160),
})});

// HTTP supplies source ownership and durable statistics. Peer messages only
// replace live presentation from that authenticated source, in sequence order.
export class OverlayReceiver {
  state:OverlayState|null=null;
  private cloudTime=0;
  cloud(next:OverlayState) {
    if((next.updatedAt??0)<this.cloudTime) return this.state;
    this.cloudTime=next.updatedAt??0;
    if(this.state?.sourceId && next.sourceId===this.state.sourceId && (next.sequence??0)<=(this.state.sequence??0)) {
      // A peer can change exercises before the durable snapshot catches up.
      // Do not label the new score with the previous exercise's PB/attempts.
      if(next.snapshot?.exerciseNumber!==this.state.snapshot?.exerciseNumber || next.snapshot?.hand!==this.state.snapshot?.hand)return this.state;
      if(!next.gamePlayer&&!this.state.gamePlayer&&next.best===this.state.best&&next.attempts===this.state.attempts)return this.state;
      this.state={...next,snapshot:this.state.snapshot,sequence:this.state.sequence,updatedAt:this.state.updatedAt};
    } else this.state=next;
    return this.state;
  }
  direct(raw:unknown) {
    const parsed=frameSchema.safeParse(raw);
    if(!parsed.success || !this.state || parsed.data.sourceId!==this.state.sourceId || parsed.data.sequence<=(this.state.sequence??0)) return null;
    // Never accept persistent player totals/records from the peer.
    const changed=parsed.data.snapshot.exerciseNumber!==this.state.snapshot?.exerciseNumber || parsed.data.snapshot.hand!==this.state.snapshot?.hand;
    this.state={...this.state,...parsed.data,updatedAt:Date.now(),...(changed?{best:null,attempts:0,gamePlayer:this.state.gamePlayer?{...this.state.gamePlayer,exerciseBest:0}:undefined}:{})};
    return this.state;
  }
}

async function signal(sourceId:string,viewerId?:string,body?:{type:"offer"|"answer";sdp:string}) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try {
    const query=new URLSearchParams({rtc:"1",sourceId,...(viewerId?{viewerId}:{})});
    const response=await fetch(`/api/obs?${query}`,{method:body?"POST":"GET",cache:"no-store",signal:controller.signal,
      ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify({...body,sourceId,viewerId})}:{})});
    if(!response.ok) throw new Error("Direct score handshake unavailable");
    return await response.json() as {active:boolean;answer?:string|null;offers?:{viewerId:string;sdp:string}[]};
  } finally {clearTimeout(timer);}
}
async function gather(peer:RTCPeerConnection) {
  if(peer.iceGatheringState==="complete") return;
  await new Promise<void>(resolve=>{
    const done=()=>{clearTimeout(timer);peer.removeEventListener("icegatheringstatechange",changed);resolve();};
    const changed=()=>{if(peer.iceGatheringState==="complete"||peer.connectionState==="closed")done();};
    const timer=setTimeout(done,2000);peer.addEventListener("icegatheringstatechange",changed);
  });
}
function connection() {
  // Local/LAN data only: no camera, microphone, public STUN or TURN service.
  return new RTCPeerConnection({iceServers:[]});
}
type Peer={pc:RTCPeerConnection;channel?:RTCDataChannel;createdAt:number;sent?:string};

export class DirectScorePublisher {
  private peers=new Map<string,Peer>();
  private latest="";
  private disposed=false;
  private polling=false;
  private timer:ReturnType<typeof setInterval>;
  private heartbeat:ReturnType<typeof setInterval>;
  constructor(private sourceId:string) {
    this.timer=setInterval(()=>void this.poll(),1000);
    this.heartbeat=setInterval(()=>this.send(true),500);
    void this.poll();
  }
  publish(frame:ScoreFrame) {
    const value=JSON.stringify(frame);
    // Keep only the newest frame in JS and bound the transport backlog. Cloud
    // fallback handles unusually large snapshots; smaller frames resume here.
    this.latest=new TextEncoder().encode(value).byteLength<=MAX_FRAME_BYTES?value:"";
    this.send();
  }
  private send(repeat=false) {
    if(!this.latest)return;
    for(const peer of this.peers.values()) {
      if(peer.channel?.readyState==="open" && peer.channel.bufferedAmount<16384 && (repeat||peer.sent!==this.latest)) {
        try {peer.channel.send(this.latest);peer.sent=this.latest;} catch { /* HTTP remains active. */ }
      }
    }
  }
  private async answer(offer:{viewerId:string;sdp:string}) {
    const peer:Peer={pc:connection(),createdAt:Date.now()};this.peers.set(offer.viewerId,peer);
    try {
      peer.pc.ondatachannel=e=>{
        peer.channel=e.channel;e.channel.onopen=()=>this.send();
        e.channel.onmessage=event=>{
          if(this.disposed||typeof event.data!=='string'||event.data.length>3000)return;
          try {const parsed=audioStatusSchema.safeParse(JSON.parse(event.data));if(parsed.success)window.dispatchEvent(new CustomEvent('battle-audio-status',{detail:parsed.data.data}));}catch{/* Diagnostics never interrupt score traffic. */}
        };
        e.channel.bufferedAmountLowThreshold=16384;e.channel.onbufferedamountlow=()=>this.send();
        e.channel.onclose=()=>{peer.pc.close();this.peers.delete(offer.viewerId);};
      };
      await peer.pc.setRemoteDescription({type:"offer",sdp:offer.sdp});
      await peer.pc.setLocalDescription(await peer.pc.createAnswer());await gather(peer.pc);
      if(this.disposed)return;
      await signal(this.sourceId,offer.viewerId,{type:"answer",sdp:peer.pc.localDescription!.sdp});
    } catch {peer.pc.close();this.peers.delete(offer.viewerId);}
  }
  private async poll() {
    if(this.disposed||this.polling||typeof RTCPeerConnection==="undefined")return;
    this.polling=true;
    try {
      const result=await signal(this.sourceId);
      if(this.disposed)return;
      if(!result.active){for(const p of this.peers.values())p.pc.close();this.peers.clear();return;}
      for(const [id,p] of this.peers)if(p.pc.connectionState==="failed" || (p.channel?.readyState!=="open"&&Date.now()-p.createdAt>15000)){p.pc.close();this.peers.delete(id);}
      for(const offer of result.offers??[])if(!this.peers.has(offer.viewerId)&&this.peers.size<8)void this.answer(offer).catch(()=>{});
    } catch { /* The existing authenticated cloud path is the fallback. */ }
    finally {this.polling=false;}
  }
  close() {this.disposed=true;clearInterval(this.timer);clearInterval(this.heartbeat);for(const p of this.peers.values())p.pc.close();this.peers.clear();}
}

export class DirectScoreViewer {
  private source="";
  private peer?:RTCPeerConnection;
  private retry?:ReturnType<typeof setTimeout>;
  private poll?:ReturnType<typeof setTimeout>;
  private watchdog?:ReturnType<typeof setInterval>;
  private generation=0;
  private lastFrame=0;
  private connected=false;
  constructor(private onFrame:(frame:unknown)=>void,private onConnection:(connected:boolean)=>void) {}
  sourceChanged(source:string) {
    if(source===this.source)return;
    this.stop();this.source=source;
    if(source)void this.connect();
  }
  private status(value:boolean){if(value!==this.connected){this.connected=value;this.onConnection(value);}}
  private stop() {
    this.generation++;clearTimeout(this.retry);clearTimeout(this.poll);clearInterval(this.watchdog);
    this.peer?.close();this.peer=undefined;this.status(false);
  }
  private reconnect(generation:number) {
    if(generation!==this.generation)return;
    this.stop();this.retry=setTimeout(()=>void this.connect(),2000);
  }
  private async connect() {
    if(!this.source||typeof RTCPeerConnection==="undefined")return;
    const generation=++this.generation,source=this.source,viewerId=crypto.randomUUID();
    const valid=()=>generation===this.generation;
    try {
      const peer=this.peer=connection();
      const channel=peer.createDataChannel("pianopath-score-v1",{ordered:false,maxRetransmits:0});
      const started=Date.now();this.lastFrame=started;
      channel.onmessage=event=>{
        if(!valid()||typeof event.data!=="string"||event.data.length>MAX_FRAME_BYTES)return;
        try {
          const parsed=frameSchema.safeParse(JSON.parse(event.data));
          if(!parsed.success||parsed.data.sourceId!==source)return;
          this.onFrame(parsed.data);this.lastFrame=Date.now();this.status(true);
        } catch { /* Ignore malformed frames; keep the cloud path running. */ }
      };
      channel.onclose=()=>this.reconnect(generation);
      peer.onconnectionstatechange=()=>{if(peer.connectionState==="failed")this.reconnect(generation);};
      this.watchdog=setInterval(()=>{
        if(channel.readyState==='open'&&channel.bufferedAmount<4096&&isObsAudioSource()&&location.pathname==='/obs/recording'){
          try {channel.send(JSON.stringify({type:'battle-audio-status',data:battleAudio.snapshot()}));}catch{/* Reconnection handles closed channels. */}
        }
        if(Date.now()-(this.connected?this.lastFrame:started)>(this.connected?3000:12000))this.reconnect(generation);
      },1000);
      await peer.setLocalDescription(await peer.createOffer());await gather(peer);
      if(!valid())return;
      const response=await signal(source,viewerId,{type:"offer",sdp:peer.localDescription!.sdp});
      if(!valid())return;
      if(!response.active){this.reconnect(generation);return;}
      const answer=async()=>{
        if(!valid())return;
        try {
          const response=await signal(source,viewerId);
          if(!valid())return;
          if(response.answer)await peer.setRemoteDescription({type:"answer",sdp:response.answer});
          else if(response.active)this.poll=setTimeout(()=>void answer(),300);
          else this.reconnect(generation);
        } catch {this.reconnect(generation);}
      };
      void answer();
    } catch {this.reconnect(generation);}
  }
  close(){this.source="";this.stop();}
}
