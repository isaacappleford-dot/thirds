import { APP } from '../config/app';
import { Button } from '../components/ui';
import { Icon } from '../components/Icon';
import { isAndroid, isIOS, isStandalone } from '../lib/platform';
import type { CameraErrorKind } from './stream';

function deniedSteps(): string[] {
  if (isIOS && isStandalone()) {
    return [`Open the Settings app and find ${APP.name} (or Safari) → Camera → Allow.`, `Then come back and tap “Try again”.`];
  }
  if (isIOS) {
    return ['Tap “aA” in the address bar → Website Settings → Camera → Allow.', 'Or: Settings app → Safari → Camera → Allow.'];
  }
  if (isAndroid && isStandalone()) {
    return [`Long-press the ${APP.name} icon → App info → Permissions → Camera → Allow.`];
  }
  if (isAndroid) return ['Tap the icon left of the address → Permissions → Camera → Allow.', 'Then tap “Try again”.'];
  return ['Click the camera icon in the address bar and allow access, then try again.'];
}

const COPY: Record<CameraErrorKind, { title: string; body: string }> = {
  denied: { title: 'Camera access is off', body: `${APP.name} needs the camera to coach your shot. Nothing is recorded or uploaded.` },
  nocamera: { title: 'No camera found', body: 'You can still import photos, use your phone’s camera app, or try the demo camera.' },
  insecure: { title: 'Needs a secure connection', body: 'Browsers only allow the camera on https:// pages. Open the https address of this app.' },
  busy: { title: 'Camera is busy', body: 'Another app is using the camera. Close it and try again.' },
  error: { title: 'Couldn’t start the camera', body: 'Something went wrong starting the camera. Try again, or use one of the options below.' },
};

export function CameraProblem({
  kind,
  onRetry,
  onNative,
  onImport,
  onDemo,
}: {
  kind: CameraErrorKind;
  onRetry: () => void;
  onNative: () => void;
  onImport: () => void;
  onDemo: () => void;
}) {
  const copy = COPY[kind];
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto px-6 py-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
        <Icon name="camera" size={30} />
      </span>
      <h2 className="text-[22px] font-semibold">{copy.title}</h2>
      <p className="max-w-sm text-[15px] text-white/70">{copy.body}</p>
      {kind === 'denied' && (
        <ol className="max-w-sm list-decimal space-y-1 pl-5 text-left text-[14px] text-white/80">
          {deniedSteps().map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      )}
      <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
        {kind !== 'nocamera' && kind !== 'insecure' && <Button onClick={onRetry}>Try again</Button>}
        <Button variant="secondary" onClick={onNative}>
          Use phone camera
        </Button>
        <Button variant="secondary" onClick={onImport}>
          Import from library
        </Button>
        <Button variant="ghost" onClick={onDemo}>
          Try the demo camera
        </Button>
      </div>
    </div>
  );
}
