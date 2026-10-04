import { FaceLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { FatigueLevel, HeadPose } from '../types';
import {
  IRIS_LANDMARK_COUNT,
  KEY_POINTS,
  LEFT_IRIS_CENTER,
  MESH_LANDMARK_COUNT,
  RIGHT_IRIS_CENTER,
} from './landmarks';

type Ctx = CanvasRenderingContext2D;
type Connection = { start: number; end: number };

export const NEON = {
  cyan: '#22d3ee',
  violet: '#a855f7',
  pink: '#f472b6',
  red: '#f43f5e',
  amber: '#fbbf24',
  green: '#34d399',
  bg: '#020617',
} as const;

const TESSELATION: Connection[] = FaceLandmarker.FACE_LANDMARKS_TESSELATION;
const CONTOUR_GROUPS: Connection[][] = [
  FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
  FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
  FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
  FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
  FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
  FaceLandmarker.FACE_LANDMARKS_LIPS,
];

const MONO = '"JetBrains Mono", ui-monospace, monospace';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
}

/**
 * Proyecta los landmarks normalizados a píxeles del canvas (espejado horizontal)
 * sobre un buffer reutilizable [x, y, z, x, y, z, ...] para no generar basura por frame.
 */
export function projectLandmarks(lm: NormalizedLandmark[], w: number, h: number, out: Float32Array): number {
  const n = Math.min(lm.length, out.length / 3);
  for (let i = 0; i < n; i++) {
    const p = lm[i];
    out[i * 3] = (1 - p.x) * w;
    out[i * 3 + 1] = p.y * h;
    out[i * 3 + 2] = p.z * w;
  }
  return n;
}

