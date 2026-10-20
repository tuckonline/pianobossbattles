/* eslint-disable react-hooks/immutability -- This effect owns imperative layout of Verovio's SVG DOM, not React props or state. */
import { useLayoutEffect, useRef, type RefObject } from "react";
import { measureNotationInk, screenNotationInk, unionBounds, type ScoreBounds } from "./notation-bounds";
import { createBroadcastDebug } from "./broadcast-debug";
import {portraitWindow,type PortraitMeasure} from './portrait-layout';
export type { ScoreBounds } from "./notation-bounds";
export type ScorePadding = { top: number; bottom: number; left: number; right: number };
export const broadcastPadding: ScorePadding = { top: 24, bottom: 24, left: 24, right: 24 };

export function broadcastFrame(bounds: ScoreBounds[], width: number, height: number, padding = broadcastPadding, visibleSystems = 2) {
  const lines = Math.min(visibleSystems, bounds.length);
  // Fit complete consecutive unions, including any overhanging glyphs on either
  // system. Never assume the first top or the last bottom is the extreme.
  const pairs = bounds.map((_b, i) => unionBounds(bounds.slice(i, i + lines)));
  const widest = Math.max(1, ...pairs.map(b => b.right - b.left));
  const tallest = Math.max(1, ...pairs.map(b => b.bottom - b.top));
  return { margin: Math.min(...Object.values(padding)), padding,
    scale: Math.max(0, Math.min((width-padding.left-padding.right)/widest, (height-padding.top-padding.bottom)/tallest)) };
}

// Row targets are aesthetic preferences; complete ink containment always wins.
export function adaptiveBroadcastFrame(bounds: ScoreBounds[], width:number, height:number, padding = broadcastPadding) {
  const base=broadcastFrame(bounds,width,height,padding);
  const targets=({1:[.5],2:[.32,.68],3:[.22,.5,.78]} as Record<number,number[]>)[bounds.length];
  if(!targets)return {...base,centers:undefined};
  const centers=targets.map(t=>t*height+(padding.top-padding.bottom)/2),heights=bounds.map(b=>Math.max(1,b.bottom-b.top));
  const limits=[base.scale*1.1,(width-padding.left-padding.right)/Math.max(1,...bounds.map(b=>b.right-b.left))];
  heights.forEach((h,i)=>{
    limits.push(2*(centers[i]-padding.top)/h,2*(height-padding.bottom-centers[i])/h);
    if(i)limits.push(2*(centers[i]-centers[i-1]-base.margin)/(h+heights[i-1]));
  });
  return {...base,scale:Math.max(0,Math.min(...limits)),centers};
}

