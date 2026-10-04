export type ViewMode = 'hud' | 'wireframe' | 'accessories';

export type AccessoryId = 'none' | 'visor' | 'aviator' | 'mask';

export interface Settings {
  viewMode: ViewMode;
  accessory: AccessoryId;
  /** Umbral EAR por debajo del cual el ojo se considera cerrado. */
  earThreshold: number;
  /** Frames consecutivos bajo el umbral para confirmar un cierre. */
  blinkMinFrames: number;
  /** 0 = sin suavizado, 0.9 = muy suave (más latencia). */
  smoothing: number;
  /** Confianza mínima de detección/seguimiento de MediaPipe. */
  detectionConfidence: number;
  /** Opacidad de la malla en modo HUD. */
  meshOpacity: number;
}

export type CameraStatus =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'denied'
  | 'not-found'
  | 'in-use'
  | 'insecure'
  | 'unsupported'
  | 'disconnected'
  | 'error';

export type ModelStatus = 'loading' | 'ready' | 'error';

export type Delegate = 'GPU' | 'CPU';

export interface HeadPose {
  /** Grados. Positivo = cabeza hacia arriba. */
  pitch: number;
  /** Grados. Positivo = giro hacia la derecha de la pantalla. */
  yaw: number;
  /** Grados. Positivo = inclinación en sentido horario en pantalla. */
  roll: number;
}

export type FatigueLevel = 'normal' | 'moderate' | 'high' | 'critical';

export interface BlinkState {
  eyesClosed: boolean;
  blinkCount: number;
  blinksPerMinute: number;
  /** Porcentaje (0–1) de tiempo con ojos cerrados en la ventana reciente. */
  perclos: number;
  closedDurationMs: number;
  fatigue: FatigueLevel;
}

export interface Telemetry extends BlinkState {
  faceDetected: boolean;
  fps: number;
  inferenceMs: number;
  landmarkCount: number;
  resolution: { width: number; height: number };
  pose: HeadPose;
  earLeft: number;
  earRight: number;
  earAvg: number;
  /** Historial reciente de EAR medio (muestreado a ~10 Hz). */
  earHistory: number[];
  /** Progreso 0–1 de la autocalibración, o null si no está activa. */
  calibrationProgress: number | null;
}
