import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Shape, Shot, Trajectory } from '../types';
import { newShotId, useApp } from '../lib/store';
import { SHAPE_LABEL, TRAJECTORY_LABEL, TRAJECTORY_WIND, fmtDist } from '../lib/golf';
import { DistanceLadder } from './DistanceLadder';

const CLUB_ORDER = [
  'Driver',
  '3 Wood',
  '5 Wood',
  '4 Hybrid',
  '3 Hybrid',
  '2 Iron',
  '3 Iron',
  '4 Iron',
  '5 Iron',
  '6 Iron',
  '7 Iron',
  '8 Iron',
  '9 Iron',
  'Pitching Wedge',
  'Gap Wedge',
  'Sand Wedge',
  'Lob Wedge',
  'Putter',
];

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-xl bg-turf-700 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`h-9 flex-1 rounded-lg text-sm font-medium ${
            value === o.value ? 'bg-lime-400 text-turf-950' : 'text-turf-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const inputCls =
  'h-11 w-full rounded-xl bg-turf-700 px-3 text-base text-turf-50 outline-none placeholder:text-turf-400 focus:ring-2 focus:ring-lime-400/60';

function ShotEditor({
  shot,
  isNew,
  onCancel,
  onSave,
  onDelete,
}: {
  shot: Shot;
  isNew: boolean;
  onCancel: () => void;
  onSave: (s: Shot) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<Shot>({ ...shot });
  const set = (patch: Partial<Shot>) => setDraft((d) => ({ ...d, ...patch }));
  const valid = draft.club.trim().length > 0 && draft.carry > 0;

  const save = () => {
    if (!valid) return;
    onSave({
      ...draft,
      club: draft.club.trim(),
      name: draft.name.trim() || 'Full',
      carry: Number(draft.carry),
      total: draft.total != null && draft.total > 0 ? Number(draft.total) : null,
      windSensitivity:
        draft.windSensitivity != null && draft.windSensitivity > 0 ? Number(draft.windSensitivity) : null,
    });
  };

  // Portal to <body>: the modal layers above everything (app header included)
  // regardless of stacking contexts further down the tree.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70" onClick={onCancel}>
      <div
        className="flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-3xl border-t border-turf-600 bg-turf-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title + actions stay put; only the form below scrolls. */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-turf-700/60 px-5 py-3">
          <h2 className="text-lg font-semibold">{isNew ? 'New shot' : 'Edit shot'}</h2>
          <div className="flex items-center gap-1">
            {!isNew && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-lg px-2.5 py-2 text-sm font-semibold text-red-300 active:bg-red-500/10"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-2.5 py-2 text-sm font-semibold text-turf-300 active:bg-turf-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!valid}
              className="ml-1 rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-turf-950 disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-8 pt-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-turf-300">Club</span>
            <input
              className={`${inputCls} mt-1`}
              list="club-suggestions"
              value={draft.club}
              onChange={(e) => set({ club: e.target.value })}
              placeholder="7 Iron, Lob Wedge…"
            />
            <datalist id="club-suggestions">
              {CLUB_ORDER.map((club) => (
                <option key={club} value={club} />
              ))}
            </datalist>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-turf-300">Shot name</span>
            <input
              className={`${inputCls} mt-1`}
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Full, Punch, Flop…"
            />
          </label>

          <div className="flex gap-3">
            <label className="flex-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-turf-300">Carry (yd)</span>
              <input
                className={`${inputCls} mt-1`}
                inputMode="decimal"
                value={draft.carry === 0 ? '' : String(draft.carry)}
                onChange={(e) => set({ carry: e.target.value === '' ? 0 : Number(e.target.value) })}
                placeholder="152"
              />
            </label>
            <label className="flex-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-turf-300">Total (opt.)</span>
              <input
                className={`${inputCls} mt-1`}
                inputMode="decimal"
                value={draft.total == null ? '' : String(draft.total)}
                onChange={(e) => set({ total: e.target.value === '' ? null : Number(e.target.value) })}
                placeholder="159"
              />
            </label>
          </div>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-turf-300">Trajectory</span>
            <div className="mt-1">
              <Segmented<Trajectory>
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'mid', label: 'Mid' },
                  { value: 'high', label: 'High' },
                ]}
                value={draft.trajectory}
                onChange={(v) => set({ trajectory: v })}
              />
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-turf-300">Shape</span>
            <div className="mt-1">
              <Segmented<Shape>
                options={[
                  { value: 'straight', label: 'Straight' },
                  { value: 'draw', label: 'Draw' },
                  { value: 'fade', label: 'Fade' },
                ]}
                value={draft.shape}
                onChange={(v) => set({ shape: v })}
              />
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-turf-300">
              Wind sensitivity (advanced)
            </span>
            <input
              className={`${inputCls} mt-1`}
              inputMode="decimal"
              value={draft.windSensitivity == null ? '' : String(draft.windSensitivity)}
              onChange={(e) =>
                set({ windSensitivity: e.target.value === '' ? null : Number(e.target.value) })
              }
              placeholder={`auto: Low ${TRAJECTORY_WIND.low} · Mid ${TRAJECTORY_WIND.mid} · High ${TRAJECTORY_WIND.high}`}
            />
            <span className="mt-1 block text-xs text-turf-400">
              How much wind moves this shot. 1 = normal flight, lower = barely affected (putter-like), higher = sails.
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-turf-300">Notes</span>
            <textarea
              className="mt-1 h-20 w-full rounded-xl bg-turf-700 px-3 py-2 text-base text-turf-50 outline-none placeholder:text-turf-400 focus:ring-2 focus:ring-lime-400/60"
              value={draft.notes ?? ''}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Choke down a hair, feels softer…"
            />
          </label>
        </div>

      </div>
    </div>,
    document.body,
  );
}

export function ArsenalScreen() {
  const { state, dispatch } = useApp();
  const u = state.settings.units;
  const [editing, setEditing] = useState<Shot | null>(null);
  const [isNew, setIsNew] = useState(false);

  const sorted = useMemo(() => {
    const idx = (club: string) => {
      const i = CLUB_ORDER.indexOf(club);
      return i === -1 ? CLUB_ORDER.length : i;
    };
    return [...state.shots].sort((a, b) => idx(a.club) - idx(b.club) || b.carry - a.carry);
  }, [state.shots]);

  const hasSample = state.shots.some((s) => s.sample);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Arsenal</h1>
        <button
          type="button"
          onClick={() => {
            setIsNew(true);
            setEditing({
              id: newShotId(),
              club: '',
              name: 'Full',
              carry: 0,
              total: null,
              trajectory: 'mid',
              shape: 'straight',
            });
          }}
          className="rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-turf-950"
        >
          + Add shot
        </button>
      </header>

      {hasSample && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-200">
          These are <b>sample distances</b>, not your real numbers. Edit each shot's carry to match you, or{' '}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => dispatch({ type: 'deleteSampleShots' })}
          >
            delete all samples
          </button>
          .
        </div>
      )}

      <DistanceLadder shots={state.shots} units={u} />

      <ul className="space-y-2">
        {sorted.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => {
                setIsNew(false);
                setEditing(s);
              }}
              className="w-full rounded-xl bg-turf-800 px-4 py-3 text-left active:bg-turf-700"
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-medium">
                  {s.club} <span className="text-turf-300">· {s.name}</span>
                </div>
                <div className="font-semibold tabular-nums">{fmtDist(s.carry, u)}</div>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-turf-300">
                <span className="rounded-full bg-turf-600 px-2 py-0.5">{TRAJECTORY_LABEL[s.trajectory]}</span>
                {s.shape !== 'straight' && (
                  <span className="rounded-full bg-turf-600 px-2 py-0.5">{SHAPE_LABEL[s.shape]}</span>
                )}
                {s.total != null && <span>total {fmtDist(s.total, u)}</span>}
                {s.notes && <span className="italic">{s.notes}</span>}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {editing && (
        <ShotEditor
          shot={editing}
          isNew={isNew}
          onCancel={() => setEditing(null)}
          onSave={(shot) => {
            dispatch({ type: 'upsertShot', shot });
            setEditing(null);
          }}
          onDelete={() => {
            dispatch({ type: 'deleteShot', id: editing.id });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
