import { describe, expect, it } from 'vitest';
import { attitudeFromOrientation, levelAdvice, normalizeAngle } from './level';

describe('attitudeFromOrientation', () => {
  it('upright portrait is level, pitch 0', () => {
    const a = attitudeFromOrientation(90, 0);
    expect(a.roll).toBeCloseTo(0);
    expect(a.pitch).toBeCloseTo(0);
  });

  it('lying flat, screen up → camera points straight down', () => {
    expect(attitudeFromOrientation(0, 0).pitch).toBeCloseTo(-90);
  });

  it('tilting the top back points the camera up', () => {
    expect(attitudeFromOrientation(120, 0).pitch).toBeCloseTo(30);
    expect(attitudeFromOrientation(60, 0).pitch).toBeCloseTo(-30);
  });

  it('handles the gimbal-lock representation of a rolled upright phone', () => {
    // Browsers report an upright phone rolled clockwise by θ as gamma ≈ 90, beta ≈ 90 − θ.
    expect(attitudeFromOrientation(85, 90).roll).toBeCloseTo(5);
    expect(attitudeFromOrientation(85, -90).roll).toBeCloseTo(-5);
  });

  it('small rolls on a slightly tilted phone', () => {
    const a = attitudeFromOrientation(70, 4);
    expect(Math.abs(a.roll)).toBeGreaterThan(0.5);
    expect(Math.abs(a.roll)).toBeLessThan(5);
  });

  it('compensates for landscape screen orientation', () => {
    // Phone turned counter-clockwise to landscape (screen angle 90), held level:
    // device +x points up, i.e. up = (1, 0, 0) → gamma = -90, beta = 0.
    const a = attitudeFromOrientation(0, -90, 90);
    expect(Math.abs(normalizeAngle(a.roll))).toBeCloseTo(0);
  });
});

describe('levelAdvice', () => {
  const opts = { personInFrame: false, rearCamera: true };
  it('asks to straighten small tilts only', () => {
    expect(levelAdvice({ roll: 1, pitch: 0, flatX: 0, flatY: 0 }, opts).straighten).toBe(false);
    expect(levelAdvice({ roll: 5, pitch: 0, flatX: 0, flatY: 0 }, opts).straighten).toBe(true);
    expect(levelAdvice({ roll: -5, pitch: 0, flatX: 0, flatY: 0 }, opts).straighten).toBe(true);
    expect(levelAdvice({ roll: 25, pitch: 0, flatX: 0, flatY: 0 }, opts).straighten).toBe(false);
  });

  it('switches to flat-lay when pointing down', () => {
    const a = levelAdvice({ roll: 0, pitch: -85, flatX: 1, flatY: 1 }, opts);
    expect(a.flatLay).toBe(true);
    expect(a.flatLayTilted).toBe(false);
    expect(levelAdvice({ roll: 0, pitch: -75, flatX: 10, flatY: 8 }, opts).flatLayTilted).toBe(true);
  });

  it('suggests eye level only with a person in frame', () => {
    expect(levelAdvice({ roll: 0, pitch: -40, flatX: 0, flatY: 0 }, opts).eyeLevel).toBe(false);
    expect(levelAdvice({ roll: 0, pitch: -40, flatX: 0, flatY: 0 }, { ...opts, personInFrame: true }).eyeLevel).toBe(true);
    expect(levelAdvice({ roll: 0, pitch: 10, flatX: 0, flatY: 0 }, { ...opts, personInFrame: true }).eyeLevel).toBe(false);
  });

  it('returns nothing without sensor data', () => {
    expect(levelAdvice(null, opts).straighten).toBe(false);
  });
});
