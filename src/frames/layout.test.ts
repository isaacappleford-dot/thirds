import { describe, expect, it } from 'vitest';
import { frameLayout, photoSizeForBudget, stampPlacement } from './layout';

describe('frameLayout', () => {
  it('none is the photo itself', () => {
    expect(frameLayout('none', 400, 300)).toMatchObject({ width: 400, height: 300, photo: { x: 0, y: 0, w: 400, h: 300 } });
  });

  it('gallery adds a mat with a larger bottom margin', () => {
    const l = frameLayout('gallery', 3000, 4000);
    const bottom = l.height - (l.photo.y + l.photo.h);
    expect(bottom).toBeGreaterThan(l.photo.y);
    expect(l.photo.x).toBe(l.width - (l.photo.x + l.photo.w));
  });

  it('paper nests photo in paper in background', () => {
    const l = frameLayout('paper', 3000, 2000);
    expect(l.paper).not.toBeNull();
    expect(l.photo.x).toBeGreaterThan(l.paper!.x);
    expect(l.paper!.x + l.paper!.w).toBeLessThan(l.width);
  });

  it('borders scale with the photo so previews match exports', () => {
    const big = frameLayout('gallery', 3000, 4000);
    const small = frameLayout('gallery', 300, 400);
    expect(big.width / big.height).toBeCloseTo(small.width / small.height, 2);
  });
});

describe('photoSizeForBudget', () => {
  it('keeps framed output within 16 MP', () => {
    const p = photoSizeForBudget('paper', 4000, 4000, 16_000_000, 8192);
    const l = frameLayout('paper', p.width, p.height);
    expect(l.width * l.height).toBeLessThanOrEqual(16_000_000);
    expect(p.width).toBeGreaterThan(3000);
  });

  it('does not upscale', () => {
    expect(photoSizeForBudget('none', 1000, 800, 16_000_000, 8192)).toEqual({ width: 1000, height: 800 });
  });
});

describe('stampPlacement', () => {
  it('sits inside the bottom-right of the photo', () => {
    const s = stampPlacement({ x: 100, y: 100, w: 3000, h: 4000 });
    expect(s.right).toBeLessThan(3100);
    expect(s.baseline).toBeLessThan(4100);
    expect(s.size).toBeCloseTo(135);
  });
});
