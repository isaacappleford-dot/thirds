import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { capturePhoto } from '../camera/capture';
import { CameraProblem } from '../camera/CameraProblem';
import { NO_FEATURES, snapToStep, zoomPresets } from '../camera/capabilities';
import { focusAndExposeAt, setExposureCompensation, setTorch, setZoom } from '../camera/controls';
import { InstructionPill } from '../camera/InstructionPill';
import { Overlay } from '../camera/Overlay';
import { ScanCard } from '../camera/ScanCard';
import { displayPointToRaw } from '../camera/space';
import { useCamera } from '../camera/useCamera';
import { requestMotionPermission, useOrientation } from '../camera/useOrientation';
import { Icon } from '../components/Icon';
import { IconButton, Sheet, SheetItem, Spinner } from '../components/ui';
import { SAMPLE_SCENES, sampleScene, type SceneId } from '../demo/scenes';
import type { Instruction } from '../guidance/advisor';
import type { Attitude } from '../guidance/level';
import type { ScanResult } from '../guidance/score';
import type { Facing } from '../guidance/types';
import { navigate } from '../lib/router';
import { toast } from '../lib/toast';
import { Coach } from '../ml/coach';
import type { PhotoSource } from '../gallery/db';
import { setSettings, useSettings } from '../settings';

const DIGITAL_MAX = 4;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Same id/text/arrow (rounded) → no re-render. */
function sameInstruction(a: Instruction | null, b: Instruction | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.id === b.id && a.text === b.text && Math.round((a.arrow ?? 0) / 15) === Math.round((b.arrow ?? 0) / 15);
}

async function storeAndEdit(blob: Blob, source: PhotoSource, takenAt?: Date, known?: { width: number; height: number }) {
  const { savePhoto } = await import('../photos/service');
  const id = await savePhoto(blob, source, takenAt, known);
  navigate({ name: 'edit', id });
}

