"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useBroadcastLayout } from "./broadcast-layout";
import { useScoreFollow, type ScoreFollowOptions } from "./score-follow";
import { importMusicXml } from "@/domains/notation/musicxml";
export type NoteFeedback = {
  pitch: number;
  beat: number;
  beats: number;
  hand: "left" | "right";
  status: "correct" | "incorrect" | "current";
};
export function NotationViewer({
  url,
  xml: suppliedXml,
  activeMeasure,
  presentationId,
  pending = false,
  activeBeat,
  compact = false,
  consistentScale = false,
  engravingScale = 75,
  displaySize,
  autoFitSingleSystem = false,
  hideTitle = false,
  broadcastFit = false,
  onDisplayedZoom,
  noteFeedback,
  followOptions = { enabled: true, topPercent: 0, bottomPercent: 0 },
}: {
  url?: string;
  xml?: string;
  presentationId?: string;
  pending?: boolean;
  activeMeasure?: number;
  activeBeat?: number;
  compact?: boolean;
  consistentScale?: boolean;
  engravingScale?: number;
  displaySize?: {zoom:number;fitWidth:boolean};
  autoFitSingleSystem?: boolean;
  hideTitle?: boolean;
  broadcastFit?: boolean;
  onDisplayedZoom?: (percent:number)=>void;
  noteFeedback?: NoteFeedback[];
  followOptions?: ScoreFollowOptions;
}) {
  const container = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const fixedScale=!broadcastFit && (consistentScale || displaySize!==undefined);
  const scale=engravingScale*(displaySize?.zoom??1);
  const fitWidth=displaySize?.fitWidth??false;
  const [availableWidth, setAvailableWidth] = useState(0);
  useEffect(() => {
    if (!fixedScale || !frame.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setAvailableWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, [fixedScale]);
  const identity=presentationId??suppliedXml??url??"";
  const [rendered,setRendered]=useState({svg:"",identity:""});
  const svg=rendered.svg;
  const fresh=rendered.identity===identity&&!pending;
  const transition=useRef({identity,started:0});
  const fade=useRef<Animation|null>(null);
  const lastCursor=useRef({measure:activeMeasure,beat:activeBeat});
  useLayoutEffect(()=>{
    if(fresh)lastCursor.current={measure:activeMeasure,beat:activeBeat};
  },[fresh,activeMeasure,activeBeat]);
  useLayoutEffect(()=>{
    if(transition.current.identity===identity)return;
    transition.current={identity,started:performance.now()};
    const node=container.current;
    fade.current?.cancel();
    node?.querySelectorAll(".practice-note-current,.practice-note-correct,.practice-note-incorrect,.sight-active-measure").forEach(el=>{
      el.classList.remove("practice-note-current","practice-note-correct","practice-note-incorrect","sight-active-measure");
    });
    if(node)fade.current=node.animate([{opacity:1},{opacity:0}],{duration:100,easing:"ease-out",fill:"forwards"});
  },[identity]);
  useLayoutEffect(()=>{
    if(!fresh||!rendered.svg)return;
    fade.current?.cancel();
    if(transition.current.started&&container.current)fade.current=container.current.animate([{opacity:0},{opacity:1}],{duration:100,easing:"ease-in",fill:"forwards"});
    return()=>{fade.current?.cancel();};
  },[rendered,fresh]);
  const
    [error, setError] = useState(""),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1);
  const [singleSystem,setSingleSystem]=useState(false);
  const engraving=useRef<{key:string;svg:string;single:boolean;pages:number}|null>(null);
  const enlargeSingle=autoFitSingleSystem && !displaySize && singleSystem;
  useEffect(() => {
    if (pending || (fixedScale && !availableWidth)) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;
    const controller = new AbortController();
    const key=JSON.stringify([url,suppliedXml,page,compact,fixedScale,scale,availableWidth,fitWidth,hideTitle,broadcastFit,consistentScale]);
    const display=async(value:{svg:string;single:boolean;pages:number})=>{
      const remaining=100-(performance.now()-transition.current.started);
      if(transition.current.started&&remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));
      if(cancelled||transition.current.identity!==identity)return;
      setRendered({svg:value.svg,identity});setSingleSystem(value.single);setPages(value.pages);setError("");
    };
    void (async () => {
      try {
        // Same-score loops reuse engraving; only presentation feedback resets.
        if(engraving.current?.key===key){await display(engraving.current);return;}
        let xml = suppliedXml;
        if (!xml) {
          if (!url) throw new Error("No score supplied");
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error("Unable to load MusicXML");
          xml = await response.text();
        }
        const score = importMusicXml(xml);
        // Give each pitched MusicXML note a stable SVG id. Unlike DOM order,
        // source timing remains correct for chords, rests, voices and ties.
        const source = new DOMParser().parseFromString(xml, "application/xml");
        if (fixedScale || broadcastFit) {
          source.querySelectorAll("part-name, part-abbreviation").forEach((element) => {
            element.textContent = "";
          });
        }
        const noteInfo = new Map<
          string,
          { pitch: number; beat: number; hand: string; name: string }
        >();
        let index = 0;
        source.querySelectorAll("part > measure > note").forEach((element) => {
          const playingHand = element.getAttribute("data-pianopath-hand");
          element.removeAttribute("data-pianopath-hand");
          if (!element.querySelector("pitch")) return;
          const n = score.notes[index];
          const id = `pianopath-note-${index++}`;
          element.setAttribute("id", id);
          noteInfo.set(id, {
            pitch: n.midiPitch,
            beat: n.onsetTick / score.ppq,
            hand: playingHand ?? (
              element.querySelector("staff")?.textContent === "2"
                ? "left"
                : "right"),
            name: n.spelling,
          });
          // Playing hand is independent of engraving staff in cross-staff piano music.
        });
        xml = new XMLSerializer().serializeToString(source);
        const [{ default: create }, { VerovioToolkit }] = await Promise.all([
          import("verovio/wasm"),
          import("verovio/esm"),
        ]);
        const wasm = await create();
        const toolkit = new VerovioToolkit(wasm);
        if(cancelled){toolkit.destroy();return;}
        destroy = () => toolkit.destroy();
        toolkit.setOptions({
          // Fixed staff size; page width controls wrapping, never magnification.
          scale: fixedScale ? scale : 38,
          pageWidth: fixedScale ? Math.max(400, Math.floor(availableWidth * 100 / scale)) : compact ? 2200 : 1600,
          pageHeight: suppliedXml ? 8000 : 1400,
          adjustPageHeight: true,
          ...(hideTitle ? { header: "none" } : {}),
          ...(fixedScale ? { header: "none", footer: "none", pageMarginTop: 20, pageMarginBottom: 20, pageMarginLeft: 60, pageMarginRight: 60 } : {}),
          ...(suppliedXml
            ? { breaks: fixedScale ? "auto" : "encoded", adjustPageWidth: fixedScale || !compact }
            : {}),
          ...(broadcastFit ? { scale: 38, pageWidth: 2200, pageHeight: 8000,
            header: "none", footer: "none", pageMarginTop: 20, pageMarginBottom: 20,
            pageMarginLeft: 40, pageMarginRight: 40, minLastJustification: 0,
            breaks: consistentScale ? "auto" : "encoded", adjustPageWidth: false } : {}),
        });
        if (!toolkit.loadData(xml))
          throw new Error("Unable to render this score");
        if (broadcastFit && toolkit.getPageCount() === 1) {
          const probe = new DOMParser().parseFromString(toolkit.renderToSVG(1), "image/svg+xml");
          if (probe.querySelectorAll(".system").length === 1) {
            // Do not stretch a sparse one-line exercise into tiny notes. Trim
            // its natural width, then magnify the entire staff to fit the frame.
            toolkit.setOptions({ minLastJustification: 1 });
            toolkit.redoLayout();
          }
        }
        if (!cancelled) {
          const count = toolkit.getPageCount();

          const rendered: string[] = [];
          let measureIndex = 0;
          let systemCount = 0;
          // Practice scores form one continuous document, including long books'
          // studies that exceed a single engraving page. Cursor indices stay global.
          for (const pageNumber of suppliedXml
            ? Array.from({ length: count }, (_, i) => i + 1)
            : [page]) {
            const raw = toolkit.renderToSVG(pageNumber);
            const doc = new DOMParser().parseFromString(raw, "image/svg+xml");
            systemCount += doc.querySelectorAll('.system').length;
            doc.querySelectorAll(".measure").forEach((element) => {
              const measure = score.measures[measureIndex++];
              if (measure) element.setAttribute("data-start-beat", String(measure.startTick / score.ppq));
            });
            doc.querySelectorAll(".note").forEach((element) => {
              const info = noteInfo.get(element.id);
              if (!info) return;
              element.setAttribute("data-pitch", String(info.pitch));
              element.setAttribute("data-beat", String(info.beat));
              element.setAttribute("data-hand", info.hand);
              element.setAttribute("data-note-name", info.name);
            });
            doc
              .querySelectorAll("script,foreignObject")
              .forEach((n) => n.remove());
            doc.querySelectorAll("*").forEach((n) =>
              Array.from(n.attributes).forEach((a) => {
                if (
                  a.name.startsWith("on") ||
                  (/href$/i.test(a.name) && !a.value.startsWith("#"))
                )
                  n.removeAttribute(a.name);
              }),
            );
            rendered.push(
              new XMLSerializer().serializeToString(doc.documentElement),
            );
          }
          const value={key,svg:rendered.join(""),single:systemCount===1,pages:suppliedXml?1:count};
          engraving.current=value;
          destroy?.();destroy=undefined;
          // Presentation waits only; MIDI and battle state never await engraving.
          await display(value);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        destroy?.();
        destroy = undefined;
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
      destroy?.();
      destroy=undefined;
    };
  }, [identity, pending, url, suppliedXml, page, compact, fixedScale, scale, availableWidth, fitWidth, hideTitle, broadcastFit, consistentScale]);
  useLayoutEffect(()=>{
    if (!broadcastFit && (!singleSystem || !(enlargeSingle || fitWidth))) return;
    const pages=container.current?.querySelectorAll<SVGSVGElement>(':scope > svg');
    for (const page of pages ?? []) {
      // Freeze the nested viewport before cropping only empty paper.
      const width=parseFloat(page.getAttribute('width')??'');
      const height=parseFloat(page.getAttribute('height')??'');
      if (!(width>0&&height>0)) continue;
      const inner=page.querySelector<SVGSVGElement>('svg.definition-scale');
      inner?.setAttribute('width',String(width));inner?.setAttribute('height',String(height));
      page.setAttribute('viewBox',`0 0 ${width} ${height}`);
      const bounds=page.getBBox();
      if (!(bounds.width>0&&bounds.height>0)) continue;
      const pad=12;
      page.setAttribute('viewBox',`${bounds.x-pad} ${bounds.y-pad} ${bounds.width+pad*2} ${bounds.height+pad*2}`);
      page.setAttribute('width',String(bounds.width+pad*2));
      page.setAttribute('height',String(bounds.height+pad*2));
    }
  },[svg,enlargeSingle,fitWidth,singleSystem,broadcastFit]);
  useEffect(()=>{
    if (!onDisplayedZoom) return;
    const page=container.current?.querySelector<SVGSVGElement>(':scope > svg');
    if (!page) return;
    const report=()=>{
      const natural=parseFloat(page.getAttribute('width')??'');
      if(natural>0) onDisplayedZoom(Math.round(100*(fixedScale?scale:38)/engravingScale*page.getBoundingClientRect().width/natural));
    };
    const observer=new ResizeObserver(report);observer.observe(page);report();
    return()=>observer.disconnect();
  },[svg,scale,fixedScale,engravingScale,onDisplayedZoom]);
  useScoreFollow(container, broadcastFit ? "" : svg, fresh?activeMeasure:lastCursor.current.measure, {...followOptions, fitSingleSystem: enlargeSingle}, fresh?activeBeat:lastCursor.current.beat);
  useBroadcastLayout(container, svg, broadcastFit, fresh?activeMeasure:lastCursor.current.measure, followOptions.enabled);
  useLayoutEffect(() => {
    if(!fresh)return;
    const measures = container.current?.querySelectorAll(".measure");
    measures?.forEach((measure, i) => {
      measure.classList.toggle("sight-active-measure", i === activeMeasure);

    });
  }, [svg, activeMeasure, fresh]);
  useLayoutEffect(() => {
    if(!fresh)return;
    container.current
      ?.querySelectorAll(".note[data-pitch]")
      .forEach((element) => {
        const pitch = Number(element.getAttribute("data-pitch"));
        const beat = Number(element.getAttribute("data-beat"));
        const hand = element.getAttribute("data-hand");
        // A tied continuation shares the feedback of its original attack.
        const candidates = noteFeedback?.filter(
          (n) =>
            n.pitch === pitch &&
            n.hand === hand &&
            n.beat <= beat + 0.000001 &&
            n.beat + n.beats > beat + 0.000001,
        );
        const feedback = candidates?.sort((a, b) => b.beat - a.beat)[0];
        for (const status of ["correct", "incorrect", "current"])
          element.classList.toggle(
            `practice-note-${status}`,
            feedback?.status === status,
          );
        element.setAttribute(
          "aria-label",
          `${element.getAttribute("data-note-name")}: ${feedback?.status ?? "unplayed"}`,
        );
      });
  }, [svg, noteFeedback, fresh]);
  return (
    <div ref={frame}>
      {error ? (
        <p role="alert">{error}</p>
      ) : svg ? (
        <div
          ref={container}
          data-score-presentation={presentationId?rendered.identity:undefined}
          data-score-pending={!fresh}
          className={`notation${broadcastFit ? " notation-broadcast" : ""}${fixedScale ? " notation-consistent-scale" : ""}${displaySize ? " notation-user-sized" : ""}${fitWidth ? " notation-fit-width" : ""}${enlargeSingle ? ' notation-auto-single' : ''}`}
          role="img"
          aria-label={`Music notation, page ${page}`}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <p role="status">Loading notation…</p>
      )}
      {pages > 1 && (
        <div className="row">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous score page
          </button>
          <span>
            {page} / {pages}
          </span>
          <button disabled={page === pages} onClick={() => setPage(page + 1)}>
            Next score page
          </button>
        </div>
      )}
    </div>
  );
}
export function ScoreCursor({
  noteId,
  children,
}: {
  noteId?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const n = noteId
      ? ref.current?.querySelector(`[id="${CSS.escape(noteId)}"]`)
      : null;
    n?.classList.add("highlighted");
    return () => n?.classList.remove("highlighted");
  }, [noteId]);
  return <div ref={ref}>{children}</div>;
}
export const MeasureHighlighter = ScoreCursor;
export const MusicScore = NotationViewer;


