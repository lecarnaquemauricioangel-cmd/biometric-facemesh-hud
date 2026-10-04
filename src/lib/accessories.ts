import type { AccessoryId } from '../types';
import type { AccessoryTransform } from './smoothing';

type Ctx = CanvasRenderingContext2D;

/**
 * Accesorios dibujados de forma procedural (sin imágenes) en un espacio local donde:
 *  - el origen es el punto medio entre los ojos,
 *  - el eje X sigue la línea de los ojos (ya rotada por el roll),
 *  - `u` = distancia entre las esquinas externas de los ojos.
 * `kL`/`kR` escalan cada lado según el giro (yaw) para simular perspectiva.
 */
export function drawAccessory(ctx: Ctx, id: AccessoryId, tr: AccessoryTransform, t: number): void {
  if (id === 'none' || tr.unit < 4) return;
  ctx.save();
  ctx.translate(tr.cx, tr.cy);
  ctx.rotate(tr.angle);
  const u = tr.unit;
  const kL = 1 + 0.45 * tr.asym;
  const kR = 1 - 0.45 * tr.asym;
  switch (id) {
    case 'visor':
      drawVisor(ctx, u, kL, kR, t);
      break;
    case 'aviator':
      drawAviator(ctx, u * 1.12, kL, kR, tr.asym);
      break;
    case 'mask':
      drawMask(ctx, u * 1.06, kL, kR, t);
      break;
  }
  ctx.restore();
}

/* ───────────────────────── Visor futurista ───────────────────────── */

