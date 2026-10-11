export interface Point {
  x: number;
  y: number;
}

/** Normalised box: x/y top-left, w/h size, all in 0..1 frame units. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type SubjectKind = 'face' | 'person' | 'object' | 'salient';

export interface Candidate {
  kind: SubjectKind;
  box: Box;
  score: number;
  label?: string;
  /** Eye midpoint for faces, when the detector provides keypoints. */
  eyes?: Point;
}

export type Facing = 'environment' | 'user';

export interface ViewInfo {
  /** Frame width / height of what will be captured. */
  aspect: number;
  facing: Facing;
  /** Whether the preview (and the capture) is mirrored. */
  mirrored: boolean;
}
