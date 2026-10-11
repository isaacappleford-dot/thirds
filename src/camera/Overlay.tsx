import { useEffect, useRef } from 'react';
import { GUIDANCE } from '../config/guidance';
import { lerpBox } from '../guidance/geometry';
import type { Box, Point } from '../guidance/types';
import { prefersReducedMotion } from '../lib/platform';
import type { Coach } from '../ml/coach';

interface Props {
  coach: Coach;
  width: number;
  height: number;
  grid: boolean;
  guidance: boolean;
  level: boolean;
}

const WHITE = 'rgba(255,255,255,0.92)';
const LOCK = '#5ce1a0';
const AMBER = '#ffc93c';

/**
 * Draws the viewfinder overlay on a canvas at display refresh rate, reading
 * the coach's latest state directly (no React re-renders per frame).
 */
export function Overlay({ coach, width, height, grid, guidance, level }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const props = useRef({ grid, guidance, level });
  props.current = { grid, guidance, level };

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || width <= 0 || height <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = prefersReducedMotion();
    let raf = 0;
    let last = performance.now();
    let shown: Box | null = null;
    let anchor: Point | null = null;
    let lockGlow = 0;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const { grid, guidance, level } = props.current;
      const st = coach.state;
      const a = st.analysis;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const W = width;
      const H = height;
      const flatLay = !!a?.level.flatLay;

      if (grid && !flatLay) {
        ctx.strokeStyle = 'rgba(255,255,255,0.32)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const f of [1 / 3, 2 / 3]) {
          ctx.moveTo(Math.round(W * f) + 0.5, 0);
          ctx.lineTo(Math.round(W * f) + 0.5, H);
          ctx.moveTo(0, Math.round(H * f) + 0.5);
          ctx.lineTo(W, Math.round(H * f) + 0.5);
        }
        ctx.stroke();
      }

      if (flatLay && (guidance || level)) {
        // Centred flat-lay guide with a bubble level.
        const r = Math.min(W, H) * 0.12;
        const tilted = a!.level.flatLayTilted;
        ctx.strokeStyle = tilted ? WHITE : LOCK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
        ctx.moveTo(W / 2 - r * 1.6, H / 2);
        ctx.lineTo(W / 2 - r * 1.15, H / 2);
        ctx.moveTo(W / 2 + r * 1.15, H / 2);
        ctx.lineTo(W / 2 + r * 1.6, H / 2);
        ctx.moveTo(W / 2, H / 2 - r * 1.6);
        ctx.lineTo(W / 2, H / 2 - r * 1.15);
        ctx.moveTo(W / 2, H / 2 + r * 1.15);
        ctx.lineTo(W / 2, H / 2 + r * 1.6);
        ctx.stroke();
        const att = a!.attitude;
        if (att) {
          const k = r / 15;
          // The bubble floats towards the raised edge.
          const bx = W / 2 + Math.max(-r, Math.min(r, att.flatX * k));
          const by = H / 2 - Math.max(-r, Math.min(r, att.flatY * k));
          ctx.fillStyle = tilted ? 'rgba(255,255,255,0.85)' : LOCK;
          ctx.beginPath();
          ctx.arc(bx, by, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (level && a?.level.straighten && a.attitude) {
        // The true horizon (rotated against the phone's roll) vs. the screen's horizontal.
        const roll = (a.attitude.roll * Math.PI) / 180;
        const len = Math.min(W, H) * 0.32;
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-len * 1.15, 0);
        ctx.lineTo(-len * 0.85, 0);
        ctx.moveTo(len * 0.85, 0);
        ctx.lineTo(len * 1.15, 0);
        ctx.stroke();
        ctx.rotate(-roll);
        ctx.strokeStyle = AMBER;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.lineTo(len, 0);
        ctx.stroke();
        ctx.restore();
      }

      const subject = guidance ? st.subject : null;
      if (subject && a?.target) {
        const follow = reduce ? 1 : 1 - Math.exp(-GUIDANCE.tracking.reticleFollow * dt);
        shown = shown ? lerpBox(shown, subject.box, follow) : { ...subject.box };
        const tgt = a.target.anchor;
        anchor = anchor ? { x: anchor.x + (tgt.x - anchor.x) * follow, y: anchor.y + (tgt.y - anchor.y) * follow } : { ...tgt };
        lockGlow += ((a.locked ? 1 : 0) - lockGlow) * (reduce ? 1 : Math.min(1, dt * 8));
        const color = a.locked ? LOCK : WHITE;

        // Corner-bracket reticle.
        const x = shown.x * W;
        const y = shown.y * H;
        const w = shown.w * W;
        const h = shown.h * H;
        const c = Math.max(10, Math.min(28, Math.min(w, h) * 0.25));
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        for (const [px, py, dx, dy] of [
          [x, y, 1, 1],
          [x + w, y, -1, 1],
          [x, y + h, 1, -1],
          [x + w, y + h, -1, -1],
        ] as const) {
          ctx.moveTo(px, py + dy * c);
          ctx.lineTo(px, py);
          ctx.lineTo(px + dx * c, py);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Target point and a subtle guide line from the subject to it.
        const tx = a.target.point.x * W;
        const ty = a.target.point.y * H;
        const ax = anchor.x * W;
        const ay = anchor.y * H;
        if (!a.locked) {
          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath();
          ctx.arc(ax, ay, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = a.locked ? LOCK : AMBER;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tx, ty, 9 + lockGlow * 3, 0, Math.PI * 2);
        ctx.stroke();
        if (lockGlow > 0.02) {
          ctx.fillStyle = `rgba(92,225,160,${0.35 * lockGlow})`;
          ctx.beginPath();
          ctx.arc(tx, ty, 9 + lockGlow * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        shown = null;
        anchor = null;
        lockGlow = 0;
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [coach, width, height]);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />;
}
