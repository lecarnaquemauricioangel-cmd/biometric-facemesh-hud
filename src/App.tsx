import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { CameraFeed } from './components/CameraFeed';
import { ControlPanel } from './components/ControlPanel';
import { FaceCanvas } from './components/FaceCanvas';
import { Header } from './components/Header';
import { TelemetryCards } from './components/TelemetryCards';
import { DEFAULT_SETTINGS, EMPTY_TELEMETRY } from './config';
import { useCamera } from './hooks/useCamera';
import { useFaceLandmarker } from './hooks/useFaceLandmarker';
import { downloadCanvasPng } from './lib/snapshot';
import type { AccessoryId, Settings, Telemetry, ViewMode } from './types';

interface Toast {
  id: number;
  message: string;
  tone: 'ok' | 'error';
}

const MODE_KEYS: Record<string, ViewMode> = { h: 'hud', w: 'wireframe', a: 'accessories' };
const ACCESSORY_KEYS: Record<string, AccessoryId> = { '0': 'none', '1': 'visor', '2': 'aviator', '3': 'mask' };

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [telemetry, setTelemetry] = useState<Telemetry>(EMPTY_TELEMETRY);
  const [calibrationToken, setCalibrationToken] = useState(0);
  const [resetToken, setResetToken] = useState(0);
  const [flash, setFlash] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const camera = useCamera();
  const model = useFaceLandmarker(settings.detectionConfidence);
  const active = camera.status === 'ready' && model.status === 'ready';

  const showToast = useCallback((message: string, tone: Toast['tone'] = 'ok') => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(false), 350);
    return () => window.clearTimeout(id);
  }, [flash]);

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  const handleSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    setFlash(true);
    downloadCanvasPng(canvas)
      .then((name) => showToast(`Snapshot guardado: ${name}`))
      .catch((err: unknown) => showToast(err instanceof Error ? err.message : 'Error al capturar', 'error'));
  }, [active, showToast]);

  const handleCalibrate = useCallback(() => setCalibrationToken((t) => t + 1), []);
  const handleResetCounters = useCallback(() => {
    setResetToken((t) => t + 1);
    showToast('Contadores de parpadeo y fatiga reiniciados');
  }, [showToast]);
  const handleResetSettings = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  const handleCalibrated = useCallback(
    (threshold: number | null) => {
      if (threshold === null) {
        showToast('Calibración fallida: mantén el rostro visible con los ojos abiertos', 'error');
        return;
      }
      setSettings((prev) => ({ ...prev, earThreshold: threshold }));
      showToast(`Umbral EAR calibrado a ${threshold.toFixed(2)}`);
    },
    [showToast],
  );

  // Atajos de teclado (ignorados mientras se escribe en un input).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (key in MODE_KEYS) updateSetting('viewMode', MODE_KEYS[key]);
      else if (key in ACCESSORY_KEYS) updateSetting('accessory', ACCESSORY_KEYS[key]);
      else if (key === 's') handleSnapshot();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [updateSetting, handleSnapshot]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1600px] flex-col gap-6 px-4 py-5 sm:px-6 lg:py-6">
      <Header
        cameraStatus={camera.status}
        modelStatus={model.status}
        delegate={model.delegate}
        fps={active ? telemetry.fps : 0}
        faceDetected={telemetry.faceDetected}
      />

      <main className="grid flex-1 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <CameraFeed
            videoRef={camera.videoRef}
            cameraStatus={camera.status}
            cameraError={camera.errorMessage}
            modelStatus={model.status}
            modelError={model.error}
            onRetryCamera={camera.retry}
            onRetryModel={model.reload}
            flash={flash}
          >
            <FaceCanvas
              canvasRef={canvasRef}
              videoRef={camera.videoRef}
              landmarker={model.landmarker}
              active={active}
              settings={settings}
              onTelemetry={setTelemetry}
              calibrationToken={calibrationToken}
              onCalibrated={handleCalibrated}
              resetToken={resetToken}
            />
          </CameraFeed>
          <TelemetryCards telemetry={telemetry} earThreshold={settings.earThreshold} />
        </div>

        <ControlPanel
          settings={settings}
          onChange={updateSetting}
          onSnapshot={handleSnapshot}
          onCalibrate={handleCalibrate}
          onResetCounters={handleResetCounters}
          onResetSettings={handleResetSettings}
          canCapture={active}
          calibrationProgress={telemetry.calibrationProgress}
        />
      </main>

      <footer className="flex flex-col items-center justify-between gap-2 border-t border-slate-800/80 pt-4 text-xs text-slate-500 sm:flex-row">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-emerald-400" />
          Procesamiento 100 % local · ningún frame sale de tu navegador
        </span>
        <span className="font-mono">React · TypeScript · MediaPipe Tasks Vision · Canvas API</span>
      </footer>

      {toast && (
        <div
          key={toast.id}
          role="status"
          className={`animate-toast fixed bottom-5 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-2xl backdrop-blur-md ${
            toast.tone === 'ok'
              ? 'border-cyan-400/40 bg-slate-900/90 text-cyan-100'
              : 'border-rose-400/40 bg-slate-900/90 text-rose-200'
          }`}
        >
          {toast.tone === 'ok' ? <CheckCircle2 className="size-4 shrink-0 text-cyan-400" /> : <TriangleAlert className="size-4 shrink-0 text-rose-400" />}
          <span className="truncate">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
