import { useEffect, useState } from 'react';
import { APP } from '../config/app';
import { Icon } from '../components/Icon';
import { Button, Header, Toggle } from '../components/ui';
import { needsMotionPermission, requestMotionPermission } from '../camera/useOrientation';
import { imageCaptureAvailable } from '../camera/capture';
import { DATE_FORMATS, formatStamp } from '../frames/dateStamp';
import { clearGallery } from '../gallery/db';
import { formatBytes, isPersisted, requestPersistence, storageUsage, type Usage } from '../gallery/storage';
import { back, navigate } from '../lib/router';
import { toast } from '../lib/toast';
import { dismissInstall, useInstall } from '../pwa/install';
import { setSettings, useSettings } from '../settings';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-1 px-4 text-[13px] font-semibold uppercase tracking-wide text-white/45">{title}</h2>
      <div className="divide-y divide-white/10 rounded-2xl bg-white/5">{children}</div>
    </section>
  );
}

function Row({ label, hint, onClick, icon = 'arrow' }: { label: string; hint?: string; onClick: () => void; icon?: 'arrow' | 'info' }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[56px] w-full items-center gap-3 px-4 text-left active:bg-white/5">
      <span className="flex-1">
        <span className="block text-[16px]">{label}</span>
        {hint && <span className="block text-[13px] text-white/55">{hint}</span>}
      </span>
      <Icon name={icon} size={18} className="text-white/40" />
    </button>
  );
}

export default function SettingsScreen() {
  const s = useSettings();
  const install = useInstall();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [motionOk, setMotionOk] = useState(!needsMotionPermission());

  useEffect(() => {
    void storageUsage().then(setUsage);
    void isPersisted().then(setPersisted);
  }, []);

  const clear = async () => {
    if (!window.confirm('Delete every photo in the gallery? This can’t be undone.')) return;
    await clearGallery();
    setUsage(await storageUsage());
    toast('Gallery cleared');
  };

  return (
    <div className="min-h-screen-safe bg-ink pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <Header title="Settings" onBack={() => back({ name: 'camera' })} />
      <div className="mx-auto max-w-lg px-3">
        <Section title="Camera">
          <Toggle label="Thirds grid" checked={s.grid} onChange={(v) => setSettings({ grid: v })} />
          <Toggle label="Composition guidance" hint="Subject tracking and one live tip at a time" checked={s.guidance} onChange={(v) => setSettings({ guidance: v })} />
          <Toggle label="Level" hint="Straighten tilted shots; flat-lay guide when pointing down" checked={s.level} onChange={(v) => setSettings({ level: v })} />
          {!motionOk && (
            <Row
              label="Allow motion sensors"
              hint="Needed for the level on iPhone"
              onClick={async () => {
                const ok = await requestMotionPermission();
                setMotionOk(ok);
                toast(ok ? 'Level is on' : 'Motion access was not allowed');
              }}
            />
          )}
          {imageCaptureAvailable() && (
            <Toggle
              label="Full-sensor photos"
              hint="Uses the camera’s still mode when available. Turn off if photos look wrong."
              checked={s.fullSensor}
              onChange={(v) => setSettings({ fullSensor: v })}
            />
          )}
          <Toggle label="Demo camera" hint="A generated scene instead of the real camera" checked={s.demoCamera} onChange={(v) => setSettings({ demoCamera: v })} />
        </Section>

        <Section title="Date stamp format">
          <div className="flex flex-wrap gap-2 p-3" role="radiogroup" aria-label="Date stamp format">
            {DATE_FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={s.dateFormat === f.id}
                onClick={() => setSettings({ dateFormat: f.id })}
                className={`min-h-[44px] rounded-full px-4 font-mono text-[14px] ${s.dateFormat === f.id ? 'bg-[#ff9a3d] text-ink' : 'bg-white/10'}`}
              >
                {formatStamp(new Date(), f.id)}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Storage">
          <div className="px-4 py-3 text-[14px] text-white/75">
            <p>{usage ? `${formatBytes(usage.used)} used on this device` : 'Storage usage isn’t available in this browser.'}</p>
            <p className="mt-1 text-[13px] text-white/55">
              Photos live only in this browser. Save favourites to Photos with Share → Save Image; clearing browser data deletes the gallery.
            </p>
          </div>
          {persisted === false && (
            <Row
              label="Protect my gallery"
              hint="Ask the browser not to clear photos when space is low"
              onClick={async () => {
                const ok = await requestPersistence();
                setPersisted(ok);
                toast(ok ? 'Storage protected' : 'The browser declined. Installing the app usually helps.');
              }}
            />
          )}
          <div className="p-3">
            <Button variant="danger" className="w-full" onClick={() => void clear()}>
              Clear gallery
            </Button>
          </div>
        </Section>

        {install.mode && (
          <Section title="Install">
            {install.mode === 'android' ? (
              <Row label={`Install ${APP.name}`} hint="Adds it to your home screen and works offline" onClick={() => void install.prompt()} />
            ) : (
              <div className="px-4 py-3 text-[14px] text-white/75">
                <p className="font-medium text-white">Add to Home Screen</p>
                <ol className="mt-1 list-decimal space-y-1 pl-5">
                  <li>Tap the Share button in Safari.</li>
                  <li>Choose “Add to Home Screen”.</li>
                  <li>Open {APP.name} from your Home Screen.</li>
                </ol>
                <button type="button" className="mt-2 min-h-[44px] text-[13px] text-white/50" onClick={dismissInstall}>
                  Don’t remind me
                </button>
              </div>
            )}
          </Section>
        )}

        <Section title="About">
          <Row label="Privacy" hint="Everything stays on your phone" onClick={() => navigate({ name: 'privacy' })} />
          <Row label="Credits & licenses" onClick={() => navigate({ name: 'credits' })} />
          <Row label="Show the intro again" onClick={() => setSettings({ onboarded: false })} />
        </Section>
        <p className="pb-4 text-center text-[12px] text-white/40">
          {APP.name} · free, no ads, no accounts · v{__APP_VERSION__}
        </p>
      </div>
    </div>
  );
}
