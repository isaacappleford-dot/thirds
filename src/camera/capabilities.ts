/**
 * Camera feature detection from MediaStreamTrack.getCapabilities()/getSettings().
 * Pure so it can be unit-tested with capability objects captured from real phones.
 */

export interface Range {
  min: number;
  max: number;
  step: number;
}

/** The parts of the Image Capture spec's track capabilities we care about. */
export interface ExtendedCapabilities {
  zoom?: Partial<Range>;
  torch?: boolean | boolean[];
  focusMode?: string[];
  exposureMode?: string[];
  exposureCompensation?: Partial<Range>;
  width?: Partial<Range>;
  height?: Partial<Range>;
}

export interface ExtendedSettings {
  zoom?: number;
  torch?: boolean;
  focusMode?: string;
  exposureMode?: string;
  exposureCompensation?: number;
  pointsOfInterest?: unknown;
  width?: number;
  height?: number;
  facingMode?: string;
}

export interface CameraFeatures {
  /** Hardware zoom range, or null (use digital crop zoom). */
  zoom: Range | null;
  torch: boolean;
  /** Tap-to-focus/expose via pointsOfInterest. */
  pointsOfInterest: boolean;
  focusModes: string[];
  exposureModes: string[];
  exposureCompensation: Range | null;
}

function range(r: Partial<Range> | undefined, fallbackStep: number): Range | null {
  if (!r || typeof r.min !== 'number' || typeof r.max !== 'number' || !(r.max > r.min)) return null;
  return { min: r.min, max: r.max, step: typeof r.step === 'number' && r.step > 0 ? r.step : fallbackStep };
}

export function parseCapabilities(caps: ExtendedCapabilities | null | undefined, settings: ExtendedSettings | null | undefined): CameraFeatures {
  const c = caps ?? {};
  const s = settings ?? {};
  const torch = Array.isArray(c.torch) ? c.torch.includes(true) : c.torch === true;
  const focusModes = Array.isArray(c.focusMode) ? c.focusMode : [];
  const exposureModes = Array.isArray(c.exposureMode) ? c.exposureMode : [];
  const poiModes = [...focusModes, ...exposureModes].some((m) => m === 'single-shot' || m === 'continuous');
  return {
    zoom: range(c.zoom, 0.1),
    torch,
    pointsOfInterest: 'pointsOfInterest' in s && poiModes,
    focusModes,
    exposureModes,
    exposureCompensation: range(c.exposureCompensation, 1 / 3),
  };
}

export const NO_FEATURES: CameraFeatures = {
  zoom: null,
  torch: false,
  pointsOfInterest: false,
  focusModes: [],
  exposureModes: [],
  exposureCompensation: null,
};

/** Zoom presets to show as chips: 1×, 2×, 3× (within range), plus the max for short ranges. */
export function zoomPresets(features: CameraFeatures, digitalMax = 4): number[] {
  const min = features.zoom ? Math.max(features.zoom.min, 1) : 1;
  const max = features.zoom ? features.zoom.max : digitalMax;
  const presets = [min, 2, 3].filter((z, i) => i === 0 || (z > min && z <= max));
  return [...new Set(presets)];
}

export function snapToStep(v: number, r: Range): number {
  const snapped = r.min + Math.round((v - r.min) / r.step) * r.step;
  return Math.min(r.max, Math.max(r.min, Number(snapped.toFixed(4))));
}
