/** Canvas helpers that keep iOS Safari's canvas memory budget in check. */

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  return c;
}

/**
 * Free a canvas' backing store immediately. Safari keeps canvas memory until
 * GC otherwise and throws "Total canvas memory use exceeds the maximum limit".
 */
export function releaseCanvas(c: HTMLCanvasElement | null | undefined) {
  if (!c) return;
  c.width = 0;
  c.height = 0;
}

export function canvasToBlob(c: HTMLCanvasElement, type = 'image/jpeg', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), type, quality);
  });
}

export function context2d(c: HTMLCanvasElement, opts?: CanvasRenderingContext2DSettings): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', opts);
  if (!ctx) throw new Error('2D canvas unavailable');
  return ctx;
}

/** Downscaled copy (contain within maxSide), high-quality smoothing. */
export function scaledCopy(src: CanvasImageSource & { width: number; height: number }, maxSide: number): HTMLCanvasElement {
  const s = Math.min(1, maxSide / Math.max(src.width, src.height));
  let w = src.width;
  let h = src.height;
  let current: CanvasImageSource = src;
  let temp: HTMLCanvasElement | null = null;
  const targetW = src.width * s;
  // Halve in steps for a smoother result than one big jump.
  while (targetW < w / 2 && w > 2) {
    w = Math.round(w / 2);
    h = Math.round(h / 2);
    const next = createCanvas(w, h);
    const ctx = context2d(next);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(current, 0, 0, w, h);
    releaseCanvas(temp);
    temp = next;
    current = next;
  }
  const out = createCanvas(src.width * s, src.height * s);
  const ctx = context2d(out);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(current, 0, 0, out.width, out.height);
  releaseCanvas(temp);
  return out;
}
