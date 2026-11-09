import type { ChangeEvent } from 'react';
import type { Factors } from '../types';
import { DEFAULT_FACTORS } from '../lib/golf';
import { STATE_VERSION, freshState, useApp } from '../lib/store';

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-xs font-semibold uppercase tracking-wider text-turf-300">{children}</h2>;
}

function FactorRow({
  label,
  hint,
  value,
  min,
  max,
  step,
  fmt,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  fmt?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-turf-100">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-lime-300">{fmt ? fmt(value) : value}</span>
      </div>
      <p className="text-xs text-turf-400">{hint}</p>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full"
        aria-label={label}
      />
    </div>
  );
}

export function SettingsScreen() {
  const { state, dispatch } = useApp();
  const s = state.settings;
  const f = s.factors;
  const setF = (patch: Partial<Factors>) => dispatch({ type: 'setFactors', patch });

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `caddie-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<typeof state>;
      if (parsed && Array.isArray(parsed.shots) && parsed.conditions && parsed.settings) {
        dispatch({ type: 'replaceAll', state: { ...parsed, version: STATE_VERSION } as typeof state });
      } else {
        window.alert('That file does not look like a Caddie backup.');
      }
    } catch {
      window.alert('Could not read that file.');
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Settings</h1>

      {/* Units */}
      <section className="rounded-2xl bg-turf-800 p-4">
        <SectionTitle>Distance units</SectionTitle>
        <div className="mt-2 flex rounded-xl bg-turf-700 p-1">
          {(['yd', 'm'] as const).map((unit) => (
            <button
              key={unit}
              type="button"
              onClick={() => dispatch({ type: 'setSettings', patch: { units: unit } })}
              className={`h-10 flex-1 rounded-lg text-sm font-semibold ${
                s.units === unit ? 'bg-lime-400 text-turf-950' : 'text-turf-200'
              }`}
            >
              {unit === 'yd' ? 'Yards' : 'Meters'}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-turf-400">
          Distances you enter are treated as {s.units}. Wind stays in mph and elevation in feet for now.
        </p>
      </section>

      {/* Course altitude */}
      <section className="rounded-2xl bg-turf-800 p-4">
        <SectionTitle>Course altitude</SectionTitle>
        <div className="mt-2 flex flex-wrap gap-2">
          {[0, 1000, 2500, 5000].map((alt) => (
            <button
              key={alt}
              type="button"
              onClick={() => dispatch({ type: 'setSettings', patch: { courseAltFt: alt } })}
              className={`h-9 rounded-full px-3 text-sm font-medium ${
                s.courseAltFt === alt ? 'bg-lime-400 text-turf-950' : 'bg-turf-700 text-turf-100'
              }`}
            >
              {alt === 0 ? 'Sea level' : `${alt.toLocaleString()} ft`}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-turf-400">
          The ball flies farther at altitude — this stretches every shot in your arsenal.
        </p>
      </section>

      {/* Model tuning */}
      <section className="rounded-2xl bg-turf-800 p-4">
        <div className="flex items-baseline justify-between">
          <SectionTitle>Model tuning</SectionTitle>
          <button
            type="button"
            onClick={() => setF({ ...DEFAULT_FACTORS })}
            className="text-xs font-semibold text-lime-300 underline"
          >
            Reset to defaults
          </button>
        </div>
        <p className="mt-1 text-xs text-turf-400">
          These are heuristics, not physics. Play a few rounds, compare what actually happened, and tune
          them to your game.
        </p>
        <div className="mt-2 divide-y divide-turf-700">
          <FactorRow
            label="Headwind"
            hint="Distance lost per mph of headwind, % of carry."
            value={f.headwindPctPerMph}
            min={0.2}
            max={1.5}
            step={0.05}
            fmt={(v) => `${v.toFixed(2)}% / mph`}
            onChange={(v) => setF({ headwindPctPerMph: v })}
          />
          <FactorRow
            label="Tailwind"
            hint="Distance gained per mph of tailwind — helping winds help less than headwinds hurt."
            value={f.tailwindPctPerMph}
            min={0.1}
            max={1.2}
            step={0.05}
            fmt={(v) => `${v.toFixed(2)}% / mph`}
            onChange={(v) => setF({ tailwindPctPerMph: v })}
          />
          <FactorRow
            label="Temperature"
            hint="Per °F away from 70°F. Cold air = shorter ball."
            value={f.tempPctPerDegF}
            min={0}
            max={0.4}
            step={0.01}
            fmt={(v) => `${v.toFixed(2)}% / °F`}
            onChange={(v) => setF({ tempPctPerDegF: v })}
          />
          <FactorRow
            label="Altitude"
            hint="Distance gained per 1,000 ft above sea level."
            value={f.altPctPer1000Ft}
            min={0}
            max={4}
            step={0.1}
            fmt={(v) => `${v.toFixed(1)}% / 1000 ft`}
            onChange={(v) => setF({ altPctPer1000Ft: v })}
          />
          <FactorRow
            label="Uphill"
            hint="Yards added to the required carry per foot of elevation gain."
            value={f.elevUpYdPerFt}
            min={0.2}
            max={2}
            step={0.05}
            fmt={(v) => `${v.toFixed(2)} yd / ft`}
            onChange={(v) => setF({ elevUpYdPerFt: v })}
          />
          <FactorRow
            label="Downhill"
            hint="Yards removed per foot of elevation drop."
            value={f.elevDownYdPerFt}
            min={0}
            max={1.5}
            step={0.05}
            fmt={(v) => `${v.toFixed(2)} yd / ft`}
            onChange={(v) => setF({ elevDownYdPerFt: v })}
          />
          <FactorRow
            label="Overshoot penalty"
            hint="How much worse flying the green is vs. coming up short, when ranking shots."
            value={f.overshootPenalty}
            min={1}
            max={3}
            step={0.1}
            fmt={(v) => `${v.toFixed(1)}×`}
            onChange={(v) => setF({ overshootPenalty: v })}
          />
        </div>
      </section>

      {/* Data */}
      <section className="rounded-2xl bg-turf-800 p-4">
        <SectionTitle>Your data</SectionTitle>
        <p className="mt-1 text-xs text-turf-400">
          Everything lives on this device. Export a backup before switching phones or clearing your
          browser — a future version can sync to the cloud.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportData}
            className="h-10 rounded-xl bg-turf-700 px-4 text-sm font-semibold text-turf-50 active:bg-turf-600"
          >
            Export backup
          </button>
          <label className="h-10 cursor-pointer rounded-xl bg-turf-700 px-4 text-sm font-semibold leading-10 text-turf-50 active:bg-turf-600">
            Import backup
            <input type="file" accept="application/json,.json" onChange={importData} className="hidden" />
          </label>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Reset everything to the sample arsenal and default settings?')) {
                dispatch({ type: 'replaceAll', state: freshState() });
              }
            }}
            className="h-10 rounded-xl bg-red-500/15 px-4 text-sm font-semibold text-red-300"
          >
            Reset app
          </button>
        </div>
      </section>

      <p className="pb-2 text-center text-xs text-turf-500">Caddie v0.1 · distances are a guide, not gospel</p>
    </div>
  );
}
