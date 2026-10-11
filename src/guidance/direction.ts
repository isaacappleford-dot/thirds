import type { Facing, Point } from './types';

export type Direction = 'left' | 'right' | 'up' | 'down' | 'up-left' | 'up-right' | 'down-left' | 'down-right';

export interface PhoneMove {
  /** Unit-ish vector of how to move the phone, in screen terms (+x right, +y down). */
  x: number;
  y: number;
  direction: Direction | null;
  /** Arrow rotation in degrees, 0 = pointing right, 90 = pointing down. */
  angle: number;
}

/**
 * Which way to move the PHONE so the subject travels from `anchor` to
 * `target` in the preview. Both points are in display space (what the user
 * sees, i.e. after any mirroring).
 *
 * Rear camera: to push the subject RIGHT in the frame, turn/move the phone
 * LEFT. The scene always slides opposite to the camera.
 *
 * Front camera: moving the phone to the user's left moves the camera to its
 * own right, so the subject slides left in the raw sensor image — which is
 * RIGHT in a mirrored preview. So with a mirrored preview the rule is the same
 * as for the rear camera; only an un-mirrored front preview flips it.
 *
 * Vertically the camera and the user agree for both cameras: to push the
 * subject DOWN the frame, move/tilt the phone UP.
 */
export function phoneMove(anchor: Point, target: Point, facing: Facing, mirrored: boolean): PhoneMove {
  const dx = target.x - anchor.x; // how the subject must travel
  const dy = target.y - anchor.y;
  const sameAsRear = facing === 'environment' || mirrored;
  const x = sameAsRear ? 0 - dx : dx; // "0 -" avoids -0 in the arrow angle
  const y = 0 - dy;
  return { x, y, direction: directionOf(x, y), angle: (Math.atan2(y, x) * 180) / Math.PI };
}

/** Names a screen-space vector, collapsing to one axis when the other is minor. */
export function directionOf(x: number, y: number, minorRatio = 0.45): Direction | null {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (ax < 1e-6 && ay < 1e-6) return null;
  const h = x < 0 ? 'left' : 'right';
  const v = y < 0 ? 'up' : 'down';
  if (ay < ax * minorRatio) return h;
  if (ax < ay * minorRatio) return v;
  return `${v}-${h}` as Direction;
}

const WORDS: Record<Direction, string> = {
  left: 'left',
  right: 'right',
  up: 'up',
  down: 'down',
  'up-left': 'up and left',
  'up-right': 'up and right',
  'down-left': 'down and left',
  'down-right': 'down and right',
};

export function moveInstruction(direction: Direction): string {
  return `Move phone ${WORDS[direction]}`;
}
