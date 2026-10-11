import { boxToZoomed, clipBox, mirrorBox, pointFromZoomed } from '../guidance/geometry';
import type { Box, Point } from '../guidance/types';

/**
 * Coordinate spaces:
 *   raw     – the camera's video frame as delivered (never mirrored), 0..1
 *   display – what the user sees and what gets captured: raw, cropped by any
 *             digital zoom, then mirrored for the front camera.
 * All composition logic runs in display space.
 */
export interface SpaceInfo {
  mirrored: boolean;
  digitalZoom: number;
}

export function rawBoxToDisplay(b: Box, s: SpaceInfo): Box | null {
  let out = clipBox(boxToZoomed(b, s.digitalZoom));
  if (out.w <= 0 || out.h <= 0) return null;
  if (s.mirrored) out = mirrorBox(out);
  return out;
}

/** Box in the digitally-zoomed (but not mirrored) frame, e.g. the exposure sample. */
export function displayBoxToSample(b: Box, s: SpaceInfo): Box {
  return s.mirrored ? mirrorBox(b) : b;
}

export function displayPointToRaw(p: Point, s: SpaceInfo): Point {
  const unmirrored = s.mirrored ? { x: 1 - p.x, y: p.y } : p;
  return pointFromZoomed(unmirrored, s.digitalZoom);
}

export function rawPointToDisplay(p: Point, s: SpaceInfo): Point {
  const z = s.digitalZoom > 1 ? { x: (p.x - 0.5) * s.digitalZoom + 0.5, y: (p.y - 0.5) * s.digitalZoom + 0.5 } : p;
  return s.mirrored ? { x: 1 - z.x, y: z.y } : z;
}
