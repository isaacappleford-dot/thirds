import { describe, expect, it } from 'vitest';
import { directionOf, moveInstruction, phoneMove } from './direction';

const target = { x: 2 / 3, y: 1 / 3 };

describe('phoneMove — the phone always moves opposite to where the subject must go', () => {
  it('rear camera: subject must move right → move phone left', () => {
    const m = phoneMove({ x: 0.5, y: 1 / 3 }, target, 'environment', false);
    expect(m.direction).toBe('left');
    expect(m.x).toBeLessThan(0);
  });

  it('rear camera: subject must move left → move phone right', () => {
    const m = phoneMove({ x: 0.85, y: 1 / 3 }, target, 'environment', false);
    expect(m.direction).toBe('right');
  });

  it('rear camera: subject must move down → move phone up', () => {
    const m = phoneMove({ x: 2 / 3, y: 0.1 }, target, 'environment', false);
    expect(m.direction).toBe('up');
    expect(m.y).toBeLessThan(0);
  });

  it('rear camera: subject must move up → move phone down', () => {
    const m = phoneMove({ x: 2 / 3, y: 0.6 }, target, 'environment', false);
    expect(m.direction).toBe('down');
  });

  it('front camera with mirrored preview behaves like the rear camera', () => {
    expect(phoneMove({ x: 0.5, y: 1 / 3 }, target, 'user', true).direction).toBe('left');
    expect(phoneMove({ x: 0.9, y: 1 / 3 }, target, 'user', true).direction).toBe('right');
  });

  it('front camera with un-mirrored preview flips horizontally only', () => {
    expect(phoneMove({ x: 0.5, y: 1 / 3 }, target, 'user', false).direction).toBe('right');
    expect(phoneMove({ x: 2 / 3, y: 0.1 }, target, 'user', false).direction).toBe('up');
  });

  it('combines axes when both matter', () => {
    const m = phoneMove({ x: 0.4, y: 0.6 }, target, 'environment', false);
    expect(m.direction).toBe('down-left');
    expect(moveInstruction(m.direction!)).toBe('Move phone down and left');
  });

  it('arrow angle points the way the phone moves', () => {
    expect(phoneMove({ x: 0.5, y: 1 / 3 }, target, 'environment', false).angle).toBeCloseTo(180);
    expect(phoneMove({ x: 2 / 3, y: 0.1 }, target, 'environment', false).angle).toBeCloseTo(-90);
  });
});

describe('directionOf', () => {
  it('returns null for no movement', () => {
    expect(directionOf(0, 0)).toBeNull();
  });
  it('collapses a minor axis', () => {
    expect(directionOf(1, 0.2)).toBe('right');
    expect(directionOf(0.2, -1)).toBe('up');
  });
});
