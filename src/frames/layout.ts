/** Frame geometry. Everything is relative to the photo's short side so previews match exports. Pure. */
import type { FrameId } from '../looks/recipe';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FrameLayout {
  width: number;
  height: number;
  photo: Rect;
  /** Paper sheet (Paper frame only). */
  paper: Rect | null;
}

export const FRAME_SPEC = {
  gallery: { side: 0.065, top: 0.065, bottom: 0.105, keylineGap: 0.012, keylineWidth: 0.0016 },
  paper: { side: 0.055, top: 0.055, bottom: 0.085, margin: 0.075 },
  stamp: { size: 0.045, inset: 0.05 },
} as const;

export function frameLayout(frame: FrameId, pw: number, ph: number): FrameLayout {
  const s = Math.min(pw, ph);
  const r = (v: number) => Math.round(v * s);
  if (frame === 'gallery') {
    const g = FRAME_SPEC.gallery;
    const photo = { x: r(g.side), y: r(g.top), w: pw, h: ph };
    return { width: pw + 2 * r(g.side), height: ph + r(g.top) + r(g.bottom), photo, paper: null };
  }
  if (frame === 'paper') {
    const p = FRAME_SPEC.paper;
    const m = r(p.margin);
    const paper = { x: m, y: m, w: pw + 2 * r(p.side), h: ph + r(p.top) + r(p.bottom) };
    const photo = { x: m + r(p.side), y: m + r(p.top), w: pw, h: ph };
    return { width: paper.w + 2 * m, height: paper.h + 2 * m, photo, paper };
  }
  return { width: pw, height: ph, photo: { x: 0, y: 0, w: pw, h: ph }, paper: null };
}

/**
 * The photo size to render so the framed output fits a pixel budget
 * (iOS canvas limit) and a max side (texture limit).
 */
export function photoSizeForBudget(frame: FrameId, pw: number, ph: number, maxPixels: number, maxSide: number): { width: number; height: number } {
  const l = frameLayout(frame, pw, ph);
  let s = Math.min(1, Math.sqrt(maxPixels / (l.width * l.height)), maxSide / Math.max(l.width, l.height));
  for (let i = 0; i < 20; i++) {
    const w = Math.max(1, Math.floor(pw * s));
    const h = Math.max(1, Math.floor(ph * s));
    const o = frameLayout(frame, w, h);
    if (o.width * o.height <= maxPixels && Math.max(o.width, o.height) <= maxSide) return { width: w, height: h };
    s *= 0.995;
  }
  return { width: Math.floor(pw * s), height: Math.floor(ph * s) };
}

/** Where the date stamp goes: bottom-right inside the photo. */
export function stampPlacement(photo: Rect) {
  const s = Math.min(photo.w, photo.h);
  const size = Math.max(8, s * FRAME_SPEC.stamp.size);
  const inset = s * FRAME_SPEC.stamp.inset;
  return { size, right: photo.x + photo.w - inset, baseline: photo.y + photo.h - inset };
}
