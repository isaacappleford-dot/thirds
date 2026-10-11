# Thirds — build plan

A free, installable, fully on-device camera PWA that coaches composition in real
time and finishes photos with original film-style looks and frames.

The app name lives in **`src/config/app.ts`** (used by the UI, the HTML title and
the PWA manifest). Rename it there.

## Principles

- Static site, no backend, no accounts, no analytics, no third-party requests at
  runtime. Models, WASM and fonts are served from our own origin.
- Pure, unit-tested TypeScript for every decision (guidance, scoring, direction,
  exposure, level, curves, frame layout, date formats, size limits). React and
  browser APIs only glue those together.
- Feature-detect everything; nothing is assumed (zoom, torch, focus, exposure,
  ImageCapture, orientation sensors, Web Share, persistent storage).
- iOS memory discipline: every canvas ≤ 16 MP, ≤ `MAX_TEXTURE_SIZE`, canvases
  released (`width = height = 0`) after use.

## Architecture

```
index.html                  shell (viewport-fit=cover, apple meta, title injected from config)
vite.config.ts              base path, PWA manifest (from config), code splitting
public/
  models/                   EfficientDet-Lite0 + BlazeFace .tflite (self-hosted)
  mediapipe/                tasks-vision WASM (copied from node_modules at build)
  fonts/                    DSEG7 (OFL) for the date stamp
  icons/                    generated PNG icons (any + maskable), apple-touch-icon
scripts/
  copy-assets.mjs           copies WASM + font, fetches models if missing
  gen-icons.mjs             rasterises src/assets/logo.svg to every icon size
src/
  config/app.ts             name, colours, storage keys            ← rename here
  config/guidance.ts        every guidance/scoring threshold        ← tune here
  config/looks.ts           the six original looks (parameter recipes)
  lib/                      tiny shared helpers (store, platform detection, router)
  camera/                   stream lifecycle, capability parsing, capture, controls
  guidance/                 PURE: geometry, direction, tracker, exposure, level,
                            advisor (one instruction at a time), scan score
  ml/                       lazy MediaPipe loader + detection loop, saliency fallback
  image/                    decode, EXIF orientation/date, size limits, encode
  looks/                    curves → LUT (pure), WebGL2 renderer + shaders
  frames/                   frame layout (pure), 2D compositor, date stamp formats
  gallery/                  Dexie DB, persistence/estimate, share/download
  pwa/                      SW registration, install prompt
  demo/                     generated test scenes + synthetic "camera" stream
  screens/                  Onboarding, Camera, Editor, Gallery, Viewer,
                            Settings, Privacy, Credits, Permission/NoCamera
  components/               shared UI (icon buttons, sheets, pills, sliders)
tests/e2e/                  Playwright smoke test (Chromium fake camera)
.github/workflows/          CI + GitHub Pages deploy
```

### Data flow

```
camera stream ──► <video> (contain-fit, mirrored for front)
     │                    │
     │      rVFC/rAF @ 5–10 fps ──► MediaPipe (face/object, alternating) ─┐
     │                    └──────► 64×48 luma sample ─► exposure/saliency ├─► guidance (pure) ─► overlay + pill
     │      DeviceOrientation ─────────────────────────► level/pitch ─────┘
     ▼
capture (ImageCapture.takePhoto | frame grab) ─► normalise (orientation, ≤16 MP)
     ─► IndexedDB {original, recipe, thumb, display} ─► Editor
Editor: WebGL2 (WB → curves LUT → sat/hue → split tone → fade → halation → vignette → grain → intensity mix)
     ─► 2D compositor (frame + date stamp) ─► preview canvas / full-res JPEG 0.92
```

Preview and export share one shader and one compositor; everything that has a
size (grain, halation blur, vignette, frame borders, stamp) is defined relative
to the image, and halation is computed at a fixed working resolution, so the
small preview matches the full-resolution export.

### Key decisions

- **Contain-fit preview** so what you see is exactly what is captured; guidance
  works in "display space" (normalised, post-mirroring).
- **Direction rule**: in display space, subject needs to move right ⇒ move the
  phone left. Holds for rear and for the *mirrored* front preview; inverts only
  for an un-mirrored front preview. Unit-tested.
- **Front captures are saved mirrored**, matching the preview.
- **Every capture is saved immediately** (non-destructive recipe), so nothing is
  lost if the tab is killed during editing.
- **Tailwind v3** (not v4): v4 needs Safari 16.4+, we support iOS 16.0+.
- **Detection on the main thread**, throttled and alternating face/object per
  tick: MediaPipe's GPU delegate in a worker needs WebGL OffscreenCanvas, which
  iOS 16 lacks.
- **Hash routing** so GitHub Pages needs no 404 rewrite and Android back works.

## Milestones

1. Scaffold: Vite/React/TS/Tailwind, lint, Vitest, config, PLAN.md
2. Camera: stream, flip, capabilities, tap focus/expose, torch, zoom, EV, grid, lifecycle
3. Capture: ImageCapture/frame grab, native camera input, import, EXIF, limits, demo mode
4. Looks: WebGL2 pipeline, six looks, strip, intensity, compare, export
5. Frames: Gallery, Paper, date stamp (DSEG7)
6. Gallery: IndexedDB, grid, viewer, re-edit, delete, share/download, storage
7. Guidance: detection, tracking, targets, direction, zoom/exposure/level tips, scan score
8. PWA & polish: manifest, SW, icons, install prompt, onboarding, settings,
   privacy, credits, a11y
9. Deploy: GitHub Actions → Pages, README, QA checklist, Playwright smoke

Each milestone ends with `npm run typecheck && npm run lint && npm test && npm run build` and a commit.
