import type { ReactNode } from 'react';
import type { Conditions } from '../types';
import { useApp } from '../lib/store';
import {
  SHAPE_LABEL,
  TRAJECTORY_LABEL,
  crossAimYards,
  elevationYards,
  fmtDist,
  fromDisplayYards,
  isStockConditions,
  rankShots,
  requiredCarry,
  toDisplayYards,
  windComponents,
  windLabel,
} from '../lib/golf';
import { WindControl } from './WindControl';

function StepBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-11 min-w-11 rounded-xl bg-turf-700 px-3 text-base font-semibold text-turf-50 active:bg-turf-600 disabled:opacity-40"
    >
      {label}
    </button>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 rounded-full px-3 text-sm font-medium ${
        active ? 'bg-lime-400 text-turf-950' : 'bg-turf-700 text-turf-100'
      }`}
    >
      {children}
    </button>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-wider text-turf-300">{children}</h2>;
}

function DiffBadge({ diff, u }: { diff: number; u: 'yd' | 'm' }) {
  const r = Math.round(toDisplayYards(diff, u));
  const abs = Math.abs(r);
  const tone =
    abs <= 3
      ? 'bg-lime-400/15 text-lime-300'
      : abs <= 8
        ? 'bg-amber-400/15 text-amber-300'
        : 'bg-red-400/15 text-red-300';
  return (
    <span className={`rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ${tone}`}>
      {r > 0 ? '+' : ''}
      {r} {u}
    </span>
  );
}

const GAP_YD = 6;

export function PlayScreen() {
  const { state, dispatch } = useApp();
  const c = state.conditions;
  const u = state.settings.units;
  const setCond = (patch: Partial<Conditions>) => dispatch({ type: 'setConditions', patch });

  const disp = Math.round(toDisplayYards(c.pinDistance, u));
  const setDisp = (v: number) => setCond({ pinDistance: Math.max(0, Math.round(fromDisplayYards(v, u))) });

  const ranked = rankShots(state.shots, c, state.settings);
  const req = requiredCarry(c, state.settings.factors);
  const best = ranked[0];
  const { crossRight } = windComponents(c);
  const noClose = best !== undefined && best.score > GAP_YD;
  const longestShort = [...ranked].filter((r) => r.diff <= 0).sort((a, b) => b.diff - a.diff)[0];
  const shortestLong = [...ranked].filter((r) => r.diff > 0).sort((a, b) => a.diff - b.diff)[0];

  const elevYd = elevationYards(c, state.settings.factors);
  const summaryBits: string[] = [];
  if (c.windSpeed >= 2) summaryBits.push(windLabel(c));
  if (c.elevationFt !== 0)
    summaryBits.push(`${Math.abs(c.elevationFt)} ft ${c.elevationFt > 0 ? 'uphill' : 'downhill'}`);
  if (c.tempF !== 70) summaryBits.push(`${c.tempF}°F`);
  if (state.settings.courseAltFt !== 0)
    summaryBits.push(`${state.settings.courseAltFt.toLocaleString()} ft course elev.`);

  return (
    <div className="space-y-4">
      {/* Distance to pin */}
      <section className="rounded-2xl bg-turf-800 p-4">
        <SectionTitle>Distance to pin</SectionTitle>
        <div className="mt-2 flex items-center justify-between gap-1.5">
          <StepBtn label="−5" onClick={() => setDisp(disp - 5)} disabled={disp <= 0} />
          <StepBtn label="−1" onClick={() => setDisp(disp - 1)} disabled={disp <= 0} />
          <div className="min-w-24 text-center text-5xl font-semibold">
            {disp}
            <span className="ml-1 text-lg font-medium text-turf-300">{u}</span>
          </div>
          <StepBtn label="+1" onClick={() => setDisp(disp + 1)} />
          <StepBtn label="+5" onClick={() => setDisp(disp + 5)} />
        </div>
        <input
          type="range"
          min={20}
          max={320}
          value={Math.min(320, Math.max(20, disp))}
          onChange={(e) => setDisp(Number(e.target.value))}
          className="mt-3 w-full"
          aria-label="Distance to pin"
        />
      </section>

      {/* Wind */}
      <section className="rounded-2xl bg-turf-800 p-4">
        <SectionTitle>Wind</SectionTitle>
        <div className="mt-2 flex items-center gap-4">
          <WindControl />
          <div className="flex-1">
            <div className="text-center text-4xl font-semibold">
              {c.windSpeed}
              <span className="ml-1 text-base font-medium text-turf-300">mph</span>
            </div>
            <div className="mt-2 flex justify-center gap-1.5">
              <StepBtn label="−5" onClick={() => setCond({ windSpeed: Math.max(0, c.windSpeed - 5) })} disabled={c.windSpeed === 0} />
              <StepBtn label="−1" onClick={() => setCond({ windSpeed: Math.max(0, c.windSpeed - 1) })} disabled={c.windSpeed === 0} />
              <StepBtn label="+1" onClick={() => setCond({ windSpeed: c.windSpeed + 1 })} />
              <StepBtn label="+5" onClick={() => setCond({ windSpeed: Math.min(40, c.windSpeed + 5) })} />
            </div>
            <p className="mt-3 text-center text-sm text-turf-200">{windLabel(c)}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-turf-400">
          Drag the dial — the arrow points where the wind blows. Up = toward the green (helping).
        </p>
      </section>

      {/* Slope + temperature */}
      <section className="rounded-2xl bg-turf-800 p-4">
        <SectionTitle>Slope to green</SectionTitle>
        <div className="mt-2 flex items-center justify-between gap-1.5">
          <div className="flex gap-1.5">
            <StepBtn label="−5" onClick={() => setCond({ elevationFt: Math.max(-60, c.elevationFt - 5) })} />
            <StepBtn label="−1" onClick={() => setCond({ elevationFt: Math.max(-60, c.elevationFt - 1) })} />
          </div>
          <div className="text-center">
            <div className="text-3xl font-semibold">
              {c.elevationFt > 0 ? '+' : ''}
              {c.elevationFt}
              <span className="ml-1 text-sm font-medium text-turf-300">ft</span>
            </div>
            {elevYd !== 0 && (
              <div className="text-xs text-turf-300 tabular-nums">
                required carry {elevYd > 0 ? '+' : ''}
                {Math.round(toDisplayYards(elevYd, u))} {u}
              </div>
            )}
          </div>
          <div className="flex gap-1.5">
            <StepBtn label="+1" onClick={() => setCond({ elevationFt: Math.min(60, c.elevationFt + 1) })} />
            <StepBtn label="+5" onClick={() => setCond({ elevationFt: Math.min(60, c.elevationFt + 5) })} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[-20, -10, 0, 10, 20].map((v) => (
            <Chip key={v} active={c.elevationFt === v} onClick={() => setCond({ elevationFt: v })}>
              {v === 0 ? 'Flat' : v > 0 ? `+${v} up` : `${v} down`}
            </Chip>
          ))}
        </div>

        <div className="mt-4">
          <SectionTitle>Temperature</SectionTitle>
          <div className="mt-2 flex flex-wrap gap-2">
            {[40, 50, 60, 70, 80, 90, 100].map((t) => (
              <Chip key={t} active={c.tempF === t} onClick={() => setCond({ tempF: t })}>
                {t}°F
              </Chip>
            ))}
          </div>
        </div>
      </section>

      {/* Plays like */}
      <section
        className={`rounded-2xl border p-4 ${
          isStockConditions(c) ? 'border-turf-600 bg-turf-800' : 'border-lime-400/40 bg-turf-800'
        }`}
      >
        <div className="text-sm text-turf-300">Plays like</div>
        <div className="mt-0.5 text-5xl font-semibold text-lime-300">
          {Math.round(toDisplayYards(req, u))}
          <span className="ml-1 text-lg font-medium text-turf-200">{u}</span>
        </div>
        <div className="mt-1 text-sm text-turf-300">
          {isStockConditions(c)
            ? `Matches the pin distance — stock conditions (from ${Math.round(toDisplayYards(c.pinDistance, u))} ${u})`
            : `Pin ${Math.round(toDisplayYards(c.pinDistance, u))} ${u} · ${summaryBits.join(' · ')}`}
        </div>
      </section>

      {/* Options */}
      <section className="space-y-3">
        <SectionTitle>Your options</SectionTitle>
        {state.shots.length === 0 && (
          <p className="rounded-xl bg-turf-800 p-4 text-sm text-turf-300">
            Your arsenal is empty — add shots in the Arsenal tab.
          </p>
        )}

        {best && (
          <article className="rounded-2xl border-2 border-lime-400/60 bg-turf-700 p-4">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-lime-400 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-turf-950">
                Best match
              </span>
              <DiffBadge diff={best.diff} u={u} />
            </div>
            <h3 className="mt-2 text-2xl font-semibold">
              {best.shot.club} <span className="font-normal text-turf-200">· {best.shot.name}</span>
            </h3>
            <p className="mt-1 text-turf-100">
              Flies <span className="font-semibold">{fmtDist(best.effectiveCarry, u)}</span>
              <span className="text-turf-300"> here (stock {fmtDist(best.shot.carry, u)})</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-turf-600 px-2 py-0.5 text-turf-100">
                {TRAJECTORY_LABEL[best.shot.trajectory]} trajectory
              </span>
              <span className="rounded-full bg-turf-600 px-2 py-0.5 text-turf-100">
                {SHAPE_LABEL[best.shot.shape]}
              </span>
              {best.windPct !== 0 && (
                <span className="rounded-full bg-turf-600 px-2 py-0.5 text-turf-100 tabular-nums">
                  wind {best.windPct > 0 ? '+' : ''}
                  {Math.round(best.windPct)}%
                </span>
              )}
            </div>
            {Math.abs(crossRight) >= 3 && (
              <p className="mt-2 text-sm text-amber-300">
                Crosswind: start your ball ~{Math.round(toDisplayYards(crossAimYards(best.effectiveCarry, crossRight), u))} {u}{' '}
                {crossRight > 0 ? 'left' : 'right'} of the flag.
              </p>
            )}
            {best.shot.notes && <p className="mt-2 text-sm italic text-turf-200">{best.shot.notes}</p>}
          </article>
        )}

        {noClose && best && (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-200">
            No stock shot flies this number.{' '}
            {longestShort && (
              <>
                <b>
                  {longestShort.shot.club} {longestShort.shot.name}
                </b>{' '}
                comes up {Math.round(-longestShort.diff)} {u} short
              </>
            )}
            {longestShort && shortestLong ? '; ' : ''}
            {shortestLong && (
              <>
                <b>
                  {shortestLong.shot.club} {shortestLong.shot.name}
                </b>{' '}
                flies {Math.round(shortestLong.diff)} {u} past
              </>
            )}
            . Consider an easier or harder swing — or add a shot for this gap in the Arsenal tab.
          </div>
        )}

        {ranked.length > 1 && (
          <ul className="space-y-2">
            {ranked.slice(1, 6).map((r) => (
              <li key={r.shot.id} className="flex items-center justify-between rounded-xl bg-turf-800 px-4 py-3">
                <div>
                  <div className="font-medium">
                    {r.shot.club} <span className="text-turf-300">· {r.shot.name}</span>
                  </div>
                  <div className="text-xs text-turf-300">flies {fmtDist(r.effectiveCarry, u)}</div>
                </div>
                <DiffBadge diff={r.diff} u={u} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
