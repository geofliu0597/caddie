import { useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type { Conditions } from '../types';
import { useApp } from '../lib/store';
import {
  DEFAULT_FACTORS,
  SHAPE_LABEL,
  TRAJECTORY_LABEL,
  WIND_UNIT,
  clamp,
  crossAimYards,
  finiteOr,
  fmtDist,
  fromDisplayYards,
  rankShots,
  toDisplayYards,
  windComponents,
  windFromDisplay,
  windLabel,
  windToDisplay,
} from '../lib/golf';
import { WindControl } from './WindControl';
import { SlopeControl } from './SlopeControl';

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
    abs <= 8
      ? 'bg-lime-400/15 text-lime-300'
      : abs <= 15
        ? 'bg-amber-400/15 text-amber-300'
        : 'bg-red-400/15 text-red-300';
  return (
    <span className={`rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ${tone}`}>
      {r > 0 ? '+' : ''}
      {r} {u}
    </span>
  );
}

export function PlayScreen() {
  const { state, dispatch } = useApp();
  const c = state.conditions;
  const s = state.settings;
  const u = s.units === 'm' ? 'm' : 'yd';
  const setCond = (patch: Partial<Conditions>) => dispatch({ type: 'setConditions', patch });

  const disp = Math.round(toDisplayYards(finiteOr(c.pinDistance, 0), u));
  const setDisp = (v: number) => setCond({ pinDistance: Math.max(0, Math.round(fromDisplayYards(v, u))) });

  const sys = s.unitsSystem === 'imperial' ? 'imperial' : 'metric';
  const windDisp = Math.round(windToDisplay(finiteOr(c.windSpeed, 0), sys));
  const setWind = (dispV: number) =>
    setCond({ windSpeed: clamp(windFromDisplay(dispV, sys), 0, 40) });

  const ranked = rankShots(state.shots, c, s);
  const best = ranked[0];
  const { crossRight } = windComponents(c);

  const slopeDeg = finiteOr(c.slopeDeg, 0);
  const missPref = c.missPref === 'long' ? 'long' : 'short';
  const windParts = windLabel(c, sys);

  // What today's stance slope does to the best shot's carry — shown on the
  // right side of the slope card, next to the degrees. Hidden when the change
  // rounds to 0 so the row never shows a cramped "No change".
  let slopeEffectValue: string | null = null;
  let slopeEffectQualifier: string | null = null;
  if (best && slopeDeg !== 0) {
    const yd =
      (-slopeDeg * finiteOr(s.factors?.slopePctPerDeg, DEFAULT_FACTORS.slopePctPerDeg) * finiteOr(best.shot.carry, 0)) / 100;
    const dispAbs = Math.round(Math.abs(toDisplayYards(yd, u)));
    if (dispAbs >= 1) {
      slopeEffectValue = `${dispAbs} ${u}`;
      slopeEffectQualifier = yd < 0 ? 'shorter' : 'longer';
    }
  }

  // ---- Distance & wind dock -------------------------------------------------
  // A bottom sheet. Dragging the handle moves the sheet with the finger in
  // both directions: pulling up peels it out of the bottom edge, pushing down
  // sinks it back. Release past a threshold (or flick, or tap) and the sheet
  // settles open or tucked with a smooth transition.
  const [open, setOpen] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ y: number; t: number; moved: number; h: number; fromOpen: boolean } | null>(null);

  // The open sheet fills the space between the bottom of the Best match card
  // and the screen edge (minus this handle), so the full card stays visible;
  // the cards inside scroll when there are more than fit.
  const bestRef = useRef<HTMLElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [sheetMax, setSheetMax] = useState<number | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const vh = window.innerHeight;
      const cardBottom = bestRef.current?.getBoundingClientRect().bottom ?? vh * 0.42;
      const handleH = handleRef.current?.offsetHeight ?? 64;
      setSheetMax(Math.round(Math.min(vh * 0.72, Math.max(200, vh - cardBottom - 12 - handleH))));
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
    };
  }, []);

  const onHandleDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const h = scrollRef.current ? Math.ceil(scrollRef.current.getBoundingClientRect().height) : 0;
    drag.current = { y: e.clientY, t: performance.now(), moved: 0, h, fromOpen: open };
    setDragging(true);
    if (!open) setDragY(h); // slide the opened sheet down to just off-screen; only the handle peeks
  };
  const onHandleMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    d.moved = Math.max(d.moved, Math.abs(dy));
    // Follow the finger: pushing down sinks the open sheet; pulling up peels
    // the tucked sheet out of the bottom edge.
    setDragY(d.fromOpen ? Math.max(0, dy) : Math.min(d.h, Math.max(0, d.h + dy)));
  };
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    const dy = e.clientY - d.y;
    const dt = performance.now() - d.t;
    const flick = dt < 260 && Math.abs(dy) > 24;
    const tap = d.moved < 8 && dt < 450;
    setDragY(0); // settle to the resting position with a transition
    if (tap) setOpen(!d.fromOpen);
    else if (d.fromOpen) {
      if (dy > 90 || (flick && dy > 0)) setOpen(false);
      else setOpen(true);
    } else {
      const revealed = -dy; // how far the sheet was actually pulled out of the bottom edge
      if (revealed > Math.min(d.h * 0.4, 140) || (flick && dy < 0)) setOpen(true);
      else setOpen(false);
    }
  };

  // While a drag is in progress the sheet body is shown open (so it can be
  // peeled out) but without its height transition — it tracks the finger.
  const bodyOpen = open || dragging;

  return (
    <div>
      {/* Primary info — your options, always in view */}
      <div className="space-y-4 pb-44">
        <section className="space-y-3">
          {state.shots.length === 0 && (
            <p className="rounded-xl bg-turf-800 p-4 text-sm text-turf-300">
              Your arsenal is empty — add shots in the Arsenal tab.
            </p>
          )}

          {best && (
            <article ref={bestRef} className="rounded-2xl border-2 border-lime-400/60 bg-turf-700 p-4">
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
                <span className="text-turf-300"> (stock {fmtDist(best.shot.carry, u)})</span>
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
                {Math.abs(crossRight) >= 3 && (
                  <span className="rounded-full bg-amber-400/15 px-2 py-0.5 tabular-nums text-amber-300">
                    aim ~{Math.round(toDisplayYards(crossAimYards(best.effectiveCarry, crossRight), u))} {u}{' '}
                    {crossRight > 0 ? 'left' : 'right'}
                  </span>
                )}
              </div>
              {best.shot.notes && <p className="mt-2 text-sm italic text-turf-200">{best.shot.notes}</p>}
            </article>
          )}

          {ranked.length > 1 && (
            <ul className="space-y-2">
              {ranked.slice(1, 6).map((r) => (
                <li key={r.shot.id} className="flex items-center justify-between rounded-xl bg-turf-800 px-4 py-3">
                  <div>
                    <div className="font-medium">
                      {r.shot.club} <span className="text-turf-300">· {r.shot.name}</span>
                    </div>
                    <div className="text-xs text-turf-300">Flies {fmtDist(r.effectiveCarry, u)}</div>
                  </div>
                  <DiffBadge diff={r.diff} u={u} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Distance & wind dock — drag up to open, drag down / tap to tuck away */}
      <div className="fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto w-full max-w-md">
          <div
            className={`rounded-t-3xl border-x border-t border-turf-700 bg-turf-900/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(0,0,0,0.5)] backdrop-blur ${
              dragging ? '' : 'transition-transform duration-200 ease-out'
            }`}
            style={{ transform: `translateY(${dragY}px)` }}
          >
            <div
              ref={handleRef}
              role="button"
              aria-expanded={open}
              aria-label="Distance and wind controls"
              className="touch-none select-none px-4 pb-2.5 pt-3"
              onPointerDown={onHandleDown}
              onPointerMove={onHandleMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-turf-600" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold tabular-nums text-turf-100">
                  {disp} {u} · {windDisp} {WIND_UNIT(sys)} · {Math.abs(Math.round(slopeDeg))}°{slopeDeg > 0 ? ' uphill' : slopeDeg < 0 ? ' downhill' : ''} · {missPref === 'long' ? 'Over' : 'Under'}
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
              </div>
            </div>
            <div className={`sheet-body ${bodyOpen ? 'open' : ''} ${dragging ? 'no-anim' : ''}`}>
              <div>
                <div
                  ref={scrollRef}
                  className="space-y-3 overflow-y-auto overscroll-contain px-4 pb-4"
                  style={{ maxHeight: sheetMax ?? undefined }}
                >
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

                <section className="rounded-2xl bg-turf-800 p-4">
                  <SectionTitle>Wind</SectionTitle>
                  <div className="mt-2 flex items-center gap-4">
                    <WindControl />
                    <div className="flex-1">
                      <div className="text-center text-4xl font-semibold">
                        {windDisp}
                        <span className="ml-1 text-base font-medium text-turf-300">{WIND_UNIT(sys)}</span>
                      </div>
                      <div className="mt-2 flex justify-center gap-1.5">
                        <StepBtn label="−5" onClick={() => setWind(windDisp - 5)} disabled={windDisp === 0} />
                        <StepBtn label="−1" onClick={() => setWind(windDisp - 1)} disabled={windDisp === 0} />
                        <StepBtn label="+1" onClick={() => setWind(windDisp + 1)} />
                        <StepBtn label="+5" onClick={() => setWind(windDisp + 5)} />
                      </div>
                      <p className="mt-3 text-center text-sm leading-snug text-turf-200">
                        {windParts.map((part) => (
                          <span key={part} className="block">
                            {part}
                          </span>
                        ))}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-turf-400">
                    Drag the dial — the arrow points where the wind blows. Up = toward the green (helping).
                  </p>
                </section>

                <section className="rounded-2xl bg-turf-800 p-4">
                  <SectionTitle>Front-back slope</SectionTitle>
                  <div className="mt-2">
                    <SlopeControl
                      value={slopeDeg}
                      onChange={(deg) => setCond({ slopeDeg: deg })}
                      effectValue={slopeEffectValue}
                      effectQualifier={slopeEffectQualifier}
                    />
                  </div>
                  <p className="mt-2 text-xs text-turf-400">The tilt under your feet</p>
                </section>

                <section className="rounded-2xl bg-turf-800 p-4">
                  <SectionTitle>Miss preference</SectionTitle>
                  <div className="mt-2 flex rounded-xl bg-turf-700 p-1">
                    {(['short', 'long'] as const).map((pref) => (
                      <button
                        key={pref}
                        type="button"
                        onClick={() => setCond({ missPref: pref })}
                        className={`h-10 flex-1 rounded-lg text-sm font-semibold ${
                          missPref === pref ? 'bg-lime-400 text-turf-950' : 'text-turf-200'
                        }`}
                      >
                        {pref === 'short' ? 'Undershoot' : 'Overshoot'}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-turf-400">
                    Where you'd rather miss on an imperfect strike — trouble long of the green →
                    Undershoot; bunker guarding the front → Overshoot. The other side is penalized by
                    the Overshoot penalty in Settings.
                  </p>
                </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
