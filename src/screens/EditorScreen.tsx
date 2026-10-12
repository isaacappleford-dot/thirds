import { useCallback, useEffect, useRef, useState } from 'react';
import { getLook, LOOKS } from '../config/looks';
import { Icon } from '../components/Icon';
import { Button, Header, IconButton, Sheet, Spinner, Toggle } from '../components/ui';
import { DATE_FORMATS, formatStamp } from '../frames/dateStamp';
import { composeInto } from '../frames/compose';
import { deletePhoto, getPhoto, type PhotoRecord } from '../gallery/db';
import { shareOrDownload } from '../gallery/share';
import { releaseCanvas, scaledCopy } from '../image/canvas';
import { decodeToCanvas } from '../image/decode';
import { HALATION_SIZE, LookRenderer } from '../looks/renderer';
import { recipeKey, type FrameId, type LookId, type Recipe } from '../looks/recipe';
import { back, navigate } from '../lib/router';
import { toast } from '../lib/toast';
import { exportPhoto, saveRecipe } from '../photos/service';
import { setSettings } from '../settings';

const FRAMES: { id: FrameId; name: string }[] = [
  { id: 'none', name: 'None' },
  { id: 'gallery', name: 'Gallery' },
  { id: 'paper', name: 'Paper' },
];

const THUMB = 160;

interface Sources {
  preview: HTMLCanvasElement;
  hal: HTMLCanvasElement;
  thumb: HTMLCanvasElement;
}

