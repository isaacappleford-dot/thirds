import { describe, expect, it } from 'vitest';
import { framingIssues } from './framing';
import type { Candidate } from './types';

const make = (kind: Candidate['kind'], x: number, y: number, w: number, h: number): Candidate => ({
  kind,
  box: { x, y, w, h },
  score: 1,
});

describe('framingIssues', () => {
  it('flags tiny subjects and suggests a zoom factor', () => {
    const f = framingIssues(make('object', 0.45, 0.45, 0.1, 0.1));
    expect(f.tiny).toBe(true);
    expect(f.zoomFactor).toBeGreaterThan(3);
  });

  it('flags subjects cut off by an edge', () => {
    expect(framingIssues(make('object', 0, 0.3, 0.3, 0.3)).cutoff).toBe(true);
    expect(framingIssues(make('face', 0.8, 0.3, 0.2, 0.2)).cutoff).toBe(true);
  });

  it('does not flag a person cropped at the bottom', () => {
    expect(framingIssues(make('person', 0.3, 0.2, 0.4, 0.8)).cutoff).toBe(false);
  });

  it('does not nag about fill-the-frame objects touching edges', () => {
    expect(framingIssues(make('object', 0, 0, 0.9, 0.9)).cutoff).toBe(false);
  });

  it('asks for headroom when a face is near the top', () => {
    const f = framingIssues(make('face', 0.4, 0.03, 0.2, 0.2));
    expect(f.headroom).toBe(true);
    expect(f.cutoff).toBe(false);
  });
});
