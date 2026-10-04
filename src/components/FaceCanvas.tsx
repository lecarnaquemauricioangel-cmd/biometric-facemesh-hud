import { useEffect, useRef, type RefObject } from 'react';
import type { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { EAR_HISTORY_LENGTH, TELEMETRY_INTERVAL_MS } from '../config';
import { drawAccessory } from '../lib/accessories';
import { BlinkTracker, clamp, eyeAspectRatio, headPoseFromMatrix } from '../lib/biometrics';
import {
  computeBounds,
  drawFrameChrome,
  drawHud,
  drawMirroredVideo,
  drawSearching,
  drawWireframe,
  NEON,
  projectLandmarks,
} from '../lib/drawing';
import {
  IRIS_LANDMARK_COUNT,
  LEFT_EYE_EAR,
  LEFT_EYE_OUTER,
  NOSE_TIP,
  RIGHT_EYE_EAR,
  RIGHT_EYE_OUTER,
} from '../lib/landmarks';
import { TransformSmoother, type AccessoryTransform } from '../lib/smoothing';
import type { BlinkState, HeadPose, Settings, Telemetry } from '../types';

interface FaceCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  landmarker: FaceLandmarker | null;
  /** true cuando cámara y modelo están listos. */
  active: boolean;
  settings: Settings;
  onTelemetry: (t: Telemetry) => void;
  /** Cambia de valor para iniciar una autocalibración del umbral EAR. */
  calibrationToken: number;
  onCalibrated: (threshold: number | null) => void;
  /** Cambia de valor para reiniciar los contadores de parpadeo/fatiga. */
  resetToken: number;
}

const CALIBRATION_MS = 2500;
/** El umbral se fija al 72 % del EAR con ojos abiertos medido. */
const CALIBRATION_RATIO = 0.72;

interface Calibration {
  until: number;
  sum: number;
  samples: number;
}

/**
 * Canvas principal: ejecuta un único loop requestAnimationFrame que
 * 1) infiere landmarks solo cuando hay un frame de video nuevo,
 * 2) calcula biometría (EAR, parpadeo, pose) y
 * 3) dibuja el modo de visualización + accesorio.
 * La telemetría se publica a React a ~10 Hz para no re-renderizar 60 veces por segundo.
 */