export default function CameraScreen() {
  const settings = useSettings();
  const [facing, setFacing] = useState<Facing>(settings.lastFacing);
  const cam = useCamera({ facing, demo: settings.demoCamera });
  const session = cam.session;
  const features = session?.features ?? NO_FEATURES;
  const mirrored = session?.facing === 'user';

  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [videoSize, setVideoSize] = useState({ w: 3, h: 4 });
  const [zoom, setZoomState] = useState(1);
  const digitalZoom = features.zoom ? 1 : zoom;
  const [torchOn, setTorchOn] = useState(false);
  const [ev, setEv] = useState(0);
  const [showEv, setShowEv] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);
  const [focusRing, setFocusRing] = useState<{ x: number; y: number; k: number } | null>(null);
  const [instruction, setInstruction] = useState<Instruction | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [lastThumb, setLastThumb] = useState<string | null>(null);
  const nativeInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);

  const coach = useMemo(() => new Coach(), []);

  // Stage size → where the (contain-fit) video sits.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setStage({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rect: Rect = useMemo(() => {
    if (!stage.w || !stage.h) return { x: 0, y: 0, w: 0, h: 0 };
    const s = Math.min(stage.w / videoSize.w, stage.h / videoSize.h);
    const w = Math.round(videoSize.w * s);
    const h = Math.round(videoSize.h * s);
    return { x: Math.round((stage.w - w) / 2), y: Math.round((stage.h - h) / 2), w, h };
  }, [stage, videoSize]);

  // Start the coach a moment after the first frame, so the camera appears first
  // and MediaPipe (code-split) loads afterwards.
  useEffect(() => {
    const v = cam.videoRef.current;
    if (cam.status !== 'live' || !v) return;
    let timer = 0;
    const onReady = () => {
      if (v.videoWidth) setVideoSize({ w: v.videoWidth, h: v.videoHeight });
      clearTimeout(timer);
      timer = window.setTimeout(() => coach.start(v), 300);
    };
    v.addEventListener('loadedmetadata', onReady);
    v.addEventListener('resize', onReady);
    if (v.readyState >= 2) onReady();
    else v.addEventListener('playing', onReady, { once: true });
    return () => {
      clearTimeout(timer);
      v.removeEventListener('loadedmetadata', onReady);
      v.removeEventListener('resize', onReady);
      v.removeEventListener('playing', onReady);
      coach.stop();
    };
  }, [cam.status, cam.videoRef, coach, session]);

  useEffect(() => {
    coach.view = { facing: session?.facing ?? facing, mirrored, digitalZoom };
    coach.caps = { canZoom: true, canExposure: !!features.exposureCompensation };
  }, [coach, session, facing, mirrored, digitalZoom, features]);

  useEffect(() => coach.setGuidance(settings.guidance), [coach, settings.guidance]);

  useEffect(
    () =>
      coach.subscribe((s) => {
        setInstruction((prev) => (sameInstruction(prev, s.instruction) ? prev : s.instruction));
        setScanning(s.scanning);
      }),
    [coach],
  );

  const onAttitude = useCallback((a: Attitude | null) => (coach.attitude = a), [coach]);
  useOrientation(settings.level || settings.guidance, onAttitude);

  // Reset per-session controls when the camera changes.
  useEffect(() => {
    setZoomState(features.zoom ? Math.max(1, features.zoom.min) : 1);
    setTorchOn(false);
    setEv(0);
    setShowEv(false);
    coach.reset();
  }, [session, features.zoom, coach]);

  // No pinch-to-zoom the page while on the camera (iOS ignores user-scalable=no).
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', stop, { passive: false } as AddEventListenerOptions);
    return () => document.removeEventListener('gesturestart', stop);
  }, []);

  // Latest gallery thumbnail for the gallery button (Dexie is loaded lazily).
  useEffect(() => {
    let url: string | null = null;
    let off: (() => void) | undefined;
    let alive = true;
    const load = async () => {
      const g = await import('../gallery/db');
      const list = await g.listPhotos().catch(() => []);
      if (!alive) return;
      if (url) URL.revokeObjectURL(url);
      url = list[0] ? URL.createObjectURL(list[0].thumb) : null;
      setLastThumb(url);
      off ??= g.onGalleryChange(() => void load());
    };
    void load();
    return () => {
      alive = false;
      off?.();
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  const applyZoom = useCallback(
    (z: number) => {
      const track = session?.track;
      if (features.zoom) {
        const v = snapToStep(z, features.zoom);
        setZoomState(v);
        if (track) void setZoom(track, features, v);
      } else {
        setZoomState(Math.min(DIGITAL_MAX, Math.max(1, Math.round(z * 20) / 20)));
      }
    },
    [session, features],
  );

  const zoomRange = features.zoom ? { min: Math.max(features.zoom.min, 1), max: features.zoom.max } : { min: 1, max: DIGITAL_MAX };

  const focusAt = useCallback(
    (p: { x: number; y: number }) => {
      if (!session?.track) return;
      void focusAndExposeAt(session.track, features, displayPointToRaw(p, { mirrored, digitalZoom }));
    },
    [session, features, mirrored, digitalZoom],
  );

  // Tap = focus/expose + pick subject. Two fingers = pinch zoom.
  const pointers = useRef(new Map<number, { x: number; y: number; t: number; sx: number; sy: number }>());
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    void requestMotionPermission();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), sx: e.clientX, sy: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom };
    }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const z = Math.min(zoomRange.max, Math.max(zoomRange.min, (pinch.current.z * d) / Math.max(1, pinch.current.d)));
      applyZoom(z);
    }
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pointers.current.get(e.pointerId);
    const wasPinch = pinch.current !== null;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (!p || wasPinch || pointers.current.size > 0) return;
    const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy);
    if (moved > 12 || performance.now() - p.t > 500) return;
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pt = { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height };
    if (pt.x < 0 || pt.x > 1 || pt.y < 0 || pt.y > 1) return;
    setFocusRing({ x: e.clientX - box.left, y: e.clientY - box.top, k: Date.now() });
    focusAt(pt);
    if (settings.guidance) coach.pinAt(pt);
  };

  const onInstructionAction = (i: Instruction) => {
    const a = coach.state.analysis;
    switch (i.action) {
      case 'zoom-in':
        applyZoom(Math.min(zoomRange.max, zoom * Math.min(2.5, a?.framing?.zoomFactor ?? 2)));
        break;
      case 'zoom-out':
        applyZoom(zoomRange.min);
        break;
      case 'ev-down':
      case 'ev-up': {
        const r = features.exposureCompensation;
        if (!r || !session) break;
        const next = snapToStep(ev + (i.action === 'ev-down' ? -2 / 3 : 2 / 3), r);
        setEv(next);
        void setExposureCompensation(session.track, features, next);
        break;
      }
      case 'tap-subject':
        if (a?.subject) {
          const b = a.subject.box;
          focusAt({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
          if (!features.pointsOfInterest && features.exposureCompensation && session) {
            const next = snapToStep(ev + 1, features.exposureCompensation);
            setEv(next);
            void setExposureCompensation(session.track, features, next);
          }
        }
        break;
    }
  };

  const takePhoto = async () => {
    const v = cam.videoRef.current;
    if (!v || busy || cam.status !== 'live') return;
    void requestMotionPermission();
    setBusy('Saving…');
    setFlash((n) => n + 1);
    // Free the main thread for encoding/saving: no detection while we save.
    coach.stop();
    try {
      const shot = await capturePhoto({
        video: v,
        track: session?.demo ? null : (session?.track ?? null),
        mirrored,
        digitalZoom,
        preferImageCapture: settings.fullSensor,
      });
      await storeAndEdit(shot.blob, 'camera', new Date(), { width: shot.width, height: shot.height });
    } catch (e) {
      toast((e as Error).message || 'Couldn’t take the photo.');
      setBusy(null);
      coach.start(v);
    }
  };

  const onFile = async (file: File | undefined, source: PhotoSource) => {
    if (!file) return;
    coach.stop();
    setBusy('Opening photo…');
    try {
      await storeAndEdit(file, source);
    } catch (e) {
      toast((e as Error).message || 'Couldn’t open that photo.');
      setBusy(null);
      if (cam.videoRef.current) coach.start(cam.videoRef.current);
    }
  };

  const openSample = async (id: SceneId) => {
    setMoreOpen(false);
    coach.stop();
    setBusy('Making a sample…');
    try {
      await storeAndEdit(await sampleScene(id), 'sample');
    } catch (e) {
      toast((e as Error).message || 'Couldn’t make the sample.');
      setBusy(null);
      if (cam.videoRef.current) coach.start(cam.videoRef.current);
    }
  };

  const runScan = async () => {
    void requestMotionPermission();
    if (!settings.guidance) setSettings({ guidance: true });
    setScanResult(null);
    setScanResult(await coach.scan());
  };

  const flip = () => {
    const next: Facing = facing === 'environment' ? 'user' : 'environment';
    setFacing(next);
    setSettings({ lastFacing: next });
  };

  const toggleTorch = async () => {
    if (!session) return;
    const ok = await setTorch(session.track, features, !torchOn);
    if (ok) setTorchOn(!torchOn);
    else toast('Flashlight isn’t available right now.');
  };

  const presets = zoomPresets(features, DIGITAL_MAX);
  const scale = digitalZoom;
  const videoTransform = `scale(${mirrored ? -scale : scale}, ${scale})`;

  return (
    <div className="h-screen-safe relative flex select-none flex-col overflow-hidden bg-black" onPointerDownCapture={() => void requestMotionPermission()}>
      {/* Top bar */}
      <div className="z-20 flex items-center gap-2 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+8px)]">
        <IconButton icon="settings" label="Settings" onClick={() => navigate({ name: 'settings' })} />
        <div className="flex flex-1 justify-center">
          {settings.demoCamera && (
            <button
              type="button"
              onClick={() => setSettings({ demoCamera: false })}
              className="min-h-[36px] rounded-full bg-accent/20 px-3 text-[13px] font-medium text-accent"
            >
              Demo camera · Exit
            </button>
          )}
        </div>
        {features.torch && <IconButton icon="bolt" label={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'} active={torchOn} onClick={toggleTorch} />}
        {features.exposureCompensation && (
          <IconButton icon="ev" label="Exposure" active={showEv || ev !== 0} onClick={() => setShowEv((s) => !s)} aria-expanded={showEv} />
        )}
        <IconButton icon="grid" label={settings.grid ? 'Hide grid' : 'Show grid'} active={settings.grid} onClick={() => setSettings({ grid: !settings.grid })} />
        <IconButton
          icon="target"
          label={settings.guidance ? 'Turn guidance off' : 'Turn guidance on'}
          active={settings.guidance}
          onClick={() => setSettings({ guidance: !settings.guidance })}
        />
      </div>

      {/* Viewfinder */}
      <div ref={stageRef} className="relative flex-1 overflow-hidden" style={{ touchAction: 'none' }}>
        <div
          className="absolute overflow-hidden bg-ink-900"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="application"
          aria-label="Viewfinder. Tap to focus and choose a subject. Pinch to zoom."
        >
          <video
            ref={cam.videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ transform: videoTransform }}
            playsInline
            muted
            autoPlay
            disablePictureInPicture
            aria-hidden="true"
          />
          {cam.status === 'live' && (
            <Overlay coach={coach} width={rect.w} height={rect.h} grid={settings.grid} guidance={settings.guidance} level={settings.level} />
          )}
          {focusRing && (
            <span
              key={focusRing.k}
              aria-hidden="true"
              className="pointer-events-none absolute h-16 w-16 rounded-full border-2 border-accent opacity-0 motion-safe:animate-[ring_700ms_ease-out]"
              style={{ left: focusRing.x, top: focusRing.y, transform: 'translate(-50%,-50%)' }}
            />
          )}
          {scanning && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-accent/25 to-transparent motion-safe:animate-[sweep_1s_linear]" />
            </div>
          )}
          {flash > 0 && <div key={flash} aria-hidden="true" className="pointer-events-none absolute inset-0 bg-white opacity-0 motion-safe:animate-[shutter_250ms_ease-out]" />}
        </div>

        {cam.status === 'live' && settings.guidance && !scanResult && <InstructionPill instruction={instruction} onAction={onInstructionAction} />}
        {cam.status === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner label="Starting camera" />
          </div>
        )}
        {cam.status === 'error' && cam.errorKind && (
          <CameraProblem
            kind={cam.errorKind}
            onRetry={cam.retry}
            onNative={() => nativeInput.current?.click()}
            onImport={() => importInput.current?.click()}
            onDemo={() => setSettings({ demoCamera: true })}
          />
        )}
        {showEv && features.exposureCompensation && (
          <div className="absolute inset-x-6 bottom-3 z-20 flex items-center gap-3 rounded-full bg-black/60 px-4 backdrop-blur">
            <span className="text-[13px] tabular-nums text-white/80" aria-hidden="true">
              {ev > 0 ? '+' : ''}
              {ev.toFixed(1)}
            </span>
            <input
              type="range"
              className="slider flex-1"
              aria-label="Exposure compensation"
              min={features.exposureCompensation.min}
              max={features.exposureCompensation.max}
              step={features.exposureCompensation.step}
              value={ev}
              onChange={(e) => {
                const v = Number(e.target.value);
                setEv(v);
                if (session) void setExposureCompensation(session.track, features, v);
              }}
            />
          </div>
        )}
        {scanResult && <ScanCard result={scanResult} onClose={() => setScanResult(null)} />}
        {busy && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/50">
            <Spinner label={busy} />
            <span className="text-[14px] text-white/80">{busy}</span>
          </div>
        )}
      </div>

      {/* Zoom chips */}
      <div className="z-10 flex justify-center gap-2 py-2" role="group" aria-label="Zoom">
        {presets.map((p) => {
          const active = Math.abs(zoom - p) < 0.05 || (p === presets[presets.length - 1] && zoom > p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => applyZoom(p)}
              aria-pressed={active}
              aria-label={`Zoom ${p}×`}
              className={`flex h-11 min-w-11 items-center justify-center rounded-full px-2 text-[13px] font-semibold tabular-nums ${
                active ? 'bg-white/20 text-accent' : 'bg-white/10 text-white/80'
              }`}
            >
              {active && Math.abs(zoom - p) >= 0.05 ? zoom.toFixed(1) : p}×
            </button>
          );
        })}
      </div>

      {/* Bottom controls (thumb zone) */}
      <div className="z-10 flex items-center justify-between px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-2">
        <button
          type="button"
          onClick={() => navigate({ name: 'gallery' })}
          aria-label="Open gallery"
          className="h-12 w-12 overflow-hidden rounded-xl border border-white/20 bg-white/10"
        >
          {lastThumb ? <img src={lastThumb} alt="" className="h-full w-full object-cover" /> : <Icon name="image" className="m-auto" />}
        </button>
        <IconButton icon="plus" label="More ways to add a photo" onClick={() => setMoreOpen(true)} />
        <button
          type="button"
          onClick={takePhoto}
          disabled={cam.status !== 'live' || !!busy}
          aria-label="Take photo"
          className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-4 border-white/90 disabled:opacity-40"
        >
          <span
            className={`h-[60px] w-[60px] rounded-full transition-colors ${instruction?.id === 'locked' ? 'bg-lock' : 'bg-white'} active:scale-95`}
          />
        </button>
        <IconButton icon="sparkle" label="Scan composition" onClick={runScan} disabled={cam.status !== 'live' || scanning} />
        {cam.canFlip ? (
          <IconButton icon="flip" label={facing === 'environment' ? 'Switch to front camera' : 'Switch to rear camera'} onClick={flip} />
        ) : (
          <span className="w-11" />
        )}
      </div>

      <input
        ref={nativeInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0], 'native');
          e.target.value = '';
        }}
      />
      <input
        ref={importInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0], 'import');
          e.target.value = '';
        }}
      />

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Add a photo">
        <SheetItem
          icon="camera"
          label="Use phone camera"
          hint="Full quality from your camera app, then add a look"
          onClick={() => {
            setMoreOpen(false);
            nativeInput.current?.click();
          }}
        />
        <SheetItem
          icon="image"
          label="Import from library"
          hint="Pick a photo you already have"
          onClick={() => {
            setMoreOpen(false);
            importInput.current?.click();
          }}
        />
        <p className="mb-1 mt-3 px-3 text-[13px] text-white/50">Sample photos</p>
        {SAMPLE_SCENES.map((s) => (
          <SheetItem key={s.id} icon="sparkle" label={s.label} onClick={() => void openSample(s.id)} />
        ))}
      </Sheet>
    </div>
  );
}
