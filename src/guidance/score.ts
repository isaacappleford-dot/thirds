import { GUIDANCE } from '../config/guidance';
import type { FrameAnalysis } from './analyze';
import { candidateInstructions, WHY, type Capabilities, type InstructionId } from './advisor';
import { normalizeAngle } from './level';

export interface ScanTip {
  id: InstructionId;
  text: string;
  why: string;
  penalty: number;
}

export interface ScanResult {
  score: number;
  headline: string;
  tips: ScanTip[];
  frames: number;
}

const P = GUIDANCE.penalty;
const L = GUIDANCE.level;

/** Fraction of frames for which `pred` holds. */
const share = (frames: FrameAnalysis[], pred: (f: FrameAnalysis) => boolean) =>
  frames.length ? frames.filter(pred).length / frames.length : 0;

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Scores about a second of analysed frames (0–100) and returns the most
 * valuable 2–3 tips. Each issue's penalty is weighted by how many frames
 * showed it, so a one-frame glitch barely counts.
 */
export function scoreScan(frames: FrameAnalysis[], caps: Capabilities): ScanResult {
  const penalties = new Map<InstructionId, number>();
  const add = (id: InstructionId, p: number) => p > 0.5 && penalties.set(id, (penalties.get(id) ?? 0) + p);

  const withSubject = frames.filter((f) => f.subject);
  add('find', P.noSubject * (1 - withSubject.length / Math.max(1, frames.length)));

  if (withSubject.length) {
    const d = median(withSubject.map((f) => f.distance ?? 0));
    add('move', P.placementMax * Math.min(1, Math.max(0, d - GUIDANCE.lock.enter) / P.placementFull));
    add('cutoff', P.cutoff * share(withSubject, (f) => !!f.framing?.cutoff));
    add('closer', P.tiny * share(withSubject, (f) => !!f.framing?.tiny));
    add('headroom', P.headroom * share(withSubject, (f) => !!f.framing?.headroom));
  }

  const rolls = frames.filter((f) => f.attitude && Math.abs(f.attitude.pitch) < L.maxPitchForRoll).map((f) => Math.abs(normalizeAngle(f.attitude!.roll)));
  if (rolls.length) {
    const r = median(rolls);
    if (r > 1 && r < L.maxRoll) add('straighten', P.levelMax * Math.min(1, (r - 1) / (L.maxRoll - 1)));
  }
  add('eyelevel', P.eyelevel * share(frames, (f) => f.level.eyeLevel));
  add('flatlay', P.levelMax * share(frames, (f) => f.level.flatLayTilted));
  add('backlit', P.backlit * share(frames, (f) => !!f.exposure?.backlit));
  add('highlights', P.highlightsMax * share(frames, (f) => !!f.exposure?.highlightsClipped));
  add('shadows', P.shadowsMax * share(frames, (f) => !!f.exposure?.shadowsCrushed));

  const total = [...penalties.values()].reduce((a, b) => a + b, 0);
  const score = Math.round(Math.max(0, Math.min(100, 100 - total)));

  // Use live-instruction wording (it knows about zoom/exposure controls).
  const last = frames[frames.length - 1];
  const live = last ? candidateInstructions(last, caps) : [];
  const textFor = (id: InstructionId) => live.find((i) => i.id === id)?.text ?? DEFAULT_TEXT[id];

  const tips = [...penalties.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, GUIDANCE.scan.maxTips)
    .map(([id, penalty]) => ({ id, penalty, text: textFor(id), why: WHY[id] }));

  return { score, headline: headline(score), tips, frames: frames.length };
}

const DEFAULT_TEXT: Record<InstructionId, string> = {
  cutoff: 'Give your subject room at the edges',
  flatlay: 'Hold the phone flat',
  backlit: 'Tap your subject to brighten it',
  closer: 'Move closer to your subject',
  headroom: 'Leave a little headroom',
  straighten: 'Straighten the horizon',
  eyelevel: 'Shoot closer to eye level',
  move: 'Place your subject on a third',
  highlights: 'Lower the exposure a touch',
  shadows: 'Find more light',
  locked: 'Take the shot',
  find: 'Choose one clear subject',
};

export function headline(score: number): string {
  if (score >= 90) return 'Beautifully composed';
  if (score >= 75) return 'Nearly there';
  if (score >= 55) return 'A few easy fixes';
  return 'Let’s rework this one';
}