export function FaceCanvas({
  canvasRef,
  videoRef,
  landmarker,
  active,
  settings,
  onTelemetry,
  calibrationToken,
  onCalibrated,
  resetToken,
}: FaceCanvasProps) {
  // Refs "vivas" para que el loop lea siempre el último valor sin reiniciarse.
  const settingsRef = useRef(settings);
  const onTelemetryRef = useRef(onTelemetry);
  const onCalibratedRef = useRef(onCalibrated);
  useEffect(() => {
    settingsRef.current = settings;
    onTelemetryRef.current = onTelemetry;
    onCalibratedRef.current = onCalibrated;
  });

  const trackerRef = useRef(new BlinkTracker());
  const smootherRef = useRef(new TransformSmoother());
  const calibrationRef = useRef<Calibration | null>(null);

  useEffect(() => {
    if (calibrationToken === 0) return;
    calibrationRef.current = { until: performance.now() + CALIBRATION_MS, sum: 0, samples: 0 };
  }, [calibrationToken]);

  useEffect(() => {
    if (resetToken === 0) return;
    trackerRef.current.reset();
  }, [resetToken]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!active || !canvas || !video || !landmarker) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const tracker = trackerRef.current;
    const smoother = smootherRef.current;
    const points = new Float32Array(IRIS_LANDMARK_COUNT * 3);
    const earHistory: number[] = [];

    let rafId = 0;
    let disposed = false;
    let lastVideoTime = -1;
    let result: FaceLandmarkerResult | null = null;
    let inferenceMs = 0;
    let fps = 0;
    let framesInWindow = 0;
    let fpsWindowStart = performance.now();
    let lastTelemetry = 0;
    let earLeft = 0;
    let earRight = 0;
    let pose: HeadPose = { pitch: 0, yaw: 0, roll: 0 };
    let blink: BlinkState = {
      eyesClosed: false,
      blinkCount: 0,
      blinksPerMinute: 0,
      perclos: 0,
      closedDurationMs: 0,
      fatigue: 'normal',
    };
    let transform: AccessoryTransform | null = null;

    const loop = (): void => {
      if (disposed) return;
      rafId = requestAnimationFrame(loop);
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) return;

      const w = video.videoWidth;
      const h = video.videoHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const now = performance.now();
      const s = settingsRef.current;
      const scale = w / 1280;

      // ── 1. Inferencia (solo con frames nuevos) ──
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const t0 = performance.now();
        try {
          result = landmarker.detectForVideo(video, t0);
        } catch (err) {
          console.error('[FaceCanvas] detectForVideo falló', err);
          result = null;
        }
        inferenceMs = inferenceMs * 0.9 + (performance.now() - t0) * 0.1;
        framesInWindow++;

        const lm = result?.faceLandmarks[0];
        if (lm) {
          earRight = eyeAspectRatio(lm, RIGHT_EYE_EAR, w, h);
          earLeft = eyeAspectRatio(lm, LEFT_EYE_EAR, w, h);
          const earAvg = (earLeft + earRight) / 2;
          blink = tracker.update(earAvg, s.earThreshold, s.blinkMinFrames, now);
          pose = headPoseFromMatrix(result?.facialTransformationMatrixes[0]) ?? pose;

          const cal = calibrationRef.current;
          if (cal && !blink.eyesClosed) {
            cal.sum += earAvg;
            cal.samples++;
          }
        } else {
          tracker.markFaceLost();
          blink = { ...blink, eyesClosed: false, closedDurationMs: 0 };
          smoother.reset();
          transform = null;
        }
      }

      const calibration = calibrationRef.current;
      if (calibration && now >= calibration.until) {
        calibrationRef.current = null;
        const threshold =
          calibration.samples >= 15
            ? clamp(Math.round((calibration.sum / calibration.samples) * CALIBRATION_RATIO * 100) / 100, 0.12, 0.35)
            : null;
        onCalibratedRef.current(threshold);
      }

      if (now - fpsWindowStart >= 500) {
        fps = (framesInWindow * 1000) / (now - fpsWindowStart);
        framesInWindow = 0;
        fpsWindowStart = now;
      }

      // ── 2. Render ──
      const t = now / 1000;
      const landmarks = result?.faceLandmarks[0];

      if (s.viewMode === 'wireframe') {
        ctx.fillStyle = NEON.bg;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 0.18;
        drawMirroredVideo(ctx, video, w, h);
        ctx.globalAlpha = 1;
      } else {
        drawMirroredVideo(ctx, video, w, h);
      }

      let count = 0;
      if (landmarks) {
        count = projectLandmarks(landmarks, w, h, points);
        const bounds = computeBounds(points, count);

        if (s.viewMode === 'hud') {
          drawHud(
            ctx,
            points,
            count,
            bounds,
            {
              pose,
              earAvg: (earLeft + earRight) / 2,
              eyesClosed: blink.eyesClosed,
              fatigue: blink.fatigue,
              blinkCount: blink.blinkCount,
            },
            s.meshOpacity,
            t,
            scale,
          );
        } else if (s.viewMode === 'wireframe') {
          drawWireframe(ctx, points, count, s.meshOpacity, scale);
        }

        if (s.accessory !== 'none') {
          // Lado izquierdo de pantalla = ojo izquierdo del sujeto (vista espejo).
          const lx = points[LEFT_EYE_OUTER * 3];
          const ly = points[LEFT_EYE_OUTER * 3 + 1];
          const rx = points[RIGHT_EYE_OUTER * 3];
          const ry = points[RIGHT_EYE_OUTER * 3 + 1];
          const nx = points[NOSE_TIP * 3];
          const ny = points[NOSE_TIP * 3 + 1];
          const dL = Math.hypot(nx - lx, ny - ly);
          const dR = Math.hypot(nx - rx, ny - ry);
          transform = smoother.update(
            {
              cx: (lx + rx) / 2,
              cy: (ly + ry) / 2,
              unit: Math.hypot(rx - lx, ry - ly),
              angle: Math.atan2(ry - ly, rx - lx),
              asym: clamp((dL - dR) / (dL + dR || 1), -1, 1),
            },
            s.smoothing,
          );
          drawAccessory(ctx, s.accessory, transform, t);
        }
      } else if (s.viewMode !== 'accessories') {
        drawSearching(ctx, w, h, t, scale);
      }

      if (s.viewMode !== 'accessories') {
        drawFrameChrome(ctx, w, h, fps, count, t, scale);
      }

      // ── 3. Telemetría throttled hacia React ──
      if (now - lastTelemetry >= TELEMETRY_INTERVAL_MS) {
        lastTelemetry = now;
        const faceDetected = Boolean(landmarks);
        const earAvg = faceDetected ? (earLeft + earRight) / 2 : 0;
        earHistory.push(earAvg);
        if (earHistory.length > EAR_HISTORY_LENGTH) earHistory.shift();
        const cal = calibrationRef.current;
        onTelemetryRef.current({
          ...blink,
          faceDetected,
          fps,
          inferenceMs,
          landmarkCount: count,
          resolution: { width: w, height: h },
          pose,
          earLeft: faceDetected ? earLeft : 0,
          earRight: faceDetected ? earRight : 0,
          earAvg,
          earHistory: earHistory.slice(),
          calibrationProgress: cal ? clamp(1 - (cal.until - now) / CALIBRATION_MS, 0, 1) : null,
        });
      }
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      result = null;
    };
  }, [active, canvasRef, videoRef, landmarker]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full object-contain"
      aria-label="Vista biométrica en tiempo real"
    />
  );
}
