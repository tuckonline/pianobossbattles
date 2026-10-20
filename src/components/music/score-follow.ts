import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

export type ScoreFollowOptions = {
  enabled: boolean;
  topPercent: number;
  bottomPercent: number;
  visibleSystems?: 1 | 2;
  fitSingleSystem?: boolean;
  fitViewport?: boolean;
};
export type VerticalBounds = { top: number; bottom: number };

// Return a single destination, not a continuously moving playhead.
export function systemScrollDelta(
  current: VerticalBounds,
  next: VerticalBounds | undefined,
  safe: VerticalBounds,
  anticipate: boolean,
) {
  const height = safe.bottom - safe.top;
  if (height <= 0) return 0;
  if (anticipate && next && next.bottom - current.top <= height) {
    // At the marked end-of-line region, lift the pair into reading position
    // even if the next line is technically visible already.
    return current.top - safe.top;
  }
  if (current.top < safe.top || current.bottom > safe.bottom)
    return current.top - safe.top;
  return 0;
}

export function useScoreFollow(
  container: RefObject<HTMLDivElement | null>,
  rendered: string,
  activeMeasure: number | undefined,
  options: ScoreFollowOptions,
  activeBeat?: number,
) {
  const latest = useRef({ activeMeasure, options, activeBeat });
  latest.current = { activeMeasure, options, activeBeat };
  const follow = useRef<((force?: boolean) => void) | null>(null);
  useLayoutEffect(() => {
    const root = container.current;
    if (!root || !rendered) return;
    let animation = 0;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let fitKey = "";
    let lastCue = "";
    const triggerBeats = new Map<Element, number>();
    const pages = Array.from(root.querySelectorAll<SVGSVGElement>(":scope > svg"));
    const widths = pages.map((svg) => svg.style.width);
    const restoreWidths = () => pages.forEach((svg, i) => { svg.style.width = widths[i]; });
    const cancel = () => {
      if (animation) cancelAnimationFrame(animation);
      animation = 0;
    };
    const run = (force = true) => {
      const { activeMeasure: index, options: settings, activeBeat: beat } = latest.current;
      if (disposed) return;
      const systems = Array.from(root.querySelectorAll<SVGGraphicsElement>(".system"));
      if (!systems.length) return;
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const height = viewport?.height ?? window.innerHeight;
      const scoreBounds = root.getBoundingClientRect();
      let top = viewportTop + height * settings.topPercent / 100;
      let bottom = viewportTop + height * (1 - settings.bottomPercent / 100);
      // Only fixed/sticky UI that actually intersects the score's width counts.
      for (const el of document.querySelectorAll<HTMLElement>("header, [data-score-occlusion]")) {
        const style = getComputedStyle(el);
        if (!["fixed", "sticky"].includes(style.position)) continue;
        const r = el.getBoundingClientRect();
        if (r.right <= scoreBounds.left || r.left >= scoreBounds.right) continue;
        if (r.top <= top && r.bottom > top) top = r.bottom;
        if (r.top < bottom && r.bottom >= viewportTop + height) bottom = r.top;
      }
      const safe = { top: top + 6, bottom: bottom - 24 };
      const fitSystems = settings.visibleSystems ?? 2;
      const panel = root.closest(".sight-score") ?? root;
      const fixedPadding = Math.max(0, root.getBoundingClientRect().top - panel.getBoundingClientRect().top);
      const nextFitKey = `${root.clientWidth}:${top}:${safe.bottom}:${fixedPadding}:${fitSystems}:${settings.fitSingleSystem}:${settings.fitViewport}`;
      if (fitKey !== nextFitKey) {
        fitKey = nextFitKey;
        restoreWidths();
        const bounds = systems.map((s) => s.getBoundingClientRect());
        const firstPage = pages[0]?.getBoundingClientRect();
        const tallestPair = Math.max(...bounds.map((b, i) =>
          (bounds[i + fitSystems - 1]?.bottom ?? b.bottom) - b.top), 1);
        const openingSpan = firstPage ?
          (bounds[fitSystems - 1]?.bottom ?? bounds[0].bottom) - firstPage.top : tallestPair;
        // Single-line scores already fill the width after trimming empty paper.
        // Cap by the whole SVG height too, so its title/markings fit on arrival.
        // Multi-line engraving stays unchanged unless OBS needs room for a pair.
        const fitHeight = settings.fitViewport || settings.fitSingleSystem || settings.topPercent || settings.bottomPercent;
        const sizes = pages.map((svg) => svg.getBoundingClientRect().width);
        // The engraver has a minimum page width; narrow phone viewports can be
        // smaller even after wrapping. Fit that paper without horizontal clipping.
        const widthScale = Math.min(1, ...sizes.map(width => root.clientWidth / Math.max(1, width)));
        const scale = Math.min(widthScale, fitHeight ? Math.min(
            Math.max(1, safe.bottom - safe.top - 2) / tallestPair,
            Math.max(1, safe.bottom - top - fixedPadding - 2) /
              (settings.fitSingleSystem && firstPage ? firstPage.height : openingSpan)) : 1);
        if (scale < 1) {
          pages.forEach((svg, i) => { svg.style.width = `${sizes[i] * scale}px`; });
        }
        triggerBeats.clear();
      }
      // Fit independently of playback/following. Starting, stopping and saving
      // must not change the reading size, and fitting alone must never scroll.
      if (!settings.enabled || index === undefined) {
        cancel();
        lastCue = "";
        return;
      }
      const measures = Array.from(root.querySelectorAll<SVGGraphicsElement>(".measure"));
      const measure = measures[index];
      if (!measure) return;
      const system = measure.closest<SVGGraphicsElement>(".system") ?? measure;
      const next = systems[systems.indexOf(system) + 1];
      const boundary = next?.querySelector(".measure")?.getAttribute("data-start-beat");
      const nextBeat = boundary == null ? NaN : Number(boundary);
      if (!triggerBeats.has(system)) {
        const notes = Array.from(system.querySelectorAll<SVGGraphicsElement>(".note[data-beat]"))
          .map((note) => {
            const bounds = (note.querySelector(".notehead") ?? note).getBoundingClientRect();
            return { beat: Number(note.getAttribute("data-beat")), x: bounds.left + bounds.width / 2 };
          });
        const first = Math.min(...notes.map((n) => n.x));
        const last = Math.max(...notes.map((n) => n.x));
        const threshold = first + (last - first) * 0.92;
        triggerBeats.set(system, Math.min(...notes.filter((n) => n.x >= threshold).map((n) => n.beat)));
      }
      const anticipate = beat !== undefined && Number.isFinite(nextBeat) &&
        beat >= triggerBeats.get(system)! && beat < nextBeat;
      const cue = `${index}:${anticipate}`;
      // Beat updates detect the threshold, but never restart an in-flight scroll.
      if (!force && cue === lastCue) return;
      lastCue = cue;
      cancel();
      const currentBounds = system.getBoundingClientRect();
      const nextBounds = next?.getBoundingClientRect();
      let delta = systemScrollDelta(currentBounds, nextBounds, safe, anticipate);
      if (index === 0 && !anticipate) {
        // Start at the score card's top edge, including its title, even when
        // the first staff is already visible. Never leave practice controls above it.
        const panel = root.closest(".sight-score") ?? root;
        delta = panel.getBoundingClientRect().top - top;
        // A shallow viewport must still contain all notes of the first system.
        delta = Math.max(delta, currentBounds.bottom - safe.bottom);
      }
      if (Math.abs(delta) < 2) return;
      const start = window.scrollY;
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const target = Math.max(0, Math.min(max, start + delta));
      if (Math.abs(target - start) < 2) return;
      const move = (y: number) => window.scrollTo({ top: y, left: window.scrollX, behavior: "instant" });
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
          typeof requestAnimationFrame !== "function" || document.hidden) {
        move(target);
        return;
      }
      const began = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - began) / 250);
        const eased = 1 - Math.pow(1 - t, 3);
        move(start + (target - start) * eased);
        if (t < 1) animation = requestAnimationFrame(step);
        else animation = 0;
      };
      animation = requestAnimationFrame(step);
    };
    follow.current = run;
    const resized = () => {
      triggerBeats.clear();
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(run, 100);
    };
    let observedWidth = root.getBoundingClientRect().width;
    let observedHeight = root.getBoundingClientRect().height;
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(() => {
      const r = root.getBoundingClientRect();
      if (Math.abs(r.width - observedWidth) < 1 && Math.abs(r.height - observedHeight) < 1) return;
      observedWidth = r.width;
      observedHeight = r.height;
      resized();
    }) : undefined;
    observer?.observe(root);
    window.addEventListener("resize", resized);
    window.visualViewport?.addEventListener("resize", resized);
    // Manual movement wins; resume at the next measure, never steal focus.
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    run();
    return () => {
      disposed = true;
      cancel();
      clearTimeout(resizeTimer);
      observer?.disconnect();
      restoreWidths();
      window.removeEventListener("resize", resized);
      window.visualViewport?.removeEventListener("resize", resized);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      follow.current = null;
    };
  }, [container, rendered]);
  useLayoutEffect(() => { follow.current?.(); }, [activeMeasure, options.enabled, options.topPercent, options.bottomPercent, options.visibleSystems, options.fitSingleSystem, options.fitViewport]);
  useEffect(() => { follow.current?.(false); }, [activeBeat]);
}
