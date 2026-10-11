import { useCallback, useEffect, useRef, useState } from 'react';
import { startDemoCamera } from '../demo/demoCamera';
import type { Facing } from '../guidance/types';
import { CameraError, demoSession, hasMultipleCameras, openCamera, type CameraErrorKind, type CameraSession } from './stream';

export type CameraStatus = 'starting' | 'live' | 'error' | 'stopped';

export interface CameraState {
  status: CameraStatus;
  errorKind: CameraErrorKind | null;
  session: CameraSession | null;
  canFlip: boolean;
}

/**
 * Owns the camera stream for the camera screen: starts it, binds it to the
 * <video>, stops it on unmount and whenever the tab is hidden (and restarts it
 * when visible again), and handles flipping.
 */
export function useCamera(opts: { facing: Facing; demo: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<CameraSession | null>(null);
  const [state, setState] = useState<CameraState>({ status: 'starting', errorKind: null, session: null, canFlip: false });
  const [restartKey, setRestartKey] = useState(0);

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: 'starting', errorKind: null }));
    (async () => {
      stop();
      let session: CameraSession;
      try {
        if (opts.demo) {
          const d = startDemoCamera();
          session = demoSession(d.stream, d.stop);
        } else {
          session = await openCamera(opts.facing);
        }
      } catch (e) {
        if (cancelled) return;
        const kind = e instanceof CameraError ? e.kind : 'error';
        setState({ status: 'error', errorKind: kind, session: null, canFlip: false });
        return;
      }
      if (cancelled) {
        session.stop();
        return;
      }
      sessionRef.current = session;
      const v = videoRef.current;
      if (v) {
        v.srcObject = session.stream;
        try {
          await v.play();
        } catch {
          /* autoplay of a muted inline video is allowed; ignore spurious aborts */
        }
      }
      const canFlip = session.demo ? false : await hasMultipleCameras();
      if (!cancelled) setState({ status: 'live', errorKind: null, session, canFlip });
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [opts.facing, opts.demo, restartKey, stop]);

  // Release the camera when the app goes to the background; restart on return.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        stop();
        setState((s) => ({ ...s, status: 'stopped', session: null }));
      } else {
        setRestartKey((k) => k + 1);
      }
    };
    const onHide = () => stop();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
    };
  }, [stop]);

  const retry = useCallback(() => setRestartKey((k) => k + 1), []);

  return { videoRef, ...state, retry };
}
