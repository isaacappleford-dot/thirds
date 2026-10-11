import { describe, expect, it } from 'vitest';
import { displayPointToRaw, rawBoxToDisplay } from './space';

describe('camera spaces', () => {
  it('mirrors raw boxes for the front camera', () => {
    const b = rawBoxToDisplay({ x: 0.1, y: 0.2, w: 0.2, h: 0.2 }, { mirrored: true, digitalZoom: 1 })!;
    expect(b.x).toBeCloseTo(0.7);
    expect(b.y).toBeCloseTo(0.2);
  });

  it('maps through digital zoom and drops boxes outside the crop', () => {
    const b = rawBoxToDisplay({ x: 0.45, y: 0.45, w: 0.1, h: 0.1 }, { mirrored: false, digitalZoom: 2 })!;
    expect(b.x).toBeCloseTo(0.4);
    expect(b.w).toBeCloseTo(0.2);
    expect(rawBoxToDisplay({ x: 0, y: 0, w: 0.1, h: 0.1 }, { mirrored: false, digitalZoom: 2 })).toBeNull();
  });

  it('display taps map back to raw sensor points', () => {
    expect(displayPointToRaw({ x: 0.25, y: 0.5 }, { mirrored: true, digitalZoom: 1 })).toEqual({ x: 0.75, y: 0.5 });
    const p = displayPointToRaw({ x: 1, y: 1 }, { mirrored: false, digitalZoom: 2 });
    expect(p.x).toBeCloseTo(0.75);
  });
});
