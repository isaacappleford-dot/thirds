import { lazy, Suspense, useEffect } from 'react';
import { Spinner } from './components/ui';
import { useRoute } from './lib/router';
import { useToast } from './lib/toast';
import CameraScreen from './screens/CameraScreen';
import Onboarding from './screens/Onboarding';
import { useSettings } from './settings';

// Everything except the camera (and first-run onboarding) is code-split, so the
// first camera frame isn't waiting on WebGL, IndexedDB or settings code.
const EditorScreen = lazy(() => import('./screens/EditorScreen'));
const GalleryScreen = lazy(() => import('./screens/GalleryScreen'));
const ViewerScreen = lazy(() => import('./screens/ViewerScreen'));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'));
const PrivacyScreen = lazy(() => import('./screens/PrivacyScreen'));
const CreditsScreen = lazy(() => import('./screens/CreditsScreen'));

function Toast() {
  const t = useToast();
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+120px)] z-[60] flex justify-center px-6">
      {t.message && (
        <span key={t.id} className="rounded-full bg-white px-4 py-2 text-[14px] font-medium text-ink shadow-xl motion-safe:animate-[fadein_150ms_ease-out]">
          {t.message}
        </span>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="h-screen-safe flex items-center justify-center bg-ink">
      <Spinner label="Loading" />
    </div>
  );
}

export default function App() {
  const route = useRoute();
  const settings = useSettings();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.name]);

  let screen;
  if (!settings.onboarded && route.name !== 'privacy' && route.name !== 'credits') {
    screen = <Onboarding />;
  } else {
    switch (route.name) {
      case 'edit':
        screen = <EditorScreen key={route.id} id={route.id} />;
        break;
      case 'gallery':
        screen = <GalleryScreen />;
        break;
      case 'view':
        screen = <ViewerScreen id={route.id} />;
        break;
      case 'settings':
        screen = <SettingsScreen />;
        break;
      case 'privacy':
        screen = <PrivacyScreen />;
        break;
      case 'credits':
        screen = <CreditsScreen />;
        break;
      default:
        screen = <CameraScreen />;
    }
  }

  return (
    <>
      <Suspense fallback={<Loading />}>{screen}</Suspense>
      <Toast />
    </>
  );
}
