/**
 * Generated test scenes (no external images, nothing to license). Used for
 * demo mode on desktops without a camera and as sample photos for Looks.
 */
import { canvasToBlob, context2d, createCanvas, releaseCanvas } from '../image/canvas';

export type SceneId = 'golden-hour' | 'portrait' | 'night-street';

export const SAMPLE_SCENES: { id: SceneId; label: string }[] = [
  { id: 'golden-hour', label: 'Golden hour' },
  { id: 'portrait', label: 'Portrait' },
  { id: 'night-street', label: 'Night street' },
];

/** Deterministic pseudo-random numbers so scenes look identical every time. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ridge(ctx: CanvasRenderingContext2D, w: number, h: number, base: number, amp: number, seed: number, fill: string | CanvasGradient, offset = 0) {
  const r = rng(seed);
  const phases = [r() * 6, r() * 6, r() * 6];
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += w / 120) {
    const u = (x + offset) / w;
    const y = base + amp * (Math.sin(u * 3.1 + phases[0]) * 0.5 + Math.sin(u * 7.3 + phases[1]) * 0.3 + Math.sin(u * 17 + phases[2]) * 0.12);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Golden-hour lake with a figure. `t` (seconds) pans the view for the demo camera. */
export function drawGoldenHour(ctx: CanvasRenderingContext2D, w: number, h: number, t = 0) {
  const pan = Math.sin(t * 0.25) * w * 0.18;
  const bob = Math.sin(t * 0.6) * h * 0.01;
  const horizon = h * 0.58;

  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#1d2b4f');
  sky.addColorStop(0.45, '#7a5a7c');
  sky.addColorStop(0.8, '#f0a35e');
  sky.addColorStop(1, '#ffd38a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);

  const sunX = w * 0.62 - pan * 0.3;
  const sunY = horizon - h * 0.07;
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, w * 0.5);
  glow.addColorStop(0, 'rgba(255,240,200,0.95)');
  glow.addColorStop(0.08, 'rgba(255,214,140,0.8)');
  glow.addColorStop(0.35, 'rgba(255,170,90,0.25)');
  glow.addColorStop(1, 'rgba(255,150,80,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff6e0';
  ctx.beginPath();
  ctx.arc(sunX, sunY, w * 0.035, 0, Math.PI * 2);
  ctx.fill();

  ridge(ctx, w, h, horizon - h * 0.08, h * 0.05, 3, 'rgba(110,80,110,0.85)', -pan * 0.4);
  ridge(ctx, w, h, horizon - h * 0.03, h * 0.04, 7, 'rgba(70,50,75,0.95)', -pan * 0.6);

  const water = ctx.createLinearGradient(0, horizon, 0, h);
  water.addColorStop(0, '#e9a066');
  water.addColorStop(0.3, '#7d5a6e');
  water.addColorStop(1, '#1f2235');
  ctx.fillStyle = water;
  ctx.fillRect(0, horizon, w, h - horizon);
  // Sun path on the water.
  const r = rng(11);
  for (let i = 0; i < 70; i++) {
    const y = horizon + (h - horizon) * Math.pow(r(), 1.6);
    const spread = (y - horizon) * 0.35 + w * 0.01;
    const x = sunX + (r() - 0.5) * spread;
    ctx.fillStyle = `rgba(255,${200 + r() * 40},${140 + r() * 60},${0.25 + r() * 0.5})`;
    ctx.fillRect(x, y, w * (0.01 + r() * 0.04), h * 0.0025);
  }

  // Shore and a figure standing on it.
  ridge(ctx, w, h, h * 0.86, h * 0.03, 21, '#15131c', -pan);
  const fx = w * 0.42 - pan;
  const fy = h * 0.86 + bob;
  const fh = h * 0.2;
  ctx.fillStyle = '#0d0c12';
  ctx.beginPath();
  ctx.ellipse(fx, fy - fh * 0.92, fh * 0.075, fh * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(fx - fh * 0.13, fy - fh * 0.78);
  ctx.quadraticCurveTo(fx, fy - fh * 0.85, fx + fh * 0.13, fy - fh * 0.78);
  ctx.lineTo(fx + fh * 0.1, fy - fh * 0.3);
  ctx.lineTo(fx + fh * 0.07, fy);
  ctx.lineTo(fx - fh * 0.07, fy);
  ctx.lineTo(fx - fh * 0.1, fy - fh * 0.3);
  ctx.closePath();
  ctx.fill();
  // A tree to the right.
  const tx = w * 0.85 - pan;
  ctx.fillRect(tx - w * 0.006, h * 0.6, w * 0.012, h * 0.28);
  ctx.beginPath();
  ctx.ellipse(tx, h * 0.6, w * 0.08, h * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawPortrait(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#2f4a3a');
  bg.addColorStop(0.6, '#6b7d4f');
  bg.addColorStop(1, '#c8a46a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  // Bokeh.
  const r = rng(5);
  for (let i = 0; i < 46; i++) {
    const x = r() * w;
    const y = r() * h * 0.8;
    const rad = w * (0.02 + r() * 0.07);
    const g = ctx.createRadialGradient(x, y, rad * 0.2, x, y, rad);
    const warm = r() > 0.5;
    g.addColorStop(0, warm ? 'rgba(255,220,150,0.45)' : 'rgba(200,255,210,0.35)');
    g.addColorStop(0.85, warm ? 'rgba(255,200,120,0.25)' : 'rgba(170,230,190,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  const cx = w * 0.62;
  const cy = h * 0.38;
  const s = Math.min(w, h);
  // Shoulders / sweater.
  const sweater = ctx.createLinearGradient(0, h * 0.6, 0, h);
  sweater.addColorStop(0, '#b4553f');
  sweater.addColorStop(1, '#5c2a22');
  ctx.fillStyle = sweater;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.42, h);
  ctx.quadraticCurveTo(cx - s * 0.4, cy + s * 0.36, cx, cy + s * 0.32);
  ctx.quadraticCurveTo(cx + s * 0.4, cy + s * 0.36, cx + s * 0.42, h);
  ctx.closePath();
  ctx.fill();
  // Neck.
  ctx.fillStyle = '#c98f6d';
  ctx.fillRect(cx - s * 0.06, cy + s * 0.12, s * 0.12, s * 0.2);
  // Hair behind.
  ctx.fillStyle = '#2a1a14';
  ctx.beginPath();
  ctx.ellipse(cx, cy - s * 0.02, s * 0.2, s * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  // Face.
  const skin = ctx.createRadialGradient(cx - s * 0.05, cy - s * 0.04, s * 0.02, cx, cy, s * 0.2);
  skin.addColorStop(0, '#f2c4a2');
  skin.addColorStop(0.7, '#d9a07c');
  skin.addColorStop(1, '#b97c5c');
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.01, s * 0.15, s * 0.19, 0, 0, Math.PI * 2);
  ctx.fill();
  // Fringe.
  ctx.fillStyle = '#2a1a14';
  ctx.beginPath();
  ctx.ellipse(cx + s * 0.02, cy - s * 0.15, s * 0.17, s * 0.07, -0.15, 0, Math.PI * 2);
  ctx.fill();
  // Eyes, brows, mouth.
  ctx.fillStyle = '#3b2a22';
  for (const dx of [-0.06, 0.06]) {
    ctx.beginPath();
    ctx.ellipse(cx + s * dx, cy - s * 0.01, s * 0.018, s * 0.011, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx + s * dx - s * 0.03, cy - s * 0.05, s * 0.06, s * 0.008);
  }
  ctx.strokeStyle = '#a1534a';
  ctx.lineWidth = s * 0.012;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.07, s * 0.045, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
}

export function drawNightStreet(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#07080d';
  ctx.fillRect(0, 0, w, h);
  const r = rng(9);
  // Buildings.
  for (let i = 0; i < 9; i++) {
    const bw = w * (0.08 + r() * 0.12);
    const bx = r() * w;
    const bh = h * (0.3 + r() * 0.4);
    ctx.fillStyle = `rgb(${14 + r() * 12},${15 + r() * 12},${24 + r() * 16})`;
    ctx.fillRect(bx, h * 0.68 - bh, bw, bh);
    for (let k = 0; k < 18; k++) {
      if (r() > 0.55) continue;
      ctx.fillStyle = r() > 0.5 ? 'rgba(255,200,120,0.75)' : 'rgba(150,200,255,0.5)';
      ctx.fillRect(bx + r() * bw * 0.85, h * 0.68 - bh + r() * bh * 0.9, w * 0.012, h * 0.01);
    }
  }
  // Neon signs.
  const neon = (x: number, y: number, ww: number, hh: number, color: string) => {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = Math.min(w, h) * 0.04;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.min(w, h) * 0.01;
    ctx.strokeRect(x, y, ww, hh);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + ww * 0.15, y + hh * 0.42, ww * 0.7, hh * 0.16);
    ctx.restore();
  };
  neon(w * 0.12, h * 0.3, w * 0.22, h * 0.07, '#ff3d9a');
  neon(w * 0.6, h * 0.22, w * 0.26, h * 0.08, '#34e1ff');
  // Street lamps.
  for (const lx of [0.3, 0.78]) {
    ctx.fillStyle = '#1a1c24';
    ctx.fillRect(w * lx, h * 0.38, w * 0.008, h * 0.32);
    const g = ctx.createRadialGradient(w * lx, h * 0.38, 0, w * lx, h * 0.38, w * 0.12);
    g.addColorStop(0, 'rgba(255,255,240,1)');
    g.addColorStop(0.12, 'rgba(255,220,160,0.8)');
    g.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // Wet street with reflections.
  const street = ctx.createLinearGradient(0, h * 0.68, 0, h);
  street.addColorStop(0, '#11131b');
  street.addColorStop(1, '#05060a');
  ctx.fillStyle = street;
  ctx.fillRect(0, h * 0.68, w, h * 0.32);
  for (const [x, c] of [
    [0.23, 'rgba(255,61,154,0.35)'],
    [0.73, 'rgba(52,225,255,0.3)'],
    [0.3, 'rgba(255,220,160,0.35)'],
    [0.78, 'rgba(255,220,160,0.35)'],
  ] as const) {
    const g = ctx.createLinearGradient(0, h * 0.7, 0, h);
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(w * x - w * 0.04, h * 0.7, w * 0.08, h * 0.3);
  }
  // A cyclist-ish subject: a lit umbrella figure.
  const fx = w * 0.46;
  ctx.fillStyle = '#0b0c10';
  ctx.beginPath();
  ctx.ellipse(fx, h * 0.6, w * 0.035, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e83a3a';
  ctx.beginPath();
  ctx.ellipse(fx, h * 0.5, w * 0.09, h * 0.035, 0, Math.PI, 0);
  ctx.fill();
}

const DRAW: Record<SceneId, (ctx: CanvasRenderingContext2D, w: number, h: number) => void> = {
  'golden-hour': (c, w, h) => drawGoldenHour(c, w, h, 0),
  portrait: drawPortrait,
  'night-street': drawNightStreet,
};

/** Adds faint sensor-like noise so looks/grain have texture to work on. */
function addNoise(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const tile = createCanvas(256, 256);
  const tctx = context2d(tile);
  const img = tctx.createImageData(256, 256);
  const r = rng(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (r() - 0.5) * 30;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 20;
  }
  tctx.putImageData(img, 0, 0);
  ctx.fillStyle = ctx.createPattern(tile, 'repeat')!;
  ctx.fillRect(0, 0, w, h);
  releaseCanvas(tile);
}

/** Render a sample scene to a JPEG blob (portrait 3:4 by default). */
export async function sampleScene(id: SceneId, width = 2400, height = 3200): Promise<Blob> {
  const c = createCanvas(width, height);
  const ctx = context2d(c);
  DRAW[id](ctx, width, height);
  addNoise(ctx, width, height, 42);
  try {
    return await canvasToBlob(c, 'image/jpeg', 0.93);
  } finally {
    releaseCanvas(c);
  }
}
