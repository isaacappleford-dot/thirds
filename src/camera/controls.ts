import type { Point } from '../guidance/types';
import { snapToStep, type CameraFeatures } from './capabilities';

/** Every hardware control is best-effort: failures are swallowed and reported as false. */
async function apply(track: MediaStreamTrack, c: Record<string, unknown>): Promise<boolean> {
  try {
    await track.applyConstraints({ advanced: [c as MediaTrackConstraintSet] });
    return true;
  } catch {
    return false;
  }
}

export function setZoom(track: MediaStreamTrack, f: CameraFeatures, zoom: number) {
  if (!f.zoom) return Promise.resolve(false);
  return apply(track, { zoom: snapToStep(zoom, f.zoom) });
}

export function setTorch(track: MediaStreamTrack, f: CameraFeatures, on: boolean) {
  if (!f.torch) return Promise.resolve(false);
  return apply(track, { torch: on });
}

export function setExposureCompensation(track: MediaStreamTrack, f: CameraFeatures, ev: number) {
  if (!f.exposureCompensation) return Promise.resolve(false);
  return apply(track, { exposureCompensation: snapToStep(ev, f.exposureCompensation) });
}

/** Focus and meter at a point in raw (un-mirrored, un-zoomed) frame coordinates. */
export async function focusAndExposeAt(track: MediaStreamTrack, f: CameraFeatures, p: Point): Promise<boolean> {
  if (!f.pointsOfInterest) return false;
  const c: Record<string, unknown> = { pointsOfInterest: [{ x: p.x, y: p.y }] };
  if (f.focusModes.includes('single-shot')) c.focusMode = 'single-shot';
  else if (f.focusModes.includes('continuous')) c.focusMode = 'continuous';
  if (f.exposureModes.includes('single-shot')) c.exposureMode = 'single-shot';
  else if (f.exposureModes.includes('continuous')) c.exposureMode = 'continuous';
  const ok = await apply(track, c);
  // Go back to continuous AF a few seconds later so the camera keeps up with the scene.
  if (ok && c.focusMode === 'single-shot' && f.focusModes.includes('continuous')) {
    const back: Record<string, unknown> = { focusMode: 'continuous' };
    if (f.exposureModes.includes('continuous')) back.exposureMode = 'continuous';
    setTimeout(() => void apply(track, back), 4000);
  }
  return ok;
}
