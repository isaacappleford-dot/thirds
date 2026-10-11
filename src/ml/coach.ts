import { GUIDANCE } from '../config/guidance';
import { displayBoxToSample, rawBoxToDisplay, rawPointToDisplay, type SpaceInfo } from '../camera/space';
import { candidateInstructions, InstructionStabilizer, type Capabilities, type Instruction } from '../guidance/advisor';
import { analyzeFrame, type FrameAnalysis } from '../guidance/analyze';
import { analyzeExposure, lumaFromRGBA, type ExposureReport } from '../guidance/exposure';
import { mirrorBox } from '../guidance/geometry';
import type { Attitude } from '../guidance/level';
import { salientRegion } from '../guidance/saliency';
import { scoreScan, type ScanResult } from '../guidance/score';
import { SubjectTracker, type Track } from '../guidance/tracker';
import type { Candidate, Facing, Point } from '../guidance/types';
import { context2d, createCanvas, releaseCanvas } from '../image/canvas';
import { vibrate } from '../lib/platform';
import { getDetectors, type Detectors } from './detector';

export type DetectorStatus = 'off' | 'loading' | 'ready' | 'unavailable';

export interface CoachState {
  analysis: FrameAnalysis | null;
  instruction: Instruction | null;
  subject: Track | null;
  tracks: readonly Track[];
  detector: DetectorStatus;
  scanning: boolean;
}

export interface CoachView extends SpaceInfo {
  facing: Facing;
}

type VideoWithRVFC = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number) => void) => number;
  cancelVideoFrameCallback?: (h: number) => void;
};

const E = GUIDANCE.exposure;

/**
 * The live composition coach. Runs detection at a throttled rate off the
 * video's frame clock, keeps everything else (tracking, analysis, advice) in
 * the pure guidance modules, and publishes a small state object.
 */
export class Coach {
  state: CoachState = { analysis: null, instruction: null, subject: null, tracks: [], detector: 'off', scanning: false };
  attitude: Attitude | null = null;
  view: CoachView = { facing: 'environment', mirrored: false, digitalZoom: 1 };
  caps: Capabilities = { canZoom: true, canExposure: false };
  guidance = true;

  private tracker = new SubjectTracker();
  private stabilizer = new InstructionStabilizer();
  private detectors: Detectors | null = null;
  private video: VideoWithRVFC | null = null;
  private running = false;
  private handle = 0;
  private lastTick = 0;
  private tickNo = 0;
  private faces: { c: Candidate[]; t: number } = { c: [], t: 0 };
  private objects: { c: Candidate[]; t: number } = { c: [], t: 0 };
  private sample: HTMLCanvasElement | null = null;
  private sampleCtx: CanvasRenderingContext2D | null = null;
  private luma: Uint8Array | undefined;
  private scanFrames: FrameAnalysis[] | null = null;
  private listeners = new Set<(s: CoachState) => void>();

