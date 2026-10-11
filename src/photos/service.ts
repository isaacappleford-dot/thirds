import { addPhoto, getPhoto, newId, updatePhoto, type PhotoRecord, type PhotoSource } from '../gallery/db';
import { requestPersistence } from '../gallery/storage';
import { exifDate, normalizePhoto } from '../image/decode';
import { defaultRecipe, type Recipe } from '../looks/recipe';
import { settingsStore } from '../settings';
import { renderPreviews, renderToBlob } from './render';
import { APP } from '../config/app';

/**
 * Save a new photo to the gallery right away (original + default recipe), so
 * nothing is lost even if the app is closed while editing.
 */
export async function savePhoto(
  blob: Blob,
  source: PhotoSource,
  takenAt?: Date,
  /** Size of a JPEG we produced ourselves (already upright and within limits): skips re-decoding. */
  known?: { width: number; height: number },
): Promise<string> {
  const [norm, exif] = await Promise.all([
    known ? Promise.resolve({ blob, ...known }) : normalizePhoto(blob),
    source === 'camera' ? Promise.resolve(null) : exifDate(blob),
  ]);
  const when = takenAt ?? exif ?? (blob instanceof File && blob.lastModified ? new Date(blob.lastModified) : new Date());
  const recipe = defaultRecipe(settingsStore.get().dateFormat);
  const { thumb, display } = await renderPreviews(norm.blob, recipe, when);
  const id = newId();
  const now = Date.now();
  const rec: PhotoRecord = {
    id,
    createdAt: now,
    updatedAt: now,
    takenAt: when.getTime(),
    source,
    width: norm.width,
    height: norm.height,
    original: norm.blob,
    recipe,
    thumb,
    display,
  };
  await addPhoto(rec);
  void requestPersistence();
  return id;
}

/** Store a new recipe and refresh the thumbnail and viewer image. */
export async function saveRecipe(id: string, recipe: Recipe): Promise<void> {
  const rec = await getPhoto(id);
  if (!rec) throw new Error('Photo not found');
  const { thumb, display } = await renderPreviews(rec.original, recipe, new Date(rec.takenAt));
  await updatePhoto(id, { recipe, thumb, display });
}

export function exportFileName(takenAt: number): string {
  const d = new Date(takenAt);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${APP.filePrefix}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.jpg`;
}

/** Full-resolution JPEG (≈0.92) of a gallery photo with its recipe. */
export async function exportPhoto(rec: PhotoRecord, recipe: Recipe = rec.recipe): Promise<File> {
  const blob = await renderToBlob(rec.original, recipe, new Date(rec.takenAt), { quality: 0.92 });
  return new File([blob], exportFileName(rec.takenAt), { type: 'image/jpeg', lastModified: rec.takenAt });
}
