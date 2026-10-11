import { describe, expect, it } from 'vitest';
import { analyzeExposure, lumaFromRGBA } from './exposure';

const W = 64;
const H = 48;
const fill = (v: number) => new Uint8Array(W * H).fill(v);

describe('lumaFromRGBA', () => {
  it('weights green most', () => {
    const l = lumaFromRGBA(new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]));
    expect(l[1]).toBeGreaterThan(l[0]);
    expect(l[0]).toBeGreaterThan(l[2]);
    expect(l[3]).toBeGreaterThanOrEqual(254);
  });
});

describe('analyzeExposure', () => {
  it('a mid-grey frame has no issues', () => {
    const r = analyzeExposure(fill(120), W, H);
    expect(r.highlightsClipped).toBe(false);
    expect(r.shadowsCrushed).toBe(false);
    expect(r.mean).toBe(120);
  });

  it('detects clipped highlights', () => {
    const l = fill(120);
    l.fill(255, 0, W * 10); // top 10 rows blown out (~21%)
    expect(analyzeExposure(l, W, H).highlightsClipped).toBe(true);
  });

  it('detects crushed shadows', () => {
    const l = fill(120);
    l.fill(0, W * 30); // bottom 18 rows black
    expect(analyzeExposure(l, W, H).shadowsCrushed).toBe(true);
  });

  it('detects a backlit subject', () => {
    const l = fill(230);
    for (let y = 16; y < 40; y++) for (let x = 24; x < 40; x++) l[y * W + x] = 40;
    const box = { x: 24 / W, y: 16 / H, w: 16 / W, h: 24 / H };
    const r = analyzeExposure(l, W, H, box);
    expect(r.backlit).toBe(true);
    expect(r.subjectMean).toBeCloseTo(40);
  });

  it('a dark subject on a dark background is not backlit', () => {
    const l = fill(60);
    for (let y = 16; y < 40; y++) for (let x = 24; x < 40; x++) l[y * W + x] = 20;
    const r = analyzeExposure(l, W, H, { x: 24 / W, y: 16 / H, w: 16 / W, h: 24 / H });
    expect(r.backlit).toBe(false);
  });
});
