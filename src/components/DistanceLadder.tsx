import type { Shot, Trajectory } from '../types';
import { clubAbbrev, fromDisplayYards, toDisplayYards } from '../lib/golf';

/**
 * "Distance ladder" — every shot in the arsenal as a labeled pill positioned by
 * its stock carry, so gaps and clustering are visible at a glance.
 *
 * Dataviz method notes:
 *  - Trajectory is ordered (low→mid→high), so it uses a one-hue ORDINAL ramp
 *    (blue, light→dark = high→low), validated against the card surface #131c15.
 *  - Hairline solid gridlines one step off the surface; recessive axis text.
 *  - Pills are ≤24px thick with 4px rounded data-ends; labels ride inside the
 *    fill (white on dark steps, near-black on light steps).
 *  - Gap bands use the reserved status-warning color *as a wash with a text
 *    explanation* — never color-alone.
 *  - The arsenal list below the chart is the table-view twin.
 */
const TRAJ_FILL: Record<Trajectory, string> = { low: '#184f95', mid: '#2a78d6', high: '#9ec5f4' };
const TRAJ_INK: Record<Trajectory, string> = { low: '#ffffff', mid: '#ffffff', high: '#0b0b0b' };

const SURFACE_GAP = 2; // px gap between touching marks, in surface color
const GRID = '#1c2a1f';
const AXIS = '#2a3d2e';
const MUTED = '#5a8265';
const GAP_WASH = 'rgba(250, 178, 25, 0.18)';
const GAP_EDGE = '#fab219';
const PILL_W = 56;
const PILL_H = 22;
const LANE_H = 30;
const TOP_PAD = 14;
const W = 760;
const PAD_X = 10;

export function DistanceLadder({ shots, units }: { shots: Shot[]; units: 'yd' | 'm' }) {
  const valid = shots
    .filter((s) => s.carry > 0 && s.club.toLowerCase() !== 'putter')
    .sort((a, b) => a.carry - b.carry);
  if (valid.length === 0) return null;

  const lo = Math.max(0, Math.floor((valid[0].carry - 12) / 25) * 25);
  const hi = Math.ceil((valid[valid.length - 1].carry + 12) / 25) * 25;
  const span = Math.max(1, hi - lo);
  const xOf = (yd: number) => PAD_X + ((yd - lo) / span) * (W - 2 * PAD_X);
  const disp = (yd: number) => Math.round(toDisplayYards(yd, units));

  // Tick marks at clean numbers in the display unit (25 yd / 20 m steps).
  const tickStep = units === 'yd' ? 25 : 20;
  const dLo = Math.ceil(toDisplayYards(lo, units) / tickStep) * tickStep;
  const dHi = Math.floor(toDisplayYards(hi, units) / tickStep) * tickStep;
  const ticks: number[] = [];
  for (let d = dLo; d <= dHi; d += tickStep) ticks.push(fromDisplayYards(d, units));

  // Lane packing: pills in one lane must clear each other by a surface gap.
  const laneEnds: number[] = [];
  const lanes = valid.map((s) => {
    const xc = Math.min(W - PAD_X - PILL_W / 2, Math.max(PAD_X + PILL_W / 2, xOf(s.carry)));
    let lane = laneEnds.findIndex((end) => xc - PILL_W / 2 >= end + SURFACE_GAP);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(xc + PILL_W / 2);
    } else {
      laneEnds[lane] = xc + PILL_W / 2;
    }
    return { shot: s, xc, lane };
  });
  const laneCount = Math.max(1, laneEnds.length);
  const rulerY = TOP_PAD + laneCount * LANE_H + 6;
  const H = rulerY + 28;

  // Yardage gaps ≥ 18 between consecutive shots, drawn as a wash on the ruler.
  const gaps: { x1: number; x2: number }[] = [];
  for (let i = 1; i < valid.length; i++) {
    const a = valid[i - 1].carry;
    const b = valid[i].carry;
    if (b - a >= 18) gaps.push({ x1: xOf(a) + PILL_W / 2, x2: xOf(b) - PILL_W / 2 });
  }

  return (
    <section className="rounded-2xl bg-turf-800 p-4">
      <h2 className="text-sm font-semibold text-turf-100">Distance coverage</h2>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-turf-300">
        {(['low', 'mid', 'high'] as Trajectory[]).map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-[4px]"
              style={{ backgroundColor: TRAJ_FILL[t] }}
            />
            <span className="capitalize">{t} flight</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-[4px]" style={{ backgroundColor: GAP_WASH }} />
          <span>gap ≥ 18 {units}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="mt-2 block" role="img" aria-label="Shot carry distances by club">
        {ticks.map((t) => (
          <line key={t} x1={xOf(t)} y1={8} x2={xOf(t)} y2={rulerY} className="pointer-events-none" stroke={GRID} strokeWidth={1} />
        ))}
        {gaps.map((g, i) => (
          <rect
            key={i}
            x={g.x1}
            y={rulerY - 3}
            width={Math.max(0, g.x2 - g.x1)}
            height={6}
            fill={GAP_WASH}
            stroke={GAP_EDGE}
            strokeWidth={1}
          />
        ))}
        {lanes.map(({ shot, xc, lane }) => {
          const y = TOP_PAD + lane * LANE_H;
          const label = `${clubAbbrev(shot.club)} ${disp(shot.carry)}`;
          return (
            <g key={shot.id}>
              <title>{`${shot.club} ${shot.name} — carry ${shot.carry} yd`}</title>
              <rect x={xc - PILL_W / 2} y={y} width={PILL_W} height={PILL_H} rx={4} fill={TRAJ_FILL[shot.trajectory]} />
              <text
                x={xc}
                y={y + PILL_H / 2 + 3.5}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill={TRAJ_INK[shot.trajectory]}
              >
                {label}
              </text>
            </g>
          );
        })}
        <line x1={PAD_X} y1={rulerY} x2={W - PAD_X} y2={rulerY} stroke={AXIS} strokeWidth={1} />
        {ticks.map((t) => (
          <text
            key={t}
            x={xOf(t)}
            y={rulerY + 16}
            textAnchor="middle"
            fontSize={10}
            fill={MUTED}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {disp(t)}
          </text>
        ))}
      </svg>
      <p className="mt-1 text-xs text-turf-400">
        Position = stock carry ({units}). Shaded stretches are yardage gaps — consider adding a shot there.
      </p>
    </section>
  );
}
