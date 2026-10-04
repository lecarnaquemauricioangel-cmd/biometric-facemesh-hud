import { useCallback, useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { FACE_MODEL_URL, WASM_BASE_PATH } from '../config';
import type { Delegate, ModelStatus } from '../types';

type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

interface LandmarkerState {
  status: ModelStatus;
  landmarker: FaceLandmarker | null;
  delegate: Delegate | null;
  error: string | null;
}

const INITIAL: LandmarkerState = { status: 'loading', landmarker: null, delegate: null, error: null };

function create(fileset: WasmFileset, delegate: Delegate, confidence: number): Promise<FaceLandmarker> {
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: true,
    minFaceDetectionConfidence: confidence,
    minFacePresenceConfidence: confidence,
    minTrackingConfidence: confidence,
  });
}

/**
 * Carga MediaPipe FaceLandmarker (GPU con fallback a CPU) y lo libera con close()
 * al desmontar. `confidence` se aplica en caliente vía setOptions sin recrear el modelo.
 */
export function useFaceLandmarker(confidence: number) {
  const [state, setState] = useState<LandmarkerState>(INITIAL);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Confianza vigente (para la creación) y la que ya tiene aplicada la instancia actual.
  const confidenceRef = useRef(confidence);
  const appliedConfidenceRef = useRef<number | null>(null);
  useEffect(() => {
    confidenceRef.current = confidence;
  });

  useEffect(() => {
    let cancelled = false;
    let instance: FaceLandmarker | null = null;
    setState(INITIAL);

    const load = async (): Promise<void> => {
      const confidence = confidenceRef.current;
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);
        let delegate: Delegate = 'GPU';
        let lm: FaceLandmarker;
        try {
          lm = await create(fileset, 'GPU', confidence);
        } catch (gpuError) {
          console.warn('[FaceLandmarker] GPU no disponible, usando CPU.', gpuError);
          delegate = 'CPU';
          lm = await create(fileset, 'CPU', confidence);
        }
        if (cancelled) {
          lm.close();
          return;
        }
        instance = lm;
        appliedConfidenceRef.current = confidence;
        setState({ status: 'ready', landmarker: lm, delegate, error: null });
      } catch (err) {
        if (cancelled) return;
        console.error('[FaceLandmarker] Error al cargar el modelo', err);
        setState({
          status: 'error',
          landmarker: null,
          delegate: null,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };

    // Diferido un tick: el montaje/desmontaje simulado de StrictMode cancela el timer
    // y así no se instancian (y descargan) dos modelos en desarrollo.
    const timer = window.setTimeout(() => void load(), 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      instance?.close();
    };
  }, [reloadKey]);

  const { landmarker } = state;
  useEffect(() => {
    if (!landmarker || appliedConfidenceRef.current === confidence) return;
    // Debounce: setOptions reconfigura el grafo y no conviene llamarlo en cada tick del slider.
    const id = window.setTimeout(() => {
      appliedConfidenceRef.current = confidence;
      landmarker
        .setOptions({
          minFaceDetectionConfidence: confidence,
          minFacePresenceConfidence: confidence,
          minTrackingConfidence: confidence,
        })
        .catch((err: unknown) => console.warn('[FaceLandmarker] setOptions falló', err));
    }, 250);
    return () => window.clearTimeout(id);
  }, [landmarker, confidence]);

  return { ...state, reload };
}
