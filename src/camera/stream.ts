import type { Facing } from '../guidance/types';
import { NO_FEATURES, parseCapabilities, type CameraFeatures, type ExtendedCapabilities, type ExtendedSettings } from './capabilities';

export type CameraErrorKind = 'denied' | 'nocamera' | 'insecure' | 'busy' | 'error';

export class CameraError extends Error {
  constructor(
    public kind: CameraErrorKind,
    message: string,
  ) {
    super(message);
  }
}

export interface CameraSession {
  stream: MediaStream;
  track: MediaStreamTrack;
  facing: Facing;
  features: CameraFeatures;
  demo: boolean;
  stop(): void;
}

export function cameraSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

/** Highest resolution we ask for; browsers pick the closest they support. */
const IDEAL = { width: { ideal: 4096 }, height: { ideal: 3072 } };

export async function openCamera(facing: Facing): Promise<CameraSession> {
  if (!window.isSecureContext) throw new CameraError('insecure', 'The camera needs a secure (https) connection.');
  if (!cameraSupported()) throw new CameraError('nocamera', 'This browser can’t use the camera.');

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, ...IDEAL } });
  } catch (e) {
    const name = (e as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new CameraError('denied', 'Camera access was blocked.');
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') throw new CameraError('nocamera', 'No camera found.');
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      throw new CameraError('busy', 'The camera is being used by another app.');
    }
    // OverconstrainedError or anything else: retry with the bare minimum.
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: facing } });
    } catch (e2) {
      const n2 = (e2 as DOMException)?.name;
      if (n2 === 'NotAllowedError') throw new CameraError('denied', 'Camera access was blocked.');
      throw new CameraError('nocamera', 'Couldn’t start the camera.');
    }
  }
  const track = stream.getVideoTracks()[0];
  if (!track) {
    stream.getTracks().forEach((t) => t.stop());
    throw new CameraError('nocamera', 'No video track.');
  }
  const settings = (track.getSettings?.() ?? {}) as ExtendedSettings;
  let caps: ExtendedCapabilities = {};
  try {
    caps = (track.getCapabilities?.() ?? {}) as ExtendedCapabilities;
  } catch {
    /* Firefox/older Safari: no getCapabilities */
  }
  const actualFacing: Facing = settings.facingMode === 'user' ? 'user' : settings.facingMode === 'environment' ? 'environment' : facing;
  return {
    stream,
    track,
    facing: actualFacing,
    features: parseCapabilities(caps, settings),
    demo: false,
    stop: () => stream.getTracks().forEach((t) => t.stop()),
  };
}

export function demoSession(stream: MediaStream, stop: () => void): CameraSession {
  return { stream, track: stream.getVideoTracks()[0], facing: 'environment', features: NO_FEATURES, demo: true, stop };
}

/** Whether a second camera exists (only known after permission is granted). */
export async function hasMultipleCameras(): Promise<boolean> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'videoinput').length > 1;
  } catch {
    return true;
  }
}
