import { describe, expect, it } from 'vitest';
import { analyzeFrame } from './analyze';
import { candidateInstructions, InstructionStabilizer, type Instruction } from './advisor';
import type { Candidate, ViewInfo } from './types';

const view: ViewInfo = { aspect: 0.75, facing: 'environment', mirrored: false };
const caps = { canZoom: true, canExposure: true };
const obj = (x: number, y: number, w: number, h: number): Candidate => ({ kind: 'object', box: { x, y, w, h }, score: 1 });

const ins = (id: Instruction['id'], priority: number): Instruction => ({ id, priority, text: id, why: '' });

describe('candidateInstructions', () => {
  it('tells you which way to move the phone', () => {
    const a = analyzeFrame({ subject: obj(0.4, 0.5, 0.25, 0.25), view, attitude: null, exposure: null, personInFrame: false });
    const list = candidateInstructions(a, caps);
    expect(list[0].id).toBe('move');
    expect(list[0].text).toMatch(/^Move phone/);
  });

  it('cut-off subjects outrank moving', () => {
    const a = analyzeFrame({ subject: obj(0, 0.3, 0.3, 0.3), view, attitude: null, exposure: null, personInFrame: false });
    expect(candidateInstructions(a, caps)[0].id).toBe('cutoff');
  });

  it('locks when on target', () => {
    const s = obj(2 / 3 - 0.08, 2 / 3 - 0.08, 0.16, 0.16);
    const a = analyzeFrame({ subject: s, view, attitude: null, exposure: null, personInFrame: false });
    expect(a.locked).toBe(true);
    expect(candidateInstructions(a, caps).map((i) => i.id)).toContain('locked');
  });

  it('asks to find a subject when there is none', () => {
    const a = analyzeFrame({ subject: null, view, attitude: null, exposure: null, personInFrame: false });
    expect(candidateInstructions(a, caps)[0].id).toBe('find');
  });

  it('offers zoom only when zoom exists', () => {
    const a = analyzeFrame({ subject: obj(0.62, 0.62, 0.08, 0.08), view, attitude: null, exposure: null, personInFrame: false });
    expect(candidateInstructions(a, caps).find((i) => i.id === 'closer')?.action).toBe('zoom-in');
    expect(candidateInstructions(a, { canZoom: false, canExposure: false }).find((i) => i.id === 'closer')?.action).toBeUndefined();
  });

  it('lock has hysteresis', () => {
    const near = obj(2 / 3 - 0.08 + 0.05, 2 / 3 - 0.08, 0.16, 0.16); // ~0.05 off: inside exit, outside enter
    const fresh = analyzeFrame({ subject: near, view, attitude: null, exposure: null, personInFrame: false });
    expect(fresh.locked).toBe(false);
    const wasLocked = { ...fresh, locked: true };
    expect(analyzeFrame({ subject: near, view, attitude: null, exposure: null, personInFrame: false, prev: wasLocked }).locked).toBe(true);
  });
});

describe('InstructionStabilizer', () => {
  it('waits before showing a new instruction', () => {
    const s = new InstructionStabilizer();
    expect(s.update([ins('move', 50)], 0)).toBeNull();
    expect(s.update([ins('move', 50)], 500)?.id).toBe('move');
  });

  it('shows lock immediately', () => {
    const s = new InstructionStabilizer();
    expect(s.update([ins('locked', 10)], 0)?.id).toBe('locked');
  });

  it('keeps the current instruction for a minimum time', () => {
    const s = new InstructionStabilizer();
    s.update([ins('move', 50)], 0);
    s.update([ins('move', 50)], 500);
    s.update([ins('move', 50), ins('cutoff', 90)], 600);
    expect(s.update([ins('move', 50), ins('cutoff', 90)], 1200)?.id).toBe('move');
    expect(s.update([ins('move', 50), ins('cutoff', 90)], 2100)?.id).toBe('cutoff');
  });

  it('survives brief dropouts', () => {
    const s = new InstructionStabilizer();
    s.update([ins('move', 50)], 0);
    s.update([ins('move', 50)], 500);
    expect(s.update([], 600)?.id).toBe('move');
    expect(s.update([], 1000)).toBeNull();
  });
});
