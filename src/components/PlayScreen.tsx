import type { ReactNode } from 'react';
import type { Conditions } from '../types';
import { useApp } from '../lib/store';
import {
  SHAPE_LABEL,
  TRAJECTORY_LABEL,
  crossAimYards,
  fmtDist,
  fromDisplayYards,
  rankShots,
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
  const s = state.settings;
  const u = s.units;
  const setCond = (patch: Partial<Conditions>) => dispatch({ type: 'setConditions', patch });

  const disp = Math.round(toDisplayYards(c.pinDistance, u));
  const setDisp = (v: number) => setCond({ pinDistance: Math.max(0, Math.round(fromDisplayYards(v, u))) });

  const ranked = rankShots(state.shots, c, s);
  const best = ranked[0];
  const { crossRight } = windComponents(c);
  const noClose = best !== undefined && best.score > GAP_YD;
  const longestShort = [...ranked].filter((r) => r.diff <= 0).sort((a, b) => b.diff - a.diff)[0];
  const shortestLong = [...ranked].filter((r) => r.diff > 0).sort((a, b) => a.diff - b.diff)[0];

  const adjustBits: string[] = [];
  if (c.windSpeed >= 2) adjustBits.push(windLabel(c));
  if (s.tempF !== 70) adjustBits.push(`${s.tempF}°F`);
  if (s.courseAltFt !== 0) adjustBits.push(`${s.courseAltFt.toLocaleString()} ft elev.`);

  return (
    <div className="space-y-4">
      {/* Distance to pin — the number to cover */}
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
        <p className="mt-1 text-xs text-turf-400">
          A slope-adjusted laser reading is perfect here — the app treats it as the number to cover.
        </p>
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

      {/* Options */}
      <section className="space-y-3">
        <SectionTitle>Your options</SectionTitle>
        <p className="-mt-1 text-xs text-turf-400">
          Covering {disp} {u}
          {adjustBits.length > 0 && <> · adjusting for {adjustBits.join(' · ')}</>}
        </p>
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
