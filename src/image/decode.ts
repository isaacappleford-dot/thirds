import { canvasToBlob, context2d, createCanvas, releaseCanvas } from './canvas';
import { photoLimit } from './limits';
import { orientationTransform, orientedSize, withExifOrientation } from './orientation';

let autoRotates: Promise<boolean> | null = null;

/**
 * Does this browser apply EXIF orientation when decoding <img>? (Safari 13.4+
 * and Chrome 81+ do.) Tested once with a 2×1 JPEG tagged "rotate 90°".
 */
export function browserAppliesExifOrientation(): Promise<boolean> {
  if (!autoRotates) {
    autoRotates = (async () => {
      try {
        const c = createCanvas(2, 1);
        context2d(c).fillRect(0, 0, 2, 1);
        const jpeg = new Uint8Array(await (await canvasToBlob(c, 'image/jpeg', 0.5)).arrayBuffer());
        releaseCanvas(c);
        const tagged = new Blob([withExifOrientation(jpeg, 6) as BlobPart], { type: 'image/jpeg' });
        const img = await loadImage(tagged);
        return img.naturalWidth === 1 && img.naturalHeight === 2;
      } catch {
        return true;
      }
    })();
  }
  return autoRotates;
}

export async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode().catch(
      () =>
        new Promise<void>((resolve, reject) => {
          if (img.complete && img.naturalWidth) return resolve();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('This image format isn’t supported on this device.'));
        }),
    );
    if (!img.naturalWidth) throw new Error('This image format isn’t supported on this device.');
    return img;
  } finally {
    // Safe to revoke once decoded.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

async function readOrientation(blob: Blob): Promise<number> {
  try {
    const exifr = await import('exifr');
    return (await exifr.orientation(blob)) ?? 1;
  } catch {
    return 1;
  }
}

export interface Decoded {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** True if pixels differ from the input file (rotated or downscaled). */
  changed: boolean;
}

/**
 * Decode any image the browser understands into an upright canvas within the
 * size limits (≤16 MP on iOS, ≤ MAX_TEXTURE_SIZE per side).
 */
export async function decodeToCanvas(blob: Blob): Promise<Decoded> {
  const [img, autoRotate] = await Promise.all([loadImage(blob), browserAppliesExifOrientation()]);
  const orientation = autoRotate ? 1 : await readOrientation(blob);
  const upright = orientedSize(img.naturalWidth, img.naturalHeight, orientation);
  const fit = photoLimit(upright.width, upright.height);
  const canvas = createCanvas(fit.width, fit.height);
  const ctx = context2d(canvas);
  ctx.imageSmoothingQuality = 'high';
  const s = fit.scale;
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  ctx.setTransform(...orientationTransform(orientation, dw, dh));
  ctx.drawImage(img, 0, 0, dw, dh);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  img.src = '';
  return { canvas, width: fit.width, height: fit.height, changed: orientation !== 1 || fit.scale < 1 };
}

/** Capture date from EXIF (DateTimeOriginal/CreateDate), if present. */
export async function exifDate(blob: Blob): Promise<Date | null> {
  try {
    const exifr = await import('exifr');
    const data = await exifr.parse(blob, ['DateTimeOriginal', 'CreateDate', 'ModifyDate']);
    const d: unknown = data?.DateTimeOriginal ?? data?.CreateDate ?? data?.ModifyDate;
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  } catch {
    return null;
  }
}

const STORABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Normalise an imported/captured file for the gallery: keep the original bytes
 * when they are already upright and within limits, otherwise re-encode.
 */
export async function normalizePhoto(blob: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const d = await decodeToCanvas(blob);
  try {
    if (!d.changed && STORABLE.has(blob.type)) {
      // The browser already shows it upright; keep the original file.
      const orientation = await readOrientation(blob);
      if (orientation === 1) return { blob, width: d.width, height: d.height };
    }
    const out = await canvasToBlob(d.canvas, 'image/jpeg', 0.95);
    return { blob: out, width: d.width, height: d.height };
  } finally {
    releaseCanvas(d.canvas);
  }
}
