import { describe, expect, it } from 'vitest';
import { parseRoute, routeToHash, type Route } from './router';

describe('router', () => {
  it('round-trips routes', () => {
    const routes: Route[] = [
      { name: 'camera' },
      { name: 'gallery' },
      { name: 'edit', id: 'abc-1' },
      { name: 'view', id: 'x y' },
      { name: 'settings' },
      { name: 'privacy' },
      { name: 'credits' },
      { name: 'onboarding' },
    ];
    for (const r of routes) expect(parseRoute(routeToHash(r))).toEqual(r);
  });

  it('falls back to the camera', () => {
    expect(parseRoute('')).toEqual({ name: 'camera' });
    expect(parseRoute('#/nope')).toEqual({ name: 'camera' });
    expect(parseRoute('#/edit')).toEqual({ name: 'camera' });
  });
});
