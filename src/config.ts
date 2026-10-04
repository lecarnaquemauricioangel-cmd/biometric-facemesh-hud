import type { Settings, Telemetry } from './types';

/** Binarios WASM servidos localmente (copiados por scripts/copy-mediapipe-wasm.mjs). */
export const WASM_BASE_PATH = `${import.meta.env.BASE_URL}mediapipe/wasm`;

/** Modelo oficial FaceLandmarker (478 puntos: 468 de malla + 10 de iris). */
export const FACE_MODEL_URL: string =
  import.meta.env.VITE_FACE_MODEL_URL ??
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export const DEFAULT_SETTINGS: Settings = {
  viewMode: 'hud',
  accessory: 'visor',
  earThreshold: 0.21,
  blinkMinFrames: 2,
  smoothing: 0.55,
  detectionConfidence: 0.5,
  meshOpacity: 0.7,
};

export const EAR_HISTORY_LENGTH = 80;

/** Frecuencia con la que el loop de render publica telemetría a React. */
export const TELEMETRY_INTERVAL_MS = 100;

export const EMPTY_TELEMETRY: Telemetry = {
  faceDetected: false,
  fps: 0,
  inferenceMs: 0,
  landmarkCount: 0,
  resolution: { width: 0, height: 0 },
  pose: { pitch: 0, yaw: 0, roll: 0 },
  earLeft: 0,
  earRight: 0,
  earAvg: 0,
  earHistory: [],
  calibrationProgress: null,
  eyesClosed: false,
  blinkCount: 0,
  blinksPerMinute: 0,
  perclos: 0,
  closedDurationMs: 0,
  fatigue: 'normal',
};
