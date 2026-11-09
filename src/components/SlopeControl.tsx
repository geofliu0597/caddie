import { finiteOr } from '../lib/golf';

/**
 * Stance-slope graphic + slider: the tilt of the ground under the golfer's
 * feet. The line tilts with the slope — uphill (+deg) raises the heels/flag
 * side, downhill (−deg) lowers it. `effectLabel` (optional) fills the middle
 * column with what the slope does to the current best shot's carry.
 */
export function SlopeControl({
  value,
  onChange,
  effectLabel,
}: {
  value: number;
  onChange: (deg: number) => void;
  effectLabel?: string | null;
}) {
  const deg = finiteOr(value, 0);
  const dir = deg > 0 ? 'uphill' : deg < 0 ? 'downhill' : 'flat';
  return (
    <div>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 120 76" className="h-[76px] w-[120px] shrink-0" aria-hidden>
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
        {effectLabel != null && (
          <div className="min-w-0 flex-1 text-center">
            <div className="text-sm font-semibold text-turf-50">{effectLabel}</div>
            <div className="text-[11px] text-turf-400">carry on this shot</div>
          </div>
        )}
        <div className="min-w-16 shrink-0 text-right">
          <div className="text-3xl font-semibold tabular-nums">
            {Math.abs(Math.round(deg))}°
          </div>
          <div className="text-xs font-medium capitalize text-turf-300">{dir}</div>
        </div>
      </div>
      <input
        type="range"
        min={-30}
        max={30}
        step={1}
        value={deg}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full"
        aria-label="Front to back slope"
      />
      <div className="mt-0.5 flex justify-between text-[11px] text-turf-400">
        <span>30° downhill</span>
        <span>30° uphill</span>
      </div>
    </div>
  );
}
