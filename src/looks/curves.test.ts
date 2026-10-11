import { describe, expect, it } from 'vitest';
import { applyCurve, buildLUT, IDENTITY, sampleCurve } from './curves';

describe('sampleCurve', () => {
  it('identity is a straight line', () => {
    const c = sampleCurve(IDENTITY);
    for (let i = 0; i < 256; i++) expect(c[i]).toBeCloseTo(i / 255, 5);
  });

  it('passes through control points', () => {
    const c = sampleCurve([
      [0, 0.1],
      [0.5, 0.6],
      [1, 0.9],
    ], 101);
    expect(c[0]).toBeCloseTo(0.1);
    expect(c[50]).toBeCloseTo(0.6);
    expect(c[100]).toBeCloseTo(0.9);
  });

  it('is monotonic for monotonic points (no overshoot)', () => {
    const c = sampleCurve([
      [0, 0],
      [0.1, 0.02],
      [0.2, 0.5],
      [0.8, 0.52],
      [1, 1],
    ]);
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThanOrEqual(c[i - 1] - 1e-6);
  });

  it('clamps outside the first/last points', () => {
    const c = sampleCurve([
      [0.2, 0.3],
      [0.8, 0.7],
    ], 11);
    expect(c[0]).toBeCloseTo(0.3);
    expect(c[10]).toBeCloseTo(0.7);
  });
});

describe('buildLUT', () => {
  it('identity LUT maps i → i', () => {
    const lut = buildLUT({});
    for (const i of [0, 64, 128, 255]) expect(lut[i * 4]).toBe(i);
  });

  it('composes master then channel', () => {
    const lut = buildLUT({ master: [[0, 0.2], [1, 1]], r: [[0, 0], [1, 0.5]] });
    // x=0 → master 0.2 → red curve halves it → 0.1
    expect(lut[0] / 255).toBeCloseTo(0.1, 2);
    expect(lut[1] / 255).toBeCloseTo(0.2, 2);
  });

  it('applyCurve interpolates', () => {
    expect(applyCurve(sampleCurve(IDENTITY, 3), 0.25)).toBeCloseTo(0.25);
  });
});
