import { GUIDANCE } from '../config/guidance';
import { area, clamp, frameDistance } from './geometry';
import type { Box, Candidate, Point } from './types';

export type TargetMode = 'thirds' | 'eyeline' | 'center' | 'flatlay';

export interface Target {
  /** The point of the subject we try to place (eyes, head or centre). */
  anchor: Point;
  /** Where that point should go. */
  point: Point;
  mode: TargetMode;
}

const T = GUIDANCE.target;
const THIRDS = [1 / 3, 2 / 3];

/** The point of a subject that composition should place. */
export function anchorOf(c: Candidate): Point {
  const b = c.box;
  if (c.kind === 'face') return c.eyes ?? { x: b.x + b.w / 2, y: b.y + b.h * T.eyesInFaceBox };
  if (c.kind === 'person') return { x: b.x + b.w / 2, y: b.y + b.h * T.headInPersonBox };
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

export function fillsFrame(b: Box): boolean {
  return area(b) > T.fillArea || b.w > T.fillSide || b.h > T.fillSide;
}

/** Nearest of two values, but stick with `prev` unless the other is clearly closer. */
function stickyNearest(v: number, options: number[], prev: number | undefined, margin: number): number {
  let best = options[0];
  for (const o of options) if (Math.abs(o - v) < Math.abs(best - v)) best = o;
  if (prev !== undefined && options.includes(prev) && Math.abs(prev - v) - Math.abs(best - v) < margin) {
    return prev;
  }
  return best;
}

/** Nearest thirds intersection to `p`, with hysteresis against `prev`. */
export function nearestIntersection(p: Point, aspect: number, prev?: Point): Point {
  const points: Point[] = [];
  for (const x of THIRDS) for (const y of THIRDS) points.push({ x, y });
  let best = points[0];
  for (const q of points) if (frameDistance(p, q, aspect) < frameDistance(p, best, aspect)) best = q;
  if (prev) {
    const same = points.find((q) => Math.abs(q.x - prev.x) < 1e-6 && Math.abs(q.y - prev.y) < 1e-6);
    if (same && frameDistance(p, same, aspect) - frameDistance(p, best, aspect) < T.switchMargin) return same;
  }
  return best;
}

/**
 * Shift the target so that, once the anchor reaches it, the whole subject box
 * still fits in the frame (when it can). Prevents "eyes on the third" from
 * pushing a tall subject off the bottom.
 */
function keepInFrame(box: Box, anchor: Point, point: Point): Point {
  const pad = T.edgePadding;
  let sx = point.x - anchor.x;
  let sy = point.y - anchor.y;
  if (box.w <= 1 - 2 * pad) sx = clamp(sx, pad - box.x, 1 - pad - (box.x + box.w));
  if (box.h <= 1 - 2 * pad) sy = clamp(sy, pad - box.y, 1 - pad - (box.y + box.h));
  return { x: anchor.x + sx, y: anchor.y + sy };
}

export function computeTarget(subject: Candidate, aspect: number, prev?: Target, flatLay = false): Target {
  const anchor = anchorOf(subject);
  const b = subject.box;

  if (flatLay) return { anchor: { x: b.x + b.w / 2, y: b.y + b.h / 2 }, point: { x: 0.5, y: 0.5 }, mode: 'flatlay' };

  if (subject.kind === 'face' || subject.kind === 'person') {
    // Eyes (or head) on the upper third line.
    const closeUp = subject.kind === 'face' && b.w > T.faceCloseUpWidth;
    const x = closeUp
      ? 0.5
      : fillsFrame(b)
        ? 0.5
        : stickyNearest(anchor.x, THIRDS, prev?.mode === 'eyeline' ? prev.point.x : undefined, T.switchMargin);
    const point = keepInFrame(b, anchor, { x, y: 1 / 3 });
    return { anchor, point, mode: 'eyeline' };
  }

  if (fillsFrame(b)) {
    return { anchor, point: { x: 0.5, y: 0.5 }, mode: 'center' };
  }

  const prevPoint = prev?.mode === 'thirds' ? prev.point : undefined;
  const point = keepInFrame(b, anchor, nearestIntersection(anchor, aspect, prevPoint));
  return { anchor, point, mode: 'thirds' };
}