export default function EditorScreen({ id }: { id: string }) {
  const [rec, setRec] = useState<PhotoRecord | null>(null);
  const [missing, setMissing] = useState(false);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [tab, setTab] = useState<'looks' | 'frames'>('looks');
  const [comparing, setComparing] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [pendingShare, setPendingShare] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const savedKey = useRef('');

  const viewRef = useRef<HTMLCanvasElement>(null);
  const sources = useRef<Sources | null>(null);
  const renderer = useRef<LookRenderer | null>(null);
  const thumbRefs = useRef(new Map<LookId, HTMLCanvasElement>());
  const raf = useRef(0);

  useEffect(() => {
    let alive = true;
    getPhoto(id).then((r) => {
      if (!alive) return;
      if (!r) setMissing(true);
      else {
        setRec(r);
        setRecipe(r.recipe);
        savedKey.current = recipeKey(r.recipe);
      }
    });
    return () => {
      alive = false;
    };
  }, [id]);

  // Decode once into a screen-sized preview source + a small halation source.
  useEffect(() => {
    if (!rec) return;
    let alive = true;
    const view = viewRef.current;
    (async () => {
      try {
        const full = await decodeToCanvas(rec.original);
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const side = Math.min(2048, Math.round(Math.max(window.innerWidth, window.innerHeight) * dpr));
        const preview = scaledCopy(full.canvas, side);
        releaseCanvas(full.canvas);
        const s: Sources = { preview, hal: scaledCopy(preview, HALATION_SIZE), thumb: scaledCopy(preview, THUMB * 2) };
        if (!alive) {
          Object.values(s).forEach(releaseCanvas);
          return;
        }
        sources.current = s;
        setReady(true);
      } catch (e) {
        if (alive) setError((e as Error).message || 'Couldn’t open this photo.');
      }
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(raf.current);
      renderer.current?.dispose();
      renderer.current = null;
      if (sources.current) Object.values(sources.current).forEach(releaseCanvas);
      sources.current = null;
      releaseCanvas(view);
    };
  }, [rec]);

  const getRenderer = useCallback(() => {
    const s = sources.current;
    if (!s) return null;
    if (!renderer.current || renderer.current.isLost) {
      renderer.current?.dispose();
      renderer.current = new LookRenderer();
      renderer.current.setSource(s.preview, s.hal);
    }
    return renderer.current;
  }, []);

  // Look strip: each look rendered on this photo (one temporary GL context).
  useEffect(() => {
    if (!ready || !sources.current || !recipe) return;
    const s = sources.current;
    let r: LookRenderer | null = null;
    try {
      r = new LookRenderer();
      r.setSource(s.thumb, s.hal);
      for (const look of LOOKS) {
        const c = thumbRefs.current.get(look.id);
        if (!c) continue;
        const k = Math.max(THUMB / s.thumb.width, (THUMB * 1.25) / s.thumb.height);
        const w = Math.round(s.thumb.width * k);
        const h = Math.round(s.thumb.height * k);
        r.render(look.params, look.id === 'original' ? 0 : 1, recipe.seed, w, h);
        c.width = THUMB;
        c.height = Math.round(THUMB * 1.25);
        const ctx = c.getContext('2d');
        ctx?.drawImage(r.canvas, (THUMB - w) / 2, (c.height - h) / 2, w, h);
      }
    } catch {
      /* thumbnails are optional */
    } finally {
      r?.dispose();
    }
    // Only when the photo is ready; the strip doesn't depend on the chosen look.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Render the preview whenever the recipe (or compare state) changes.
  useEffect(() => {
    if (!ready || !recipe || !rec) return;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const s = sources.current;
      const view = viewRef.current;
      if (!s || !view) return;
      try {
        const r = getRenderer()!;
        const look = getLook(recipe.look);
        const intensity = comparing || recipe.look === 'original' ? 0 : recipe.intensity;
        r.render(look.params, intensity, recipe.seed, s.preview.width, s.preview.height);
        composeInto(view, { graded: r.canvas, photoW: s.preview.width, photoH: s.preview.height, recipe, takenAt: new Date(rec.takenAt) }).catch((e: Error) =>
          setError(e.message || 'Rendering failed.'),
        );
      } catch (e) {
        setError((e as Error).message || 'Rendering failed.');
      }
    });
  }, [ready, recipe, comparing, rec, getRenderer]);

  const update = (patch: Partial<Recipe>) => setRecipe((r) => (r ? { ...r, ...patch } : r));

  const save = async () => {
    if (!rec || !recipe) return;
    setSaving('Saving…');
    try {
      if (recipeKey(recipe) !== savedKey.current) await saveRecipe(rec.id, recipe);
      setSettings({ dateFormat: recipe.stampFormat });
      toast('Saved to your gallery');
      back({ name: 'camera' });
    } catch (e) {
      toast((e as Error).message || 'Couldn’t save.');
      setSaving(null);
    }
  };

  const share = async () => {
    if (!rec || !recipe) return;
    setSaving('Preparing full-size photo…');
    try {
      if (recipeKey(recipe) !== savedKey.current) {
        await saveRecipe(rec.id, recipe);
        savedKey.current = recipeKey(recipe);
      }
      const file = await exportPhoto(rec, recipe);
      setSaving(null);
      const outcome = await shareOrDownload(file);
      if (outcome === 'needs-gesture') setPendingShare(file);
      else if (outcome === 'downloaded') toast('Downloaded');
      else if (outcome === 'failed') toast('Couldn’t share or download.');
    } catch (e) {
      setSaving(null);
      toast((e as Error).message || 'Export failed.');
    }
  };

  const discard = async () => {
    if (!rec) return;
    if (!window.confirm('Delete this photo?')) return;
    await deletePhoto(rec.id);
    navigate({ name: 'camera' }, { replace: true });
  };

  if (missing) {
    return (
      <div className="h-screen-safe flex flex-col">
        <Header title="Edit" onBack={() => navigate({ name: 'camera' }, { replace: true })} />
        <p className="p-6 text-center text-white/70">This photo isn’t in your gallery anymore.</p>
      </div>
    );
  }

  const look = recipe ? getLook(recipe.look) : null;

  return (
    <div className="h-screen-safe flex flex-col bg-ink">
      <Header
        title={look ? look.name : 'Edit'}
        onBack={() => void save()}
        right={<IconButton icon="share" label="Share or save to Photos" onClick={() => void share()} disabled={!ready} />}
      />

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3">
        {!ready && !error && <Spinner label="Loading photo" />}
        {error && <p className="px-6 text-center text-white/70">{error}</p>}
        <canvas
          ref={viewRef}
          role="img"
          aria-label={`Photo with the ${look?.name ?? ''} look${comparing ? ', showing original' : ''}. Press and hold to compare with the original.`}
          className={`max-h-full max-w-full touch-none select-none rounded-sm object-contain shadow-lg ${ready ? '' : 'hidden'}`}
          onPointerDown={() => setComparing(true)}
          onPointerUp={() => setComparing(false)}
          onPointerLeave={() => setComparing(false)}
          onPointerCancel={() => setComparing(false)}
          onContextMenu={(e) => e.preventDefault()}
          style={{ WebkitTouchCallout: 'none' }}
        />
        {comparing && <span className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[13px]">Original</span>}
      </div>

      <div className="pb-[calc(env(safe-area-inset-bottom)+8px)]">
        <div role="tablist" aria-label="Edit tools" className="mx-auto mt-2 flex w-56 rounded-full bg-white/10 p-1">
          {(['looks', 'frames'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`min-h-[36px] flex-1 rounded-full text-[14px] font-semibold capitalize ${tab === t ? 'bg-white text-ink' : 'text-white/70'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {recipe && (
          <div hidden={tab !== 'looks'}>
            <div className="no-scrollbar flex snap-x gap-2 overflow-x-auto px-3 py-3" role="radiogroup" aria-label="Looks">
              {LOOKS.map((l) => {
                const active = recipe.look === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`${l.name}: ${l.description}`}
                    onClick={() => update({ look: l.id, intensity: active ? recipe.intensity : 1 })}
                    className="flex shrink-0 snap-start flex-col items-center gap-1"
                  >
                    <canvas
                      ref={(c) => {
                        if (c) thumbRefs.current.set(l.id, c);
                      }}
                      width={THUMB}
                      height={THUMB * 1.25}
                      className={`h-[90px] w-[72px] rounded-lg bg-white/5 ${active ? 'ring-2 ring-accent ring-offset-2 ring-offset-ink' : ''}`}
                    />
                    <span className={`text-[12px] ${active ? 'font-semibold text-accent' : 'text-white/70'}`}>{l.name}</span>
                  </button>
                );
              })}
            </div>
            <div className={`flex items-center gap-3 px-5 ${recipe.look === 'original' ? 'invisible' : ''}`}>
              <label htmlFor="intensity" className="text-[13px] text-white/70">
                Intensity
              </label>
              <input
                id="intensity"
                type="range"
                className="slider flex-1"
                min={0}
                max={100}
                value={Math.round(recipe.intensity * 100)}
                onChange={(e) => update({ intensity: Number(e.target.value) / 100 })}
              />
              <span className="w-10 text-right text-[13px] tabular-nums text-white/80" aria-hidden="true">
                {Math.round(recipe.intensity * 100)}%
              </span>
            </div>
          </div>
        )}

        {recipe && rec && (
          <div hidden={tab !== 'frames'} className="px-3 pt-3">
            <div className="flex justify-center gap-3" role="radiogroup" aria-label="Frames">
              {FRAMES.map((f) => {
                const active = recipe.frame === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => update({ frame: f.id })}
                    className={`flex min-h-[64px] w-24 flex-col items-center justify-center gap-1 rounded-2xl border text-[13px] ${
                      active ? 'border-accent text-accent' : 'border-white/15 text-white/80'
                    }`}
                  >
                    <FrameGlyph id={f.id} />
                    {f.name}
                  </button>
                );
              })}
            </div>
            <div className="mt-1 divide-y divide-white/10">
              {recipe.frame === 'gallery' && <Toggle label="Thin keyline" checked={recipe.keyline} onChange={(v) => update({ keyline: v })} />}
              <Toggle label="Date stamp" hint={formatStamp(new Date(rec.takenAt), recipe.stampFormat)} checked={recipe.stamp} onChange={(v) => update({ stamp: v })} />
            </div>
            {recipe.stamp && (
              <div className="flex justify-center gap-2 pb-1" role="radiogroup" aria-label="Date format">
                {DATE_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={recipe.stampFormat === f.id}
                    onClick={() => update({ stampFormat: f.id })}
                    className={`min-h-[40px] rounded-full px-3 font-mono text-[13px] ${
                      recipe.stampFormat === f.id ? 'bg-[#ff9a3d] text-ink' : 'bg-white/10 text-white/80'
                    }`}
                  >
                    {formatStamp(new Date(rec.takenAt), f.id)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-2 flex items-center gap-3 px-4">
          <IconButton icon="trash" label="Delete photo" onClick={() => void discard()} />
          <Button className="flex-1" onClick={() => void save()} disabled={!recipe || !!saving}>
            <Icon name="check" size={20} /> Save
          </Button>
        </div>
      </div>

      {saving && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/60">
          <Spinner label={saving} />
          <span className="text-[14px] text-white/80">{saving}</span>
        </div>
      )}

      <Sheet open={!!pendingShare} onClose={() => setPendingShare(null)} title="Your photo is ready">
        <Button
          className="w-full"
          onClick={async () => {
            const f = pendingShare;
            setPendingShare(null);
            if (f) {
              const o = await shareOrDownload(f);
              if (o === 'downloaded') toast('Downloaded');
            }
          }}
        >
          <Icon name="share" size={20} /> Share or save to Photos
        </Button>
      </Sheet>
    </div>
  );
}

function FrameGlyph({ id }: { id: FrameId }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      {id === 'paper' && <rect x="1" y="1" width="26" height="26" rx="2" fill="rgba(255,255,255,0.15)" />}
      {id !== 'none' && <rect x="4" y="3" width="20" height="23" rx="1" fill={id === 'paper' ? '#f2ece0' : '#fbfbf9'} />}
      <rect x={id === 'none' ? 4 : 7} y={id === 'none' ? 4 : 6} width={id === 'none' ? 20 : 14} height={id === 'none' ? 20 : 14} fill="#6b7d4f" />
    </svg>
  );
}
