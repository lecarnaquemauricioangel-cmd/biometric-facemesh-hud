import { memo, type ReactNode } from 'react';
import { Activity, Eye, EyeOff, Gauge, Move3d, ScanEye } from 'lucide-react';
import type { FatigueLevel, Telemetry } from '../types';

interface TelemetryCardsProps {
  telemetry: Telemetry;
  earThreshold: number;
}

function Card({
  title,
  icon,
  accent = 'cyan',
  children,
}: {
  title: string;
  icon: ReactNode;
  accent?: 'cyan' | 'violet';
  children: ReactNode;
}) {
  const accentCls = accent === 'cyan' ? 'text-cyan-300' : 'text-violet-300';
  return (
    <section className="glass-card group relative overflow-hidden rounded-xl p-4">
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
      <header className={`mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] uppercase ${accentCls}`}>
        {icon}
        {title}
      </header>
      {children}
    </section>
  );
}

function AngleRow({ label, value }: { label: string; value: number }) {
  // Barra centrada: ±45° ocupa todo el ancho.
  const pct = Math.max(-1, Math.min(1, value / 45)) * 50;
  return (
    <div className="grid grid-cols-[48px_1fr_64px] items-center gap-2 font-mono text-xs">
      <span className="text-slate-400">{label}</span>
      <div className="relative h-1.5 rounded-full bg-slate-800">
        <span className="absolute top-[-3px] left-1/2 h-3 w-px bg-slate-500" />
        <span
          className="absolute top-0 h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-[left,width] duration-100"
          style={{ left: `${pct < 0 ? 50 + pct : 50}%`, width: `${Math.abs(pct)}%` }}
        />
      </div>
      <span className="text-right text-cyan-200 tabular-nums">
        {value >= 0 ? '+' : '−'}
        {Math.abs(value).toFixed(1)}°
      </span>
    </div>
  );
}

function EarBar({ label, value, threshold }: { label: string; value: number; threshold: number }) {
  const max = 0.45;
  const closed = value > 0 && value < threshold;
  return (
    <div className="grid grid-cols-[48px_1fr_52px] items-center gap-2 font-mono text-xs">
      <span className="text-slate-400">{label}</span>
      <div className="relative h-1.5 rounded-full bg-slate-800">
        <span
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-100 ${closed ? 'bg-rose-500' : 'bg-violet-500'}`}
          style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
        />
        <span
          className="absolute top-[-3px] h-3 w-0.5 bg-amber-300"
          style={{ left: `${(threshold / max) * 100}%` }}
          title="Umbral"
        />
      </div>
      <span className={`text-right tabular-nums ${closed ? 'text-rose-300' : 'text-violet-200'}`}>{value.toFixed(3)}</span>
    </div>
  );
}

function Sparkline({ data, threshold }: { data: number[]; threshold: number }) {
  const W = 200;
  const H = 40;
  const max = 0.45;
  const step = data.length > 1 ? W / (data.length - 1) : W;
  const points = data.map((v, i) => `${(i * step).toFixed(1)},${(H - (Math.min(v, max) / max) * H).toFixed(1)}`).join(' ');
  const ty = H - (threshold / max) * H;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-10 w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="spark" x1="0" x2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <line x1="0" x2={W} y1={ty} y2={ty} stroke="#fcd34d" strokeOpacity="0.6" strokeDasharray="3 3" strokeWidth="1" />
      {data.length > 1 && (
        <polyline points={points} fill="none" stroke="url(#spark)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

const FATIGUE_UI: Record<FatigueLevel, { label: string; cls: string; hint: string }> = {
  normal: { label: 'Nominal', cls: 'text-emerald-300 border-emerald-400/40 bg-emerald-400/10', hint: 'Sin signos de fatiga' },
  moderate: { label: 'Moderada', cls: 'text-amber-300 border-amber-400/40 bg-amber-400/10', hint: 'Considera una pausa breve' },
  high: { label: 'Alta', cls: 'text-rose-300 border-rose-400/40 bg-rose-400/10', hint: 'PERCLOS elevado: descansa' },
  critical: { label: 'Microsueño', cls: 'text-rose-200 border-rose-400/60 bg-rose-500/20 animate-pulse', hint: 'Ojos cerrados de forma prolongada' },
};

/** Tarjetas flotantes de telemetría. Memoizadas: solo se re-renderizan cuando llega un nuevo snapshot (~10 Hz). */
export const TelemetryCards = memo(function TelemetryCards({ telemetry: t, earThreshold }: TelemetryCardsProps) {
  const fatigue = FATIGUE_UI[t.fatigue];
  const dim = t.faceDetected ? '' : 'opacity-40';

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card title="Pose de cabeza" icon={<Move3d className="size-4" />}>
        <div className={`space-y-2.5 ${dim}`}>
          <AngleRow label="PITCH" value={t.pose.pitch} />
          <AngleRow label="YAW" value={t.pose.yaw} />
          <AngleRow label="ROLL" value={t.pose.roll} />
        </div>
      </Card>

      <Card title="Apertura ocular · EAR" icon={<ScanEye className="size-4" />} accent="violet">
        <div className={`space-y-2.5 ${dim}`}>
          <EarBar label="IZQ" value={t.earLeft} threshold={earThreshold} />
          <EarBar label="DER" value={t.earRight} threshold={earThreshold} />
        </div>
        <Sparkline data={t.earHistory} threshold={earThreshold} />
      </Card>

      <Card title="Parpadeo" icon={t.eyesClosed ? <EyeOff className="size-4" /> : <Eye className="size-4" />} accent="violet">
        <div className={`flex items-end justify-between ${dim}`}>
          <div>
            <div className="font-mono text-3xl font-bold text-slate-100 tabular-nums">{t.blinkCount}</div>
            <div className="text-xs text-slate-400">parpadeos totales</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-lg text-violet-200 tabular-nums">{t.blinksPerMinute.toFixed(0)}</div>
            <div className="text-xs text-slate-400">por minuto</div>
          </div>
        </div>
        <div
          className={`mt-3 rounded-md border px-2 py-1 text-center font-mono text-xs tracking-widest ${
            t.eyesClosed ? 'border-rose-400/50 bg-rose-500/15 text-rose-300' : 'border-cyan-400/30 bg-cyan-400/5 text-cyan-300'
          }`}
        >
          {t.faceDetected ? (t.eyesClosed ? '● OJOS CERRADOS' : '○ OJOS ABIERTOS') : '— SIN ROSTRO —'}
        </div>
      </Card>

      <Card title="Fatiga · PERCLOS" icon={<Activity className="size-4" />}>
        <div className="flex items-center justify-between">
          <span className={`rounded-md border px-2.5 py-1 text-sm font-semibold ${fatigue.cls}`}>{fatigue.label}</span>
          <span className="font-mono text-2xl font-bold text-slate-100 tabular-nums">{(t.perclos * 100).toFixed(1)}%</span>
        </div>
        <p className="mt-2 text-xs text-slate-400">{fatigue.hint}</p>
        <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-2 font-mono text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Gauge className="size-3.5 text-cyan-400" />
            {t.fps.toFixed(0)} FPS
          </span>
          <span>{t.inferenceMs.toFixed(1)} ms</span>
          <span>{t.landmarkCount} pts</span>
        </div>
      </Card>
    </div>
  );
});
