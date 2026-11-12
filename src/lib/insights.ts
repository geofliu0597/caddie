import type { PlayedShot, Shot } from '../types';

/**
 * The analysis layer over the played-shot log — the "Numbers check".
 *
 * Method:
 *  - Only results that finished ON or NEAR the green count as carry evidence:
 *    irons land steep and stop, so resting shortfall ≈ carry shortfall (a
 *    small stable release bias is accepted as noise). Fairway/rough landings
 *    roll an unknown, condition-dependent amount — excluded from the math and
 *    reported separately.
 *  - Each green result is converted to the STOCK carry it implies:
 *      implied stock = travel × stockAtLog / predicted effectiveCarry
 *    which divides the log-time conditions (wind, temperature, altitude,
 *    stance slope, form) back out — a shot hit in a headwind is not misread
 *    as a short club.
 *  - The MEDIAN of the implied stocks is robust to mishits, so strike tags
 *    are reported (strike-rate stats) but never filter or weight the math.
 *  - Suggestions are shown, never auto-applied: applying updates the
 *    golfer's arsenal entry via an explicit tap.
 */

/** Green-finish results before a club earns a row in the check. */
export const MIN_GREEN_FOR_INSIGHT = 3;
/** Green-finish results before Apply is offered (below this: early signal, display only). */
export const MIN_GREEN_FOR_APPLY = 5;
/** |bias| below this % of stock = the number holds up. */
export const HOLD_BIAS_PCT = 3;
/** IQR above this % of the median = strike inconsistency, not a number problem. */
export const WILD_SPREAD_PCT = 10;

export interface ClubInsight {
  shotId: string;
  club: string;
  shotName: string;
  /** Live arsenal carry, or 0 when the shot has since been deleted (row becomes display-only). */
  stock: number;
  deleted: boolean;
  /** Logged results for this shot with a recorded outcome (any lie). */
  nLogged: number;
  strikes: { flush: number; solid: number; mishit: number };
  /** The carry-comparable subset — finished on or near the green. */
  nGreen: number;
  /** Median implied stock carry of the green subset. Yards. */
  medianImplied: number;
  /** Interquartile range of the same subset. Yards. */
  iqr: number;
  /** medianImplied − stock, yards. + = flies past stock. */
  biasYd: number;
  biasPct: number;
  /** |bias| inside HOLD_BIAS_PCT — the arsenal number holds up. */
  holds: boolean;
  /** Wide shot-to-shot spread — inconsistency, not a number problem. */
  wild: boolean;
  /** A third or more of logged results were mishits. */
  mishitProne: boolean;
  /** Not enough green results yet for a suggestion. */
  early: boolean;
}

export interface InsightsResult {
  insights: ClubInsight[];
  /** Results excluded from the carry math for finishing in fairway/rough/other. */
  excludedFairway: number;
}

/** Linear-interpolated quantile (numpy-style) — stable for the small n here. */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function computeClubInsights(played: PlayedShot[], shots: Shot[]): InsightsResult {
  const live = new Map(shots.map((s) => [s.id, s]));
  const groups = new Map<string, PlayedShot[]>();
  let excludedFairway = 0;
  for (const p of played) {
    if (!p.observation) continue; // pick-only records carry no result
    if (p.observation.situation !== 'green' && p.observation.situation !== 'fringe') {
      excludedFairway++;
    }
    const arr = groups.get(p.shotId);
    if (arr) arr.push(p);
    else groups.set(p.shotId, [p]);
  }

  const insights: ClubInsight[] = [];
  for (const [shotId, records] of groups) {
    const liveShot = live.get(shotId);
    const newest = records[records.length - 1];
    const stock = liveShot ? liveShot.carry : 0;
    const strikes = { flush: 0, solid: 0, mishit: 0 };
    const greenImplied: number[] = [];
    for (const p of records) {
      const o = p.observation!;
      strikes[o.strike]++;
      if (o.situation !== 'green' && o.situation !== 'fringe') continue;
      const signed =
        o.finish === 'short' ? -o.restingYd : o.finish === 'past' ? o.restingYd : 0;
      const travel = p.snapshot.conditions.pinDistance + signed;
      // stockCarry recorded at log time; fall back to the live arsenal number
      // for records created before that field existed.
      const stockAtLog =
        p.predicted.stockCarry > 0 ? p.predicted.stockCarry : (liveShot?.carry ?? 0);
      const eff = p.predicted.effectiveCarry;
      if (travel <= 0 || stockAtLog <= 0 || eff <= 0) continue;
      greenImplied.push((travel * stockAtLog) / eff);
    }

    const sorted = [...greenImplied].sort((a, b) => a - b);
    const medianImplied = quantile(sorted, 0.5);
    const iqr = quantile(sorted, 0.75) - quantile(sorted, 0.25);
    const biasYd = medianImplied - stock;
    const biasPct = stock > 0 ? (biasYd / stock) * 100 : 0;
    insights.push({
      shotId,
      club: liveShot ? liveShot.club : newest.club,
      shotName: liveShot ? liveShot.name : newest.shotName,
      stock,
      deleted: !liveShot,
      nLogged: records.length,
      strikes,
      nGreen: greenImplied.length,
      medianImplied,
      iqr,
      biasYd,
      biasPct,
      holds: Math.abs(biasPct) < HOLD_BIAS_PCT,
      wild: medianImplied > 0 && (iqr / medianImplied) * 100 > WILD_SPREAD_PCT,
      mishitProne: records.length >= 3 && strikes.mishit / records.length >= 1 / 3,
      early: greenImplied.length < MIN_GREEN_FOR_APPLY,
    });
  }

  // Actionable clubs first (worst bias at the top), then the not-enough-data
  // rows as quiet encouragement to keep logging.
  insights.sort((a, b) => {
    const aE = a.nGreen >= MIN_GREEN_FOR_INSIGHT ? 0 : 1;
    const bE = b.nGreen >= MIN_GREEN_FOR_INSIGHT ? 0 : 1;
    if (aE !== bE) return aE - bE;
    if (aE === 1) return b.nGreen - a.nGreen || b.nLogged - a.nLogged;
    return Math.abs(b.biasPct) - Math.abs(a.biasPct) || b.nGreen - a.nGreen;
  });

  return { insights, excludedFairway };
}
