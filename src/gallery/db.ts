import Dexie, { type EntityTable } from 'dexie';
import { APP } from '../config/app';
import type { Recipe } from '../looks/recipe';

export type PhotoSource = 'camera' | 'native' | 'import' | 'sample';

export interface PhotoRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  /** Capture time (EXIF or shutter press), used for the date stamp. */
  takenAt: number;
  source: PhotoSource;
  width: number;
  height: number;
  /** The untouched original (upright, ≤16 MP). */
  original: Blob;
  recipe: Recipe;
  /** Rendered with the recipe, ~400 px, for the grid. */
  thumb: Blob;
  /** Rendered with the recipe, ~1600 px, for the full-screen viewer. */
  display: Blob;
}

/** Lightweight listing without the big blobs. */
export type PhotoSummary = Pick<PhotoRecord, 'id' | 'createdAt' | 'takenAt' | 'thumb' | 'width' | 'height'>;

class GalleryDB extends Dexie {
  photos!: EntityTable<PhotoRecord, 'id'>;
  constructor() {
    super(`${APP.storagePrefix}-gallery`);
    this.version(1).stores({ photos: 'id, createdAt' });
  }
}

let instance: GalleryDB | null = null;
export const db = () => (instance ??= new GalleryDB());

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function addPhoto(p: PhotoRecord) {
  await db().photos.put(p);
  notify();
}

export async function getPhoto(id: string) {
  return db().photos.get(id);
}

export async function updatePhoto(id: string, patch: Partial<PhotoRecord>) {
  await db().photos.update(id, { ...patch, updatedAt: Date.now() });
  notify();
}

export async function deletePhoto(id: string) {
  await db().photos.delete(id);
  notify();
}

export async function clearGallery() {
  await db().photos.clear();
  notify();
}

/** Newest first. Reads only the small fields via a cursor to avoid loading originals. */
export async function listPhotos(): Promise<PhotoSummary[]> {
  const out: PhotoSummary[] = [];
  await db()
    .photos.orderBy('createdAt')
    .reverse()
    .each((p) => out.push({ id: p.id, createdAt: p.createdAt, takenAt: p.takenAt, thumb: p.thumb, width: p.width, height: p.height }));
  return out;
}

export async function photoIds(): Promise<string[]> {
  return (await db().photos.orderBy('createdAt').reverse().primaryKeys()) as string[];
}

const listeners = new Set<() => void>();
export function onGalleryChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((fn) => fn());
}
