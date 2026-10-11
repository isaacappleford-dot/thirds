import { describe, expect, it } from 'vitest';
import { pickSubject, SubjectTracker } from './tracker';
import type { Candidate } from './types';

const c = (kind: Candidate['kind'], x: number, y: number, w: number, h: number, label?: string): Candidate => ({
  kind,
  box: { x, y, w, h },
  score: 0.8,
  label,
});

describe('pickSubject', () => {
  it('prefers faces, then people, then objects', () => {
    const face = c('face', 0.1, 0.1, 0.05, 0.05);
    const person = c('person', 0.3, 0.2, 0.3, 0.6);
    const obj = c('object', 0.2, 0.2, 0.6, 0.6);
    expect(pickSubject([obj, person, face])).toBe(face);
    expect(pickSubject([obj, person])).toBe(person);
  });

  it('prefers larger and more central objects', () => {
    const small = c('object', 0.05, 0.05, 0.05, 0.05);
    const big = c('object', 0.35, 0.35, 0.3, 0.3);
    expect(pickSubject([small, big])).toBe(big);
  });
});

describe('SubjectTracker', () => {
  it('keeps the same track id and smooths the box between frames', () => {
    const tr = new SubjectTracker();
    const a = tr.update([c('object', 0.4, 0.4, 0.2, 0.2)], 0)!;
    const b = tr.update([c('object', 0.44, 0.4, 0.2, 0.2)], 100)!;
    expect(b.id).toBe(a.id);
    expect(b.box.x).toBeGreaterThan(0.4);
    expect(b.box.x).toBeLessThan(0.44);
  });

  it('drops tracks that disappear for too long', () => {
    const tr = new SubjectTracker();
    tr.update([c('object', 0.4, 0.4, 0.2, 0.2)], 0);
    expect(tr.update([], 300)).not.toBeNull();
    expect(tr.update([], 5000)).toBeNull();
  });

  it('switches to a face when one appears', () => {
    const tr = new SubjectTracker();
    tr.update([c('object', 0.4, 0.4, 0.2, 0.2)], 0);
    const s = tr.update([c('object', 0.4, 0.4, 0.2, 0.2), c('face', 0.1, 0.1, 0.1, 0.1)], 100)!;
    expect(s.kind).toBe('face');
  });

  it('is sticky between subjects of the same kind', () => {
    const tr = new SubjectTracker();
    const first = tr.update([c('object', 0.4, 0.4, 0.2, 0.2, 'cup')], 0)!;
    const s = tr.update([c('object', 0.4, 0.4, 0.2, 0.2, 'cup'), c('object', 0.3, 0.3, 0.4, 0.4, 'plant')], 100)!;
    expect(s.id).toBe(first.id);
  });

  it('tapping pins a different subject', () => {
    const tr = new SubjectTracker();
    tr.update([c('object', 0.1, 0.1, 0.2, 0.2, 'a'), c('object', 0.6, 0.6, 0.3, 0.3, 'b')], 0);
    const pinned = tr.pinAt({ x: 0.15, y: 0.15 })!;
    expect(pinned.label).toBe('a');
    const s = tr.update([c('object', 0.1, 0.1, 0.2, 0.2, 'a'), c('object', 0.6, 0.6, 0.3, 0.3, 'b')], 100)!;
    expect(s.label).toBe('a');
  });

  it('salient fallback is replaced as soon as a real detection arrives', () => {
    const tr = new SubjectTracker();
    tr.update([c('salient', 0.4, 0.4, 0.2, 0.2)], 0);
    tr.update([c('object', 0.1, 0.1, 0.2, 0.2)], 100);
    expect(tr.all.some((t) => t.kind === 'salient')).toBe(false);
  });
});
