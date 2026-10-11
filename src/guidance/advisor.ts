import { GUIDANCE } from '../config/guidance';
import type { FrameAnalysis } from './analyze';
import { moveInstruction } from './direction';

export type InstructionId = keyof typeof GUIDANCE.priority;

export type InstructionAction = 'zoom-in' | 'zoom-out' | 'ev-down' | 'ev-up' | 'tap-subject';

export interface Instruction {
  id: InstructionId;
  priority: number;
  text: string;
  /** One-line reason, shown in the scan card so people learn. */
  why: string;
  /** Arrow angle in degrees (0 = right) for directional instructions. */
  arrow?: number;
  action?: InstructionAction;
}

export const WHY: Record<InstructionId, string> = {
  cutoff: 'Cutting through a subject at the frame edge looks accidental. Give it some room.',
  flatlay: 'From straight above, a flat phone keeps lines parallel and the layout square.',
  backlit: 'The camera exposes for the bright background, so your subject turns into a silhouette.',
  closer: 'A small subject gets lost. Filling more of the frame makes clear what the photo is about.',
  headroom: 'A sliver of space above the head stops the frame from feeling cramped.',
  straighten: 'A tilted horizon is the first thing people notice. Level lines feel calm.',
  eyelevel: 'Eye level feels personal and natural; steep angles distort people.',
  move: 'Placing your subject on a third line leaves breathing room and feels more natural than dead centre.',
  highlights: 'Pure white areas hold no detail and can’t be recovered later.',
  shadows: 'Pure black areas hide detail. More light on your subject helps most.',
  locked: 'Your subject sits on a strong point in the frame.',
  find: 'Pick one clear subject so viewers know where to look.',
};

export interface Capabilities {
  canZoom: boolean;
  canExposure: boolean;
}

/** All instructions that apply right now, highest priority first. */
export function candidateInstructions(a: FrameAnalysis, caps: Capabilities): Instruction[] {
  const P = GUIDANCE.priority;
  const out: Instruction[] = [];
  const add = (id: InstructionId, text: string, extra: Partial<Instruction> = {}) =>
    out.push({ id, priority: P[id], text, why: WHY[id], ...extra });

  if (a.level.flatLay && a.level.flatLayTilted) add('flatlay', 'Hold the phone flat');
  if (a.subject && a.framing) {
    if (a.framing.cutoff) add('cutoff', caps.canZoom ? 'Step back or zoom out' : 'Step back a little', { action: caps.canZoom ? 'zoom-out' : undefined });
    if (a.framing.tiny) add('closer', caps.canZoom ? 'Move closer or tap to zoom' : 'Move closer', { action: caps.canZoom ? 'zoom-in' : undefined });
    if (a.framing.headroom) add('headroom', 'Leave a little headroom');
  }
  if (a.exposure?.backlit) add('backlit', 'Backlit — tap your subject to brighten it', { action: 'tap-subject' });
  if (a.level.straighten && a.attitude) add('straighten', 'Straighten', { arrow: a.attitude.roll > 0 ? 180 : 0 });
  if (a.level.eyeLevel) add('eyelevel', 'Shoot closer to eye level');
  if (a.move?.direction) add('move', moveInstruction(a.move.direction), { arrow: a.move.angle });
  if (a.exposure?.highlightsClipped) {
    add('highlights', caps.canExposure ? 'Bright areas are blown out — lower exposure' : 'Bright areas are blown out — tap a bright spot', {
      action: caps.canExposure ? 'ev-down' : undefined,
    });
  }
  if (a.exposure?.shadowsCrushed && !a.exposure.highlightsClipped) {
    add('shadows', caps.canExposure ? 'Too dark — turn toward the light or raise exposure' : 'Too dark — turn toward the light', {
      action: caps.canExposure ? 'ev-up' : undefined,
    });
  }
  if (a.locked) add('locked', 'Looks great — take the shot');
  if (!a.subject) add('find', 'Point at your subject');
  return out.sort((x, y) => y.priority - x.priority);
}

/**
 * Keeps the pill calm: an instruction has to persist before it appears, stays
 * up for a minimum time, and brief dropouts don't clear it.
 */
export class InstructionStabilizer {
  private firstSeen = new Map<InstructionId, number>();
  private lastSeen = new Map<InstructionId, number>();
  private current: Instruction | null = null;
  private shownAt = 0;

  constructor(private readonly cfg = GUIDANCE.advisor) {}

  update(cands: Instruction[], now: number): Instruction | null {
    const present = new Set(cands.map((c) => c.id));
    for (const c of cands) {
      if (!this.firstSeen.has(c.id)) this.firstSeen.set(c.id, now);
      this.lastSeen.set(c.id, now);
    }
    for (const id of [...this.firstSeen.keys()]) {
      if (!present.has(id) && now - (this.lastSeen.get(id) ?? 0) > this.cfg.hideAfterMs) {
        this.firstSeen.delete(id);
        this.lastSeen.delete(id);
      }
    }

    // Locking is good news: show it right away.
    const eligible = [...cands].sort((x, y) => y.priority - x.priority).filter((c) => c.id === 'locked' || now - (this.firstSeen.get(c.id) ?? now) >= this.cfg.showAfterMs);
    const best = eligible[0] ?? null;

    if (this.current) {
      const stillThere = this.firstSeen.has(this.current.id);
      const fresh = cands.find((c) => c.id === this.current!.id);
      if (stillThere) {
        if (fresh) this.current = fresh; // e.g. arrow direction updates
        const held = now - this.shownAt >= this.cfg.minShowMs;
        if (!best || best.id === this.current.id || best.priority <= this.current.priority || !held) {
          return this.current;
        }
      }
    }
    if (best?.id !== this.current?.id) this.shownAt = now;
    this.current = best;
    return best;
  }

  reset() {
    this.firstSeen.clear();
    this.lastSeen.clear();
    this.current = null;
  }
}
