// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { scaledCopy } from './canvas';

describe('scaledCopy', () => {
  it('never shrinks intermediate steps below the target size', () => {
    const sizes: [number, number][] = [];
    const ctx = { drawImage: vi.fn(), imageSmoothingQuality: 'low' };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      sizes.push([this.width, this.height]);
      return ctx as unknown as CanvasRenderingContext2D;
    } as never);
    const src = { width: 2048, height: 1536 } as HTMLCanvasElement;
    const out = scaledCopy(src, 320);
    expect(out.width).toBe(320);
    expect(Math.min(...sizes.map((s) => s[0]))).toBeGreaterThanOrEqual(320);
  });
});
