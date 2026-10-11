import type { DateFormatId } from '../frames/dateStamp';

export type LookId = 'original' | 'sunday' | 'harbor' | 'neon' | 'attic' | 'ink';
export type FrameId = 'none' | 'gallery' | 'paper';

/** A non-destructive edit: everything needed to re-render a photo from its original. */
export interface Recipe {
  look: LookId;
  /** 0..1 */
  intensity: number;
  frame: FrameId;
  /** Thin keyline around the photo (Gallery frame). */
  keyline: boolean;
  stamp: boolean;
  stampFormat: DateFormatId;
  /** Grain seed, fixed per photo so every render matches. */
  seed: number;
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export function defaultRecipe(stampFormat: DateFormatId = 'yy-mm-dd'): Recipe {
  return { look: 'original', intensity: 1, frame: 'none', keyline: false, stamp: false, stampFormat, seed: newSeed() };
}

export function recipeKey(r: Recipe): string {
  return `${r.look}|${r.intensity.toFixed(3)}|${r.frame}|${r.keyline}|${r.stamp}|${r.stampFormat}|${r.seed}`;
}

export function isUnedited(r: Recipe): boolean {
  return (r.look === 'original' || r.intensity === 0) && r.frame === 'none' && !r.stamp;
}
