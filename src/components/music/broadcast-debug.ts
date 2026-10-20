import { unionBounds, type ScoreBounds } from "./notation-bounds";

// Local developer aid only: /obs/recording?scoreDebug=1. Never shown on the
// published OBS source, and never involved in fitting or note evaluation.
export function createBroadcastDebug() {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) ||
      new URLSearchParams(location.search).get("scoreDebug") !== "1") return;
  const layer = document.createElement("div");
  layer.dataset.scoreDebug = "true";
  layer.style.cssText = "position:fixed;inset:0;z-index:10000;pointer-events:none;font:12px monospace;";
  document.body.append(layer);
  return {
    render(area: ScoreBounds, safe: ScoreBounds, measured: ScoreBounds[], final: ScoreBounds[], scale: number) {
      const ink = unionBounds(final);
      const overflow = { top: Math.max(0, safe.top - ink.top), bottom: Math.max(0, ink.bottom - safe.bottom),
        left: Math.max(0, safe.left - ink.left), right: Math.max(0, ink.right - safe.right) };
      layer.replaceChildren();
      const draw = (b: ScoreBounds, color: string, dashed = false) => {
        const box = document.createElement("div");
        box.style.cssText = `position:absolute;box-sizing:border-box;left:${b.left}px;top:${b.top}px;width:${b.right-b.left}px;height:${b.bottom-b.top}px;border:2px ${dashed?"dashed":"solid"} ${color};`;
        layer.append(box);
      };
      draw(area, "#308aff"); draw(safe, "#c88b00", true);
      final.forEach(b => draw(b, "#10a060"));
      if (Object.values(overflow).some(n => n > .5)) draw(ink, "#f03030", true);
      const metrics = { measured, area, safe, final, scale, padding: {
        top: safe.top-area.top, bottom: area.bottom-safe.bottom, left: safe.left-area.left, right: area.right-safe.right,
      }, overflow };
      const label = document.createElement("pre");
      label.style.cssText = "position:absolute;top:0;left:0;max-height:190px;overflow:hidden;margin:0;padding:6px;color:white;background:#091221e8;font:11px monospace;";
      const compact = (value: unknown) => JSON.stringify(value, (_key, v) => typeof v === "number" ? Math.round(v*100)/100 : v);
      label.textContent = `SCORE FIT DEBUG · blue=region · gold=padding · green=ink · red=overflow\nMeasured: ${compact(measured)}\nRegion: ${compact(area)}\nScaled: ${compact(final)}\nPadding: ${compact(metrics.padding)} · Scale: ${scale.toFixed(4)}\nOverflow: ${compact(overflow)}`;
      layer.dataset.metrics = JSON.stringify(metrics);
      layer.append(label);
    },
    dispose() { layer.remove(); },
  };
}
