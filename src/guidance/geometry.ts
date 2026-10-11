import type { Box, Point } from './types';

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const area = (b: Box) => Math.max(0, b.w) * Math.max(0, b.h);
export const center = (b: Box): Point => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

export function contains(b: Box, p: Point): boolean {
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}

export function iou(a: Box, b: Box): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = area(a) + area(b) - inter;
  return union > 0 ? inter / union : 0;
}

export function lerpBox(a: Box, b: Box, t: number): Box {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) };
}

/**
 * Distance between two normalised points measured in units of the frame's
 * short side, so a 0.05 tolerance means the same on portrait and landscape.
 */
export function frameDistance(a: Point, b: Point, aspect: number): number {
  const dx = (a.x - b.x) * aspect;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy) / Math.min(aspect, 1);
}

/** Mirror a box horizontally (raw camera frame ↔ mirrored preview). */
export function mirrorBox(b: Box): Box {
  return { ...b, x: 1 - b.x - b.w };
}

export function mirrorPoint(p: Point): Point {
  return { x: 1 - p.x, y: p.y };
}

/**
 * Map a box from the full sensor frame into a centred digital-zoom crop.
 * zoom = 2 shows the middle half of the frame.
 */
export function boxToZoomed(b: Box, zoom: number): Box {
  if (zoom <= 1) return b;
  return { x: (b.x - 0.5) * zoom + 0.5, y: (b.y - 0.5) * zoom + 0.5, w: b.w * zoom, h: b.h * zoom };
}

export function pointFromZoomed(p: Point, zoom: number): Point {
  if (zoom <= 1) return p;
  return { x: (p.x - 0.5) / zoom + 0.5, y: (p.y - 0.5) / zoom + 0.5 };
}

/** Clip a box to the frame. */
export function clipBox(b: Box): Box {
  const x1 = clamp(b.x, 0, 1);
  const y1 = clamp(b.y, 0, 1);
  const x2 = clamp(b.x + b.w, 0, 1);
  const y2 = clamp(b.y + b.h, 0, 1);
  return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
}
