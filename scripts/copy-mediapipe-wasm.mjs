// Copia los binarios WASM de MediaPipe Tasks Vision a /public para servirlos
// localmente (misma versión que el paquete JS instalado, sin depender de un CDN).
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const dest = resolve(root, 'public/mediapipe/wasm');

if (!existsSync(src)) {
  console.warn('[mediapipe] No se encontró', src, '— ¿ejecutaste npm install?');
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('[mediapipe] WASM copiado a public/mediapipe/wasm');
