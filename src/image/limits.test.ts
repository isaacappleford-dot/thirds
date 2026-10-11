import { describe, expect, it } from 'vitest';
import { fitInside, fitWithin } from './limits';

describe('fitWithin', () => {
  it('leaves small images alone', () => {
    expect(fitWithin(4032, 3024, 16_000_000)).toMatchObject({ width: 4032, height: 3024, scale: 1 });
  });

  it('downscales a 48 MP photo under 16 MP keeping aspect', () => {
    const r = fitWithin(8064, 6048, 16_000_000);
    expect(r.width * r.height).toBeLessThanOrEqual(16_000_000);
    expect(r.width / r.height).toBeCloseTo(8064 / 6048, 2);
  });

  it('respects a max side (texture size)', () => {
    const r = fitWithin(12000, 1000, 16_000_000, 8192);
    expect(r.width).toBeLessThanOrEqual(8192);
    expect(r.height).toBeLessThanOrEqual(1000);
  });
});

describe('fitInside', () => {
  it('contains without upscaling', () => {
    expect(fitInside(4000, 3000, 400, 400)).toEqual({ width: 400, height: 300 });
    expect(fitInside(100, 50, 400, 400)).toEqual({ width: 100, height: 50 });
  });
});
