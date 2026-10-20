export type ScoreBounds = { top: number; bottom: number; left: number; right: number };

export function unionBounds(bounds: ScoreBounds[]): ScoreBounds {
  return {
    top: Math.min(...bounds.map(b => b.top)), bottom: Math.max(...bounds.map(b => b.bottom)),
    left: Math.min(...bounds.map(b => b.left)), right: Math.max(...bounds.map(b => b.right)),
  };
}

function transformedBounds(b: ScoreBounds, m: DOMMatrix): ScoreBounds {
  const points = [[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]]
    .map(([x, y]) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }));
  return { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
    top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) };
}

// Cache these local ink bounds at engraving/font/viewport changes, never per
// MIDI note. Unlike a staff box, these include glyphs, beams, text and strokes.
export function measureNotationInk(system: SVGGraphicsElement): ScoreBounds {
  const inverse = system.getScreenCTM()!.inverse();
  const boxes: ScoreBounds[] = [];
  for (const node of system.querySelectorAll<SVGGraphicsElement>("path,use,text,line,polyline,polygon,rect,circle,ellipse,image")) {
    if (node.closest("defs,clipPath,mask")) continue;
    const style = getComputedStyle(node);
    if (style.display === "none") continue;
    const box = node.getBBox(), matrix = node.getScreenCTM();
    if (!matrix || (!box.width && !box.height)) continue;
    // SVG getBBox() omits strokes in Chromium; the options overload is not
    // consistently supported. Conservatively include joins and end caps.
    const stroke = style.stroke !== "none" ? (parseFloat(style.strokeWidth) || 0) / 2 : 0;
    const path = node.getAttribute("d") ?? "";
    const hasJoins = ["polygon", "polyline"].includes(node.tagName) ||
      (node.tagName === "path" && (path.match(/[LlHhVvCcSsQqTtAa]/g)?.length ?? 0) > (path.match(/[Mm]/g)?.length ?? 0));
    const pad = stroke * (hasJoins && style.strokeLinejoin === "miter" ? Math.max(1, parseFloat(style.strokeMiterlimit) || 4) : 1);
    boxes.push(transformedBounds({ left: box.x - pad, right: box.x + box.width + pad,
      top: box.y - pad, bottom: box.y + box.height + pad }, inverse.multiply(matrix)));
  }
  if (boxes.length) return unionBounds(boxes);
  const box = system.getBBox();
  return { left: box.x, right: box.x + box.width, top: box.y, bottom: box.y + box.height };
}

export function screenNotationInk(system: SVGGraphicsElement, local: ScoreBounds): ScoreBounds {
  return transformedBounds(local, system.getScreenCTM()!);
}
