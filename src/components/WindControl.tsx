import type { PointerEvent } from 'react';
import { finiteOr } from '../lib/golf';
import { useApp } from '../lib/store';

const SIZE = 160;
const C = SIZE / 2;

/**
 * Compass dial for wind direction. The arrow points where the wind blows TOWARD:
 * up = toward the green (tailwind), down = back at you (headwind).
 * Drag or tap anywhere on the dial to set the direction (snaps to 5°).
 */
export function WindControl() {
  const { state, dispatch } = useApp();
  const dir = finiteOr(state.conditions.windDir, 0);
  const setDir = (d: number) => dispatch({ type: 'setConditions', patch: { windDir: d } });

  const fromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    let deg = (Math.atan2(x, -y) * 180) / Math.PI; // 0 = up, 90 = right
    if (deg < 0) deg += 360;
    setDir((Math.round(deg / 5) * 5) % 360);
  };
  const down = (e: PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    fromPointer(e);
  };
  const move = (e: PointerEvent<SVGSVGElement>) => {
    if (e.buttons !== 0) fromPointer(e);
  };
  const up = (e: PointerEvent<SVGSVGElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={SIZE}
      height={SIZE}
      className="touch-none select-none"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      role="slider"
      aria-label="Wind direction, 0 degrees is toward the green"
      aria-valuenow={dir}
    >
      <circle cx={C} cy={C} r={C - 2} className="fill-turf-700 stroke-turf-500" strokeWidth={1} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line
          key={a}
          x1={C}
          y1={6}
          x2={C}
          y2={a % 90 === 0 ? 14 : 10}
          className={a % 90 === 0 ? 'stroke-turf-300' : 'stroke-turf-500'}
          strokeWidth={a % 90 === 0 ? 2 : 1}
          transform={`rotate(${a} ${C} ${C})`}
        />
      ))}
      <text x={C} y={24} textAnchor="middle" className="fill-turf-200 text-[9px] font-semibold tracking-widest">
        GREEN
      </text>
      <text x={C} y={SIZE - 8} textAnchor="middle" className="fill-turf-200 text-[9px] font-semibold tracking-widest">
        YOU
      </text>
      <g transform={`rotate(${dir} ${C} ${C})`}>
        <line x1={C} y1={C} x2={C} y2={42} className="stroke-lime-400" strokeWidth={5} strokeLinecap="round" />
        <path d={`M ${C} 30 L ${C + 10} 50 L ${C - 10} 50 Z`} className="fill-lime-400" />
        <circle cx={C} cy={C} r={7} className="fill-turf-100" />
      </g>
    </svg>
  );
}
