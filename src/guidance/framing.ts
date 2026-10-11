import { GUIDANCE } from '../config/guidance';
import { area } from './geometry';
import type { Candidate } from './types';

export interface FramingIssues {
  tiny: boolean;
  cutoff: boolean;
  headroom: boolean;
  /** Suggested zoom multiplier to make a tiny subject a comfortable size. */
  zoomFactor: number;
}

const F = GUIDANCE.framing;

export function framingIssues(s: Candidate): FramingIssues {
  const b = s.box;
  const a = area(b);
  const e = F.edgeTouch;
  const touchL = b.x <= e;
  const touchR = b.x + b.w >= 1 - e;
  const touchT = b.y <= e;
  const touchB = b.y + b.h >= 1 - e;

  let cutoff = false;
  if (s.kind === 'face') {
    cutoff = touchL || touchR || touchT || touchB;
  } else if (s.kind === 'person') {
    // Cropping a person at the bottom (waist/knees) is a normal portrait crop.
    cutoff = (touchL || touchR || touchT) && b.h < 0.95;
  } else if (s.kind === 'object') {
    cutoff = a < F.edgeIgnoreArea && (touchL || touchR || touchT || touchB);
  }

  const tiny = a < F.tinyArea && s.kind !== 'salient';
  const headroom =
    !cutoff &&
    ((s.kind === 'face' && b.y < F.faceHeadroom) || (s.kind === 'person' && b.y < F.personHeadroom && !touchT));

  const zoomFactor = tiny && a > 0 ? Math.sqrt(F.zoomTargetArea / a) : 1;
  return { tiny, cutoff, headroom, zoomFactor };
}
