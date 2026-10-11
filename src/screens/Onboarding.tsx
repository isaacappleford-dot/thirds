import { useState } from 'react';
import { APP } from '../config/app';
import { Icon } from '../components/Icon';
import { Button } from '../components/ui';
import { requestMotionPermission } from '../camera/useOrientation';
import { isIOS, isStandalone } from '../lib/platform';
import { navigate } from '../lib/router';
import { setSettings } from '../settings';

function Hero() {
  return (
    <svg viewBox="0 0 200 150" className="mx-auto w-64 max-w-full" aria-hidden="true">
      <rect x="1" y="1" width="198" height="148" rx="14" fill="#1a1a1d" stroke="rgba(255,255,255,0.15)" />
      <g stroke="rgba(255,255,255,0.3)" strokeWidth="1">
        <line x1="67" y1="1" x2="67" y2="149" />
        <line x1="133" y1="1" x2="133" y2="149" />
        <line x1="1" y1="50" x2="199" y2="50" />
        <line x1="1" y1="100" x2="199" y2="100" />
      </g>
      <g stroke="#5ce1a0" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M113 32v-8h8M145 24h8v8M113 68v8h8M153 68v8h-8" />
      </g>
      <circle cx="133" cy="50" r="7" fill="none" stroke="#5ce1a0" strokeWidth="2.5" />
    </svg>
  );
}

const STEPS = ['intro', 'camera', 'privacy'] as const;

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [asking, setAsking] = useState(false);
  const finish = () => {
    setSettings({ onboarded: true });
    navigate({ name: 'camera' }, { replace: true });
  };

  const allowCamera = async () => {
    setAsking(true);
    // Both prompts must come from this tap on iOS.
    const motion = requestMotionPermission();
    try {
      const s = await navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      s?.getTracks().forEach((t) => t.stop());
    } catch {
      /* the camera screen explains how to fix a denial */
    }
    await motion.catch(() => false);
    setAsking(false);
    setStep(2);
  };

  const id = STEPS[step];
  return (
    <main className="h-screen-safe flex flex-col bg-ink px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+24px)]">
      <div className="flex justify-end">
        {step < 2 && (
          <Button variant="ghost" onClick={finish}>
            Skip
          </Button>
        )}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center" aria-live="polite">
        {id === 'intro' && (
          <>
            <Hero />
            <h1 className="text-[28px] font-bold leading-tight">Better photos, framed as you shoot</h1>
            <p className="max-w-sm text-[16px] text-white/70">
              {APP.name} spots your subject and nudges you into a balanced shot, one calm tip at a time. Then finish it with film-style looks and frames.
            </p>
          </>
        )}
        {id === 'camera' && (
          <>
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
              <Icon name="camera" size={38} />
            </span>
            <h1 className="text-[28px] font-bold leading-tight">Allow the camera</h1>
            <p className="max-w-sm text-[16px] text-white/70">
              The camera feed is analysed live, right here on your phone. {isIOS ? 'We’ll also ask for motion access so the level works.' : ''}
            </p>
          </>
        )}
        {id === 'privacy' && (
          <>
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
              <Icon name="shield" size={38} />
            </span>
            <h1 className="text-[28px] font-bold leading-tight">Everything stays on your phone</h1>
            <p className="max-w-sm text-[16px] text-white/70">
              No account, no uploads, no ads, no tracking. Photos are processed and saved on this device only. Free, with everything unlocked.
            </p>
            {isIOS && !isStandalone() && (
              <p className="max-w-sm rounded-2xl bg-white/5 p-3 text-[14px] text-white/70">
                Tip: tap <strong>Share</strong> → <strong>Add to Home Screen</strong> to use {APP.name} like an app.
              </p>
            )}
          </>
        )}
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-2" aria-label={`Step ${step + 1} of 3`} role="img">
          {STEPS.map((s, i) => (
            <span key={s} className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-accent' : 'w-2 bg-white/25'}`} />
          ))}
        </div>
        {id === 'intro' && (
          <Button className="w-full max-w-xs" onClick={() => setStep(1)}>
            Continue
          </Button>
        )}
        {id === 'camera' && (
          <Button className="w-full max-w-xs" onClick={() => void allowCamera()} disabled={asking}>
            {asking ? 'Waiting…' : 'Turn on camera'}
          </Button>
        )}
        {id === 'privacy' && (
          <Button className="w-full max-w-xs" onClick={finish}>
            Start shooting
          </Button>
        )}
      </div>
    </main>
  );
}