export function computeBounds(pts: Float32Array, count: number): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const n = Math.min(count, MESH_LANDMARK_COUNT);
  for (let i = 0; i < n; i++) {
    const x = pts[i * 3];
    const y = pts[i * 3 + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function drawMirroredVideo(ctx: Ctx, video: HTMLVideoElement, w: number, h: number): void {
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, w, h);
  ctx.restore();
}

function strokeConnections(ctx: Ctx, pts: Float32Array, count: number, conns: Connection[]): void {
  ctx.beginPath();
  for (const c of conns) {
    if (c.start >= count || c.end >= count) continue;
    ctx.moveTo(pts[c.start * 3], pts[c.start * 3 + 1]);
    ctx.lineTo(pts[c.end * 3], pts[c.end * 3 + 1]);
  }
  ctx.stroke();
}

function rgba(hex: string, alpha: number): string {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${alpha})`;
}

const fmtSigned = (v: number): string => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1).padStart(5, '0')}°`;

const FATIGUE_LABEL: Record<FatigueLevel, { text: string; color: string }> = {
  normal: { text: 'NOMINAL', color: NEON.green },
  moderate: { text: 'MODERADA', color: NEON.amber },
  high: { text: 'ALTA', color: NEON.red },
  critical: { text: 'MICROSUEÑO', color: NEON.red },
};

export interface HudInfo {
  pose: HeadPose;
  earAvg: number;
  eyesClosed: boolean;
  fatigue: FatigueLevel;
  blinkCount: number;
}

/** Modo HUD: malla sutil, contornos neón, anillos de escaneo y etiqueta de telemetría. */
export function drawHud(
  ctx: Ctx,
  pts: Float32Array,
  count: number,
  b: Bounds,
  info: HudInfo,
  meshOpacity: number,
  t: number,
  scale: number,
): void {
  ctx.save();
  ctx.lineCap = 'round';

  // Malla de 468 puntos
  ctx.strokeStyle = rgba(NEON.cyan, 0.16 * meshOpacity);
  ctx.lineWidth = 0.7 * scale;
  strokeConnections(ctx, pts, count, TESSELATION);

  // Contornos principales con glow
  ctx.shadowColor = NEON.cyan;
  ctx.shadowBlur = 10 * scale;
  ctx.strokeStyle = rgba(NEON.cyan, 0.55 + 0.35 * meshOpacity);
  ctx.lineWidth = 1.4 * scale;
  for (const group of CONTOUR_GROUPS) strokeConnections(ctx, pts, count, group);

  // Puntos clave
  ctx.shadowColor = NEON.violet;
  ctx.fillStyle = NEON.violet;
  for (const i of KEY_POINTS) {
    const s = 3 * scale;
    ctx.fillRect(pts[i * 3] - s / 2, pts[i * 3 + 1] - s / 2, s, s);
  }

  // Iris
  if (count >= IRIS_LANDMARK_COUNT) {
    ctx.strokeStyle = info.eyesClosed ? NEON.red : NEON.violet;
    ctx.lineWidth = 1.4 * scale;
    for (const c of [RIGHT_IRIS_CENTER, LEFT_IRIS_CENTER]) {
      const x = pts[c * 3];
      const y = pts[c * 3 + 1];
      const r = Math.hypot(pts[(c + 1) * 3] - x, pts[(c + 1) * 3 + 1] - y);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.moveTo(x - r * 1.8, y);
      ctx.lineTo(x - r * 1.2, y);
      ctx.moveTo(x + r * 1.2, y);
      ctx.lineTo(x + r * 1.8, y);
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;

  drawScanRings(ctx, b, t, scale);
  drawScanLine(ctx, b, t, scale);
  drawBrackets(ctx, b, scale, NEON.cyan);
  drawInfoPanel(ctx, b, info, scale);
  ctx.restore();
}

function drawScanRings(ctx: Ctx, b: Bounds, t: number, scale: number): void {
  const R = Math.max(b.width, b.height) * 0.62;
  ctx.save();
  ctx.translate(b.cx, b.cy);

  // Anillo discontinuo rotando
  ctx.strokeStyle = rgba(NEON.cyan, 0.45);
  ctx.lineWidth = 1.2 * scale;
  ctx.setLineDash([R * 0.07, R * 0.035]);
  ctx.lineDashOffset = -t * 40 * scale;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arcos violeta contra-rotación
  ctx.strokeStyle = rgba(NEON.violet, 0.75);
  ctx.lineWidth = 2.5 * scale;
  ctx.shadowColor = NEON.violet;
  ctx.shadowBlur = 12 * scale;
  const rot = -t * 0.8;
  for (let k = 0; k < 3; k++) {
    const start = rot + (k * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.08, start, start + Math.PI / 4);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Marcas de graduación
  ctx.strokeStyle = rgba(NEON.cyan, 0.35);
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  for (let deg = 0; deg < 360; deg += 5) {
    const a = (deg * Math.PI) / 180 + t * 0.15;
    const long = deg % 30 === 0;
    const r1 = R * 1.15;
    const r2 = R * (long ? 1.22 : 1.18);
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
  }
  ctx.stroke();

  // Pulso expansivo
  const pulse = (t * 0.6) % 1;
  ctx.strokeStyle = rgba(NEON.cyan, 0.35 * (1 - pulse));
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.arc(0, 0, R * (0.9 + pulse * 0.45), 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawScanLine(ctx: Ctx, b: Bounds, t: number, scale: number): void {
  const phase = (t * 0.45) % 1;
  const y = b.minY + phase * b.height;
  const pad = b.width * 0.08;

  const band = ctx.createLinearGradient(0, y - b.height * 0.12, 0, y);
  band.addColorStop(0, rgba(NEON.cyan, 0));
  band.addColorStop(1, rgba(NEON.cyan, 0.12));
  ctx.fillStyle = band;
  ctx.fillRect(b.minX - pad, y - b.height * 0.12, b.width + pad * 2, b.height * 0.12);

  const line = ctx.createLinearGradient(b.minX - pad, 0, b.maxX + pad, 0);
  line.addColorStop(0, rgba(NEON.cyan, 0));
  line.addColorStop(0.5, rgba(NEON.cyan, 0.95));
  line.addColorStop(1, rgba(NEON.cyan, 0));
  ctx.strokeStyle = line;
  ctx.lineWidth = 1.6 * scale;
  ctx.shadowColor = NEON.cyan;
  ctx.shadowBlur = 14 * scale;
  ctx.beginPath();
  ctx.moveTo(b.minX - pad, y);
  ctx.lineTo(b.maxX + pad, y);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawBrackets(ctx: Ctx, b: Bounds, scale: number, color: string): void {
  const padX = b.width * 0.14;
  const padY = b.height * 0.1;
  const x0 = b.minX - padX;
  const y0 = b.minY - padY;
  const x1 = b.maxX + padX;
  const y1 = b.maxY + padY;
  const len = Math.min(b.width, b.height) * 0.16;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2 * scale;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8 * scale;
  ctx.beginPath();
  ctx.moveTo(x0, y0 + len);
  ctx.lineTo(x0, y0);
  ctx.lineTo(x0 + len, y0);
  ctx.moveTo(x1 - len, y0);
  ctx.lineTo(x1, y0);
  ctx.lineTo(x1, y0 + len);
  ctx.moveTo(x1, y1 - len);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x1 - len, y1);
  ctx.moveTo(x0 + len, y1);
  ctx.lineTo(x0, y1);
  ctx.lineTo(x0, y1 - len);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.font = `600 ${11 * scale}px ${MONO}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'bottom';
  ctx.fillText('SUBJECT_01 · TRACKING LOCK', x0, y0 - 6 * scale);
}

function drawInfoPanel(ctx: Ctx, b: Bounds, info: HudInfo, scale: number): void {
  const canvasW = ctx.canvas.width;
  const panelW = 168 * scale;
  const lineH = 17 * scale;
  const fatigue = FATIGUE_LABEL[info.fatigue];
  const rows: Array<[string, string, string]> = [
    ['YAW', fmtSigned(info.pose.yaw), NEON.cyan],
    ['PITCH', fmtSigned(info.pose.pitch), NEON.cyan],
    ['ROLL', fmtSigned(info.pose.roll), NEON.cyan],
    ['EAR', info.earAvg.toFixed(3), info.eyesClosed ? NEON.red : NEON.violet],
    ['BLINKS', String(info.blinkCount).padStart(3, '0'), NEON.violet],
    ['FATIGA', fatigue.text, fatigue.color],
  ];
  const panelH = lineH * (rows.length + 1) + 12 * scale;

  const gap = b.width * 0.22;
  const placeRight = b.maxX + gap + panelW < canvasW - 8 * scale;
  const x = placeRight ? b.maxX + gap : Math.max(8 * scale, b.minX - gap - panelW);
  const y = Math.max(8 * scale, b.minY);

  // Línea guía hacia el rostro
  ctx.strokeStyle = rgba(NEON.cyan, 0.6);
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  const anchorX = placeRight ? b.maxX : b.minX;
  const panelEdge = placeRight ? x : x + panelW;
  ctx.moveTo(anchorX, b.minY + b.height * 0.3);
  ctx.lineTo((anchorX + panelEdge) / 2, y + lineH);
  ctx.lineTo(panelEdge, y + lineH);
  ctx.stroke();

  ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
  ctx.strokeStyle = rgba(NEON.cyan, 0.7);
  ctx.beginPath();
  const notch = 10 * scale;
  ctx.moveTo(x + notch, y);
  ctx.lineTo(x + panelW, y);
  ctx.lineTo(x + panelW, y + panelH - notch);
  ctx.lineTo(x + panelW - notch, y + panelH);
  ctx.lineTo(x, y + panelH);
  ctx.lineTo(x, y + notch);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.textBaseline = 'middle';
  ctx.font = `700 ${10.5 * scale}px ${MONO}`;
  ctx.fillStyle = NEON.violet;
  ctx.fillText('◢ BIOMETRIC TELEMETRY', x + 10 * scale, y + lineH * 0.5 + 6 * scale);

  ctx.font = `500 ${11 * scale}px ${MONO}`;
  rows.forEach(([label, value, color], i) => {
    const ry = y + lineH * (i + 1.5) + 6 * scale;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 10 * scale, ry);
    ctx.fillStyle = color;
    ctx.textAlign = 'right';
    ctx.fillText(value, x + panelW - 10 * scale, ry);
  });
  ctx.textAlign = 'left';
}

/** Modo Wireframe: fondo oscuro y malla completa coloreada por profundidad. */
export function drawWireframe(ctx: Ctx, pts: Float32Array, count: number, meshOpacity: number, scale: number): void {
  const n = Math.min(count, MESH_LANDMARK_COUNT);
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let i = 0; i < n; i++) {
    const z = pts[i * 3 + 2];
    if (z < zMin) zMin = z;
    if (z > zMax) zMax = z;
  }
  const zRange = zMax - zMin || 1;

  // Tres capas de profundidad en lugar de un stroke por arista (mucho más rápido).
  const layers: Array<{ color: string; edges: Connection[] }> = [
    { color: NEON.violet, edges: [] },
    { color: '#6366f1', edges: [] },
    { color: NEON.cyan, edges: [] },
  ];
  for (const c of TESSELATION) {
    if (c.start >= n || c.end >= n) continue;
    const z = (pts[c.start * 3 + 2] + pts[c.end * 3 + 2]) / 2;
    // z menor = más cerca de la cámara
    const depth = 1 - (z - zMin) / zRange;
    const layer = depth > 0.66 ? 2 : depth > 0.33 ? 1 : 0;
    layers[layer].edges.push(c);
  }

  ctx.save();
  ctx.lineWidth = 0.9 * scale;
  ctx.shadowBlur = 6 * scale;
  const alpha = 0.35 + 0.6 * meshOpacity;
  for (const layer of layers) {
    ctx.strokeStyle = rgba(layer.color, alpha);
    ctx.shadowColor = layer.color;
    strokeConnections(ctx, pts, n, layer.edges);
  }
  ctx.shadowBlur = 0;

  ctx.fillStyle = rgba('#e0f2fe', 0.85);
  const s = 1.6 * scale;
  for (let i = 0; i < n; i++) {
    ctx.fillRect(pts[i * 3] - s / 2, pts[i * 3 + 1] - s / 2, s, s);
  }
  ctx.restore();
}

/** Retícula de búsqueda cuando no hay rostro. */
export function drawSearching(ctx: Ctx, w: number, h: number, t: number, scale: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.22;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = rgba(NEON.cyan, 0.5);
  ctx.lineWidth = 1.5 * scale;
  ctx.setLineDash([10 * scale, 8 * scale]);
  ctx.lineDashOffset = -t * 30 * scale;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = NEON.violet;
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.1, t * 2, t * 2 + Math.PI / 3);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.1, t * 2 + Math.PI, t * 2 + Math.PI * 1.33);
  ctx.stroke();

  ctx.strokeStyle = rgba(NEON.cyan, 0.7);
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.moveTo(-R * 0.25, 0);
  ctx.lineTo(R * 0.25, 0);
  ctx.moveTo(0, -R * 0.25);
  ctx.lineTo(0, R * 0.25);
  ctx.stroke();

  const blink = Math.sin(t * 5) > 0 ? 1 : 0.35;
  ctx.fillStyle = rgba(NEON.cyan, blink);
  ctx.font = `600 ${14 * scale}px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('BUSCANDO ROSTRO…', 0, R * 1.3);
  ctx.restore();
}

/** Marco de interfaz sobre todo el canvas (también aparece en el snapshot). */
export function drawFrameChrome(ctx: Ctx, w: number, h: number, fps: number, points: number, t: number, scale: number): void {
  const m = 16 * scale;
  const len = 28 * scale;
  ctx.save();
  ctx.strokeStyle = rgba(NEON.cyan, 0.6);
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(m, m + len);
  ctx.lineTo(m, m);
  ctx.lineTo(m + len, m);
  ctx.moveTo(w - m - len, m);
  ctx.lineTo(w - m, m);
  ctx.lineTo(w - m, m + len);
  ctx.moveTo(w - m, h - m - len);
  ctx.lineTo(w - m, h - m);
  ctx.lineTo(w - m - len, h - m);
  ctx.moveTo(m + len, h - m);
  ctx.lineTo(m, h - m);
  ctx.lineTo(m, h - m - len);
  ctx.stroke();

  ctx.font = `500 ${11 * scale}px ${MONO}`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = rgba(NEON.cyan, 0.85);
  ctx.fillText(`FACEMESH//478 · ${points} PTS · ${fps.toFixed(0)} FPS`, m + 10 * scale, m + 8 * scale);

  const recOn = Math.sin(t * 4) > -0.2;
  ctx.fillStyle = recOn ? NEON.red : 'rgba(244, 63, 94, 0.25)';
  ctx.beginPath();
  ctx.arc(w - m - 64 * scale, m + 15 * scale, 4 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba('#e2e8f0', 0.85);
  ctx.fillText('LIVE', w - m - 54 * scale, m + 8 * scale);

  ctx.textBaseline = 'bottom';
  ctx.fillStyle = rgba(NEON.violet, 0.85);
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 22);
  ctx.fillText(`T ${stamp}Z`, m + 10 * scale, h - m - 8 * scale);
  ctx.restore();
}
