import { describe, expect, it } from 'vitest';
import { analyzeFrame } from './analyze';
import { scoreScan } from './score';
import type { Candidate, ViewInfo } from './types';

const view: ViewInfo = { aspect: 0.75, facing: 'environment', mirrored: false };
const caps = { canZoom: true, canExposure: true };
const obj = (x: number, y: number, w: number, h: number): Candidate => ({ kind: 'object', box: { x, y, w, h }, score: 1 });
const level = { roll: 0, pitch: 0, flatX: 0, flatY: 0 };

const frames = (s: Candidate | null, attitude = level, n = 8) =>
  Array.from({ length: n }, () => analyzeFrame({ subject: s, view, attitude, exposure: null, personInFrame: false }));

describe('scoreScan', () => {
  it('a well-placed, level subject scores high with no major tips', () => {
    const r = scoreScan(frames(obj(2 / 3 - 0.125, 2 / 3 - 0.125, 0.25, 0.25)), caps);
    expect(r.score).toBeGreaterThanOrEqual(95);
    expect(r.tips.length).toBe(0);
  });

  it('a centred small subject loses points and gets placement advice', () => {
    const r = scoreScan(frames(obj(0.45, 0.45, 0.1, 0.1)), caps);
    expect(r.score).toBeLessThan(85);
    const ids = r.tips.map((t) => t.id);
    expect(ids).toContain('move');
    expect(ids).toContain('closer');
    expect(r.tips.every((t) => t.why.length > 10)).toBe(true);
  });

  it('tilt costs points; big intentional tilts do not', () => {
    const s = obj(2 / 3 - 0.125, 2 / 3 - 0.125, 0.25, 0.25);
    expect(scoreScan(frames(s, { ...level, roll: 6 }), caps).tips[0]?.id).toBe('straighten');
    expect(scoreScan(frames(s, { ...level, roll: 30 }), caps).score).toBeGreaterThanOrEqual(95);
  });

  it('no subject is the top tip when the frame is empty', () => {
    const r = scoreScan(frames(null), caps);
    expect(r.tips[0].id).toBe('find');
  });

  it('returns at most three tips', () => {
    const r = scoreScan(frames(obj(0, 0, 0.1, 0.1), { ...level, roll: 6 }), caps);
    expect(r.tips.length).toBeLessThanOrEqual(3);
  });
});
