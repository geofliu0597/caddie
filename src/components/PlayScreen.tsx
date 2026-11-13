import { useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type { Conditions, PlayedShot } from '../types';
import { newShotId, useApp } from '../lib/store';
import {
  BASELINE_TEMP_F,
  SHAPE_LABEL,
  TRAJECTORY_LABEL,
  WIND_UNIT,
  clamp,
  clubAbbr,
  crossAimYards,
  finiteOr,
  fmtDist,
  fromDisplayYards,
  rankShots,
  slopeCarryPct,
  toDisplayYards,
  windComponents,
  windFromDisplay,
  windLabel,
  windToDisplay,
} from '../lib/golf';
import type { ShotEstimate } from '../lib/golf';
import { WindControl } from './WindControl';
import { SlopeControl } from './SlopeControl';
import { InfoTip } from './InfoTip';
import { PendingShotCard } from './PendingShotCard';

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
  // The best-match card is selectable like the tiles below — marked while its
  // record is the pending one.
  const bestMarked = best != null && state.pendingShot?.shotId === best.shot.id;
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
    const yd = (slopeCarryPct(slopeDeg) * finiteOr(best.shot.carry, 0)) / 100;
    const dispAbs = Math.round(Math.abs(toDisplayYards(yd, u)));
    if (dispAbs >= 1) {
      slopeEffectValue = `${dispAbs} ${u}`;
      slopeEffectQualifier = yd < 0 ? 'shorter' : 'longer';
    }
  }

  // Played-shot log (opt-in in Settings): one tap freezes the conditions and
  // the prediction as the pending record; the result is entered at the ball.
  // Works for ANY ranked shot, not just the best match — the golfer can
  // override the caddie and still log what they actually chose.
  const markPlaying = (r: ShotEstimate) => {
    const played: PlayedShot = {
      id: newShotId(),
      ts: Date.now(),
      shotId: r.shot.id,
      club: r.shot.club,
      shotName: r.shot.name,
      source: 'course',
      snapshot: {
        conditions: { ...c },
        tempF: finiteOr(s.tempF, BASELINE_TEMP_F),
        courseAltFt: finiteOr(s.courseAltFt, 0),
        formPct: finiteOr(s.formPct, 0),
        trajectory: r.shot.trajectory,
        greenFirmness: s.greenFirmness,
      },
      predicted: {
        stockCarry: finiteOr(r.shot.carry, 0),
        effectiveCarry: r.effectiveCarry,
        diff: r.diff,
        windPct: r.windPct,
      },
      observation: null,
    };
    dispatch({ type: 'markHitting', played });
  };

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
  const bestRef = useRef<HTMLButtonElement | null>(null);
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

          {s.logShots && state.shots.length > 0 && (
            <p className="text-xs text-turf-400">
              Tap a club to mark it as the one you're hitting; tap it again to unmark.
            </p>
          )}

          {best && (
            <button
              ref={bestRef}
              type="button"
              disabled={!s.logShots}
              onClick={() => (bestMarked ? dispatch({ type: 'discardPending' }) : markPlaying(best))}
              aria-pressed={bestMarked}
              title={s.logShots ? "Mark this club as the one you're hitting" : undefined}
              className={`relative w-full rounded-2xl border-2 bg-turf-700 p-4 text-left ${
                s.logShots ? 'active:bg-turf-600' : ''
              } ${bestMarked ? 'border-lime-400/60' : 'border-lime-400/30'}`}
            >
              {/* Tab chip straddling the top border; the club name sits at the top edge, in line with the diff badge. */}
              <span className="absolute -top-2.5 left-4 rounded-full bg-lime-400 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-turf-950">
                Best match
              </span>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 truncate text-2xl font-semibold text-turf-200">
                  <span className="text-turf-50">{best.shot.club}</span>{' '}
                  <span className="font-normal">· {best.shot.name}</span>
                </div>
                <DiffBadge diff={best.diff} u={u} />
              </div>
              <div className="mt-1 text-turf-100">
                Flies <span className="font-semibold">{fmtDist(best.effectiveCarry, u)}</span>
                <span className="text-turf-300"> (stock {fmtDist(best.shot.carry, u)})</span>
              </div>
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
              {best.shot.notes && <div className="mt-2 text-sm italic text-turf-200">{best.shot.notes}</div>}
            </button>
          )}

          {ranked.length > 1 && (
            <div>
              <ul className="grid grid-cols-3 gap-2">
                {ranked.slice(1, 4).map((r) => {
                  const marked = state.pendingShot?.shotId === r.shot.id;
                  return (
                    <li key={r.shot.id}>
                      <button
                        type="button"
                        disabled={!s.logShots}
                        onClick={() => (marked ? dispatch({ type: 'discardPending' }) : markPlaying(r))}
                        title={s.logShots ? 'Log this shot instead of the best match' : undefined}
                        className={`w-full rounded-xl px-2 py-2.5 text-left ${
                          s.logShots ? 'active:bg-turf-600' : ''
                        } ${
                          marked
                            ? 'bg-turf-700 ring-2 ring-inset ring-lime-400/60'
                            : 'bg-turf-800'
                        }`}
                      >
                        {/* Compact tiles: club abbreviated (name only when it's not the
                            default "Full"), yardage below, diff badge right. Muted base so
                            the truncate ellipsis matches the shot name's color. */}
                        <div className="truncate text-sm font-medium text-turf-300">
                          <span className="text-turf-50">{clubAbbr(r.shot.club)}</span>
                          {r.shot.name && r.shot.name !== 'Full' && <> · {r.shot.name}</>}
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-1">
                          <span className="text-xs text-turf-300 tabular-nums">
                            {fmtDist(r.effectiveCarry, u)}
                          </span>
                          <DiffBadge diff={r.diff} u={u} />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Below the suggestions so marking/unmarking never shifts them. */}
          {state.pendingShot && s.logShots && <PendingShotCard />}
        </section>
      </div>

      {/* While the dock is open, a tap anywhere else closes it instead of
          hitting the page. Transparent (no scrim); sits above the sticky
          header (z-40), below the dock (z-50). */}
      {open && (
        <div className="fixed inset-0 z-[45] touch-none" onClick={() => setOpen(false)} aria-hidden />
      )}

      {/* Distance & wind dock — drag up to open, drag down / tap to tuck away */}
      <div className="fixed inset-x-0 bottom-0 z-50">
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
                  <div className="flex items-center justify-between">
                    <SectionTitle>Distance to pin</SectionTitle>
                    <InfoTip>
                      <p>
                        A slope-adjusted laser reading is perfect here — the app treats it as the
                        number to cover.
                      </p>
                      <p className="mt-1">
                        Your shot has to cover this distance in the air (carry) — rollout on the
                        ground is not counted.
                      </p>
                    </InfoTip>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <StepBtn label="−5" onClick={() => setDisp(disp - 5)} disabled={disp <= 0} />
                    <StepBtn label="−1" onClick={() => setDisp(disp - 1)} disabled={disp <= 0} />
                    <div className="min-w-0 flex-1 whitespace-nowrap text-center text-5xl font-semibold tabular-nums">
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

                <section className="rounded-2xl bg-turf-800 p-4">
                  <div className="flex items-center justify-between">
                    <SectionTitle>Wind</SectionTitle>
                    <InfoTip>
                      <p>
                        Drag the dial — the arrow points where the wind blows. Up = toward the green
                        (helping).
                      </p>
                      <p className="mt-1">
                        {sys === 'metric'
                          ? '5 km/h is how wind feels on your face at walking pace. 10–15 km/h is jogging. 25–30 km/h is a full sprint.'
                          : '3 mph is how wind feels on your face at walking pace. 6–9 mph is jogging. 16–19 mph is a full sprint.'}
                      </p>
                    </InfoTip>
                  </div>
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
                      {/* Reserve two lines so the value and buttons above never
                          shift as the component lines appear or disappear. */}
                      <p className="mt-3 min-h-10 text-center text-sm leading-5 text-turf-200">
                        {windParts.map((part) => (
                          <span key={part} className="block">
                            {part}
                          </span>
                        ))}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl bg-turf-800 p-4">
                  <div className="flex items-center justify-between">
                    <SectionTitle>Front-back slope</SectionTitle>
                    <InfoTip>
                      <p>The tilt under your feet.</p>
                      <p className="mt-1">
                        Uphill adds loft: about the same carry, higher flight, lands steep and
                        stops. Downhill delofts: carries less — club up to fly hazards — then
                        rolls out a lot. The classic "downhill plays longer" is total distance
                        (rollout), not carry. A laser can't see your lie, so set this whenever
                        the ground tilts where you're standing.
                      </p>
                    </InfoTip>
                  </div>
                  <div className="mt-2">
                    <SlopeControl
                      value={slopeDeg}
                      onChange={(deg) => setCond({ slopeDeg: deg })}
                      effectValue={slopeEffectValue}
                      effectQualifier={slopeEffectQualifier}
                    />
                  </div>
                </section>

                <section className="rounded-2xl bg-turf-800 p-4">
                  <div className="flex items-center justify-between">
                    <SectionTitle>Miss preference</SectionTitle>
                    <InfoTip>
                      <p>
                        Where you'd rather miss on an imperfect strike — trouble long of the green →
                        Undershoot; bunker guarding the front → Overshoot. The other side is
                        penalized at double weight — flying the target costs twice what coming up
                        short does.
                      </p>
                      <p className="mt-1">
                        Example: flying 5 yd past scores 10 and loses to landing 9 yd short (9).
                      </p>
                    </InfoTip>
                  </div>
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
