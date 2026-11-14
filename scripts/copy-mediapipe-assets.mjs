import { cp, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const source = join(process.cwd(), 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const destination = join(process.cwd(), 'public', 'mediapipe', 'wasm');

const files = await readdir(source);
if (!files.some(file => file.endsWith('.wasm'))) {
  throw new Error('MediaPipe WASM assets were not found in @mediapipe/tasks-vision.');
}
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
console.log(`Copied ${files.length} MediaPipe runtime files into public/mediapipe/wasm.`);
