/** CPU-side conversion of look parameters to shader uniforms. Pure; unit-tested. */
import type { LookParams } from '../config/looks';

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const LUM = [0.2126, 0.7152, 0.0722];

/** A colour's chroma offset (colour minus its luminance), scaled. */
export function tintOffset(hex: string, amount: number): [number, number, number] {
  const c = hexToRgb(hex);
  const l = c[0] * LUM[0] + c[1] * LUM[1] + c[2] * LUM[2];
  return [(c[0] - l) * amount, (c[1] - l) * amount, (c[2] - l) * amount];
}

/**
 * White-balance gains (applied in linear light). Temperature shifts red vs
 * blue, tint shifts green vs magenta; gains are normalised so the green
 * channel's brightness is preserved.
 */
export function whiteBalanceGains(temperature: number, tint: number): [number, number, number] {
  const r = 1 + 0.22 * temperature + 0.06 * tint;
  const g = 1 - 0.12 * tint;
  const b = 1 - 0.22 * temperature + 0.06 * tint;
  const norm = r * LUM[0] + g * LUM[1] + b * LUM[2];
  return [r / norm, g / norm, b / norm];
}

/**
 * Grain is defined relative to the image so a small preview and the full
 * export look alike: `cellsAcross` grains span the short side. When a grain
 * cell is smaller than an output pixel (small previews), many grains average
 * into one pixel, so the visible amplitude drops by the cell size.
 */
export function grainScale(outShortSide: number, size: number, amount: number) {
  const cellsAcross = 1400 / Math.max(0.2, size);
  const cellPx = outShortSide / cellsAcross;
  return { cellPx: Math.max(1, cellPx), amp: amount * Math.min(1, cellPx) };
}

export function isNeutral(p: LookParams): boolean {
  return (
    p.temperature === 0 &&
    p.tint === 0 &&
    p.exposure === 0 &&
    Object.keys(p.curves).length === 0 &&
    p.saturation === 1 &&
    p.vibrance === 0 &&
    p.hueShift === 0 &&
    !p.mono &&
    p.split.shadowAmount === 0 &&
    p.split.highlightAmount === 0 &&
    p.fade === 0 &&
    p.halation.amount === 0 &&
    p.grain.amount === 0 &&
    p.vignette.amount === 0
  );
}
