import { describe, expect, it } from 'vitest';
import { parseCapabilities, snapToStep, zoomPresets } from './capabilities';

describe('parseCapabilities', () => {
  it('handles a browser that exposes nothing (e.g. older iOS Safari)', () => {
    const f = parseCapabilities({}, {});
    expect(f).toMatchObject({ zoom: null, torch: false, pointsOfInterest: false, exposureCompensation: null });
  });

  it('handles undefined getCapabilities()', () => {
    expect(parseCapabilities(undefined, undefined).zoom).toBeNull();
  });

  it('reads a typical Chrome Android rear camera', () => {
    const f = parseCapabilities(
      {
        zoom: { min: 1, max: 8, step: 0.1 },
        torch: true,
        focusMode: ['manual', 'single-shot', 'continuous'],
        exposureMode: ['manual', 'single-shot', 'continuous'],
        exposureCompensation: { min: -2, max: 2, step: 0.1666 },
      },
      { pointsOfInterest: [], zoom: 1 },
    );
    expect(f.zoom).toEqual({ min: 1, max: 8, step: 0.1 });
    expect(f.torch).toBe(true);
    expect(f.pointsOfInterest).toBe(true);
    expect(f.exposureCompensation?.min).toBe(-2);
  });

  it('accepts torch reported as an array', () => {
    expect(parseCapabilities({ torch: [false, true] }, {}).torch).toBe(true);
  });

  it('rejects degenerate ranges', () => {
    expect(parseCapabilities({ zoom: { min: 1, max: 1 } }, {}).zoom).toBeNull();
  });
});

describe('zoom helpers', () => {
  it('offers 1×/2×/3× within the hardware range', () => {
    const f = parseCapabilities({ zoom: { min: 1, max: 2.5, step: 0.1 } }, {});
    expect(zoomPresets(f)).toEqual([1, 2]);
  });

  it('falls back to digital presets', () => {
    expect(zoomPresets(parseCapabilities({}, {}))).toEqual([1, 2, 3]);
  });

  it('snaps to the step', () => {
    expect(snapToStep(2.04, { min: 1, max: 8, step: 0.1 })).toBe(2);
    expect(snapToStep(20, { min: 1, max: 8, step: 0.1 })).toBe(8);
  });
});
