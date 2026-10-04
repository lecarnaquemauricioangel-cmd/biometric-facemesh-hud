/**
 * Índices de la topología FaceMesh de MediaPipe.
 * "Izquierdo/derecho" se refiere al sujeto (no a la pantalla).
 */

/** Orden EAR: [p1 esquina ext., p2, p3 párpado sup., p4 esquina int., p5, p6 párpado inf.] */
export type EyeIndices = readonly [number, number, number, number, number, number];

export const RIGHT_EYE_EAR: EyeIndices = [33, 160, 158, 133, 153, 144];
export const LEFT_EYE_EAR: EyeIndices = [263, 387, 385, 362, 380, 373];

export const RIGHT_EYE_OUTER = 33;
export const LEFT_EYE_OUTER = 263;
export const NOSE_TIP = 1;
export const NOSE_BRIDGE = 168;
export const CHIN = 152;
export const FOREHEAD = 10;

/** Centros de iris (solo disponibles con el modelo de 478 puntos). */
export const RIGHT_IRIS_CENTER = 468;
export const LEFT_IRIS_CENTER = 473;
export const IRIS_LANDMARK_COUNT = 478;

/** Puntos destacados en el HUD. */
export const KEY_POINTS = [NOSE_TIP, CHIN, FOREHEAD, RIGHT_EYE_OUTER, LEFT_EYE_OUTER, 61, 291, 234, 454] as const;

/** Solo los 468 puntos de malla (excluye iris) para cajas envolventes. */
export const MESH_LANDMARK_COUNT = 468;
