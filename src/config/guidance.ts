/**
 * Every threshold the composition coach uses, in one place.
 *
 * Coordinates are normalised to the captured frame: (0,0) top-left,
 * (1,1) bottom-right. Distances are measured relative to the frame's short side.
 */
export const GUIDANCE = {
  detection: {
    /** Target detection rate. Face and object detectors alternate ticks. */
    fps: 8,
    objectMinScore: 0.45,
    faceMinScore: 0.6,
    maxObjects: 5,
    /** Detections smaller than this (area) are ignored as noise. */
    minArea: 0.002,
  },
  tracking: {
    /** Minimum IoU for a detection to continue an existing track. */
    iouMatch: 0.25,
    /** Exponential smoothing weight for a new detection (0 = frozen, 1 = raw). */
    alpha: 0.45,
    /** A track not seen for this long is dropped. */
    lostAfterMs: 900,
    /** UI follow speed of the reticle (1/s); higher = snappier. */
    reticleFollow: 14,
  },
  target: {
    /** Subjects with area above this (or any side above fillSide) aim for the centre. */
    fillArea: 0.38,
    fillSide: 0.75,
    /** A face wider than this is a close-up: centre horizontally, eyes on the upper third. */
    faceCloseUpWidth: 0.3,
    /** Where eyes sit inside a face box when there are no keypoints (fraction from the top). */
    eyesInFaceBox: 0.4,
    /** Head position inside a person box (fraction from the top). */
    headInPersonBox: 0.1,
    /** Keep the current intersection unless another is closer by this much. */
    switchMargin: 0.08,
    /** Keep subjects at least this far from the edges when choosing the target. */
    edgePadding: 0.03,
  },
  lock: {
    /** Lock when anchor is within this distance of the target… */
    enter: 0.045,
    /** …and only unlock again beyond this (hysteresis). */
    exit: 0.075,
    vibrateMs: 18,
  },
  framing: {
    /** Below this area a subject is "tiny": suggest moving closer / zooming in. */
    tinyArea: 0.05,
    /** One-tap zoom aims for a subject of this area. */
    zoomTargetArea: 0.14,
    /** A box within this distance of an edge counts as touching it. */
    edgeTouch: 0.012,
    /** Objects bigger than this are deliberate fill-the-frame shots; don't nag about edges. */
    edgeIgnoreArea: 0.6,
    /** Face box top closer than this to the top edge needs headroom. */
    faceHeadroom: 0.06,
    /** Person box top closer than this to the top edge needs headroom. */
    personHeadroom: 0.025,
  },
  exposure: {
    /** Sample size for the luminance histogram. */
    sampleWidth: 64,
    sampleHeight: 48,
    highlightLevel: 250,
    highlightFraction: 0.06,
    shadowLevel: 6,
    shadowFraction: 0.14,
    /** Backlit: subject mean < ratio × background mean, with a bright background. */
    backlitRatio: 0.55,
    backlitMinBackground: 140,
  },
  saliency: {
    /** Centre weighting (Gaussian sigma, in frame units). */
    centerSigma: 0.38,
    /** Region grows over cells above this fraction of the peak. */
    regionThreshold: 0.45,
    /** Mean gradient energy below this = flat scene, no salient region. */
    minPeak: 6,
  },
  level: {
    /** Show "Straighten" between these roll angles (degrees). Bigger tilts look intentional. */
    minRoll: 2,
    maxRoll: 10,
    /** Ignore roll when the phone points this steeply up/down (roll is meaningless). */
    maxPitchForRoll: 55,
    /** With a person in frame, suggest eye level beyond this pitch. */
    eyeLevelPitch: 25,
    /** Pointing down beyond this pitch switches to the flat-lay guide. */
    flatLayPitch: -68,
    /** In flat-lay mode, tilt beyond this (degrees) asks to hold the phone flat. */
    flatLayTolerance: 4,
  },
  advisor: {
    /** An instruction must persist this long before it appears. */
    showAfterMs: 450,
    /** Once shown, keep it at least this long unless it is resolved. */
    minShowMs: 1500,
    /** A resolved instruction lingers this long so brief flickers don't clear it. */
    hideAfterMs: 350,
  },
  scan: {
    durationMs: 1000,
    maxTips: 3,
  },
  /** Higher = more important. Only the top instruction is shown. */
  priority: {
    cutoff: 90,
    flatlay: 85,
    backlit: 80,
    closer: 75,
    headroom: 70,
    straighten: 65,
    eyelevel: 60,
    move: 50,
    highlights: 40,
    shadows: 35,
    locked: 10,
    find: 5,
  },
  /** Scan-score penalties (points off 100). */
  penalty: {
    noSubject: 22,
    placementMax: 28,
    /** Distance at which the placement penalty maxes out. */
    placementFull: 0.28,
    levelMax: 14,
    cutoff: 18,
    tiny: 14,
    headroom: 9,
    eyelevel: 8,
    backlit: 14,
    highlightsMax: 10,
    shadowsMax: 8,
  },
} as const;

export type GuidanceConfig = typeof GUIDANCE;
