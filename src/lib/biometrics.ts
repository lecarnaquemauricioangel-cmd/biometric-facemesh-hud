import type { Matrix, NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { BlinkState, FatigueLevel, HeadPose } from '../types';
import type { EyeIndices } from './landmarks';

const RAD_TO_DEG = 180 / Math.PI;

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

function pixelDistance(a: NormalizedLandmark, b: NormalizedLandmark, w: number, h: number): number {
  return Math.hypot((a.x - b.x) * w, (a.y - b.y) * h);
}

/**
 * Eye Aspect Ratio (Soukupová & Čech, 2016):
 *   EAR = (|p2 − p6| + |p3 − p5|) / (2 · |p1 − p4|)
 * Se calcula en píxeles para que el aspect ratio del video no distorsione el valor.
 */
export function eyeAspectRatio(lm: NormalizedLandmark[], eye: EyeIndices, w: number, h: number): number {
  const [i1, i2, i3, i4, i5, i6] = eye;
  const horizontal = pixelDistance(lm[i1], lm[i4], w, h);
  if (horizontal < 1e-6) return 0;
  const vertical = pixelDistance(lm[i2], lm[i6], w, h) + pixelDistance(lm[i3], lm[i5], w, h);
  return vertical / (2 * horizontal);
}

/**
 * Extrae pitch/yaw/roll de la matriz de transformación facial 4×4 (column-major)
 * que devuelve FaceLandmarker. Los signos se ajustan a la vista espejada.
 */
export function headPoseFromMatrix(matrix: Matrix | undefined): HeadPose | null {
  const d = matrix?.data;
  if (!d || d.length < 16) return null;

  // Normaliza columnas por si la matriz incluye escala.
  const sx = Math.hypot(d[0], d[1], d[2]) || 1;
  const sy = Math.hypot(d[4], d[5], d[6]) || 1;
  const sz = Math.hypot(d[8], d[9], d[10]) || 1;

  const r00 = d[0] / sx;
  const r10 = d[1] / sx;
  const r20 = d[2] / sx;
  const r21 = d[6] / sy;
  const r22 = d[10] / sz;

  const pitch = Math.atan2(r21, r22);
  const yaw = Math.asin(clamp(-r20, -1, 1));
  const roll = Math.atan2(r10, r00);

  return {
    pitch: pitch * RAD_TO_DEG,
    yaw: -yaw * RAD_TO_DEG,
    roll: -roll * RAD_TO_DEG,
  };
}

interface ClosureSample {
  t: number;
  dt: number;
  closed: boolean;
}

const PERCLOS_WINDOW_MS = 30_000;
const BLINK_RATE_WINDOW_MS = 60_000;
/** Cierres más largos que esto no cuentan como parpadeo (son cierres voluntarios / microsueño). */
const MAX_BLINK_DURATION_MS = 700;
const MICROSLEEP_MS = 1_500;
const MIN_FATIGUE_DATA_MS = 5_000;

/**
 * Máquina de estados de parpadeo + métricas de fatiga:
 *  - Blink: EAR < umbral durante ≥ N frames y luego reapertura.
 *  - PERCLOS: % de tiempo con ojos cerrados en una ventana deslizante de 30 s.
 *  - Microsueño: ojos cerrados de forma continua > 1.5 s.
 * Todas las estructuras están acotadas para evitar crecimiento de memoria.
 */
export class BlinkTracker {
  private closedFrames = 0;
  private wasClosed = false;
  private closedSince: number | null = null;
  private blinkCount = 0;
  private blinkTimes: number[] = [];
  private samples: ClosureSample[] = [];
  private head = 0;
  private closedMs = 0;
  private totalMs = 0;
  private lastT: number | null = null;
  private startedAt: number | null = null;

  update(ear: number, threshold: number, minFrames: number, now: number): BlinkState {
    this.startedAt ??= now;

    this.closedFrames = ear < threshold ? this.closedFrames + 1 : 0;
    const closed = this.closedFrames >= minFrames;

    if (closed && !this.wasClosed) {
      this.closedSince = now;
    } else if (!closed && this.wasClosed && this.closedSince !== null) {
      if (now - this.closedSince <= MAX_BLINK_DURATION_MS) {
        this.blinkCount += 1;
        this.blinkTimes.push(now);
      }
      this.closedSince = null;
    }
    this.wasClosed = closed;

    // Ventana PERCLOS (cola con índice de cabeza; se compacta periódicamente).
    const dt = this.lastT === null ? 0 : Math.min(now - this.lastT, 250);
    this.lastT = now;
    this.samples.push({ t: now, dt, closed });
    this.totalMs += dt;
    if (closed) this.closedMs += dt;

    while (this.head < this.samples.length && this.samples[this.head].t < now - PERCLOS_WINDOW_MS) {
      const old = this.samples[this.head++];
      this.totalMs -= old.dt;
      if (old.closed) this.closedMs -= old.dt;
    }
    if (this.head > 1024) {
      this.samples = this.samples.slice(this.head);
      this.head = 0;
    }

    while (this.blinkTimes.length > 0 && this.blinkTimes[0] < now - BLINK_RATE_WINDOW_MS) {
      this.blinkTimes.shift();
    }

    const elapsed = now - this.startedAt;
    const rateWindow = clamp(elapsed, 10_000, BLINK_RATE_WINDOW_MS);
    const blinksPerMinute = elapsed < 3_000 ? 0 : (this.blinkTimes.length * 60_000) / rateWindow;
    const perclos = this.totalMs > 0 ? clamp(this.closedMs / this.totalMs, 0, 1) : 0;
    const closedDurationMs = this.closedSince !== null ? now - this.closedSince : 0;

    return {
      eyesClosed: closed,
      blinkCount: this.blinkCount,
      blinksPerMinute,
      perclos,
      closedDurationMs,
      fatigue: classifyFatigue(perclos, blinksPerMinute, closedDurationMs, elapsed),
    };
  }

  /** Al perder el rostro: evita contar el hueco como tiempo con ojos abiertos/cerrados. */
  markFaceLost(): void {
    this.closedFrames = 0;
    this.wasClosed = false;
    this.closedSince = null;
    this.lastT = null;
  }

  reset(): void {
    this.markFaceLost();
    this.blinkCount = 0;
    this.blinkTimes = [];
    this.samples = [];
    this.head = 0;
    this.closedMs = 0;
    this.totalMs = 0;
    this.startedAt = null;
  }
}

function classifyFatigue(perclos: number, bpm: number, closedMs: number, elapsed: number): FatigueLevel {
  if (closedMs >= MICROSLEEP_MS) return 'critical';
  if (elapsed < MIN_FATIGUE_DATA_MS) return 'normal';
  if (perclos >= 0.15) return 'high';
  if (perclos >= 0.075 || bpm > 30) return 'moderate';
  return 'normal';
}
