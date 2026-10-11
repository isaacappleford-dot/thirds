/** Tone curves → lookup tables. Pure; unit-tested. */

export type CurvePoints = readonly (readonly [number, number])[];

export const IDENTITY: CurvePoints = [
  [0, 0],
  [1, 1],
];

/**
 * Monotone cubic interpolation (Fritsch–Carlson) through control points, so
 * curves never overshoot or reverse. Returns `size` samples in 0..1.
 */
export function sampleCurve(points: CurvePoints, size = 256): Float32Array {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  const n = pts.length;
  const out = new Float32Array(size);
  if (n === 0) {
    for (let i = 0; i < size; i++) out[i] = i / (size - 1);
    return out;
  }
  if (n === 1) return out.fill(pts[0][1]);

  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const d: number[] = [];
  const m: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / Math.max(1e-9, xs[i + 1] - xs[i]));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }

  let seg = 0;
  for (let k = 0; k < size; k++) {
    const x = k / (size - 1);
    let y: number;
    if (x <= xs[0]) y = ys[0];
    else if (x >= xs[n - 1]) y = ys[n - 1];
    else {
      while (seg < n - 2 && x > xs[seg + 1]) seg++;
      const h = xs[seg + 1] - xs[seg];
      const t = (x - xs[seg]) / h;
      const t2 = t * t;
      const t3 = t2 * t;
      y =
        (2 * t3 - 3 * t2 + 1) * ys[seg] +
        (t3 - 2 * t2 + t) * h * m[seg] +
        (-2 * t3 + 3 * t2) * ys[seg + 1] +
        (t3 - t2) * h * m[seg + 1];
    }
    out[k] = Math.min(1, Math.max(0, y));
  }
  return out;
}

/** Apply a sampled curve to a value (linear interpolation between samples). */
export function applyCurve(curve: Float32Array, v: number): number {
  const x = Math.min(1, Math.max(0, v)) * (curve.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  return i >= curve.length - 1 ? curve[curve.length - 1] : curve[i] * (1 - f) + curve[i + 1] * f;
}

export interface ChannelCurves {
  master?: CurvePoints;
  r?: CurvePoints;
  g?: CurvePoints;
  b?: CurvePoints;
}

/**
 * 256×1 RGBA8 LUT: each channel is channelCurve(masterCurve(x)).
 * The shader looks up R in .r, G in .g and B in .b.
 */
export function buildLUT(c: ChannelCurves, size = 256): Uint8Array {
  const master = sampleCurve(c.master ?? IDENTITY, size);
  const ch = [c.r, c.g, c.b].map((p) => sampleCurve(p ?? IDENTITY, size));
  const lut = new Uint8Array(size * 4);
  for (let i = 0; i < size; i++) {
    const v = master[i];
    for (let k = 0; k < 3; k++) lut[i * 4 + k] = Math.round(applyCurve(ch[k], v) * 255);
    lut[i * 4 + 3] = 255;
  }
  return lut;
}
