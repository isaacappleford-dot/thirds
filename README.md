# Thirds

A free, installable camera web app (PWA) for iPhone and Android. It coaches you into a well‑composed shot in real time, then lets you finish the photo with original film‑style looks, frames and a 90s date stamp.

- **100 % free.** No accounts, paywall, ads, in‑app purchases or analytics.
- **Private.** Everything runs on the phone. Photos never leave the device, and after the app loads it makes no requests to other servers. The ML models, WASM runtime and fonts are all self‑hosted.
- **Static.** No backend, so it can be hosted for $0 on GitHub Pages, Vercel or Netlify.

> **Renaming:** the name lives in [`src/config/app.ts`](src/config/app.ts). The UI, the HTML `<title>` and the PWA manifest all read it from there.
> Guidance thresholds live in [`src/config/guidance.ts`](src/config/guidance.ts) and the six looks in [`src/config/looks.ts`](src/config/looks.ts).

Architecture and milestones are in [PLAN.md](PLAN.md). The manual test plan is in [docs/QA.md](docs/QA.md).

## Features

- **Camera:** rear/front with a mirrored selfie preview, highest available resolution, full‑sensor stills via `ImageCapture` on Chrome Android, frame grab elsewhere. Tap to focus/expose, torch, hardware zoom or a digital crop zoom, pinch zoom, exposure compensation and a thirds grid. Every capability is feature‑detected.
- **Composition coach:** MediaPipe face and object detection (GPU with CPU fallback, 8 fps), a tracked subject reticle, a rule‑of‑thirds target, "move the phone" arrows, lock + haptic, zoom/headroom/cut‑off tips, exposure tips (clipping, crushed shadows, backlit), level and eye‑level hints, a flat‑lay guide, and a 1‑second **Scan** with a 0–100 score and tips that each explain *why*.
- **Looks:** Original, Sunday, Harbor, Neon, Attic, Ink. A WebGL2 pipeline (white balance → tone‑curve LUT → saturation/hue → split toning → fade → halation → vignette → seeded grain) with an intensity slider and hold‑to‑compare. Preview and export use the same code.
- **Frames:** None, Gallery (white mat, optional keyline) and Paper (textured sheet), plus an orange seven‑segment date stamp (DSEG7, bundled) in three formats.
- **Gallery:** IndexedDB, non‑destructive (the original and its recipe are stored), with a grid, a swipe viewer, re‑edit, delete, Share → "Save Image" on iPhone or download, persistent‑storage request and a usage readout.
- **PWA:** offline after the first load, installable (Android prompt, iPhone how‑to), safe‑area aware and portrait‑first. Respects Reduce Motion, works with screen readers, and announces tips.
- **Demo mode:** a generated animated scene stands in for the camera, plus three generated sample photos, so everything works on a desktop without a camera.

## Run locally

Requirements: Node 20+ (CI uses 22).

```bash
npm install
npm run dev          # http://localhost:5173 (camera works on localhost)
```

`npm run dev` first runs `scripts/copy-assets.mjs`. That copies the MediaPipe WASM and the DSEG7 font from `node_modules` into `public/`, and downloads the two `.tflite` models only if they're missing (they're committed in `public/models/`).

No camera on your computer? Open **Settings → Demo camera**, or use **+ → Sample photos**.

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run check` | typecheck + lint + unit tests + production build |
| `npm test` | Vitest unit tests (guidance, direction, scoring, curves, frames, limits…) |
| `npm run build` / `npm run preview` | production build in `dist/` and a local server for it |
| `npm run test:e2e` | Playwright smoke test against the build, using Chromium's fake camera (`npx playwright install chromium` first if you don't have it) |
| `npm run icons` | regenerate PNG icons from `src/assets/logo.svg` |

## Test on a real phone (HTTPS required)

Browsers only allow the camera on `https://` (or `localhost`). Pick one:

1. **Deploy and open the real URL (recommended).** Push to `main` and open the GitHub Pages URL on your phone. This is also the only way to test install, offline mode and the service worker properly.
2. **Self‑signed HTTPS on your Wi‑Fi.** `npm run dev:https` (dev) or `npm run build && npm run preview:https` (production build). Then open `https://<your-computer's-LAN-IP>:5173` (dev) or `:4173` (preview) on the phone, which must be on the same Wi‑Fi.
   - iPhone Safari: *Show Details → visit this website → Visit Website*.
   - Android Chrome: *Advanced → Proceed*.
   - The camera works. The service worker won't register with a self‑signed certificate, so offline/install can't be tested this way.
