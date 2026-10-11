/**
 * The six original looks. Each is a plain parameter recipe for the WebGL2
 * pipeline (no third-party LUTs). Tweak freely; the editor and export both
 * read from here.
 */
import type { CurvePoints } from '../looks/curves';
import type { LookId } from '../looks/recipe';

export interface LookParams {
  /** White balance: + warmer / − cooler, + magenta / − green. Roughly −1..1. */
  temperature: number;
  tint: number;
  /** Exposure in stops. */
  exposure: number;
  curves: { master?: CurvePoints; r?: CurvePoints; g?: CurvePoints; b?: CurvePoints };
  /** 1 = unchanged. */
  saturation: number;
  /** Extra saturation for muted colours (protects already-vivid ones and skin). */
  vibrance: number;
  /** Global hue rotation in degrees. */
  hueShift: number;
  /** Black & white channel mix (weights sum to ~1), or null for colour. */
  mono: readonly [number, number, number] | null;
  split: { shadows: string; shadowAmount: number; highlights: string; highlightAmount: number; balance: number };
  /** Lifted black level (0..0.3). */
  fade: number;
  halation: { amount: number; threshold: number; /** Blur radius, fraction of the long side. */ radius: number; color: string };
  /** Grain strength and size (1 = fine 35mm-ish, 2 = coarse). */
  grain: { amount: number; size: number };
  vignette: { amount: number; midpoint: number; feather: number };
}

export interface LookDef {
  id: LookId;
  name: string;
  /** One-line description for screen readers and the strip's long-press hint. */
  description: string;
  params: LookParams;
}

export const NEUTRAL: LookParams = {
  temperature: 0,
  tint: 0,
  exposure: 0,
  curves: {},
  saturation: 1,
  vibrance: 0,
  hueShift: 0,
  mono: null,
  split: { shadows: '#808080', shadowAmount: 0, highlights: '#808080', highlightAmount: 0, balance: 0 },
  fade: 0,
  halation: { amount: 0, threshold: 0.75, radius: 0.02, color: '#ff5a1f' },
  grain: { amount: 0, size: 1 },
  vignette: { amount: 0, midpoint: 0.55, feather: 0.5 },
};

export const LOOKS: LookDef[] = [
  { id: 'original', name: 'Original', description: 'No change', params: NEUTRAL },
  {
    id: 'sunday',
    name: 'Sunday',
    description: 'Warm, soft contrast, gentle skin tones',
    params: {
      ...NEUTRAL,
      temperature: 0.28,
      tint: 0.05,
      exposure: 0.05,
      curves: {
        master: [[0, 0.035], [0.25, 0.27], [0.5, 0.525], [0.78, 0.79], [1, 0.975]],
        r: [[0, 0.01], [0.5, 0.525], [1, 1]],
        b: [[0, 0.03], [0.5, 0.475], [1, 0.95]],
      },
      saturation: 0.94,
      vibrance: 0.12,
      split: { shadows: '#7a5a48', shadowAmount: 0.12, highlights: '#ffd9b0', highlightAmount: 0.1, balance: 0.05 },
      fade: 0.025,
      halation: { amount: 0.14, threshold: 0.78, radius: 0.025, color: '#ff7a3c' },
      grain: { amount: 0.03, size: 1 },
      vignette: { amount: 0.16, midpoint: 0.55, feather: 0.55 },
    },
  },
  {
    id: 'harbor',
    name: 'Harbor',
    description: 'Cool and crisp, teal-green shadows, clean whites',
    params: {
      ...NEUTRAL,
      temperature: -0.2,
      tint: -0.05,
      curves: {
        master: [[0, 0], [0.22, 0.19], [0.5, 0.51], [0.78, 0.825], [1, 1]],
        r: [[0, 0], [0.3, 0.26], [0.75, 0.76], [1, 1]],
        g: [[0, 0.025], [0.3, 0.32], [1, 1]],
        b: [[0, 0.045], [0.35, 0.37], [0.8, 0.8], [1, 0.985]],
      },
      saturation: 1.02,
      vibrance: 0.15,
      hueShift: -3,
      split: { shadows: '#1f8a7d', shadowAmount: 0.2, highlights: '#e9f5ff', highlightAmount: 0.06, balance: -0.05 },
      grain: { amount: 0.02, size: 0.9 },
      vignette: { amount: 0.1, midpoint: 0.6, feather: 0.5 },
    },
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Night film feel: heavy grain, glowing highlights, deep blacks',
    params: {
      ...NEUTRAL,
      temperature: -0.06,
      tint: 0.07,
      curves: {
        master: [[0, 0], [0.12, 0.035], [0.4, 0.37], [0.75, 0.81], [1, 1]],
        b: [[0, 0.03], [0.5, 0.52], [1, 1]],
      },
      saturation: 1.15,
      vibrance: 0.1,
      split: { shadows: '#33237a', shadowAmount: 0.18, highlights: '#ffb27a', highlightAmount: 0.12, balance: 0 },
      halation: { amount: 0.7, threshold: 0.58, radius: 0.03, color: '#ff4a1a' },
      grain: { amount: 0.11, size: 1.7 },
      vignette: { amount: 0.34, midpoint: 0.5, feather: 0.55 },
    },
  },
  {
    id: 'attic',
    name: 'Attic',
    description: 'Faded vintage: lifted blacks, warm cast, muted colour',
    params: {
      ...NEUTRAL,
      temperature: 0.22,
      tint: 0.03,
      curves: {
        master: [[0, 0], [0.3, 0.31], [0.7, 0.71], [1, 0.93]],
        r: [[0, 0.03], [0.5, 0.54], [1, 1]],
        g: [[0, 0.01], [0.5, 0.51], [1, 0.98]],
        b: [[0, 0.06], [0.5, 0.455], [1, 0.86]],
      },
      saturation: 0.7,
      split: { shadows: '#6b4a2e', shadowAmount: 0.14, highlights: '#fff0c8', highlightAmount: 0.12, balance: 0.1 },
      fade: 0.11,
      halation: { amount: 0.12, threshold: 0.75, radius: 0.03, color: '#ff8a40' },
      grain: { amount: 0.06, size: 1.3 },
      vignette: { amount: 0.26, midpoint: 0.5, feather: 0.6 },
    },
  },
  {
    id: 'ink',
    name: 'Ink',
    description: 'Rich black and white, punchy contrast, fine grain',
    params: {
      ...NEUTRAL,
      mono: [0.4, 0.5, 0.1],
      curves: { master: [[0, 0], [0.18, 0.1], [0.5, 0.5], [0.82, 0.9], [1, 1]] },
      grain: { amount: 0.065, size: 0.85 },
      vignette: { amount: 0.22, midpoint: 0.5, feather: 0.55 },
    },
  },
];

export function getLook(id: LookId): LookDef {
  return LOOKS.find((l) => l.id === id) ?? LOOKS[0];
}
