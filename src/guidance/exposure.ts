import { GUIDANCE } from '../config/guidance';
import type { Box } from './types';

export interface ExposureReport {
  histogram: Uint32Array; // 256 bins
  mean: number; // 0..255
  highlightFraction: number;
  shadowFraction: number;
  highlightsClipped: boolean;
  shadowsCrushed: boolean;
  backlit: boolean;
  subjectMean: number | null;
  backgroundMean: number | null;
}

const E = GUIDANCE.exposure;

/** Rec. 709 luma from an RGBA buffer (e.g. a 64×48 getImageData). */
export function lumaFromRGBA(rgba: Uint8ClampedArray | Uint8Array, out?: Uint8Array): Uint8Array {
  const n = rgba.length >> 2;
  const luma = out && out.length === n ? out : new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    luma[i] = (rgba[j] * 54 + rgba[j + 1] * 183 + rgba[j + 2] * 19) >> 8;
  }
  return luma;
}

/**
 * Histogram-based exposure check. `subject` (normalised box) enables the
 * backlit test: subject much darker than a bright background.
 */
export function analyzeExposure(luma: Uint8Array, width: number, height: number, subject?: Box | null): ExposureReport {
  const histogram = new Uint32Array(256);
  let sum = 0;
  let sIn = 0;
  let nIn = 0;
  let sOut = 0;
  let nOut = 0;
  const sx1 = subject ? Math.floor(subject.x * width) : -1;
  const sy1 = subject ? Math.floor(subject.y * height) : -1;
  const sx2 = subject ? Math.ceil((subject.x + subject.w) * width) : -1;
  const sy2 = subject ? Math.ceil((subject.y + subject.h) * height) : -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = luma[y * width + x];
      histogram[v]++;
      sum += v;
      if (subject) {
        if (x >= sx1 && x < sx2 && y >= sy1 && y < sy2) {
          sIn += v;
          nIn++;
        } else {
          sOut += v;
          nOut++;
        }
      }
    }
  }
  const total = width * height || 1;
  let hi = 0;
  for (let v = E.highlightLevel; v < 256; v++) hi += histogram[v];
  let lo = 0;
  for (let v = 0; v <= E.shadowLevel; v++) lo += histogram[v];
  const subjectMean = nIn > 0 ? sIn / nIn : null;
  const backgroundMean = nOut > 0 ? sOut / nOut : null;
  const backlit =
    subjectMean !== null &&
    backgroundMean !== null &&
    backgroundMean >= E.backlitMinBackground &&
    subjectMean < backgroundMean * E.backlitRatio;
  return {
    histogram,
    mean: sum / total,
    highlightFraction: hi / total,
    shadowFraction: lo / total,
    highlightsClipped: hi / total > E.highlightFraction,
    shadowsCrushed: lo / total > E.shadowFraction,
    backlit,
    subjectMean,
    backgroundMean,
  };
}
