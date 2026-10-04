import { memo, type CSSProperties, type ReactNode } from 'react';
import {
  Ban,
  Box,
  Camera,
  Crosshair,
  Glasses,
  RotateCcw,
  ScanFace,
  SlidersHorizontal,
  Sparkles,
  Sun,
  VenetianMask,
  WandSparkles,
} from 'lucide-react';
import type { AccessoryId, Settings, ViewMode } from '../types';

interface ControlPanelProps {
  settings: Settings;
  onChange: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  onSnapshot: () => void;
  onCalibrate: () => void;
  onResetCounters: () => void;
  onResetSettings: () => void;
  canCapture: boolean;
  calibrationProgress: number | null;
}

const VIEW_MODES: Array<{ id: ViewMode; label: string; icon: ReactNode; key: string }> = [
  { id: 'hud', label: 'HUD', icon: <ScanFace className="size-4" />, key: 'H' },
  { id: 'wireframe', label: 'Wireframe', icon: <Box className="size-4" />, key: 'W' },
  { id: 'accessories', label: 'Solo accesorios', icon: <Sparkles className="size-4" />, key: 'A' },
];

const ACCESSORIES: Array<{ id: AccessoryId; label: string; icon: ReactNode; key: string }> = [
  { id: 'visor', label: 'Visor neón', icon: <Glasses className="size-5" />, key: '1' },
  { id: 'aviator', label: 'Aviador sol', icon: <Sun className="size-5" />, key: '2' },
  { id: 'mask', label: 'Máscara cyber', icon: <VenetianMask className="size-5" />, key: '3' },
  { id: 'none', label: 'Ninguno', icon: <Ban className="size-5" />, key: '0' },
];

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-slate-800/80 px-5 py-5 last:border-b-0">
      <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-slate-400 uppercase">
        <span className="text-cyan-400">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  hint: string;
  onChange: (v: number) => void;
}) {
  const id = `slider-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-sm text-slate-200">
          {label}
        </label>
        <span className="rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-xs text-cyan-300 tabular-nums">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="neon-range w-full"
        style={{ '--fill': `${pct}%` } as CSSProperties}
      />
      <p className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</p>
    </div>
  );
}

/** Sidebar de control: modo de visualización, accesorio, calibración y captura. */
export const ControlPanel = memo(function ControlPanel({
  settings,
  onChange,
  onSnapshot,
  onCalibrate,
  onResetCounters,
  onResetSettings,
  canCapture,
  calibrationProgress,
}: ControlPanelProps) {
  const calibrating = calibrationProgress !== null;

  return (
    <aside className="glass-card flex flex-col overflow-hidden rounded-2xl lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto">
      <Section title="Modo de visualización" icon={<Crosshair className="size-3.5" />}>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-900/80 p-1" role="radiogroup" aria-label="Modo de visualización">
          {VIEW_MODES.map((m) => {
            const active = settings.viewMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={active}
                title={`${m.label} (${m.key})`}
                onClick={() => onChange('viewMode', m.id)}
                className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                  active
                    ? 'bg-gradient-to-br from-cyan-500/25 to-violet-500/25 text-cyan-100 shadow-[inset_0_0_0_1px] shadow-cyan-400/50'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {m.icon}
                <span className="leading-tight">{m.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Virtual try-on" icon={<Glasses className="size-3.5" />}>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Accesorio">
          {ACCESSORIES.map((a) => {
            const active = settings.accessory === a.id;
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={active}
                title={`${a.label} (${a.key})`}
                onClick={() => onChange('accessory', a.id)}
                className={`group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                  active
                    ? 'border-violet-400/60 bg-violet-500/15 text-violet-100 shadow-[0_0_20px_-6px] shadow-violet-500/70'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <span className={active ? 'text-violet-300' : 'text-slate-500 group-hover:text-slate-300'}>{a.icon}</span>
                <span className="leading-tight">{a.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Calibración" icon={<SlidersHorizontal className="size-3.5" />}>
        <Slider
          label="Umbral EAR"
          value={settings.earThreshold}
          min={0.12}
          max={0.35}
          step={0.005}
          format={(v) => v.toFixed(3)}
          hint="Por debajo de este valor el ojo se considera cerrado."
          onChange={(v) => onChange('earThreshold', v)}
        />
        <button
          type="button"
          onClick={onCalibrate}
          disabled={!canCapture || calibrating}
          className="relative mb-5 flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg border border-violet-400/40 bg-violet-500/10 px-3 py-2 text-sm text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {calibrating && (
            <span
              className="absolute inset-y-0 left-0 bg-violet-500/30 transition-[width] duration-100"
              style={{ width: `${(calibrationProgress ?? 0) * 100}%` }}
            />
          )}
          <WandSparkles className="relative size-4" />
          <span className="relative">{calibrating ? 'Mantén los ojos abiertos…' : 'Autocalibrar EAR (2.5 s)'}</span>
        </button>
        <Slider
          label="Frames de parpadeo"
          value={settings.blinkMinFrames}
          min={1}
          max={6}
          step={1}
          format={(v) => `${v} fr`}
          hint="Frames consecutivos bajo el umbral para confirmar un cierre."
          onChange={(v) => onChange('blinkMinFrames', v)}
        />
        <Slider
          label="Suavizado accesorios"
          value={settings.smoothing}
          min={0}
          max={0.9}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          hint="Más alto = movimiento más estable pero con más latencia."
          onChange={(v) => onChange('smoothing', v)}
        />
        <Slider
          label="Confianza de detección"
          value={settings.detectionConfidence}
          min={0.2}
          max={0.9}
          step={0.05}
          format={(v) => v.toFixed(2)}
          hint="Sensibilidad del detector facial de MediaPipe."
          onChange={(v) => onChange('detectionConfidence', v)}
        />
        <Slider
          label="Opacidad de malla"
          value={settings.meshOpacity}
          min={0}
          max={1}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          hint="Intensidad de la teselación en HUD y Wireframe."
          onChange={(v) => onChange('meshOpacity', v)}
        />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onResetCounters}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2 py-1.5 text-xs text-slate-300 transition hover:border-slate-600 hover:bg-slate-800"
          >
            <RotateCcw className="size-3.5" />
            Reiniciar contadores
          </button>
          <button
            type="button"
            onClick={onResetSettings}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2 py-1.5 text-xs text-slate-300 transition hover:border-slate-600 hover:bg-slate-800"
          >
            <SlidersHorizontal className="size-3.5" />
            Valores por defecto
          </button>
        </div>
      </Section>

      <Section title="Captura" icon={<Camera className="size-3.5" />}>
        <button
          type="button"
          onClick={onSnapshot}
          disabled={!canCapture}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-4 py-3 font-semibold text-white shadow-[0_0_30px_-6px] shadow-cyan-500/60 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <Camera className="size-5" />
          Capturar snapshot PNG
        </button>
        <p className="mt-3 text-center text-[11px] text-slate-500">
          Atajos: <kbd>H</kbd> <kbd>W</kbd> <kbd>A</kbd> modos · <kbd>0</kbd>–<kbd>3</kbd> accesorios · <kbd>S</kbd> captura
        </p>
      </Section>
    </aside>
  );
});
