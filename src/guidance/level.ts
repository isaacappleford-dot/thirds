import { GUIDANCE } from '../config/guidance';

const L = GUIDANCE.level;
const RAD = Math.PI / 180;

export interface Attitude {
  /** Rotation in the screen plane, degrees. Positive = phone turned clockwise. */
  roll: number;
  /** Elevation of the rear camera, degrees. 0 = level, -90 = pointing straight down. */
  pitch: number;
  /** Tilt away from lying flat (for the flat-lay bubble), degrees on each screen axis. */
  flatX: number;
  flatY: number;
}

/**
 * Converts DeviceOrientationEvent beta/gamma into a gimbal-lock-free attitude.
 *
 * We rebuild world "up" in device coordinates (x right, y towards the top of
 * the screen, z out of the screen) from the Z-X'-Y'' Euler angles:
 *   up = (-sin γ cos β, sin β, cos γ cos β)
 * Roll comes from up's projection onto the screen, pitch from its z part.
 * `screenAngle` is screen.orientation.angle (0, 90, 180, 270).
 */
export function attitudeFromOrientation(beta: number, gamma: number, screenAngle = 0): Attitude {
  const b = beta * RAD;
  const g = gamma * RAD;
  let ux = -Math.sin(g) * Math.cos(b);
  let uy = Math.sin(b);
  const uz = Math.cos(g) * Math.cos(b);
  if (screenAngle) {
    // Express "up" in screen coordinates: rotate counter-clockwise by the screen angle.
    const a = screenAngle * RAD;
    const sx = ux * Math.cos(a) - uy * Math.sin(a);
    const sy = ux * Math.sin(a) + uy * Math.cos(a);
    ux = sx;
    uy = sy;
  }
  const roll = Math.atan2(-ux, uy) / RAD;
  const pitch = Math.asin(Math.max(-1, Math.min(1, -uz))) / RAD;
  return { roll, pitch, flatX: Math.asin(Math.max(-1, Math.min(1, ux))) / RAD, flatY: Math.asin(Math.max(-1, Math.min(1, uy))) / RAD };
}

export interface LevelAdvice {
  /** Show the straighten line + instruction. */
  straighten: boolean;
  /** Pointing straight down: use the flat-lay guide. */
  flatLay: boolean;
  /** In flat-lay mode, the phone isn't flat enough. */
  flatLayTilted: boolean;
  /** Steep up/down angle with a person in frame. */
  eyeLevel: boolean;
}

export function levelAdvice(att: Attitude | null, opts: { personInFrame: boolean; rearCamera: boolean }): LevelAdvice {
  const none = { straighten: false, flatLay: false, flatLayTilted: false, eyeLevel: false };
  if (!att) return none;
  const flatLay = opts.rearCamera && att.pitch <= L.flatLayPitch;
  if (flatLay) {
    return { ...none, flatLay, flatLayTilted: Math.hypot(att.flatX, att.flatY) > L.flatLayTolerance };
  }
  const r = Math.abs(normalizeAngle(att.roll));
  const straighten = Math.abs(att.pitch) < L.maxPitchForRoll && r > L.minRoll && r < L.maxRoll;
  const eyeLevel = opts.personInFrame && opts.rearCamera && Math.abs(att.pitch) > L.eyeLevelPitch;
  return { ...none, straighten, eyeLevel };
}

/** Wrap to (-180, 180]. */
export function normalizeAngle(a: number): number {
  let x = ((a + 180) % 360 + 360) % 360 - 180;
  if (x === -180) x = 180;
  return x;
}
