import { context2d, createCanvas, releaseCanvas } from '../image/canvas';
import { asset } from '../lib/platform';
import type { Recipe } from '../looks/recipe';
import { formatStamp } from './dateStamp';
import { FRAME_SPEC, frameLayout, stampPlacement, type Rect } from './layout';

const STAMP_FONT = 'ThirdsSeg7';
let fontReady: Promise<boolean> | null = null;

/** Load the bundled DSEG7 font (OFL) for the date stamp. Never fetched from a third party. */
export function ensureStampFont(): Promise<boolean> {
  if (!fontReady) {
    fontReady = (async () => {
      try {
        const face = new FontFace(STAMP_FONT, `url(${asset('fonts/DSEG7Classic-Bold.woff2')}) format("woff2")`);
        await face.load();
        document.fonts.add(face);
        return true;
      } catch {
        return false;
      }
    })();
  }
  return fontReady;
}

/** Deterministic noise for the paper texture. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

const paperTiles = new Map<number, { mottle: HTMLCanvasElement; fibre: HTMLCanvasElement }>();

function paperTextures(seed: number) {
  const key = seed % 7; // a handful of variants is plenty
  let t = paperTiles.get(key);
  if (t) return t;
  const r = rng(1000 + key);
  // Soft mottling, stretched over the whole sheet.
  const mottle = createCanvas(64, 64);
  const mctx = context2d(mottle);
  const img = mctx.createImageData(64, 64);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 200 + r() * 55;
    img.data[i] = v;
    img.data[i + 1] = v - 4;
    img.data[i + 2] = v - 12;
    img.data[i + 3] = 255;
  }
  mctx.putImageData(img, 0, 0);
  // Fine fibres, tiled at a size relative to the sheet.
  const fibre = createCanvas(256, 256);
  const fctx = context2d(fibre);
  fctx.fillStyle = '#fff';
  fctx.fillRect(0, 0, 256, 256);
  fctx.lineCap = 'round';
  for (let i = 0; i < 420; i++) {
    const x = r() * 256;
    const y = r() * 256;
    const a = r() * Math.PI;
    const len = 2 + r() * 9;
    fctx.strokeStyle = `rgba(${120 + r() * 60},${110 + r() * 50},${90 + r() * 40},${0.08 + r() * 0.18})`;
    fctx.lineWidth = 0.5 + r() * 0.8;
    fctx.beginPath();
    fctx.moveTo(x, y);
    fctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    fctx.stroke();
  }
  t = { mottle, fibre };
  paperTiles.set(key, t);
  return t;
}

function drawPaper(ctx: CanvasRenderingContext2D, W: number, H: number, paper: Rect, seed: number) {
  const s = Math.min(paper.w, paper.h);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#c9c7c3');
  bg.addColorStop(1, '#b5b3ae');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = s * 0.035;
  ctx.shadowOffsetY = s * 0.01;
  ctx.fillStyle = '#f2ece0';
  ctx.fillRect(paper.x, paper.y, paper.w, paper.h);
  ctx.restore();

  const { mottle, fibre } = paperTextures(seed);
  ctx.save();
  ctx.beginPath();
  ctx.rect(paper.x, paper.y, paper.w, paper.h);
  ctx.clip();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.14;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(mottle, paper.x, paper.y, paper.w, paper.h);
  ctx.globalAlpha = 0.9;
  const pat = ctx.createPattern(fibre, 'repeat');
  if (pat) {
    const k = s / 1400; // fibre tile size relative to the sheet
    pat.setTransform?.(new DOMMatrix([k, 0, 0, k, paper.x, paper.y]));
    ctx.fillStyle = pat;
    ctx.fillRect(paper.x, paper.y, paper.w, paper.h);
  }
  ctx.restore();
}

/** Seven-segment date stamp with a soft orange glow. DSEG7 has no apostrophe, so we draw that tick ourselves. */
export function drawStamp(ctx: CanvasRenderingContext2D, text: string, right: number, baseline: number, size: number, fontOk: boolean) {
  ctx.save();
  ctx.font = `${size}px ${fontOk ? STAMP_FONT : 'monospace'}`;
  ctx.textBaseline = 'alphabetic';
  const parts = text.split('');
  const tickW = size * 0.42;
  const widths = parts.map((ch) => (ch === "'" ? tickW : ctx.measureText(ch).width));
  const total = widths.reduce((a, b) => a + b, 0);
  const draw = () => {
    let x = right - total;
    parts.forEach((ch, i) => {
      if (ch === "'") {
        // A short slanted segment near the top, like a camera back's year tick.
        const h = size * 0.32;
        const w = size * 0.11;
        const top = baseline - size * 0.98;
        const cx = x + tickW * 0.45;
        ctx.beginPath();
        ctx.moveTo(cx + w * 0.6, top);
        ctx.lineTo(cx + w * 1.6, top);
        ctx.lineTo(cx + w * 0.6, top + h);
        ctx.lineTo(cx - w * 0.4, top + h);
        ctx.closePath();
        ctx.fill();
      } else if (ch !== ' ') {
        ctx.fillText(ch, x, baseline);
      }
      x += widths[i];
    });
  };
  ctx.shadowColor = 'rgba(255, 106, 20, 0.85)';
  ctx.shadowBlur = size * 0.45;
  ctx.fillStyle = '#ff9a3d';
  draw();
  ctx.shadowBlur = size * 0.12;
  ctx.shadowColor = 'rgba(255, 140, 50, 0.9)';
  draw();
  ctx.shadowColor = 'transparent';
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255, 200, 140, 0.35)';
  draw();
  ctx.restore();
}

