// Copies self-hosted runtime assets into public/ so nothing is fetched from a
// third-party server at runtime:
//   - MediaPipe tasks-vision WASM (Apache-2.0) -> public/mediapipe/
//   - DSEG7 Classic font (OFL-1.1)             -> public/fonts/
//   - Detection models (Apache-2.0)            -> public/models/ (downloaded only if missing)
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');

async function exists(p) {
  try {
    return (await stat(p)).size > 0;
  } catch {
    return false;
  }
}

async function copy(from, to) {
  await mkdir(dirname(to), { recursive: true });
  await copyFile(from, to);
}

const wasmSrc = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
for (const f of [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]) {
  await copy(join(wasmSrc, f), join(pub, 'mediapipe', f));
}

await copy(
  join(root, 'node_modules/dseg/fonts/DSEG7-Classic/DSEG7Classic-Bold.woff2'),
  join(pub, 'fonts/DSEG7Classic-Bold.woff2'),
);

const models = {
  'efficientdet_lite0.tflite':
    'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/latest/efficientdet_lite0.tflite',
  'blaze_face_short_range.tflite':
    'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
};
for (const [name, url] of Object.entries(models)) {
  const dest = join(pub, 'models', name);
  if (await exists(dest)) continue;
  console.log(`Downloading ${name}…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}
console.log('Assets ready.');
