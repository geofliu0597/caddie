import { useRef } from 'react';
import { clamp, finiteOr } from '../lib/golf';

const MIN = -30;
const MAX = 30;
const STEP = 5;
const TICKS = (MAX - MIN) / STEP + 1; // 13 notches

/**
 * Pointer-driven notched slider. Replaces the native <input type="range">:
 * the whole rail is the hit area (press anywhere to jump, then drag), the
 * value always snaps to a 5° notch, and the cursor is explicit — so none of
 * the native thumb-drag quirks (dead thumb presses, blocked cursor) can
 * happen. Same pointer-capture pattern as the wind dial.
 */
function SlopeSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const frac = clamp((finiteOr(value, 0) - MIN) / (MAX - MIN), 0, 1);

  const setFromX = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    const t = clamp((clientX - r.left) / r.width, 0, 1);
    onChange(clamp(Math.round((MIN + t * (MAX - MIN)) / STEP) * STEP, MIN, MAX));
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label="Front to back slope"
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      aria-valuenow={finiteOr(value, 0)}
      className="relative mt-3 h-10 rounded-lg outline-none select-none focus-visible:ring-2 focus-visible:ring-lime-400/60"
      style={{ cursor: 'pointer', touchAction: 'none' }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        e.currentTarget.focus();
        setFromX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (dragging.current) setFromX(e.clientX);
      }}
      onPointerUp={(e) => {
        dragging.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      onKeyDown={(e) => {
        const cur = finiteOr(value, 0);
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(clamp(cur - STEP, MIN, MAX));
        else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(clamp(cur + STEP, MIN, MAX));
        else if (e.key === 'Home') onChange(MIN);
        else if (e.key === 'End') onChange(MAX);
        else return;
        e.preventDefault();
      }}
    >
      {/* rail */}
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-turf-600" />
      {/* 5° notch ticks — the middle one marks 0° */}
      {Array.from({ length: TICKS }, (_, i) => (
        <div
          key={i}
          className={`absolute top-1/2 w-px -translate-y-1/2 ${i === 6 ? 'h-3 bg-turf-400' : 'h-2 bg-turf-500'}`}
          style={{ left: `${(i / (TICKS - 1)) * 100}%` }}
        />
      ))}
      {/* thumb */}
      <div
        className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-400 shadow"
        style={{ left: `${frac * 100}%` }}
      />
    </div>
  );
}

/**
 * Stance-slope graphic + slider: the tilt of the ground under the golfer's
 * feet. The line tilts with the slope — uphill (+deg) raises the heels/flag
 * side, downhill (−deg) lowers it. Row layout: graphic (half the row) ·
 * degrees · what the slope does to the best shot's carry, on the right.
 */
export function SlopeControl({
  value,
  onChange,
  effectValue,
  effectQualifier,
}: {
  value: number;
  onChange: (deg: number) => void;
  effectValue?: string | null;
  effectQualifier?: string | null;
}) {
  const deg = finiteOr(value, 0);
  const dir = deg > 0 ? 'uphill' : deg < 0 ? 'downhill' : 'flat';
  return (
    <div>
      <div className="flex items-center gap-3">
        <svg
          viewBox="0 0 120 76"
          className="h-auto w-1/2 shrink-0"
          style={{ aspectRatio: '120 / 76' }}
          aria-hidden
        >
          {/* flat reference */}
          <line x1="14" y1="38" x2="106" y2="38" stroke="#3a5a45" strokeWidth="1.5" strokeDasharray="4 5" />
          {/* the ground line + flag, rotating about the pivot */}
          <g
            style={{
              transform: `rotate(${deg}deg)`,
              transformOrigin: '60px 38px',
              transition: 'transform 120ms ease-out',
            }}
          >
            <line x1="18" y1="38" x2="102" y2="38" stroke="#dcead9" strokeWidth="2.5" strokeLinecap="round" />
            {/* muted flag on the green end */}
            <line x1="18" y1="38" x2="18" y2="25" stroke="#6f9d7f" strokeWidth="2" strokeLinecap="round" />
            <path d="M18 25 l10 3.5 -10 3.5 z" fill="#6f9d7f" />
          </g>
          <circle cx="60" cy="38" r="3.5" fill="#a3e635" />
        </svg>
        <div className="min-w-14 shrink-0">
          <div className="text-3xl font-semibold tabular-nums">
            {Math.abs(Math.round(deg))}°
          </div>
          <div className="text-xs font-medium capitalize text-turf-300">{dir}</div>
        </div>
        {effectValue != null && (
          <div className="min-w-0 flex-1 text-right">
            <div className="text-base font-semibold tabular-nums text-turf-50">{effectValue}</div>
            {effectQualifier && <div className="text-xs font-medium text-turf-300">{effectQualifier}</div>}
          </div>
        )}
      </div>
      <SlopeSlider value={deg} onChange={onChange} />
      <div className="mt-0.5 flex justify-between text-[11px] text-turf-400">
        <span>30° downhill</span>
        <span>30° uphill</span>
      </div>
    </div>
  );
}
