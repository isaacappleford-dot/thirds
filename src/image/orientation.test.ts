import { describe, expect, it } from 'vitest';
import { orientationTransform, orientedSize, withExifOrientation } from './orientation';

const apply = (m: number[], x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

describe('orientation', () => {
  it('swaps size for rotated orientations', () => {
    expect(orientedSize(400, 300, 6)).toEqual({ width: 300, height: 400 });
    expect(orientedSize(400, 300, 3)).toEqual({ width: 400, height: 300 });
  });

  it('every transform maps the raw image exactly onto the oriented canvas', () => {
    const w = 400;
    const h = 300;
    for (let o = 1; o <= 8; o++) {
      const m = orientationTransform(o, w, h);
      const size = orientedSize(w, h, o);
      const corners = [apply(m, 0, 0), apply(m, w, 0), apply(m, 0, h), apply(m, w, h)];
      const xs = corners.map((c) => c[0]);
      const ys = corners.map((c) => c[1]);
      expect(Math.min(...xs)).toBeCloseTo(0);
      expect(Math.max(...xs)).toBeCloseTo(size.width);
      expect(Math.min(...ys)).toBeCloseTo(0);
      expect(Math.max(...ys)).toBeCloseTo(size.height);
    }
  });

  it('orientation 6 rotates 90° clockwise: raw top-left lands top-right', () => {
    const [x, y] = apply(orientationTransform(6, 400, 300), 0, 0);
    expect([x, y]).toEqual([300, 0]);
  });

  it('writes an APP1 segment after SOI', () => {
    const out = withExifOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 6);
    expect([...out.subarray(0, 4)]).toEqual([0xff, 0xd8, 0xff, 0xe1]);
    expect(out[out.length - 1]).toBe(0xd9);
  });
});
