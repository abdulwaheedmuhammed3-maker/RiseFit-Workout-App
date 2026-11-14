import { cp, mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const source = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const destination = join(root, 'public', 'mediapipe', 'wasm');
const publicAssets = join(root, 'public', 'mediapipe');

const files = await readdir(source);
if (!files.some(file => file.endsWith('.wasm'))) {
  throw new Error('MediaPipe WASM assets were not found in @mediapipe/tasks-vision.');
}
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });

const modelUrl = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const response = await fetch(modelUrl);
if (!response.ok) {
  throw new Error(`Could not download MediaPipe pose model during build: HTTP ${response.status}`);
}
const model = new Uint8Array(await response.arrayBuffer());
if (model.byteLength < 100000) {
  throw new Error('Downloaded MediaPipe pose model is unexpectedly small.');
}
await mkdir(publicAssets, { recursive: true });
await writeFile(join(publicAssets, 'pose_landmarker_lite.task'), model);
console.log(`Bundled ${files.length} MediaPipe runtime files and ${model.byteLength} model bytes.`);