function drawVisor(ctx: Ctx, u: number, kL: number, kR: number, t: number): void {
  const xL = -0.95 * u * kL;
  const xR = 0.95 * u * kR;

  const shape = new Path2D();
  shape.moveTo(xL, -0.14 * u);
  shape.bezierCurveTo(xL * 0.6, -0.34 * u, xR * 0.6, -0.34 * u, xR, -0.14 * u);
  shape.quadraticCurveTo(xR * 1.04, 0.08 * u, xR * 0.86, 0.2 * u);
  shape.bezierCurveTo(xR * 0.5, 0.3 * u, 0.15 * u, 0.25 * u, 0.09 * u, 0.13 * u);
  shape.quadraticCurveTo(0, 0.04 * u, -0.09 * u, 0.13 * u);
  shape.bezierCurveTo(-0.15 * u, 0.25 * u, xL * 0.5, 0.3 * u, xL * 0.86, 0.2 * u);
  shape.quadraticCurveTo(xL * 1.04, 0.08 * u, xL, -0.14 * u);
  shape.closePath();

  // Patillas
  ctx.strokeStyle = '#0e7490';
  ctx.lineWidth = 0.05 * u;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(xL, -0.08 * u);
  ctx.lineTo(xL - 0.14 * u * kL, -0.05 * u);
  ctx.moveTo(xR, -0.08 * u);
  ctx.lineTo(xR + 0.14 * u * kR, -0.05 * u);
  ctx.stroke();

  // Sombra proyectada + cristal degradado
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 0.12 * u;
  ctx.shadowOffsetY = 0.05 * u;
  const glass = ctx.createLinearGradient(xL, 0, xR, 0);
  glass.addColorStop(0, 'rgba(34, 211, 238, 0.62)');
  glass.addColorStop(0.5, 'rgba(79, 70, 229, 0.55)');
  glass.addColorStop(1, 'rgba(168, 85, 247, 0.65)');
  ctx.fillStyle = glass;
  ctx.fill(shape);
  ctx.restore();

  // Detalles internos recortados al cristal
  ctx.save();
  ctx.clip(shape);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 0.008 * u;
  ctx.beginPath();
  for (let y = -0.32 * u; y < 0.32 * u; y += 0.035 * u) {
    ctx.moveTo(xL, y);
    ctx.lineTo(xR, y);
  }
  ctx.stroke();

  const sweep = (((t * 0.35) % 1.4) - 0.2) * (xR - xL) + xL;
  const glint = ctx.createLinearGradient(sweep - 0.25 * u, 0, sweep + 0.25 * u, 0);
  glint.addColorStop(0, 'rgba(255, 255, 255, 0)');
  glint.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
  glint.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glint;
  ctx.beginPath();
  ctx.moveTo(sweep - 0.1 * u, -0.4 * u);
  ctx.lineTo(sweep + 0.2 * u, -0.4 * u);
  ctx.lineTo(sweep + 0.05 * u, 0.4 * u);
  ctx.lineTo(sweep - 0.25 * u, 0.4 * u);
  ctx.closePath();
  ctx.fill();

  // Retículas sobre cada ojo
  const pulse = 0.5 + 0.5 * Math.sin(t * 4);
  ctx.strokeStyle = `rgba(165, 243, 252, ${0.45 + 0.4 * pulse})`;
  ctx.lineWidth = 0.012 * u;
  for (const [x, k] of [
    [-0.33 * u * kL, kL],
    [0.33 * u * kR, kR],
  ] as const) {
    const r = 0.09 * u * k;
    ctx.beginPath();
    ctx.arc(x, 0.02 * u, r, 0, Math.PI * 2);
    ctx.moveTo(x - r * 1.6, 0.02 * u);
    ctx.lineTo(x - r * 0.6, 0.02 * u);
    ctx.moveTo(x + r * 0.6, 0.02 * u);
    ctx.lineTo(x + r * 1.6, 0.02 * u);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(207, 250, 254, 0.85)';
  ctx.font = `700 ${0.055 * u}px "JetBrains Mono", monospace`;
  ctx.textBaseline = 'middle';
  ctx.fillText('◉ NEURAL-LINK', xL * 0.78, -0.17 * u);
  ctx.textAlign = 'right';
  ctx.fillText(`SYNC ${(97 + pulse * 2.9).toFixed(1)}%`, xR * 0.78, -0.17 * u);
  ctx.restore();

  // Borde neón
  ctx.save();
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 0.15 * u;
  ctx.strokeStyle = '#67e8f9';
  ctx.lineWidth = 0.022 * u;
  ctx.lineJoin = 'round';
  ctx.stroke(shape);
  ctx.restore();
}

/* ───────────────────────── Aviador de sol ───────────────────────── */

/** Lente en forma de gota para el lado derecho de pantalla; se espeja con scale(-1, 1). */
function aviatorLens(u: number): Path2D {
  const p = new Path2D();
  p.moveTo(-0.3 * u, -0.15 * u);
  p.bezierCurveTo(-0.1 * u, -0.2 * u, 0.2 * u, -0.21 * u, 0.3 * u, -0.17 * u);
  p.bezierCurveTo(0.39 * u, -0.12 * u, 0.37 * u, 0.06 * u, 0.22 * u, 0.17 * u);
  p.bezierCurveTo(0.08 * u, 0.27 * u, -0.18 * u, 0.23 * u, -0.27 * u, 0.08 * u);
  p.bezierCurveTo(-0.33 * u, -0.02 * u, -0.34 * u, -0.12 * u, -0.3 * u, -0.15 * u);
  p.closePath();
  return p;
}

function drawAviator(ctx: Ctx, u: number, kL: number, kR: number, asym: number): void {
  const lens = aviatorLens(u);
  const frame = ctx.createLinearGradient(0, -0.25 * u, 0, 0.25 * u);
  frame.addColorStop(0, '#f5f5f4');
  frame.addColorStop(0.45, '#a8a29e');
  frame.addColorStop(1, '#e7e5e4');

  // Puente doble y patillas (detrás de las lentes)
  ctx.strokeStyle = frame;
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.022 * u;
  ctx.beginPath();
  ctx.moveTo(-0.08 * u * kL, -0.165 * u);
  ctx.lineTo(0.08 * u * kR, -0.165 * u);
  ctx.moveTo(-0.075 * u * kL, -0.06 * u);
  ctx.quadraticCurveTo(0, -0.13 * u, 0.075 * u * kR, -0.06 * u);
  ctx.moveTo(-0.72 * u * kL, -0.15 * u);
  ctx.lineTo(-0.86 * u * kL, -0.13 * u);
  ctx.moveTo(0.72 * u * kR, -0.15 * u);
  ctx.lineTo(0.86 * u * kR, -0.13 * u);
  ctx.stroke();

  for (const side of [-1, 1] as const) {
    const k = side < 0 ? kL : kR;
    ctx.save();
    ctx.translate(side * 0.38 * u * k, 0);
    ctx.scale(side * k, k);

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 0.1 * u;
    ctx.shadowOffsetY = 0.04 * u;
    const tint = ctx.createLinearGradient(0, -0.2 * u, 0, 0.25 * u);
    tint.addColorStop(0, 'rgba(10, 10, 20, 0.94)');
    tint.addColorStop(0.6, 'rgba(46, 16, 101, 0.88)');
    tint.addColorStop(1, 'rgba(88, 28, 135, 0.8)');
    ctx.fillStyle = tint;
    ctx.fill(lens);
    ctx.restore();

    // Reflejos (con ligero paralaje según el giro)
    ctx.save();
    ctx.clip(lens);
    const shift = asym * 0.15 * u * side;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.moveTo(-0.25 * u + shift, -0.25 * u);
    ctx.lineTo(-0.08 * u + shift, -0.25 * u);
    ctx.lineTo(-0.32 * u + shift, 0.3 * u);
    ctx.lineTo(-0.45 * u + shift, 0.3 * u);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(0.02 * u + shift, -0.25 * u);
    ctx.lineTo(0.08 * u + shift, -0.25 * u);
    ctx.lineTo(-0.12 * u + shift, 0.3 * u);
    ctx.lineTo(-0.18 * u + shift, 0.3 * u);
    ctx.closePath();
    ctx.fill();
    const sheen = ctx.createRadialGradient(0.15 * u, 0.12 * u, 0, 0.15 * u, 0.12 * u, 0.2 * u);
    sheen.addColorStop(0, 'rgba(168, 85, 247, 0.35)');
    sheen.addColorStop(1, 'rgba(168, 85, 247, 0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(-0.4 * u, -0.3 * u, 0.8 * u, 0.6 * u);
    ctx.restore();

    ctx.strokeStyle = frame;
    ctx.lineWidth = 0.028 * u;
    ctx.lineJoin = 'round';
    ctx.stroke(lens);
    ctx.restore();
  }
}

/* ───────────────────────── Máscara cyber ───────────────────────── */

function drawMask(ctx: Ctx, u: number, kL: number, kR: number, t: number): void {
  const X = (x: number): number => x * u * (x < 0 ? kL : kR);
  const Y = (y: number): number => y * u;

  const outline = new Path2D();
  outline.moveTo(X(0), Y(-0.3));
  outline.bezierCurveTo(X(0.15), Y(-0.42), X(0.45), Y(-0.4), X(0.62), Y(-0.3));
  outline.lineTo(X(1.02), Y(-0.58));
  outline.bezierCurveTo(X(0.93), Y(-0.25), X(0.96), Y(0.0), X(0.82), Y(0.13));
  outline.bezierCurveTo(X(0.65), Y(0.3), X(0.35), Y(0.32), X(0.18), Y(0.2));
  outline.quadraticCurveTo(X(0.06), Y(0.1), X(0), Y(0.15));
  outline.quadraticCurveTo(X(-0.06), Y(0.1), X(-0.18), Y(0.2));
  outline.bezierCurveTo(X(-0.35), Y(0.32), X(-0.65), Y(0.3), X(-0.82), Y(0.13));
  outline.bezierCurveTo(X(-0.96), Y(0.0), X(-0.93), Y(-0.25), X(-1.02), Y(-0.58));
  outline.lineTo(X(-0.62), Y(-0.3));
  outline.bezierCurveTo(X(-0.45), Y(-0.4), X(-0.15), Y(-0.42), X(0), Y(-0.3));
  outline.closePath();

  const eyes = new Path2D();
  const eyeHoles: Array<[number, number, number]> = [
    [X(-0.34), kL, 0.18],
    [X(0.34), kR, -0.18],
  ];
  for (const [x, k, tilt] of eyeHoles) {
    eyes.moveTo(x + 0.17 * u * k, 0);
    eyes.ellipse(x, 0, 0.17 * u * k, 0.095 * u, tilt, 0, Math.PI * 2);
  }

  const body = new Path2D();
  body.addPath(outline);
  body.addPath(eyes);

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 0.14 * u;
  ctx.shadowOffsetY = 0.05 * u;
  const fill = ctx.createLinearGradient(0, Y(-0.6), 0, Y(0.35));
  fill.addColorStop(0, 'rgba(59, 7, 100, 0.95)');
  fill.addColorStop(0.5, 'rgba(24, 10, 48, 0.94)');
  fill.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
  ctx.fillStyle = fill;
  ctx.fill(body, 'evenodd');
  ctx.restore();

  // Circuitos grabados
  ctx.save();
  ctx.clip(body, 'evenodd');
  const flow = (t * 0.8) % 1;
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
  ctx.lineWidth = 0.01 * u;
  ctx.beginPath();
  for (const s of [-1, 1]) {
    const k = s < 0 ? kL : kR;
    ctx.moveTo(0, Y(-0.22));
    ctx.lineTo(s * 0.12 * u * k, Y(-0.22));
    ctx.lineTo(s * 0.2 * u * k, Y(-0.3));
    ctx.lineTo(s * 0.55 * u * k, Y(-0.3));
    ctx.moveTo(s * 0.62 * u * k, Y(-0.18));
    ctx.lineTo(s * 0.85 * u * k, Y(-0.42));
    ctx.moveTo(s * 0.55 * u * k, Y(0.15));
    ctx.lineTo(s * 0.72 * u * k, Y(0.08));
    ctx.lineTo(s * 0.86 * u * k, Y(0.08));
  }
  ctx.stroke();
  ctx.fillStyle = `rgba(165, 243, 252, ${0.4 + 0.6 * flow})`;
  for (const s of [-1, 1]) {
    const k = s < 0 ? kL : kR;
    for (const [x, y] of [
      [0.55, -0.3],
      [0.85, -0.42],
      [0.86, 0.08],
    ] as const) {
      ctx.beginPath();
      ctx.arc(s * x * u * k, Y(y), 0.016 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Contorno y aros de ojos con glow
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.shadowColor = '#a855f7';
  ctx.shadowBlur = 0.14 * u;
  ctx.strokeStyle = '#c084fc';
  ctx.lineWidth = 0.024 * u;
  ctx.stroke(outline);

  const pulse = 0.55 + 0.45 * Math.sin(t * 3);
  ctx.shadowColor = '#22d3ee';
  ctx.strokeStyle = `rgba(103, 232, 249, ${pulse})`;
  ctx.lineWidth = 0.02 * u;
  ctx.stroke(eyes);

  // Gema frontal
  const g = 0.055 * u;
  ctx.fillStyle = `rgba(34, 211, 238, ${0.6 + 0.4 * pulse})`;
  ctx.beginPath();
  ctx.moveTo(0, Y(-0.25) - g);
  ctx.lineTo(g * 0.7, Y(-0.25));
  ctx.lineTo(0, Y(-0.25) + g);
  ctx.lineTo(-g * 0.7, Y(-0.25));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
