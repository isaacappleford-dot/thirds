import { GUIDANCE } from '../config/guidance';
import type { Box } from './types';

const S = GUIDANCE.saliency;

/**
 * Fallback subject when the detectors find nothing: the centre-weighted
 * high-contrast region of a small luma image. Gradient energy × centre
 * Gaussian, blurred, then flood-filled from the peak.
 */
export function salientRegion(luma: Uint8Array, width: number, height: number): Box | null {
  const n = width * height;
  const energy = new Float32Array(n);
  let mean = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx = Math.abs(luma[i + 1] - luma[i - 1]);
      const gy = Math.abs(luma[i + width] - luma[i - width]);
      energy[i] = gx + gy;
      mean += gx + gy;
    }
  }
  mean /= n;
  const blurred = boxBlur(boxBlur(energy, width, height), width, height);
  const aspect = width / height;
  const sig2 = 2 * S.centerSigma * S.centerSigma;
  let peak = 0;
  let peakI = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = ((x + 0.5) / width - 0.5) * aspect;
      const dy = (y + 0.5) / height - 0.5;
      const i = y * width + x;
      blurred[i] *= Math.exp(-(dx * dx + dy * dy) / sig2);
      if (blurred[i] > peak) {
        peak = blurred[i];
        peakI = i;
      }
    }
  }
  if (peakI < 0 || mean < S.minPeak * 0.25 || peak < S.minPeak) return null;

  const threshold = peak * S.regionThreshold;
  const seen = new Uint8Array(n);
  const stack = [peakI];
  seen[peakI] = 1;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % width;
    const y = (i / width) | 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    for (const j of [i - 1, i + 1, i - width, i + width]) {
      if (j < 0 || j >= n || seen[j]) continue;
      if ((j === i - 1 && x === 0) || (j === i + 1 && x === width - 1)) continue;
      seen[j] = 1;
      if (blurred[j] >= threshold) stack.push(j);
    }
  }
  return { x: minX / width, y: minY / height, w: (maxX - minX + 1) / width, h: (maxY - minY + 1) / height };
}

function boxBlur(src: Float32Array, w: number, h: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let c = 0;
      for (let k = -1; k <= 1; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < w) {
          s += src[y * w + xx];
          c++;
        }
      }
      tmp[y * w + x] = s / c;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let c = 0;
      for (let k = -1; k <= 1; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < h) {
          s += tmp[yy * w + x];
          c++;
        }
      }
      out[y * w + x] = s / c;
    }
  }
  return out;
}
