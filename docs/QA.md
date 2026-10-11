# Manual QA checklist

Test on real devices over HTTPS (the GitHub Pages URL is easiest). Tick each item on each target:
**iPhone Safari** (browser tab), **iPhone Home Screen app**, **Android Chrome**.

## First run
- [ ] Onboarding shows 3 screens max; "Skip" works; "Turn on camera" shows the camera prompt (and on iPhone the motion prompt).
- [ ] Deny the camera → friendly screen with platform-specific steps, "Try again", "Use phone camera", "Import", "Demo camera".
- [ ] Re-allow in system settings → "Try again" starts the camera.

## Camera
- [ ] First frame appears within ~1–2 s; no layout jump; preview is not stretched (letterboxed 3:4).
- [ ] Notch/Dynamic Island and home indicator never cover controls (safe areas), portrait and after rotating back.
- [ ] Pinching the page does not zoom the UI; pinching the viewfinder zooms the camera.
- [ ] Flip to front camera: preview is mirrored; the saved photo matches the preview (mirrored).
- [ ] Zoom chips (1×/2×/3×) work: hardware zoom where supported (Android), otherwise digital crop that is also applied to the saved photo.
- [ ] Tap to focus shows a ring; on Android, focus/exposure visibly change (where supported).
- [ ] Torch button appears only when supported and toggles the light.
- [ ] Exposure (±) button appears only when supported; slider changes brightness.
- [ ] Grid toggle shows/hides thirds lines.
- [ ] Switch apps / lock the phone and come back: camera light goes off while away and the preview resumes on return.
- [ ] Shutter → "Saving…" → editor within ~2 s. On Android Chrome the photo resolution is the full sensor still where ImageCapture works (check file size/dimensions after export).
- [ ] "+" → Use phone camera opens the native camera; the shot goes straight to Looks.
- [ ] "+" → Import from library: portrait and landscape photos, a HEIC (iPhone), a 48 MP photo (downscaled to ≤16 MP, no crash), a photo with EXIF rotation (upright).

## Guidance
- [ ] A person/face/object gets a corner-bracket reticle that follows smoothly; tapping another object switches subject.
- [ ] With nothing detectable (blank wall with one picture), the reticle falls back to the high-contrast region.
- [ ] Target dot sits on a thirds intersection (eyes on the upper third for faces; centre for frame-filling subjects).
- [ ] Arrows: when the subject needs to move right on screen, the pill says "Move phone left" — moving the phone left fixes it. Repeat with the front camera.
- [ ] Reaching the target turns the reticle green ("Looks great"), Android vibrates once.
- [ ] Tiny subject → "Move closer or tap to zoom" with a working Zoom button. Subject cut by the edge → "Step back…". Face at the top → "Leave a little headroom".
- [ ] Backlit subject against a window → backlit tip; tapping "Fix" brightens the subject (Android) or raises exposure.
- [ ] Tilt the phone ~5° → level line + "Straighten"; 20° tilt → no nagging.
- [ ] Person in frame, phone tilted steeply down → "Shoot closer to eye level".
- [ ] Point straight down at a table → flat-lay guide with a bubble; green when flat.
- [ ] Scan (✦) → about 1 s sweep → score card with 0–3 tips, each with a one-line why.
- [ ] Only one instruction is shown at a time; it doesn't flicker. Guidance toggle hides everything except the grid/level.
- [ ] VoiceOver/TalkBack: all buttons are labelled; tips are announced.

## Looks & frames
- [ ] The look strip shows each look rendered on the actual photo; tapping applies it.
- [ ] Intensity slider 0–100 % changes strength smoothly; press-and-hold the photo shows the original.
- [ ] Frames: Gallery (white mat, larger bottom, optional keyline), Paper (textured sheet, soft shadow).
- [ ] Date stamp: orange seven-segment, bottom-right, with glow; all three formats; date matches capture/EXIF date.
- [ ] Share/Save exports a full-resolution JPEG that looks the same as the preview (look, grain, frame, stamp).
- [ ] iPhone: Share sheet offers "Save Image" → appears in Photos. Android: share sheet, or download where share isn't available.
- [ ] Export a 16 MP photo with Paper + stamp several times in a row: no crash/blank image (iOS canvas memory).

## Gallery
- [ ] New captures appear first; thumbnails reflect the saved look/frame.
- [ ] Viewer: swipe between photos; Edit reopens the saved recipe; Delete removes it.
- [ ] Settings shows storage used; "Protect my gallery" requests persistent storage (Android); "Clear gallery" asks first.
- [ ] Backup reminder appears in the gallery and can be dismissed.

## PWA
- [ ] Android: install banner (Gallery) / Settings → Install uses the native prompt; app opens standalone with the right icon.
- [ ] iPhone: Settings / Gallery explains Share → Add to Home Screen; icon is correct; status bar is dark/translucent.
- [ ] Airplane mode after one full load: app opens, camera + guidance + looks + export work offline.
- [ ] After a new deploy, reopening the app picks up the update (may need one relaunch).
- [ ] Reduce Motion on: no sweeping/sliding animations; reticle snaps instead of gliding.
- [ ] Desktop browser without a camera: nothing breaks; demo camera and sample photos work.
