import { canvasToBlob, context2d, createCanvas, releaseCanvas } from '../image/canvas';
import { photoLimit } from '../image/limits';

export interface CaptureOptions {
  video: HTMLVideoElement;
  track: MediaStreamTrack | null;
  /** Mirror the still (front camera), matching the preview. */
  mirrored: boolean;
  /** Digital zoom crop factor (1 = none). */
  digitalZoom: number;
  /** Try ImageCapture.takePhoto() for a full-sensor still (Chrome Android). */
  preferImageCapture: boolean;
}

export interface Captured {
  blob: Blob;
  width: number;
  height: number;
  method: 'image-capture' | 'frame';
}

interface ImageCaptureLike {
  takePhoto(settings?: { imageWidth?: number; imageHeight?: number }): Promise<Blob>;
  getPhotoCapabilities?(): Promise<{ imageWidth?: { max?: number }; imageHeight?: { max?: number } }>;
}
type ImageCaptureCtor = new (track: MediaStreamTrack) => ImageCaptureLike;

/** Set to false for the rest of the session after takePhoto() misbehaves once. */
let imageCaptureReliable = true;

export function imageCaptureAvailable(): boolean {
  return imageCaptureReliable && typeof (window as unknown as { ImageCapture?: unknown }).ImageCapture === 'function';
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Draw `src` (sw×sh) into a new canvas with zoom crop, mirroring and size limits applied. */
function renderStill(src: CanvasImageSource, sw: number, sh: number, mirrored: boolean, zoom: number): HTMLCanvasElement {
  const cw = sw / Math.max(1, zoom);
  const ch = sh / Math.max(1, zoom);
  const fit = photoLimit(Math.round(cw), Math.round(ch));
  const canvas = createCanvas(fit.width, fit.height);
  const ctx = context2d(canvas);
  ctx.imageSmoothingQuality = 'high';
  if (mirrored) {
    ctx.translate(fit.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, fit.width, fit.height);
  return canvas;
}

async function viaImageCapture(o: CaptureOptions): Promise<Captured | null> {
  if (!o.preferImageCapture || !o.track || !imageCaptureAvailable() || o.track.readyState !== 'live') return null;
  try {
    const IC = (window as unknown as { ImageCapture: ImageCaptureCtor }).ImageCapture;
    const ic = new IC(o.track);
    let settings: { imageWidth?: number; imageHeight?: number } | undefined;
    try {
      const pc = await withTimeout(ic.getPhotoCapabilities?.() ?? Promise.resolve(undefined), 1500);
      if (pc?.imageWidth?.max && pc?.imageHeight?.max) settings = { imageWidth: pc.imageWidth.max, imageHeight: pc.imageHeight.max };
    } catch {
      /* use defaults */
    }
    const blob = await withTimeout(ic.takePhoto(settings), 5000);
    const bmp = await createImageBitmap(blob);
    // Reject stills whose orientation disagrees with the preview (some devices
    // return sensor-oriented JPEGs); the frame grab is always consistent.
    const videoPortrait = o.video.videoHeight > o.video.videoWidth;
    const photoPortrait = bmp.height > bmp.width;
    if (videoPortrait !== photoPortrait || bmp.width < o.video.videoWidth) {
      bmp.close();
      imageCaptureReliable = false;
      return null;
    }
    const fit = photoLimit(bmp.width, bmp.height);
    if (!o.mirrored && o.digitalZoom <= 1 && fit.scale === 1 && blob.type === 'image/jpeg') {
      const out = { blob, width: bmp.width, height: bmp.height, method: 'image-capture' as const };
      bmp.close();
      return out;
    }
    const canvas = renderStill(bmp, bmp.width, bmp.height, o.mirrored, o.digitalZoom);
    bmp.close();
    try {
      return { blob: await canvasToBlob(canvas, 'image/jpeg', 0.95), width: canvas.width, height: canvas.height, method: 'image-capture' };
    } finally {
      releaseCanvas(canvas);
    }
  } catch {
    imageCaptureReliable = false;
    return null;
  }
}

/** Grab the current video frame at the stream's native resolution. */
async function viaFrame(o: CaptureOptions): Promise<Captured> {
  const w = o.video.videoWidth;
  const h = o.video.videoHeight;
  if (!w || !h) throw new Error('The camera isn’t ready yet.');
  const canvas = renderStill(o.video, w, h, o.mirrored, o.digitalZoom);
  try {
    return { blob: await canvasToBlob(canvas, 'image/jpeg', 0.95), width: canvas.width, height: canvas.height, method: 'frame' };
  } finally {
    releaseCanvas(canvas);
  }
}

export async function capturePhoto(o: CaptureOptions): Promise<Captured> {
  return (await viaImageCapture(o)) ?? viaFrame(o);
}
