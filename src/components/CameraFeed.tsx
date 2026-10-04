import type { ReactNode, RefObject } from 'react';
import { CameraOff, Cpu, Lock, MonitorX, RefreshCw, ShieldAlert, TriangleAlert, Unplug, Video } from 'lucide-react';
import type { CameraStatus, ModelStatus } from '../types';

interface CameraFeedProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  cameraStatus: CameraStatus;
  cameraError: string | null;
  modelStatus: ModelStatus;
  modelError: string | null;
  onRetryCamera: () => void;
  onRetryModel: () => void;
  flash: boolean;
  /** Canvas de visualización (se superpone al video). */
  children: ReactNode;
}

interface OverlayContent {
  icon: ReactNode;
  title: string;
  body: string;
  tone: 'info' | 'warn' | 'error';
  action?: { label: string; onClick: () => void };
  loading?: boolean;
}

function describeCamera(status: CameraStatus, error: string | null, retry: () => void): OverlayContent | null {
  const retryAction = { label: 'Reintentar', onClick: retry };
  switch (status) {
    case 'idle':
    case 'requesting':
      return {
        icon: <Video className="size-7" />,
        title: 'Solicitando acceso a la cámara',
        body: 'Acepta el permiso del navegador para iniciar el escaneo biométrico. Todo el procesamiento ocurre localmente en tu dispositivo.',
        tone: 'info',
        loading: true,
      };
    case 'denied':
      return {
        icon: <ShieldAlert className="size-7" />,
        title: 'Permiso de cámara denegado',
        body: 'Haz clic en el icono de cámara/candado de la barra de direcciones, permite el acceso y pulsa "Reintentar".',
        tone: 'error',
        action: retryAction,
      };
    case 'not-found':
      return {
        icon: <CameraOff className="size-7" />,
        title: 'No se detectó ninguna cámara',
        body: 'Conecta una webcam. Reintentaremos automáticamente en cuanto el sistema la detecte.',
        tone: 'warn',
        action: retryAction,
      };
    case 'disconnected':
      return {
        icon: <Unplug className="size-7" />,
        title: 'Cámara desconectada',
        body: 'Se perdió la señal de video. Vuelve a conectar la cámara o pulsa "Reintentar".',
        tone: 'warn',
        action: retryAction,
      };
    case 'in-use':
      return {
        icon: <MonitorX className="size-7" />,
        title: 'Cámara ocupada',
        body: 'Otra aplicación (Zoom, Teams, OBS…) está usando la cámara. Ciérrala y vuelve a intentarlo.',
        tone: 'warn',
        action: retryAction,
      };
    case 'insecure':
      return {
        icon: <Lock className="size-7" />,
        title: 'Se requiere un contexto seguro',
        body: 'El acceso a la cámara solo funciona bajo HTTPS o en http://localhost.',
        tone: 'error',
      };
    case 'unsupported':
      return {
        icon: <TriangleAlert className="size-7" />,
        title: 'Navegador no compatible',
        body: 'Tu navegador no soporta getUserMedia. Usa una versión reciente de Chrome, Edge, Firefox o Safari.',
        tone: 'error',
      };
    case 'error':
      return {
        icon: <TriangleAlert className="size-7" />,
        title: 'No se pudo iniciar la cámara',
        body: error ?? 'Error desconocido.',
        tone: 'error',
        action: retryAction,
      };
    case 'ready':
      return null;
  }
}

const TONE_STYLES: Record<OverlayContent['tone'], string> = {
  info: 'text-cyan-300 border-cyan-400/40 bg-cyan-400/10 shadow-[0_0_40px_-8px] shadow-cyan-400/50',
  warn: 'text-amber-300 border-amber-400/40 bg-amber-400/10 shadow-[0_0_40px_-8px] shadow-amber-400/40',
  error: 'text-rose-300 border-rose-400/40 bg-rose-400/10 shadow-[0_0_40px_-8px] shadow-rose-400/40',
};

/**
 * Escenario de video: mantiene el <video> siempre montado (fuente para MediaPipe),
 * superpone el canvas y muestra estados de carga / permisos / errores.
 */
export function CameraFeed({
  videoRef,
  cameraStatus,
  cameraError,
  modelStatus,
  modelError,
  onRetryCamera,
  onRetryModel,
  flash,
  children,
}: CameraFeedProps) {
  let overlay = describeCamera(cameraStatus, cameraError, onRetryCamera);
  if (!overlay && modelStatus === 'loading') {
    overlay = {
      icon: <Cpu className="size-7" />,
      title: 'Cargando red neuronal FaceLandmarker',
      body: 'Inicializando WebAssembly y descargando el modelo (~3.6 MB). Solo ocurre la primera vez.',
      tone: 'info',
      loading: true,
    };
  } else if (!overlay && modelStatus === 'error') {
    overlay = {
      icon: <TriangleAlert className="size-7" />,
      title: 'Error al cargar el modelo',
      body: modelError ?? 'Comprueba tu conexión a internet.',
      tone: 'error',
      action: { label: 'Recargar modelo', onClick: onRetryModel },
    };
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-cyan-400/20 bg-slate-950 shadow-[0_0_60px_-20px] shadow-cyan-500/40">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full -scale-x-100 object-contain"
        playsInline
        muted
        autoPlay
        aria-hidden="true"
      />
      {children}

      {/* Rejilla decorativa */}
      <div className="hud-grid pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" />

      {overlay && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm sm:p-6">
          <div className="flex max-w-md flex-col items-center text-center" role="status" aria-live="polite">
            <div className={`relative mb-4 grid size-16 place-items-center rounded-2xl border ${TONE_STYLES[overlay.tone]}`}>
              {overlay.loading && (
                <span className="absolute inset-[-6px] animate-spin rounded-[20px] border-2 border-transparent border-t-cyan-400 border-r-violet-500" />
              )}
              {overlay.icon}
            </div>
            <h2 className="font-display text-lg font-semibold text-slate-100 sm:text-xl">{overlay.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{overlay.body}</p>
            {overlay.action && (
              <button
                type="button"
                onClick={overlay.action.onClick}
                className="mt-5 inline-flex items-center gap-2 rounded-lg border border-cyan-400/50 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
              >
                <RefreshCw className="size-4" />
                {overlay.action.label}
              </button>
            )}
          </div>
        </div>
      )}

      {flash && <div className="animate-flash pointer-events-none absolute inset-0 z-20 bg-white" aria-hidden="true" />}
    </div>
  );
}
