import { describe, expect, it } from 'vitest';
import { salientRegion } from './saliency';

const W = 64;
const H = 48;

describe('salientRegion', () => {
  it('returns null for a flat frame', () => {
    expect(salientRegion(new Uint8Array(W * H).fill(128), W, H)).toBeNull();
  });

  it('finds a high-contrast object', () => {
    const l = new Uint8Array(W * H).fill(40);
    for (let y = 10; y < 22; y++) for (let x = 36; x < 50; x++) l[y * W + x] = 230;
    const b = salientRegion(l, W, H)!;
    expect(b).not.toBeNull();
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    expect(cx).toBeGreaterThan(36 / W);
    expect(cx).toBeLessThan(50 / W);
    expect(cy).toBeGreaterThan(8 / H);
    expect(cy).toBeLessThan(24 / H);
  });
});
