/**
 * App identity. Rename the app here — the UI, the HTML <title> and the PWA
 * manifest all read from this file.
 */
export const APP = {
  name: 'Thirds',
  shortName: 'Thirds',
  tagline: 'A camera that helps you compose.',
  description:
    'A free camera that coaches you into a well-composed shot in real time, then finishes it with film-style looks and frames. Everything stays on your phone.',
  /** Background of the camera-first UI; also the PWA theme/background colour. */
  themeColor: '#0a0a0b',
  backgroundColor: '#0a0a0b',
  /** Prefix for localStorage keys and the IndexedDB name. */
  storagePrefix: 'thirds',
  /** File name prefix for exported photos, e.g. thirds-2025-10-11-1432.jpg */
  filePrefix: 'thirds',
} as const;
