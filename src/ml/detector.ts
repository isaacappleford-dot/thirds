import type { Detection, FaceDetector, ObjectDetector } from '@mediapipe/tasks-vision';
import { GUIDANCE } from '../config/guidance';
import type { Candidate } from '../guidance/types';
import { asset } from '../lib/platform';

export type Delegate = 'GPU' | 'CPU';

export interface Detectors {
  delegate: Delegate;
  /**
   * Raw-frame (un-mirrored) candidates, normalised 0..1. The frame is a 2D
   * canvas copy of the video, not the <video> itself: iOS Safari can upload
   * camera video to WebGL flipped, which put the reticle on the mirror image
   * of the subject and inverted every direction. Canvas uploads are reliable.
   */
  faces(frame: HTMLCanvasElement, ts: number): Candidate[];
  objects(frame: HTMLCanvasElement, ts: number): Candidate[];
  close(): void;
}

const D = GUIDANCE.detection;

function toCandidates(dets: Detection[], w: number, h: number, kindOf: (d: Detection) => Candidate['kind'] | null): Candidate[] {
  const out: Candidate[] = [];
  for (const d of dets) {
    const bb = d.boundingBox;
    if (!bb) continue;
    const kind = kindOf(d);
    if (!kind) continue;
    const box = { x: bb.originX / w, y: bb.originY / h, w: bb.width / w, h: bb.height / h };
    if (box.w * box.h < D.minArea) continue;
    const cand: Candidate = { kind, box, score: d.categories?.[0]?.score ?? 0, label: d.categories?.[0]?.categoryName };
    if (kind === 'face' && d.keypoints?.length >= 2) {
      // BlazeFace keypoints are normalised: [0] right eye, [1] left eye.
      cand.eyes = { x: (d.keypoints[0].x + d.keypoints[1].x) / 2, y: (d.keypoints[0].y + d.keypoints[1].y) / 2 };
    }
    out.push(cand);
  }
  return out;
}

/**
 * Loads MediaPipe (code-split; only fetched after the first camera frame) and
 * both models from our own origin. Tries the GPU delegate, falls back to CPU.
 */
export async function loadDetectors(): Promise<Detectors> {
  const vision = await import('@mediapipe/tasks-vision');
  const fileset = await vision.FilesetResolver.forVisionTasks(asset('mediapipe').replace(/\/$/, ''));

  const make = async (delegate: Delegate) => {
    const objects: ObjectDetector = await vision.ObjectDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: asset('models/efficientdet_lite0.tflite'), delegate },
      runningMode: 'VIDEO',
      scoreThreshold: D.objectMinScore,
      maxResults: D.maxObjects,
    });
    let faces: FaceDetector;
    try {
      faces = await vision.FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: asset('models/blaze_face_short_range.tflite'), delegate },
        runningMode: 'VIDEO',
        minDetectionConfidence: D.faceMinScore,
      });
    } catch (e) {
      objects.close();
      throw e;
    }
    return { objects, faces };
  };

  let delegate: Delegate = 'GPU';
  let models: { objects: ObjectDetector; faces: FaceDetector };
  try {
    models = await make('GPU');
  } catch {
    delegate = 'CPU';
    models = await make('CPU');
  }

  // MediaPipe requires strictly increasing timestamps per task.
  let lastTs = 0;
  const ts = (t: number) => (lastTs = Math.max(lastTs + 1, Math.round(t)));

  // If the GPU path throws at runtime (some mobile GPUs), rebuild on CPU once.
  let rebuilding = false;
  const guard = <T,>(fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch {
      if (delegate === 'GPU' && !rebuilding) {
        rebuilding = true;
        delegate = 'CPU';
        const old = models;
        make('CPU')
          .then((m) => {
            models = m;
            old.objects.close();
            old.faces.close();
          })
          .catch(() => {})
          .finally(() => (rebuilding = false));
      }
      return fallback;
    }
  };

  return {
    get delegate() {
      return delegate;
    },
    faces(frame, t) {
      return guard(() => {
        const r = models.faces.detectForVideo(frame, ts(t));
        return toCandidates(r.detections, frame.width, frame.height, () => 'face');
      }, []);
    },
    objects(frame, t) {
      return guard(() => {
        const r = models.objects.detectForVideo(frame, ts(t));
        return toCandidates(r.detections, frame.width, frame.height, (d) =>
          d.categories?.[0]?.categoryName === 'person' ? 'person' : 'object',
        );
      }, []);
    },
    close() {
      models.objects.close();
      models.faces.close();
    },
  };
}

let shared: Promise<Detectors> | null = null;

/** One detector instance for the app's lifetime (MediaPipe is expensive to boot). */
export function getDetectors(): Promise<Detectors> {
  if (!shared) {
    shared = loadDetectors().catch((e) => {
      shared = null;
      throw e;
    });
  }
  return shared;
}
