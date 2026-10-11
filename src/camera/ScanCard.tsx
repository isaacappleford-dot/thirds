import { useEffect, useRef } from 'react';
import type { ScanResult } from '../guidance/score';
import { Button } from '../components/ui';

function ScoreRing({ score }: { score: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const color = score >= 85 ? '#5ce1a0' : score >= 60 ? '#ffc93c' : '#ff8a65';
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
      <circle cx="38" cy="38" r={r} stroke="rgba(255,255,255,0.15)" strokeWidth="6" fill="none" />
      <circle
        cx="38"
        cy="38"
        r={r}
        stroke={color}
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`}
        transform="rotate(-90 38 38)"
      />
      <text x="38" y="44" textAnchor="middle" fill="white" fontSize="20" fontWeight="700">
        {score}
      </text>
    </svg>
  );
}

/** Result of a one-second composition scan: score + the top tips, each with a "why". */
export function ScanCard({ result, onClose }: { result: ScanResult; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="absolute inset-x-3 bottom-3 z-30 motion-safe:animate-[sheet_220ms_ease-out]">
      <div
        ref={ref}
        role="dialog"
        aria-label={`Composition score ${result.score} out of 100`}
        tabIndex={-1}
        className="rounded-3xl bg-ink-800/95 p-4 shadow-2xl outline-none backdrop-blur"
      >
        <div className="flex items-center gap-4">
          <ScoreRing score={result.score} />
          <div>
            <p className="text-[13px] uppercase tracking-wide text-white/55">Composition</p>
            <p className="text-[19px] font-semibold">{result.headline}</p>
          </div>
        </div>
        {result.tips.length > 0 ? (
          <ol className="mt-3 space-y-3">
            {result.tips.map((t, i) => (
              <li key={t.id} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[13px] font-semibold">
                  {i + 1}
                </span>
                <span>
                  <span className="block text-[15px] font-medium">{t.text}</span>
                  <span className="block text-[13px] leading-snug text-white/60">{t.why}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-[14px] text-white/70">Nothing to fix. Take the shot.</p>
        )}
        <Button className="mt-4 w-full" onClick={onClose}>
          Got it
        </Button>
      </div>
    </div>
  );
}
