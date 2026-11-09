import type { ChangeEvent } from 'react';
import type { UnitsSystem } from '../types';
import { BASELINE_TEMP_F, TEMP_UNIT, altFromDisplay, finiteOr, tempFromDisplay } from '../lib/golf';
import { STATE_VERSION, freshState, useApp } from '../lib/store';
import { InfoTip } from './InfoTip';

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
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-turf-100">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-lime-300">{fmt ? fmt(value) : value}</span>
          <InfoTip>
            <p>{hint}</p>
          </InfoTip>
        </div>
      </div>
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

function ConditionChips({
  options,
  value,
  label,
  info,
  onSelect,
}: {
  options: { v: number; label: string }[];
  value: number;
  label: string;
  info?: string;
  onSelect: (v: number) => void;
}) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-turf-100">{label}</span>
        {info && (
          <InfoTip>
            <p>{info}</p>
          </InfoTip>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => onSelect(o.v)}
            className={`h-9 rounded-full px-3 text-sm font-medium ${
              value === o.v ? 'bg-lime-400 text-turf-950' : 'bg-turf-700 text-turf-100'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SettingsScreen() {
  const { state, dispatch } = useApp();
  const s = state.settings;
  const sys: UnitsSystem = s.unitsSystem === 'imperial' ? 'imperial' : 'metric';
  const setS = (patch: Partial<typeof s>) => dispatch({ type: 'setSettings', patch });

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

      {/* Golf distance units */}
      <section className="rounded-2xl bg-turf-800 p-4">
        <SectionTitle>Golf distance units</SectionTitle>
        <div className="mt-2 flex rounded-xl bg-turf-700 p-1">
          {(['yd', 'm'] as const).map((unit) => (
            <button
              key={unit}
              type="button"
              onClick={() => setS({ units: unit })}
              className={`h-10 flex-1 rounded-lg text-sm font-semibold ${
                s.units === unit ? 'bg-lime-400 text-turf-950' : 'text-turf-200'
              }`}
            >
              {unit === 'yd' ? 'Yards' : 'Meters'}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-turf-400">
          Golf distances are yards almost everywhere, so that's the default. This only affects golf
          distances — pin distance, carries, gaps.
        </p>
      </section>

      {/* Conditions units */}
      <section className="rounded-2xl bg-turf-800 p-4">
        <SectionTitle>Conditions units</SectionTitle>
        <div className="mt-2 flex rounded-xl bg-turf-700 p-1">
          {(['metric', 'imperial'] as const).map((sysOpt) => (
            <button
              key={sysOpt}
              type="button"
              onClick={() => setS({ unitsSystem: sysOpt })}
              className={`h-10 flex-1 rounded-lg text-xs font-semibold ${
                s.unitsSystem === sysOpt ? 'bg-lime-400 text-turf-950' : 'text-turf-200'
              }`}
            >
              {sysOpt === 'metric' ? 'Metric · °C, km/h, m' : 'Imperial · °F, mph, ft'}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-turf-400">
          For wind, temperature and altitude. Metric is the default.
        </p>
      </section>

      {/* Round conditions */}
      <section className="rounded-2xl bg-turf-800 p-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Round conditions</SectionTitle>
          <InfoTip>
            <p>
              Set once when you arrive — these change how far your shots fly, not the number you
              cover.
            </p>
            <p className="mt-1">
              The stance slope under your feet is entered per shot on the Play tab.
            </p>
          </InfoTip>
        </div>
        <ConditionChips
          label={`Temperature (${TEMP_UNIT(sys)})`}
          info="Distances are defined at the 20°C (68°F) baseline. Colder air is denser and the ball flies shorter; warmer air flies farther — built-in constants set how much: ~1% of carry per 10°F (≈2% per 10°C)."
          value={finiteOr(s.tempF, BASELINE_TEMP_F)}
          options={
            sys === 'metric'
              ? [5, 10, 15, 20, 25, 30, 35, 40].map((c) => ({ v: tempFromDisplay(c, sys), label: `${c}°C` }))
              : [40, 50, 60, 68, 80, 90, 100].map((t) => ({ v: t, label: `${t}°F` }))
          }
          onSelect={(v) => setS({ tempF: v })}
        />
        <ConditionChips
          label={`Course altitude (${sys === 'metric' ? 'm' : 'ft'} above sea level)`}
          info="Sea level is the baseline. Thinner air up high means less drag, so the ball flies farther — built-in constants set how much: ~1% of carry per 1,000 ft (≈3% per 1,000 m)."
          value={finiteOr(s.courseAltFt, 0)}
          options={
            sys === 'metric'
              ? [0, 300, 750, 1500].map((m) => ({
                  v: altFromDisplay(m, sys),
                  label: m === 0 ? 'Sea level' : `${m.toLocaleString()} m`,
                }))
              : [0, 1000, 2500, 5000].map((ft) => ({
                  v: ft,
                  label: ft === 0 ? 'Sea level' : `${ft.toLocaleString()} ft`,
                }))
          }
          onSelect={(v) => setS({ courseAltFt: v })}
        />
        <div className="mt-3">
          <FactorRow
            label="How am I feeling"
            hint="Your arsenal numbers are a baseline from the sim or range — shift all of them for how you're striking it today. Good day = +, rough day = −."
            value={finiteOr(s.formPct, 0)}
            min={-20}
            max={20}
            step={1}
            fmt={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}%`}
            onChange={(v) => setS({ formPct: v })}
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
