import { useEffect, useRef, useState } from 'react';
import { getLook } from '../config/looks';
import { Icon } from '../components/Icon';
import { Button, IconButton, Sheet, Spinner } from '../components/ui';
import { deletePhoto, getPhoto, onGalleryChange, photoIds } from '../gallery/db';
import { shareOrDownload } from '../gallery/share';
import { back, navigate } from '../lib/router';
import { toast } from '../lib/toast';
import { exportPhoto } from '../photos/service';

/** Lazily loads one photo's viewer image while it's near the visible slide. */
function Slide({ id, near }: { id: string; near: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [label, setLabel] = useState('Photo');
  useEffect(() => {
    if (!near) return;
    let u: string | null = null;
    let alive = true;
    getPhoto(id).then((r) => {
      if (!alive || !r) return;
      u = URL.createObjectURL(r.display);
      setUrl(u);
      setLabel(`Photo from ${new Date(r.takenAt).toLocaleString()}, ${getLook(r.recipe.look).name} look`);
    });
    return () => {
      alive = false;
      if (u) URL.revokeObjectURL(u);
      setUrl(null);
    };
  }, [id, near]);
  return (
    <div className="flex h-full w-full shrink-0 snap-center snap-always items-center justify-center">
      {url ? <img src={url} alt={label} className="max-h-full max-w-full object-contain" draggable={false} /> : near && <Spinner label="Loading photo" />}
    </div>
  );
}

export default function ViewerScreen({ id }: { id: string }) {
  const [ids, setIds] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const initial = useRef(true);

  useEffect(() => {
    let alive = true;
    const load = () =>
      photoIds().then((list) => {
        if (!alive) return;
        setIds(list);
        if (list.length === 0) navigate({ name: 'gallery' }, { replace: true });
      });
    void load();
    const off = onGalleryChange(() => void load());
    return () => {
      alive = false;
      off();
    };
  }, []);

  // Jump to the requested photo once the list is known.
  useEffect(() => {
    if (!ids || !scroller.current || !initial.current) return;
    const i = Math.max(0, ids.indexOf(id));
    initial.current = false;
    setIndex(i);
    scroller.current.scrollLeft = i * scroller.current.clientWidth;
  }, [ids, id]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el || !ids) return;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (i !== index && ids[i]) {
      setIndex(i);
      history.replaceState(history.state, '', `#/view/${encodeURIComponent(ids[i])}`);
    }
  };

  const current = ids?.[index];

  const share = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const rec = await getPhoto(current);
      if (!rec) return;
      const file = await exportPhoto(rec);
      setBusy(false);
      const o = await shareOrDownload(file);
      if (o === 'needs-gesture') setPending(file);
      else if (o === 'downloaded') toast('Downloaded');
    } catch (e) {
      toast((e as Error).message || 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!current || !window.confirm('Delete this photo? This can’t be undone.')) return;
    await deletePhoto(current);
    toast('Deleted');
  };

  const step = (d: number) => {
    const el = scroller.current;
    if (el) el.scrollTo({ left: (index + d) * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div
      className="h-screen-safe relative flex flex-col bg-black"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') step(1);
        if (e.key === 'ArrowLeft') step(-1);
      }}
    >
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-2 pb-6 pt-[calc(env(safe-area-inset-top)+8px)]">
        <IconButton icon="back" label="Back to gallery" className="bg-black/30" onClick={() => back({ name: 'gallery' })} />
        <span className="text-[14px] text-white/70" aria-live="polite">
          {ids ? `${index + 1} of ${ids.length}` : ''}
        </span>
        <span className="w-11" />
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
        tabIndex={0}
        aria-label="Photos. Swipe to browse."
      >
        {ids?.map((pid, i) => <Slide key={pid} id={pid} near={Math.abs(i - index) <= 1} />)}
      </div>

      <div className="flex items-center justify-around gap-2 bg-gradient-to-t from-black/80 to-transparent px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-4">
        <IconButton icon="trash" label="Delete" onClick={() => void remove()} disabled={!current} />
        <Button onClick={() => void share()} disabled={!current || busy}>
          {busy ? <Spinner label="Preparing" /> : <Icon name="share" size={20} />} Share / Save
        </Button>
        <IconButton icon="edit" label="Edit" onClick={() => current && navigate({ name: 'edit', id: current })} disabled={!current} />
      </div>

      <Sheet open={!!pending} onClose={() => setPending(null)} title="Your photo is ready">
        <Button
          className="w-full"
          onClick={async () => {
            const f = pending;
            setPending(null);
            if (f && (await shareOrDownload(f)) === 'downloaded') toast('Downloaded');
          }}
        >
          <Icon name="share" size={20} /> Share or save to Photos
        </Button>
      </Sheet>
    </div>
  );
}