  subscribe(fn: (s: CoachState) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  start(video: HTMLVideoElement) {
    this.video = video as VideoWithRVFC;
    if (this.running) return;
    this.running = true;
    this.schedule();
    if (this.guidance) this.ensureDetectors();
  }

  stop() {
    this.running = false;
    const v = this.video;
    if (v && this.handle) {
      if (v.cancelVideoFrameCallback) v.cancelVideoFrameCallback(this.handle);
      cancelAnimationFrame(this.handle);
    }
    this.handle = 0;
    releaseCanvas(this.sample);
    this.sample = null;
    this.sampleCtx = null;
  }

  setGuidance(on: boolean) {
    this.guidance = on;
    if (on) this.ensureDetectors();
    this.reset();
  }

  reset() {
    this.tracker.reset();
    this.stabilizer.reset();
    this.faces = { c: [], t: 0 };
    this.objects = { c: [], t: 0 };
    this.state = { ...this.state, analysis: null, instruction: null, subject: null, tracks: [] };
  }

  /** Select the subject under a tap (display coordinates). */
  pinAt(p: Point): Track | null {
    return this.tracker.pinAt(p);
  }

  /** Collect ~1 s of analysed frames and score them. */
  scan(): Promise<ScanResult> {
    this.scanFrames = [];
    this.publish({ scanning: true });
    return new Promise((resolve) => {
      setTimeout(() => {
        const frames = this.scanFrames ?? [];
        this.scanFrames = null;
        this.publish({ scanning: false });
        resolve(scoreScan(frames, this.caps));
      }, GUIDANCE.scan.durationMs);
    });
  }

  private ensureDetectors() {
    if (this.detectors || this.state.detector === 'loading') return;
    this.publish({ detector: 'loading' });
    getDetectors()
      .then((d) => {
        this.detectors = d;
        this.publish({ detector: 'ready' });
      })
      .catch(() => this.publish({ detector: 'unavailable' }));
  }

  private schedule() {
    if (!this.running || !this.video) return;
    const v = this.video;
    const cb = (now: number) => {
      this.handle = 0;
      if (!this.running) return;
      if (now - this.lastTick >= 1000 / GUIDANCE.detection.fps - 4) {
        this.lastTick = now;
        try {
          this.tick(now);
        } catch {
          /* never let a bad frame kill the loop */
        }
      }
      this.schedule();
    };
    this.handle = v.requestVideoFrameCallback ? v.requestVideoFrameCallback(cb) : requestAnimationFrame(cb);
  }

  private sampleFrame(v: HTMLVideoElement): Uint8Array | null {
    const portrait = v.videoHeight > v.videoWidth;
    const w = portrait ? E.sampleHeight : E.sampleWidth;
    const h = portrait ? E.sampleWidth : E.sampleHeight;
    if (!this.sample || this.sample.width !== w || this.sample.height !== h) {
      releaseCanvas(this.sample);
      this.sample = createCanvas(w, h);
      this.sampleCtx = context2d(this.sample, { willReadFrequently: true });
    }
    const z = Math.max(1, this.view.digitalZoom);
    const cw = v.videoWidth / z;
    const ch = v.videoHeight / z;
    const ctx = this.sampleCtx!;
    ctx.drawImage(v, (v.videoWidth - cw) / 2, (v.videoHeight - ch) / 2, cw, ch, 0, 0, w, h);
    this.luma = lumaFromRGBA(ctx.getImageData(0, 0, w, h).data, this.luma);
    return this.luma;
  }

  private tick(now: number) {
    const v = this.video;
    if (!v || v.readyState < 2 || !v.videoWidth) return;
    const space: SpaceInfo = { mirrored: this.view.mirrored, digitalZoom: this.view.digitalZoom };
    const aspect = v.videoWidth / v.videoHeight;
    const prev = this.state.analysis;

    if (!this.guidance) {
      // Level only: no detection, no sampling.
      const analysis = analyzeFrame({ subject: null, view: { aspect, facing: this.view.facing, mirrored: this.view.mirrored }, attitude: this.attitude, exposure: null, personInFrame: false, prev });
      this.publish({ analysis, instruction: null, subject: null, tracks: [] });
      return;
    }

    const t = performance.now();
    if (this.detectors) {
      // Alternate detectors to keep each tick's main-thread cost small.
      if (this.tickNo++ % 2 === 0) this.objects = { c: this.detectors.objects(v, t), t: now };
      else this.faces = { c: this.detectors.faces(v, t), t: now };
    }
    const fresh = (r: { c: Candidate[]; t: number }) => (now - r.t < 600 ? r.c : []);
    const toDisplay = (c: Candidate): Candidate | null => {
      const box = rawBoxToDisplay(c.box, space);
      if (!box) return null;
      return { ...c, box, eyes: c.eyes ? rawPointToDisplay(c.eyes, space) : undefined };
    };
    const cands = [...fresh(this.faces), ...fresh(this.objects)].map(toDisplay).filter((c): c is Candidate => !!c);

    const luma = this.sampleFrame(v);
    const sw = this.sample!.width;
    const sh = this.sample!.height;
    if (cands.length === 0 && luma) {
      const sal = salientRegion(luma, sw, sh);
      if (sal) cands.push({ kind: 'salient', box: this.view.mirrored ? mirrorBox(sal) : sal, score: 0.5 });
    }

    const subject = this.tracker.update(cands, now);
    let exposure: ExposureReport | null = null;
    if (luma) exposure = analyzeExposure(luma, sw, sh, subject ? displayBoxToSample(subject.box, space) : null);

    const personInFrame = this.tracker.all.some((tr) => tr.kind === 'face' || tr.kind === 'person');
    const analysis = analyzeFrame({
      subject,
      view: { aspect, facing: this.view.facing, mirrored: this.view.mirrored },
      attitude: this.attitude,
      exposure,
      personInFrame,
      prev,
    });
    if (analysis.locked && !prev?.locked) vibrate(GUIDANCE.lock.vibrateMs);
    this.scanFrames?.push(analysis);
    const instruction = this.stabilizer.update(candidateInstructions(analysis, this.caps), now);
    this.publish({ analysis, instruction, subject, tracks: this.tracker.all });
  }

  private publish(patch: Partial<CoachState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  }
}
