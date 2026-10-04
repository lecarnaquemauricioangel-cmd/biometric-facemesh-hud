import type { ReactNode } from 'react';
import { Cpu, Gauge, ScanFace, Video } from 'lucide-react';
import type { CameraStatus, Delegate, ModelStatus } from '../types';

interface HeaderProps {
  cameraStatus: CameraStatus;
  modelStatus: ModelStatus;
  delegate: Delegate | null;
  fps: number;
  faceDetected: boolean;
}

type Tone = 'ok' | 'busy' | 'error';

const DOT: Record<Tone, string> = {
  ok: 'bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400',
  busy: 'bg-amber-400 animate-pulse',
  error: 'bg-rose-500',
};

function Pill({ icon, label, tone }: { icon: ReactNode; label: string; tone: Tone }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 font-mono text-[11px] text-slate-300">
      <span className={`size-1.5 rounded-full ${DOT[tone]}`} />
      <span className="text-slate-500">{icon}</span>
      {label}
    </span>
  );
}

export function Header({ cameraStatus, modelStatus, delegate, fps, faceDetected }: HeaderProps) {
  const camTone: Tone = cameraStatus === 'ready' ? 'ok' : cameraStatus === 'requesting' || cameraStatus === 'idle' ? 'busy' : 'error';
  const modelTone: Tone = modelStatus === 'ready' ? 'ok' : modelStatus === 'loading' ? 'busy' : 'error';

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="relative grid size-11 shrink-0 place-items-center rounded-xl border border-cyan-400/40 bg-gradient-to-br from-cyan-500/20 to-violet-600/20 shadow-[0_0_24px_-4px] shadow-cyan-500/60">
          <ScanFace className="size-6 text-cyan-300" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-slate-50 sm:text-2xl">
            Biometric <span className="bg-gradient-to-r from-cyan-300 to-violet-400 bg-clip-text text-transparent">FaceMesh HUD</span>
          </h1>
          <p className="text-xs text-slate-400 sm:text-sm">Visión artificial en el navegador · Virtual Try-On · 478 landmarks</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Pill icon={<Video className="size-3" />} label={cameraStatus === 'ready' ? 'CAM ONLINE' : `CAM ${cameraStatus.toUpperCase()}`} tone={camTone} />
        <Pill
          icon={<Cpu className="size-3" />}
          label={modelStatus === 'ready' ? `MODEL ${delegate ?? ''}` : `MODEL ${modelStatus.toUpperCase()}`}
          tone={modelTone}
        />
        <Pill icon={<Gauge className="size-3" />} label={`${fps.toFixed(0)} FPS`} tone={fps > 0 ? (faceDetected ? 'ok' : 'busy') : 'error'} />
      </div>
    </header>
  );
}
