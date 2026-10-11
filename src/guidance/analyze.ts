import { GUIDANCE } from '../config/guidance';
import { phoneMove, type PhoneMove } from './direction';
import type { ExposureReport } from './exposure';
import { framingIssues, type FramingIssues } from './framing';
import { frameDistance } from './geometry';
import { levelAdvice, type Attitude, type LevelAdvice } from './level';
import { computeTarget, type Target } from './target';
import type { Candidate, ViewInfo } from './types';

/** Everything the coach knows about one moment. Pure data; no DOM. */
export interface FrameAnalysis {
  subject: Candidate | null;
  target: Target | null;
  distance: number | null;
  locked: boolean;
  move: PhoneMove | null;
  framing: FramingIssues | null;
  level: LevelAdvice;
  attitude: Attitude | null;
  exposure: ExposureReport | null;
}

export interface AnalyzeInput {
  subject: Candidate | null;
  view: ViewInfo;
  attitude: Attitude | null;
  exposure: ExposureReport | null;
  personInFrame: boolean;
  prev?: FrameAnalysis | null;
}

export function analyzeFrame(input: AnalyzeInput): FrameAnalysis {
  const { subject, view, attitude, exposure, prev } = input;
  const rear = view.facing === 'environment';
  const level = levelAdvice(attitude, { personInFrame: input.personInFrame, rearCamera: rear });
  if (!subject) {
    return { subject: null, target: null, distance: null, locked: false, move: null, framing: null, level, attitude, exposure };
  }
  const target = computeTarget(subject, view.aspect, prev?.target ?? undefined, level.flatLay);
  const distance = frameDistance(target.anchor, target.point, view.aspect);
  const wasLocked = prev?.locked ?? false;
  const locked = distance < (wasLocked ? GUIDANCE.lock.exit : GUIDANCE.lock.enter);
  const move = locked ? null : phoneMove(target.anchor, target.point, view.facing, view.mirrored);
  return { subject, target, distance, locked, move, framing: framingIssues(subject), level, attitude, exposure };
}
