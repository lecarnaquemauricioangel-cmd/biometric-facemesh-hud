import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { CameraStatus } from '../types';

const CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: 'user',
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 60, max: 60 },
  },
};

function statusFromError(err: unknown): CameraStatus {
  const name = err instanceof DOMException || err instanceof Error ? err.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'not-found';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'in-use';
    default:
      return 'error';
  }
}

export interface CameraState {
  videoRef: RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  errorMessage: string | null;
  retry: () => void;
}

/**
 * Gestiona el ciclo de vida de getUserMedia:
 * - Cancela de forma segura si el componente se desmonta antes de resolver (StrictMode).
 * - Detiene todas las pistas al desmontar o reintentar (sin fugas de cámara).
 * - Reintenta automáticamente al conectar un dispositivo si no había cámara.
 */
export function useCamera(): CameraState {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!window.isSecureContext) {
      setStatus('insecure');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    const stopStream = (s: MediaStream): void => s.getTracks().forEach((track) => track.stop());
    const onTrackEnded = (): void => {
      if (!cancelled) setStatus('disconnected');
    };

    setStatus('requesting');
    setErrorMessage(null);

    navigator.mediaDevices
      .getUserMedia(CONSTRAINTS)
      .then(async (s) => {
        if (cancelled) {
          stopStream(s);
          return;
        }
        stream = s;
        s.getVideoTracks()[0]?.addEventListener('ended', onTrackEnded);
        video.srcObject = s;
        await video.play();
        if (!cancelled) setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus(statusFromError(err));
        setErrorMessage(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
      if (stream) {
        stream.getVideoTracks()[0]?.removeEventListener('ended', onTrackEnded);
        stopStream(stream);
      }
      video.pause();
      video.srcObject = null;
    };
  }, [attempt]);

  // Si no hay cámara (o se desconectó), escucha la conexión de un nuevo dispositivo.
  useEffect(() => {
    if (status !== 'not-found' && status !== 'disconnected') return;
    const devices = navigator.mediaDevices;
    if (!devices) return;
    devices.addEventListener('devicechange', retry);
    return () => devices.removeEventListener('devicechange', retry);
  }, [status, retry]);

  return { videoRef, status, errorMessage, retry };
}
