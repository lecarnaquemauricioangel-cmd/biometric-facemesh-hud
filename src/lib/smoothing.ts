import { clamp } from './biometrics';

/** Transformación 2D del accesorio en coordenadas de canvas (vista espejada). */
export interface AccessoryTransform {
  /** Centro entre los ojos (px). */
  cx: number;
  cy: number;
  /** Distancia entre esquinas externas de los ojos (px): unidad de escala del accesorio. */
  unit: number;
  /** Rotación en radianes (roll en pantalla). */
  angle: number;
  /** Asimetría −1…1 por giro de cabeza: lado izquierdo (+) o derecho (−) más cercano a cámara. */
  asym: number;
}

const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** Filtro exponencial sobre la transformación (con interpolación angular por el arco corto). */
export class TransformSmoother {
  private state: AccessoryTransform | null = null;

  update(target: AccessoryTransform, smoothing: number): AccessoryTransform {
    if (this.state === null) {
      this.state = { ...target };
      return this.state;
    }
    const a = 1 - clamp(smoothing, 0, 0.95);
    const s = this.state;
    s.cx += (target.cx - s.cx) * a;
    s.cy += (target.cy - s.cy) * a;
    s.unit += (target.unit - s.unit) * a;
    s.angle += wrapAngle(target.angle - s.angle) * a;
    s.asym += (target.asym - s.asym) * a;
    return s;
  }

  reset(): void {
    this.state = null;
  }
}
