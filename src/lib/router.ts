import { useSyncExternalStore } from 'react';

/**
 * Hash routes: works on GitHub Pages without rewrites and gives Android's
 * back button something sensible to do.
 */
export type Route =
  | { name: 'onboarding' }
  | { name: 'camera' }
  | { name: 'edit'; id: string }
  | { name: 'gallery' }
  | { name: 'view'; id: string }
  | { name: 'settings' }
  | { name: 'privacy' }
  | { name: 'credits' };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (parts[0]) {
    case 'onboarding':
      return { name: 'onboarding' };
    case 'edit':
      return parts[1] ? { name: 'edit', id: decodeURIComponent(parts[1]) } : { name: 'camera' };
    case 'gallery':
      return { name: 'gallery' };
    case 'view':
      return parts[1] ? { name: 'view', id: decodeURIComponent(parts[1]) } : { name: 'gallery' };
    case 'settings':
      return { name: 'settings' };
    case 'privacy':
      return { name: 'privacy' };
    case 'credits':
      return { name: 'credits' };
    default:
      return { name: 'camera' };
  }
}

export function routeToHash(r: Route): string {
  switch (r.name) {
    case 'edit':
    case 'view':
      return `#/${r.name}/${encodeURIComponent(r.id)}`;
    case 'camera':
      return '#/';
    default:
      return `#/${r.name}`;
  }
}

/** How many entries we pushed ourselves, so "back" never leaves the app. */
let depth = 0;

export function navigate(r: Route, opts: { replace?: boolean } = {}) {
  const hash = routeToHash(r);
  if (opts.replace) {
    history.replaceState({ depth }, '', hash);
  } else {
    depth += 1;
    history.pushState({ depth }, '', hash);
  }
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Go back if we navigated here in-app, otherwise to a sensible parent. */
export function back(fallback: Route = { name: 'camera' }) {
  if (depth > 0) history.back();
  else navigate(fallback, { replace: true });
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', (e) => {
    depth = (e.state as { depth?: number } | null)?.depth ?? 0;
  });
}

function subscribe(fn: () => void) {
  window.addEventListener('hashchange', fn);
  window.addEventListener('popstate', fn);
  return () => {
    window.removeEventListener('hashchange', fn);
    window.removeEventListener('popstate', fn);
  };
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash, () => '');
  return parseRoute(hash);
}
