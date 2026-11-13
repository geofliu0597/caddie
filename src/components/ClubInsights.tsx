import type { ClubInsight } from '../lib/insights';
import { MIN_GREEN_FOR_INSIGHT, computeClubInsights } from '../lib/insights';
import { useApp } from '../lib/store';
import { toDisplayYards } from '../lib/golf';
import { InfoTip } from './InfoTip';

/**
 * "Numbers check" — the played-shot log's analysis, rendered on the Arsenal
 * tab where the numbers being checked live. Pure display over
 * computeClubInsights: the only mutation it offers is the explicit Apply
 * button, which writes the median-implied stock into the arsenal entry.
 */
export function ClubInsights() {
  const { state, dispatch } = useApp();
  const u = state.settings.units;
  const disp = (yd: number) => Math.round(toDisplayYards(yd, u));

  // Hidden entirely for golfers who never turned logging on.
  if (!state.settings.logShots && state.played.length === 0) return null;

  const { insights, excludedFairway } = computeClubInsights(state.played, state.shots);
  const eligible = insights.filter((i) => i.nGreen >= MIN_GREEN_FOR_INSIGHT);
  // The check holds only resolvable items: a stock discrepancy (Apply
  // resolves it) or too little data (more logs resolve it). Confirmed clubs
  // collapse into a one-line summary, and strike traits (wild spread,
  // mishit rate) live as chips on the club's arsenal row — standing
  // information, not tasks that would otherwise sit here forever.
  const attention = eligible.filter((i) => i.attention);
  const confirmed = eligible.filter((i) => !i.attention);
  const thin = insights.filter((i) => i.nGreen < MIN_GREEN_FOR_INSIGHT);

  const apply = (i: ClubInsight) => {
    const liveShot = state.shots.find((s) => s.id === i.shotId);
    if (!liveShot) return;
    dispatch({ type: 'upsertShot', shot: { ...liveShot, carry: Math.round(i.medianImplied) } });
  };

  return (
    <section className="rounded-2xl bg-turf-800 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-turf-100">Numbers check</h2>
        <InfoTip>
          <p>
            Each logged result is converted to the stock carry it implies — wind, temperature,
            altitude, stance slope and form divided back out — and the median of those is compared
            to the arsenal number. Medians shrug off mishits.
          </p>
          <p className="mt-1">
            Only results that finish on or near the green count: the release (rollout) after
            landing is estimated from the shot's trajectory and the round's green firmness and
            subtracted, so resting results measure carry — not carry plus rollout. Fairway
            landings roll over unknown turf and stay excluded. Nothing changes until you tap Apply.
          </p>
          <p className="mt-1">
            Clubs that hold up collapse into one line. Strike traits — wide spread, mishit rate —
            show as chips on the club's row below: standing information, not tasks.
          </p>
        </InfoTip>
      </div>

      {insights.length === 0 && (
        <p className="mt-2 text-xs text-turf-400">
          Not enough logged results yet. Tap a suggested club on the Play tab before a shot and
          record where the ball finished — a club shows up here once {MIN_GREEN_FOR_INSIGHT} of its
          results land on or near the green.
        </p>
      )}

      {attention.length > 0 && (
        <ul className="mt-3 space-y-2">
          {attention.map((i) => {
            const stockD = `${disp(i.stock)} ${u}`;
            const shortYd = Math.abs(disp(i.biasYd));
            const earlyTag = i.early ? ' (early signal)' : '';
            let text: string;
            let cls: string;
            if (i.deleted) {
              text = `${i.nGreen} result${i.nGreen === 1 ? '' : 's'} kept — club no longer in your arsenal.`;
              cls = 'text-turf-300';
            } else if (i.holds && !i.wild) {
              text = `Stock ${stockD} holds up over ${i.nGreen} shots${earlyTag}.`;
              cls = 'text-lime-300';
            } else if (i.holds && i.wild) {
              text = `Stock ${stockD} is right on median — the spread is the problem.`;
              cls = 'text-amber-300';
            } else if (i.biasYd < 0) {
              text = `Comes up ~${shortYd} ${u} short of stock ${stockD}${earlyTag}.`;
              cls = 'text-amber-300';
            } else {
              text = `Flies ~${shortYd} ${u} past stock ${stockD}${earlyTag}.`;
              cls = 'text-amber-300';
            }
            const showApply = !i.deleted && !i.holds && !i.early;
            return (
              <li key={i.shotId} className="rounded-xl bg-turf-700/60 px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-turf-50">
                    {i.shotName ? `${i.club} · ${i.shotName}` : i.club}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-turf-300">
                    {i.nGreen} on/near green
                  </span>
                </div>
                <div className="mt-1 flex items-start justify-between gap-2">
                  <p className={`text-sm ${cls}`}>{text}</p>
                  {showApply && (
                    <button
                      type="button"
                      onClick={() => apply(i)}
                      className="shrink-0 rounded-lg bg-lime-400 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-turf-950 active:bg-lime-300"
                    >
                      Apply {disp(i.medianImplied)} {u}
                    </button>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-turf-300">
                  spread {disp(i.iqr)} {u} middle-half
                  {i.wild && (
                    <span className="font-semibold text-amber-300"> · strike inconsistent</span>
                  )}
                  {i.strikes.mishit > 0 && (
                    <>
                      {' '}
                      · {i.strikes.mishit} mishit{i.strikes.mishit === 1 ? '' : 's'} in {i.nLogged}
                    </>
                  )}
                  {i.mishitProne && (
                    <span className="font-semibold text-amber-300"> · mishit-prone</span>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {confirmed.length > 0 && (
        <p className="mt-2 text-xs text-turf-400">
          <span className="font-semibold text-lime-300">
            ✓ {confirmed.length} club{confirmed.length === 1 ? '' : 's'} check
            {confirmed.length === 1 ? 's' : ''} out
          </span>
          {' — '}
          {confirmed
            .map((i) => (i.shotName && i.shotName !== 'Full' ? `${i.club} · ${i.shotName}` : i.club))
            .join(', ')}
          .
        </p>
      )}

      {thin.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {thin.map((i) => (
            <li key={i.shotId} className="rounded-xl bg-turf-700/40 px-3 py-2 text-xs text-turf-300">
              <span className="font-medium text-turf-200">
                {i.shotName ? `${i.club} · ${i.shotName}` : i.club}
              </span>{' '}
              — {i.nLogged} logged, {i.nGreen} on/near green · {MIN_GREEN_FOR_INSIGHT} needed for a
              check
            </li>
          ))}
        </ul>
      )}

      {excludedFairway > 0 && (
        <p className="mt-2 text-xs text-turf-400">
          {excludedFairway} fairway/rough result{excludedFairway === 1 ? '' : 's'} excluded —
          rollout makes them poor carry evidence.
        </p>
      )}
    </section>
  );
}