// Playback reuses cached full ink bounds. It only changes the visible pair and
// its translation; there is no re-engraving or leaf measurement per MIDI note.
export function useBroadcastLayout(
  container: RefObject<HTMLDivElement | null>, rendered: string,
  enabled: boolean, activeMeasure: number | undefined, follow: boolean,
) {
  const latest = useRef({ activeMeasure, follow });
  latest.current = { activeMeasure, follow };
  const update = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    const root = container.current;
    if (!enabled || !rendered || !root) return;
    const pages = Array.from(root.querySelectorAll<SVGSVGElement>(":scope > svg"));
    const focusMeasure=!!root.closest('[data-broadcast-focus="measure"]');
    const systems = Array.from(root.querySelectorAll<SVGGraphicsElement>(focusMeasure?".measure":".system"));
    const measures = Array.from(root.querySelectorAll<SVGGraphicsElement>(".measure"));
    if (!systems.length) return;
    const count=root.closest('[data-broadcast-systems="1"]')?1:2;
    const adaptive=!!root.closest('[data-broadcast-spacing="adaptive"]')&&systems.length<=3;
    // Measure focus is an optional portrait-only window. Hide system labels and
    // braces outside that window; the complete measure includes both staves,
    // clefs, beams, ledger lines and fingerings measured below.
    const outside=focusMeasure?Array.from(root.querySelectorAll<SVGGraphicsElement>('.system > *')).filter(n=>!n.matches('.measure')&&!n.querySelector('.measure')):[];
    const outsideStyles=outside.map(n=>n.style.visibility);
    outside.forEach(n=>{n.style.visibility='hidden';});
    const originalTransforms=systems.map(s=>s.getAttribute("transform"));
    const restoreTransforms=()=>systems.forEach((s,i)=>{
      if(originalTransforms[i]===null)s.removeAttribute("transform");else s.setAttribute("transform",originalTransforms[i]!);
    });
    const debug = createBroadcastDebug();
    let localInk: ScoreBounds[] = [], measured: ScoreBounds[] = [];
    let portraitMeasures:PortraitMeasure[]=[],portraitKey='';
    let padding = broadcastPadding, scale = 1;
    let first = 0, frame = "", raf = 0, disposed = false;
    const viewport = () => root.closest<HTMLElement>("[data-broadcast-viewport]")?.getBoundingClientRect()
      ?? {left:0,top:0,width:window.innerWidth,height:window.innerHeight};
    const screenInk = (i:number) => screenNotationInk(systems[i],localInk[i]);
    const debugFrame = (indices:number[]) => {
      if (!debug) return;
      const a=viewport(),area={left:a.left,top:a.top,right:a.left+a.width,bottom:a.top+a.height};
      debug.render(area,{left:area.left+padding.left,right:area.right-padding.right,top:area.top+padding.top,bottom:area.bottom-padding.bottom},measured,indices.map(screenInk),scale);
    };
    const show = () => {
      if(adaptive || !localInk.length)return;
      if(focusMeasure){
        const area=viewport(),wrapper=root.closest<HTMLElement>('[data-broadcast-focus]')!;
        const requested=Number(wrapper.dataset.notationScale??125),view=wrapper.dataset.notationView??'automatic';
        const at=latest.current.follow?latest.current.activeMeasure??0:0;
        const key=`${frame}:${at}:${view}:${requested}`;if(key===portraitKey)return;portraitKey=key;
        const baseline=broadcastFrame(measured,area.width,area.height*.8,padding,1).scale;
        const plan=portraitWindow(portraitMeasures,at,view,area.width-padding.left-padding.right,area.height-padding.top-padding.bottom,requested,baseline);
        restoreTransforms();root.style.transform='';root.dataset.broadcastX='0';root.dataset.broadcastY='0';scale=plan.scale;
        pages.forEach(page=>{page.style.width=`${parseFloat(page.getAttribute('width')!)*scale}px`;});
        systems.forEach((s,i)=>{s.style.visibility=plan.indices.includes(i)?'visible':'hidden';});
        let x=area.left+padding.left+(area.width-padding.left-padding.right-plan.span*scale)/2;
        const staffY=area.top+padding.top+(area.height-padding.top-padding.bottom-(plan.bottom-plan.top)*scale)/2-plan.top*scale;
        for(const i of plan.indices){
          const s=systems[i],ink=screenInk(i),dy=staffY+(portraitMeasures[i].bounds.top-portraitMeasures[i].staffY)*scale-ink.top,dx=x-ink.left;
          const inverse=(s.parentNode as SVGGraphicsElement).getScreenCTM()!.inverse();
          s.setAttribute('transform',`translate(${inverse.a*dx+inverse.c*dy} ${inverse.b*dx+inverse.d*dy}) ${originalTransforms[i]??''}`);
          x+=(portraitMeasures[i].bounds.right-portraitMeasures[i].bounds.left+plan.gap)*scale;
        }
        root.dataset.broadcastReady='true';root.dataset.broadcastFirst=String(plan.indices[0]);root.dataset.broadcastWindow=String(plan.indices.length);
        root.dataset.broadcastEffectiveScale=String(plan.effective);root.dataset.broadcastRequestedScale=String(requested);
        root.dispatchEvent(new CustomEvent('shorts-notation-fit',{bubbles:true,detail:{effective:plan.effective,requested,measures:plan.indices.length}}));
        debugFrame(plan.indices);return;
      }
      const current = focusMeasure?measures[latest.current.activeMeasure ?? 0]:measures[latest.current.activeMeasure ?? 0]?.closest(".system");
      const at = Math.max(0, systems.indexOf(current as SVGGraphicsElement));
      if (latest.current.follow) {
        if (at < first || at > first + count - 1) first = Math.min(at, Math.max(0, systems.length - count));
        if ((latest.current.activeMeasure ?? 0) === 0) first = 0;
      }
      const indices=systems.map((_s,i)=>i).filter(i=>i>=first&&i<first+count);
      systems.forEach((s,i)=>{s.style.visibility=indices.includes(i)?"visible":"hidden";});
      const ink=unionBounds(indices.map(screenInk)),area=viewport();
      const x=Number(root.dataset.broadcastX??0)+area.left+(area.width+padding.left-padding.right)/2-(ink.left+ink.right)/2;
      const y=Number(root.dataset.broadcastY??0)+area.top+(area.height+padding.top-padding.bottom)/2-(ink.top+ink.bottom)/2;
      root.style.transform=`translate(${x}px, ${y}px)`;
      root.dataset.broadcastX=String(x);root.dataset.broadcastY=String(y);
      root.dataset.broadcastReady="true";root.dataset.broadcastFirst=String(first);
      debugFrame(indices);
    };
    const fit = () => {
      if(disposed)return;
      const {width,height,left,top}=viewport();
      const wrapper=root.closest<HTMLElement>(".sight-score")??root;
      const style=getComputedStyle(wrapper);
      // Configurable screen-pixel padding; changing the viewport refits it.
      padding=Object.fromEntries(Object.entries(broadcastPadding).map(([edge,value])=>{
        const custom=parseFloat(style.getPropertyValue(focusMeasure?`padding-${edge}`:`--score-padding-${edge}`));
        return [edge,Number.isFinite(custom)?Math.max(0,custom):value];
      })) as ScorePadding;
      const geometry=systems.map(s=>{const b=s.getBBox();return `${b.x}:${b.y}:${b.width}:${b.height}`;}).join(";");
      const next=`${width}:${height}:${left}:${top}:${geometry}:${JSON.stringify(padding)}`;
      if(next!==frame){
        frame=next;root.style.transform="";root.dataset.broadcastX="0";root.dataset.broadcastY="0";
        if(adaptive||focusMeasure)restoreTransforms();
        pages.forEach(page=>{page.style.width=`${parseFloat(page.getAttribute("width")!)}px`;});
        localInk=systems.map(measureNotationInk);
        measured=systems.map((_s,i)=>screenInk(i));
        if(focusMeasure){
          portraitMeasures=systems.map((s,i)=>({bounds:measured[i],staffY:s.querySelector('.staff > path')?.getBoundingClientRect().top??measured[i].top,notes:s.querySelectorAll('.note').length}));
          portraitKey='';
        }
        const plan:{scale:number;centers?:number[]}=adaptive?adaptiveBroadcastFrame(measured,width,height,padding):broadcastFrame(measured,width,height,padding,count);
        scale=plan.scale;
        pages.forEach(page=>{page.style.width=`${parseFloat(page.getAttribute("width")!)*scale}px`;});
        if(adaptive&&plan.centers){
          systems.forEach((system,i)=>{
            system.style.visibility="visible";
            const b=screenInk(i),dy=top+plan.centers![i]-(b.top+b.bottom)/2;
            const inverse=(system.parentNode as SVGGraphicsElement).getScreenCTM()!.inverse();
            system.setAttribute("transform",`translate(${inverse.c*dy} ${inverse.d*dy}) ${originalTransforms[i]??""}`);
          });
          const ink=unionBounds(systems.map((_s,i)=>screenInk(i)));
          const x=left+(width+padding.left-padding.right)/2-(ink.left+ink.right)/2;
          root.style.transform=`translate(${x}px, 0px)`;
          root.dataset.broadcastX=String(x);root.dataset.broadcastReady="true";root.dataset.broadcastFirst="0";
          debugFrame(systems.map((_s,i)=>i));
        }
        root.dataset.broadcastFitRevision=String(Number(root.dataset.broadcastFitRevision??0)+1);
      }
      show();
    };
    const resize=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(fit);};
    update.current=show;
    window.addEventListener("resize",resize);
    const observer=new ResizeObserver(resize);
    const wrapper=root.closest<HTMLElement>(".sight-score");
    if(wrapper)observer.observe(wrapper);
    const attributes=new MutationObserver(()=>{portraitKey='';show();});
    if(focusMeasure&&wrapper)attributes.observe(wrapper,{attributes:true,attributeFilter:['data-notation-scale','data-notation-view']});
    systems.forEach(system=>observer.observe(system));
    void document.fonts.ready.then(()=>{if(!disposed){frame="";fit();}});
    fit();
    return ()=>{
      disposed=true;observer.disconnect();attributes.disconnect();cancelAnimationFrame(raf);window.removeEventListener("resize",resize);
      update.current=null;root.style.transform="";debug?.dispose();
      delete root.dataset.broadcastReady;delete root.dataset.broadcastX;delete root.dataset.broadcastY;delete root.dataset.broadcastFitRevision;
      if(adaptive||focusMeasure)restoreTransforms();
      outside.forEach((n,i)=>{n.style.visibility=outsideStyles[i];});
      pages.forEach(page=>{page.style.width="";});systems.forEach(s=>{s.style.visibility="";});
    };
  }, [container, rendered, enabled]);
  useLayoutEffect(() => { update.current?.(); }, [activeMeasure, follow]);
}
