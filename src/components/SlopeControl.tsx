import { finiteOr } from '../lib/golf';

/**
 * Front-to-back slope graphic + slider. The flag marks the green end (left);
 * the line tilts with the slope: uphill (+deg) raises the flag side, downhill
 * (−deg) lowers it — matching how the ground falls from ball to green.
 */
export function SlopeControl({ value, onChange }: { value: number; onChange: (deg: number) => void }) {
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
        <div className="min-w-16 flex-1 text-right">
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
