import { useEffect } from 'react';
import { attitudeFromOrientation, normalizeAngle, type Attitude } from '../guidance/level';

type PermissionFn = () => Promise<'granted' | 'denied' | 'default'>;

function requestFns(): PermissionFn[] {
  const fns: PermissionFn[] = [];
  const DOE = (typeof window !== 'undefined' ? window.DeviceOrientationEvent : undefined) as unknown as { requestPermission?: PermissionFn } | undefined;
  if (typeof DOE?.requestPermission === 'function') fns.push(DOE.requestPermission.bind(DOE));
  return fns;
}

/** iOS 13+ needs an explicit permission prompt, triggered by a tap. */
export function needsMotionPermission(): boolean {
  return requestFns().length > 0;
}

let granted: boolean | null = null;

/** Call from a user gesture (tap). Resolves true if orientation events will flow. */
export async function requestMotionPermission(): Promise<boolean> {
  if (granted !== null) return granted;
  const fns = requestFns();
  if (fns.length === 0) return (granted = true);
  try {
    const results = await Promise.all(fns.map((f) => f()));
    granted = results.every((r) => r === 'granted');
  } catch {
    // Throws if not called from a gesture; try again on the next tap.
    return false;
  }
  return granted;
}

function screenAngle(): number {
  const so = typeof screen !== 'undefined' ? screen.orientation : undefined;
  if (so && typeof so.angle === 'number') return so.angle;
  const legacy = (window as unknown as { orientation?: number }).orientation;
  return typeof legacy === 'number' ? legacy : 0;
}

/**
 * Streams a smoothed device attitude (roll/pitch) to `onAttitude`. Uses a
 * callback rather than state so 60 Hz sensor events never re-render React.
 */
export function useOrientation(enabled: boolean, onAttitude: (a: Attitude | null) => void) {
  useEffect(() => {
    if (!enabled) {
      onAttitude(null);
      return;
    }
    let smooth: Attitude | null = null;
    const k = 0.25;
    const onEvent = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      const a = attitudeFromOrientation(e.beta, e.gamma, screenAngle());
      if (!smooth) smooth = a;
      else {
        smooth = {
          roll: normalizeAngle(smooth.roll + normalizeAngle(a.roll - smooth.roll) * k),
          pitch: smooth.pitch + (a.pitch - smooth.pitch) * k,
          flatX: smooth.flatX + (a.flatX - smooth.flatX) * k,
          flatY: smooth.flatY + (a.flatY - smooth.flatY) * k,
        };
      }
      onAttitude(smooth);
    };
    window.addEventListener('deviceorientation', onEvent);
    return () => {
      window.removeEventListener('deviceorientation', onEvent);
      onAttitude(null);
    };
  }, [enabled, onAttitude]);
}
