import { GUIDANCE } from '../config/guidance';
import { area, center, contains, iou, lerp, lerpBox } from './geometry';
import type { Box, Candidate, Point, SubjectKind } from './types';

export interface Track extends Candidate {
  id: number;
  firstSeen: number;
  lastSeen: number;
  hits: number;
}

const KIND_RANK: Record<SubjectKind, number> = { face: 3, person: 2, object: 1, salient: 0 };

/** Faces, then people, then the largest/most central object, then the salient region. */
export function subjectScore(c: Candidate): number {
  const a = area(c.box);
  const ctr = center(c.box);
  const centrality = 1 - Math.min(1, Math.hypot(ctr.x - 0.5, ctr.y - 0.5) / 0.71);
  return KIND_RANK[c.kind] * 10 + a * 6 + centrality * 2 + c.score * 0.5;
}

export function pickSubject<T extends Candidate>(cands: T[]): T | null {
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const c of cands) {
    const s = subjectScore(c);
    if (s > bestScore) {
      best = c;
      bestScore = s;
    }
  }
  return best;
}

/**
 * Keeps detections stable between frames: IoU matching (greedy), exponential
 * smoothing of boxes, track expiry, and a sticky subject choice that the user
 * can override by tapping.
 */
export class SubjectTracker {
  private tracks: Track[] = [];
  private nextId = 1;
  private pinnedId: number | null = null;
  private subjectId: number | null = null;

  constructor(private readonly cfg = GUIDANCE.tracking) {}

  update(cands: Candidate[], now: number): Track | null {
    const unmatched = new Set(this.tracks.map((t) => t.id));
    const pairs: { t: Track; c: Candidate; score: number }[] = [];
    for (const t of this.tracks) {
      for (const c of cands) {
        if (t.kind !== c.kind) continue; // a face never continues a person track
        const score = iou(t.box, c.box);
        if (score >= this.cfg.iouMatch) pairs.push({ t, c, score });
      }
    }
    pairs.sort((a, b) => b.score - a.score);
    const usedCands = new Set<Candidate>();
    for (const { t, c } of pairs) {
      if (!unmatched.has(t.id) || usedCands.has(c)) continue;
      unmatched.delete(t.id);
      usedCands.add(c);
      t.box = lerpBox(t.box, c.box, this.cfg.alpha);
      t.eyes = c.eyes && t.eyes ? { x: lerp(t.eyes.x, c.eyes.x, this.cfg.alpha), y: lerp(t.eyes.y, c.eyes.y, this.cfg.alpha) } : c.eyes;
      t.score = c.score;
      t.label = c.label;
      t.lastSeen = now;
      t.hits += 1;
    }
    for (const c of cands) {
      if (usedCands.has(c)) continue;
      this.tracks.push({ ...c, box: { ...c.box }, id: this.nextId++, firstSeen: now, lastSeen: now, hits: 1 });
    }
    this.tracks = this.tracks.filter((t) => now - t.lastSeen <= this.cfg.lostAfterMs);
    // The salient fallback only lives while it is the only thing we have.
    if (this.tracks.some((t) => t.kind !== 'salient' && t.lastSeen === now)) {
      this.tracks = this.tracks.filter((t) => t.kind !== 'salient');
    }
    return this.chooseSubject();
  }

  private chooseSubject(): Track | null {
    const alive = (id: number | null) => (id === null ? undefined : this.tracks.find((t) => t.id === id));
    const pinned = alive(this.pinnedId);
    if (pinned) return this.setSubject(pinned);
    this.pinnedId = null;

    const best = pickSubject(this.tracks);
    const current = alive(this.subjectId);
    // Stay on the current subject unless something of a higher kind shows up.
    if (current && best && KIND_RANK[best.kind] <= KIND_RANK[current.kind]) return this.setSubject(current);
    return this.setSubject(best);
  }

  private setSubject(t: Track | null): Track | null {
    this.subjectId = t ? t.id : null;
    return t;
  }

  /** Pin the smallest track under the tap. Returns the pinned track, if any. */
  pinAt(p: Point): Track | null {
    const hits = this.tracks.filter((t) => contains(t.box, p)).sort((a, b) => area(a.box) - area(b.box));
    if (hits.length === 0) {
      // Tapping empty space cycles to the next candidate, if there is one.
      if (this.tracks.length > 1) {
        const order = [...this.tracks].sort((a, b) => subjectScore(b) - subjectScore(a));
        const i = order.findIndex((t) => t.id === this.subjectId);
        const next = order[(i + 1) % order.length];
        this.pinnedId = next.id;
        return this.setSubject(next);
      }
      return null;
    }
    // Tapping the current subject again while something else overlaps cycles through the stack.
    const i = hits.findIndex((t) => t.id === this.subjectId);
    const next = i >= 0 && hits.length > 1 ? hits[(i + 1) % hits.length] : hits[0];
    this.pinnedId = next.id;
    return this.setSubject(next);
  }

  clearPin() {
    this.pinnedId = null;
  }

  get all(): readonly Track[] {
    return this.tracks;
  }

  reset() {
    this.tracks = [];
    this.pinnedId = null;
    this.subjectId = null;
  }
}

export function boxesEqual(a: Box, b: Box, eps = 1e-9) {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps && Math.abs(a.w - b.w) < eps && Math.abs(a.h - b.h) < eps;
}
