import { isIOS } from '../lib/platform';

/**
 * Canvas size limits. iOS Safari fails (silently or with "canvas memory"
 * errors) on very large canvases, so every canvas stays at or below 16 MP.
 * We use the same cap elsewhere: it keeps memory predictable on mid-range
 * Android phones too, and it's still a sharp 4900×3266 photo.
 */
export const MAX_PIXELS = 16_000_000;
export const MAX_PIXELS_IOS = 16_000_000;

export function maxPixels(): number {
  return isIOS ? MAX_PIXELS_IOS : MAX_PIXELS;
}

export interface Size {
  width: number;
  height: number;
}

/** Largest size with the same aspect that fits both a pixel budget and a max side. */
export function fitWithin(width: number, height: number, maxPx: number, maxSide = Infinity): Size & { scale: number } {
  let scale = 1;
  if (width * height > maxPx) scale = Math.sqrt(maxPx / (width * height));
  const side = Math.max(width, height) * scale;
  if (side > maxSide) scale *= maxSide / side;
  // Floor, then nudge down if rounding pushed us over the budget.
  let w = Math.max(1, Math.floor(width * scale));
  let h = Math.max(1, Math.floor(height * scale));
  while (w * h > maxPx) {
    w -= 1;
    h = Math.max(1, Math.floor((w * height) / width));
  }
  return { width: w, height: h, scale: w / width };
}

/** Fit a size inside a box (contain), never upscaling. */
export function fitInside(width: number, height: number, boxW: number, boxH: number): Size {
  const s = Math.min(1, boxW / width, boxH / height);
  return { width: Math.max(1, Math.round(width * s)), height: Math.max(1, Math.round(height * s)) };
}

let cachedMaxTexture: number | null = null;

/** gl.MAX_TEXTURE_SIZE (and renderbuffer/viewport limits), probed once. */
export function maxTextureSize(): number {
  if (cachedMaxTexture !== null) return cachedMaxTexture;
  let v = 4096;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const gl = c.getContext('webgl2');
    if (gl) {
      const dims = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
      v = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), dims[0], dims[1]);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    c.width = c.height = 0;
  } catch {
    /* keep default */
  }
  cachedMaxTexture = v;
  return v;
}

/** The size every photo is normalised to on import/capture. */
export function photoLimit(width: number, height: number) {
  return fitWithin(width, height, maxPixels(), maxTextureSize());
}