3. **An HTTPS tunnel** to `npm run dev`, for example `npx cloudflared tunnel --url http://localhost:5173`. This gives a real certificate, but your dev traffic goes through the tunnel provider.

Tip for iPhone debugging: enable *Settings → Safari → Advanced → Web Inspector* and use Safari on a Mac (*Develop → [your iPhone]*). For Android, use `chrome://inspect` on a desktop Chrome.

## Deploy to GitHub Pages (free)

The workflow `.github/workflows/deploy.yml` runs on every push to `main`. It installs dependencies, runs the typecheck, lint and tests, builds with the right base path and deploys.

**Turn on one repo setting:** **Settings → Pages → Build and deployment → Source: "GitHub Actions"**. That's all; you don't need a `gh-pages` branch.

The site will be at `https://<user>.github.io/<repo>/`. The workflow sets `BASE_PATH=/<repo>/`, and Vite's `base`, the manifest `scope`, `start_url` and `id`, and the service worker's navigation fallback all follow it. (A `<user>.github.io` repo is served from `/` automatically.) Routing is hash‑based, so no 404 rewrite is needed.

### Alternatives

- **Vercel:** import the repo. `vercel.json` sets the build command (`npm run build`) and output (`dist`). Leave `BASE_PATH` unset (served from `/`).
- **Netlify:** import the repo. `netlify.toml` sets `npm run build` → `dist`. Leave `BASE_PATH` unset.
- **Anything static:** `npm run build` and upload `dist/`. If it's served from a sub‑path, build with `BASE_PATH=/sub/path/ npm run build`.

All three serve `.wasm` with the right MIME type out of the box. `sw.js` is served with `no-cache` so updates roll out quickly.

## Privacy

There's no server. Detection, scoring, looks, frames and export all run in the browser. Photos are stored in this browser's IndexedDB on this device. Clearing browser data, deleting the Home Screen app, or (on iPhone) leaving the app unused for weeks can erase them, and the app reminds users to save favourites to Photos. The Playwright smoke test fails if the app requests any other origin.

## Known web limitations (vs. a native camera app)

- **Image quality:** iOS Safari only gives web apps a video stream, not the photo pipeline. Stills are video frames, usually lower resolution than the native camera and without Deep Fusion/Night mode/Smart HDR and without RAW. For maximum quality, use **+ → Use phone camera**, which opens the native camera and then goes straight to Looks.
- **Lenses:** you can't reliably choose the ultra‑wide/tele lens on iOS. Hardware zoom and `ImageCapture` are Chrome/Android only. Elsewhere zoom is a digital crop.
- **Focus/exposure/torch** controls exist only where the browser exposes them (mostly Chrome on Android). On iPhone, tap‑to‑focus only selects the subject. Exposure compensation and torch appear only when supported.
- **Shutter latency:** no zero‑shutter‑lag buffer. `takePhoto()` can briefly re‑configure the camera on some Android phones (it can be turned off in Settings).
- **Detection on the main thread:** MediaPipe's GPU path in a worker needs WebGL in `OffscreenCanvas`, which iOS 16 lacks. Detection is throttled to ~8 fps and alternates detectors to keep the UI smooth, but it uses battery, and very old phones fall back to slower CPU inference.
- **Memory:** iOS Safari limits total canvas memory, so photos are capped at 16 MP and big imports are downscaled.
- **Storage:** the gallery lives in browser storage, which the browser may evict. iOS can clear storage for sites that aren't used for a while (installed Home Screen apps are safer), and there's no access to the system photo library except through the share sheet.
- **Saving to Photos** takes one extra tap through the share sheet. Web apps can't write to the camera roll directly.
- **Haptics:** `navigator.vibrate` is Android‑only, so there's no lock haptic on iPhone.
- **Sensors:** iOS asks for motion permission (needed by the level) and the request must come from a tap. Landscape support is basic; the app is designed for portrait.
- **Background:** the camera stops whenever the app is hidden, and there's no lock‑screen or Action‑button launch.
- **First visit:** the offline cache downloads ~18 MB (WASM runtime + models) in the background.

## Licenses

App code: yours to license. Bundled third‑party software is all permissive, and the in‑app **Settings → Credits** screen lists it:
React (MIT), MediaPipe Tasks Vision (Apache‑2.0), EfficientDet‑Lite0 and BlazeFace models (Apache‑2.0), Dexie.js (Apache‑2.0), exifr (MIT), DSEG font (SIL OFL 1.1), Workbox and vite‑plugin‑pwa (MIT), Tailwind CSS (MIT), Vite (MIT).
The logo, icons, looks and sample scenes are original. Sample photos are generated in code, so there are no image licenses to track.
