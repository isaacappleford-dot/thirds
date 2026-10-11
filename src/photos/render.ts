import { getLook } from '../config/looks';
import { composeInto } from '../frames/compose';
import { photoSizeForBudget } from '../frames/layout';
import { canvasToBlob, createCanvas, releaseCanvas, scaledCopy } from '../image/canvas';
import { decodeToCanvas } from '../image/decode';
import { maxPixels, maxTextureSize } from '../image/limits';
import { HALATION_SIZE, LookRenderer } from '../looks/renderer';
import type { Recipe } from '../looks/recipe';
import { isNeutral } from '../looks/uniforms';

export interface RenderOptions {
  /** Longest side of the framed output; omit for full resolution within limits. */
  maxSide?: number;
}

/**
 * Render a photo with a recipe: decode → (downscale) → WebGL look → frame +
 * stamp. The same code path serves thumbnails, the viewer and full exports.
 * Every intermediate canvas and the GL context are released before returning.
 */
export async function renderRecipe(original: Blob, recipe: Recipe, takenAt: Date, opts: RenderOptions = {}): Promise<HTMLCanvasElement> {
  const decoded = await decodeToCanvas(original);
  let src: HTMLCanvasElement = decoded.canvas;
  let hal: HTMLCanvasElement | null = null;
  let renderer: LookRenderer | null = null;
  try {
    const limitSide = Math.min(opts.maxSide ?? Infinity, maxTextureSize());
    const size = photoSizeForBudget(recipe.frame, decoded.width, decoded.height, maxPixels(), limitSide);
    if (size.width < decoded.width * 0.9) {
      src = scaledCopy(decoded.canvas, Math.max(size.width, size.height));
      releaseCanvas(decoded.canvas);
    }
    const look = getLook(recipe.look).params;
    let graded: HTMLCanvasElement = src;
    if (!isNeutral(look) && recipe.intensity > 0) {
      hal = scaledCopy(src, HALATION_SIZE);
      renderer = new LookRenderer();
      renderer.setSource(src, hal);
      // The GPU has its own copy now; free the CPU canvases before allocating the output.
      releaseCanvas(src);
      releaseCanvas(hal);
      renderer.render(look, recipe.intensity, recipe.seed, size.width, size.height);
      graded = renderer.canvas;
    }
    const out = createCanvas(1, 1);
    await composeInto(out, { graded, photoW: size.width, photoH: size.height, recipe, takenAt });
    return out;
  } finally {
    renderer?.dispose();
    releaseCanvas(hal);
    releaseCanvas(src);
    releaseCanvas(decoded.canvas);
  }
}

export async function renderToBlob(original: Blob, recipe: Recipe, takenAt: Date, opts: RenderOptions & { quality?: number } = {}): Promise<Blob> {
  const c = await renderRecipe(original, recipe, takenAt, opts);
  try {
    return await canvasToBlob(c, 'image/jpeg', opts.quality ?? 0.92);
  } finally {
    releaseCanvas(c);
  }
}

export const THUMB_SIDE = 480;
export const DISPLAY_SIDE = 1800;

/** Grid thumbnail + viewer image for a recipe, rendered once at save time. */
export async function renderPreviews(original: Blob, recipe: Recipe, takenAt: Date): Promise<{ thumb: Blob; display: Blob }> {
  const display = await renderRecipe(original, recipe, takenAt, { maxSide: DISPLAY_SIDE });
  try {
    const t = scaledCopy(display, THUMB_SIDE);
    try {
      const [thumbBlob, displayBlob] = await Promise.all([canvasToBlob(t, 'image/jpeg', 0.82), canvasToBlob(display, 'image/jpeg', 0.88)]);
      return { thumb: thumbBlob, display: displayBlob };
    } finally {
      releaseCanvas(t);
    }
  } finally {
    releaseCanvas(display);
  }
}
