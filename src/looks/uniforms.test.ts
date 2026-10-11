import { describe, expect, it } from 'vitest';
import { LOOKS, NEUTRAL } from '../config/looks';
import { grainScale, hexToRgb, isNeutral, tintOffset, whiteBalanceGains } from './uniforms';

describe('look uniforms', () => {
  it('parses hex colours', () => {
    expect(hexToRgb('#ff8000')).toEqual([1, 128 / 255, 0]);
    expect(hexToRgb('#fff')).toEqual([1, 1, 1]);
  });

  it('neutral grey has no tint offset', () => {
    const o = tintOffset('#808080', 1);
    o.forEach((v) => expect(Math.abs(v)).toBeLessThan(1e-6));
  });

  it('neutral white balance is identity; warm boosts red over blue', () => {
    whiteBalanceGains(0, 0).forEach((g) => expect(g).toBeCloseTo(1));
    const [r, , b] = whiteBalanceGains(0.5, 0);
    expect(r).toBeGreaterThan(b);
  });

  it('grain amplitude scales down when grains are smaller than a pixel', () => {
    const big = grainScale(3000, 1, 0.1);
    const small = grainScale(700, 1, 0.1);
    expect(big.amp).toBeCloseTo(0.1);
    expect(small.amp).toBeLessThan(0.1);
    expect(small.cellPx).toBe(1);
    expect(big.cellPx).toBeGreaterThan(2);
  });

  it('only Original is neutral', () => {
    expect(isNeutral(NEUTRAL)).toBe(true);
    expect(LOOKS.filter((l) => isNeutral(l.params)).map((l) => l.id)).toEqual(['original']);
  });

  it('has the six looks with original names', () => {
    expect(LOOKS.map((l) => l.name)).toEqual(['Original', 'Sunday', 'Harbor', 'Neon', 'Attic', 'Ink']);
  });
});
