import { APP } from '../config/app';
import { Header } from '../components/ui';
import { back } from '../lib/router';

export default function PrivacyScreen() {
  return (
    <div className="min-h-screen-safe bg-ink pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <Header title="Privacy" onBack={() => back({ name: 'settings' })} />
      <article className="mx-auto max-w-prose space-y-4 px-5 text-[15px] leading-relaxed text-white/80">
        <h2 className="text-[20px] font-semibold text-white">The short version: your photos never leave your phone.</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>No servers.</strong> {APP.name} is a static web app. After it loads, it makes no network requests except to update itself from the same
            site.
          </li>
          <li>
            <strong>On-device analysis.</strong> Subject detection, composition tips, looks and frames all run in your browser. Camera frames are never
            recorded or sent anywhere.
          </li>
          <li>
            <strong>No accounts, ads, analytics or tracking.</strong> Nothing to sign up for, nothing to buy.
          </li>
          <li>
            <strong>Local gallery.</strong> Photos and edits are stored in this browser’s storage (IndexedDB) on this device. Clearing browser data,
            removing the Home Screen app, or (on iPhone) not opening the app for a long time can delete them — save favourites to Photos.
          </li>
          <li>
            <strong>Permissions.</strong> The camera is only on while you’re on the camera screen. Motion sensors are only used for the level.
          </li>
          <li>
            <strong>Sharing</strong> uses your phone’s own share sheet. Only you decide where a photo goes.
          </li>
        </ul>
      </article>
    </div>
  );
}
