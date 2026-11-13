import { useState } from 'react';
import type { FinishTag, PlayedObservation, SituationTag, StrikeTag } from '../types';
import { useApp } from '../lib/store';
import { finiteOr, fmtDist, fromDisplayYards } from '../lib/golf';

const FINISH_OPTIONS: { v: FinishTag; label: string }[] = [
  { v: 'short', label: 'Short' },
  { v: 'atPin', label: 'At pin' },
  { v: 'past', label: 'Past' },
];

const SITUATION_OPTIONS: { v: SituationTag; label: string }[] = [
  { v: 'green', label: 'On green' },
  { v: 'fairway', label: 'Fairway' },
  { v: 'rough', label: 'Rough' },
  { v: 'other', label: 'Other' },
];

const STRIKE_OPTIONS: { v: StrikeTag; label: string }[] = [
  { v: 'flush', label: 'Flush' },
  { v: 'solid', label: 'Solid' },
  { v: 'mishit', label: 'Mishit' },
];

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 rounded-full px-3 text-sm font-medium ${
        selected ? 'bg-lime-400 text-turf-950' : 'bg-turf-700 text-turf-100 active:bg-turf-600'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * The played-shot log's post-shot step. Collapsed by default so the pre-shot
 * view stays uncluttered; tap to record where the ball finished. Raw
 * observation only — carry is derived in analysis, never entered (see
 * PlayedObservation).
 */
export function PendingShotCard() {
  const { state, dispatch } = useApp();
  const pending = state.pendingShot;
  const u = state.settings.units === 'm' ? 'm' : 'yd';

  const [open, setOpen] = useState(false);
  const [finish, setFinish] = useState<FinishTag | null>(null);
  const [situation, setSituation] = useState<SituationTag | null>(null);
  const [strike, setStrike] = useState<StrikeTag | null>(null);
  const [rest, setRest] = useState('');

  if (!pending) return null;

  const restNum = Number(rest);
  const restOk = rest.trim() !== '' && Number.isFinite(restNum) && restNum >= 0;
  const canSave =
    finish !== null && situation !== null && strike !== null && (finish === 'atPin' || restOk);

  const save = () => {
    if (!canSave || finish === null || situation === null || strike === null) return;
    const observation: PlayedObservation = {
      restingYd: finish === 'atPin' ? 0 : Math.max(0, Math.round(fromDisplayYards(restNum, u))),
      finish,
      situation,
      strike,
    };
    dispatch({ type: 'saveObservation', observation });
  };

  const covered = fmtDist(finiteOr(pending.snapshot.conditions.pinDistance, 0), u);
  const flies = fmtDist(finiteOr(pending.predicted.effectiveCarry, 0), u);
  const clubLine = pending.shotName ? `${pending.club} · ${pending.shotName}` : pending.club;

  return (
    <article className="rounded-2xl border-2 border-amber-400/50 bg-turf-800">
      <div className="flex items-stretch gap-1 py-2 pl-4 pr-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold uppercase tracking-wider text-amber-300">
              Record result
            </span>
            <span className="block truncate text-sm text-turf-100">
              {clubLine} — at {covered}, flies ~{flies}
            </span>
          </span>
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className={`h-4 w-4 shrink-0 text-turf-300 transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path
              d="m6 15 6-6 6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'discardPending' })}
          aria-label="Discard logged shot"
          className="my-1 rounded-lg px-2 text-lg text-turf-400 active:text-turf-200"
        >
          ✕
        </button>
      </div>

      {open && (
        <div className="space-y-3 px-4 pb-4 pt-1">
          <div>
            <p className="text-sm font-medium text-turf-100">Over / under the pin</p>
            {finish !== 'atPin' && (
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={rest}
                  onChange={(e) => setRest(e.target.value)}
                  placeholder="0"
                  aria-label="How far over or under the pin"
                  className="h-11 w-24 rounded-xl bg-turf-700 px-3 text-base font-semibold tabular-nums text-turf-50 outline-none focus:ring-2 focus:ring-lime-400/60"
                />
                <span className="text-sm text-turf-300">{u}</span>
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {FINISH_OPTIONS.map((o) => (
                <Chip key={o.v} selected={finish === o.v} onClick={() => setFinish(o.v)}>
                  {o.label}
                </Chip>
              ))}
            </div>
            <p className="mt-1 text-xs text-turf-400">
              How far over or under along your shot line — where the ball stopped, not how far it
              flew. A laser is exact on line; off to the side, enter the over/under part, not the
              diagonal reading. Chip/putt length works when you're roughly on line.
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-turf-100">Ball finished in</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SITUATION_OPTIONS.map((o) => (
                <Chip key={o.v} selected={situation === o.v} onClick={() => setSituation(o.v)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-turf-100">Strike</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STRIKE_OPTIONS.map((o) => (
                <Chip key={o.v} selected={strike === o.v} onClick={() => setStrike(o.v)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="h-11 flex-1 rounded-xl bg-lime-400 text-sm font-bold uppercase tracking-wider text-turf-950 active:bg-lime-300 disabled:opacity-40"
            >
              Save result
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'discardPending' })}
              className="h-11 rounded-xl bg-turf-700 px-4 text-sm font-semibold text-turf-100 active:bg-turf-600"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