export interface ComposeInput {
  /** The graded photo (e.g. the WebGL canvas), drawn at photoW×photoH. */
  graded: CanvasImageSource;
  photoW: number;
  photoH: number;
  recipe: Recipe;
  takenAt: Date;
}

/**
 * Draw frame + photo + stamp into `out` (resized to fit). Used for both the
 * live preview and the full-resolution export.
 */
export async function composeInto(out: HTMLCanvasElement, input: ComposeInput): Promise<HTMLCanvasElement> {
  const { recipe } = input;
  const fontOk = recipe.stamp ? await ensureStampFont() : false;
  const layout = frameLayout(recipe.frame, input.photoW, input.photoH);
  if (out.width !== layout.width || out.height !== layout.height) {
    out.width = layout.width;
    out.height = layout.height;
  }
  const ctx = context2d(out);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  if (recipe.frame === 'gallery') {
    ctx.fillStyle = '#fbfbf9';
    ctx.fillRect(0, 0, layout.width, layout.height);
  } else if (recipe.frame === 'paper' && layout.paper) {
    drawPaper(ctx, layout.width, layout.height, layout.paper, recipe.seed);
  }

  const p = layout.photo;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(input.graded, p.x, p.y, p.w, p.h);

  if (recipe.frame === 'gallery' && recipe.keyline) {
    const s = Math.min(p.w, p.h);
    const g = FRAME_SPEC.gallery;
    const lw = Math.max(1, s * g.keylineWidth);
    const gap = s * g.keylineGap;
    ctx.strokeStyle = 'rgba(30, 30, 30, 0.75)';
    ctx.lineWidth = lw;
    ctx.strokeRect(p.x - gap, p.y - gap, p.w + 2 * gap, p.h + 2 * gap);
  }

  if (recipe.stamp) {
    const st = stampPlacement(p);
    ctx.save();
    ctx.beginPath();
    ctx.rect(p.x, p.y, p.w, p.h);
    ctx.clip();
    drawStamp(ctx, formatStamp(input.takenAt, recipe.stampFormat), st.right, st.baseline, st.size, fontOk);
    ctx.restore();
  }
  return out;
}

export async function compose(input: ComposeInput): Promise<HTMLCanvasElement> {
  const c = createCanvas(1, 1);
  try {
    return await composeInto(c, input);
  } catch (e) {
    releaseCanvas(c);
    throw e;
  }
}
