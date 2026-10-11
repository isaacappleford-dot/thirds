import { APP } from '../config/app';
import { CREDITS } from '../config/credits';
import { Header } from '../components/ui';
import { back } from '../lib/router';

export default function CreditsScreen() {
  return (
    <div className="min-h-screen-safe bg-ink pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <Header title="Credits" onBack={() => back({ name: 'settings' })} />
      <div className="mx-auto max-w-prose px-5 text-[15px] text-white/80">
        <p className="mb-4">
          {APP.name} is free and built on open-source software. The app’s logo, icons, looks and sample scenes are original. Thank you to these projects:
        </p>
        <ul className="divide-y divide-white/10 rounded-2xl bg-white/5">
          {CREDITS.map((c) => (
            <li key={c.name} className="px-4 py-3">
              <p className="font-medium text-white">{c.name}</p>
              <p className="text-[13px] text-white/60">{c.what}</p>
              <p className="text-[13px] text-white/60">
                License: {c.license} ·{' '}
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="break-all text-accent underline">
                  source
                </a>
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[13px] text-white/50">Full license texts are included with each package in the source repository.</p>
      </div>
    </div>
  );
}
