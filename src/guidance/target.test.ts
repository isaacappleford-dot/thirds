import { describe, expect, it } from 'vitest';
import { anchorOf, computeTarget, nearestIntersection } from './target';
import type { Candidate } from './types';

const obj = (x: number, y: number, w = 0.1, h = 0.1): Candidate => ({ kind: 'object', box: { x, y, w, h }, score: 0.9 });

describe('nearestIntersection', () => {
  it('picks the closest thirds intersection', () => {
    expect(nearestIntersection({ x: 0.2, y: 0.2 }, 0.75)).toEqual({ x: 1 / 3, y: 1 / 3 });
    expect(nearestIntersection({ x: 0.9, y: 0.8 }, 0.75)).toEqual({ x: 2 / 3, y: 2 / 3 });
  });

  it('sticks with the previous intersection near the middle (hysteresis)', () => {
    const prev = { x: 1 / 3, y: 1 / 3 };
    // Slightly closer to the right third, but within the switch margin.
    expect(nearestIntersection({ x: 0.52, y: 1 / 3 }, 0.75, prev)).toEqual(prev);
    // Clearly closer to the right third: switch.
    expect(nearestIntersection({ x: 0.66, y: 1 / 3 }, 0.75, prev)).toEqual({ x: 2 / 3, y: 1 / 3 });
  });
});

describe('computeTarget', () => {
  it('small objects go to the nearest intersection', () => {
    const t = computeTarget(obj(0.6, 0.6), 0.75);
    expect(t.mode).toBe('thirds');
    expect(t.point.x).toBeCloseTo(2 / 3);
    expect(t.point.y).toBeCloseTo(2 / 3);
  });

  it('subjects that fill the frame aim for the centre', () => {
    const t = computeTarget(obj(0.05, 0.1, 0.85, 0.7), 0.75);
    expect(t.mode).toBe('center');
    expect(t.point).toEqual({ x: 0.5, y: 0.5 });
  });

  it('faces put the eyes on the upper third', () => {
    const face: Candidate = { kind: 'face', box: { x: 0.6, y: 0.4, w: 0.15, h: 0.12 }, score: 0.9, eyes: { x: 0.675, y: 0.44 } };
    const t = computeTarget(face, 0.75);
    expect(t.mode).toBe('eyeline');
    expect(t.anchor).toEqual({ x: 0.675, y: 0.44 });
    expect(t.point.y).toBeCloseTo(1 / 3);
    expect(t.point.x).toBeCloseTo(2 / 3);
  });

  it('close-up faces are centred horizontally', () => {
    const face: Candidate = { kind: 'face', box: { x: 0.2, y: 0.3, w: 0.45, h: 0.35 }, score: 0.9 };
    const t = computeTarget(face, 0.75);
    expect(t.point.x).toBeCloseTo(0.5);
    expect(t.point.y).toBeCloseTo(1 / 3);
    expect(anchorOf(face).y).toBeCloseTo(0.3 + 0.35 * 0.4);
  });

  it('keeps tall people inside the frame instead of forcing the head onto the third', () => {
    const person: Candidate = { kind: 'person', box: { x: 0.3, y: 0.08, w: 0.3, h: 0.86 }, score: 0.9 };
    const t = computeTarget(person, 0.75);
    const shiftY = t.point.y - t.anchor.y;
    expect(0.08 + 0.86 + shiftY).toBeLessThanOrEqual(0.97 + 1e-9);
  });

  it('flat-lay mode centres the subject', () => {
    const t = computeTarget(obj(0.1, 0.1), 0.75, undefined, true);
    expect(t.mode).toBe('flatlay');
    expect(t.point).toEqual({ x: 0.5, y: 0.5 });
  });
});
