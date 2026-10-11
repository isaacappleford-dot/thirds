import { useEffect, useState } from 'react';
import { APP } from '../config/app';
import { Icon } from '../components/Icon';
import { Button, Header, Spinner } from '../components/ui';
import { InstallBanner } from '../components/InstallBanner';
import { listPhotos, onGalleryChange, type PhotoSummary } from '../gallery/db';
import { formatBytes, isPersisted, storageUsage, type Usage } from '../gallery/storage';
import { back, navigate } from '../lib/router';
import { setSettings, useSettings } from '../settings';

const REMIND_EVERY = 1000 * 60 * 60 * 24 * 21;

export default function GalleryScreen() {
  const settings = useSettings();
  const [photos, setPhotos] = useState<(PhotoSummary & { url: string })[] | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    let urls: string[] = [];
    let alive = true;
    const load = async () => {
      const list = await listPhotos().catch(() => []);
      if (!alive) return;
      urls.forEach(URL.revokeObjectURL);
      const withUrls = list.map((p) => ({ ...p, url: URL.createObjectURL(p.thumb) }));
      urls = withUrls.map((p) => p.url);
      setPhotos(withUrls);
      setUsage(await storageUsage());
      setPersisted(await isPersisted());
    };
    void load();
    const off = onGalleryChange(() => void load());
    return () => {
      alive = false;
      off();
      urls.forEach(URL.revokeObjectURL);
    };
  }, []);

  const showReminder = photos && photos.length > 0 && Date.now() - settings.backupReminderDismissedAt > REMIND_EVERY;

  return (
    <div className="min-h-screen-safe bg-ink pb-[env(safe-area-inset-bottom)]">
      <Header title="Gallery" onBack={() => back({ name: 'camera' })} />
      <InstallBanner />
      {photos === null ? (
        <div className="flex justify-center p-10">
          <Spinner label="Loading gallery" />
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
            <Icon name="image" size={30} />
          </span>
          <p className="text-[17px] font-semibold">No photos yet</p>
          <p className="text-[14px] text-white/60">Photos you take or import in {APP.name} show up here.</p>
          <Button onClick={() => navigate({ name: 'camera' })}>Open camera</Button>
        </div>
      ) : (
        <>
          {showReminder && (
            <div className="mx-3 mb-3 flex gap-3 rounded-2xl bg-accent/10 p-3 text-[13px] text-white/85" role="note">
              <Icon name="info" className="mt-0.5 shrink-0 text-accent" size={20} />
              <p className="flex-1">
                Your gallery lives in this browser on this phone. <strong>Save favourites to Photos</strong> (Share → Save Image) — clearing
                browser data or removing the app deletes them.
              </p>
              <button
                type="button"
                aria-label="Dismiss reminder"
                className="-m-1 flex h-11 w-11 items-center justify-center"
                onClick={() => setSettings({ backupReminderDismissedAt: Date.now() })}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          )}
          <ul className="grid grid-cols-3 gap-0.5 px-0.5" aria-label={`${photos.length} photo${photos.length === 1 ? "" : "s"}`}>
            {photos.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => navigate({ name: 'view', id: p.id })}
                  className="block aspect-square w-full overflow-hidden bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  aria-label={`Photo from ${new Date(p.takenAt).toLocaleString()}`}
                >
                  <img src={p.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
          <p className="px-4 py-4 text-center text-[12px] text-white/45">
            {photos.length} photo{photos.length === 1 ? '' : 's'}
            {usage ? ` · ${formatBytes(usage.used)} used on this device` : ''}
            {persisted === true ? ' · protected storage' : persisted === false ? ' · browser may clear storage if space runs low' : ''}
          </p>
        </>
      )}
    </div>
  );
}
