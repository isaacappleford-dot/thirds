import { createCanvas, context2d, releaseCanvas } from '../image/canvas';
import { drawGoldenHour } from './scenes';

/**
 * A fake camera for desktops without one: an animated generated scene sent
 * through canvas.captureStream(), so the full camera + guidance pipeline runs.
 */
export function startDemoCamera(width = 960, height = 1280): { stream: MediaStream; stop: () => void } {
  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);
  const start = performance.now();
  let raf = 0;
  const draw = () => {
    drawGoldenHour(ctx, width, height, (performance.now() - start) / 1000);
  };
  draw();
  // captureStream needs repaints; rAF pauses in background tabs, which is fine.
  const loop = () => {
    draw();
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  if (typeof canvas.captureStream !== 'function') throw new Error('Demo camera not supported in this browser.');
  const stream = canvas.captureStream(30);
  return {
    stream,
    stop: () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      releaseCanvas(canvas);
    },
  };
}
