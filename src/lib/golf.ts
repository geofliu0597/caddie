import type { Conditions, Factors, Settings, Shot, Trajectory, UnitsSystem } from '../types';

/**
 * The plays-like model.
 *
 * A shot's stock `carry` is defined under STANDARD CONDITIONS:
 *   no wind · 20°C (68°F) · sea level.
 *
 * On the course:
 *  - The distance to cover is entered directly — a slope-adjusted laser
 *    reading is ideal, since elevation is already baked into that number.
 *    The app never adjusts for slope itself, so nothing is double-counted.
 *  - WIND changes how far each shot flies: a percentage scaled by trajectory
 *    (high-flying shots are affected more than punch shots).
 *  - TEMPERATURE and COURSE ALTITUDE are per-round settings (Settings tab)
 *    that scale every shot's flight.
 *
 * effective carry(shot) = stock carry × wind × temperature × altitude
 * The best shot minimizes |effective carry − distance to cover|, with
 * overshoots penalized (flying the green is worse than coming up short).
 */
export const DEFAULT_FACTORS: Factors = {
  headwindPctPerMph: 0.8,
  tailwindPctPerMph: 0.45,
  tempPctPerDegF: 0.15,
  altPctPer1000Ft: 2,
  slopePctPerDeg: 1,
  overshootPenalty: 1.5,
};

/** How strongly wind affects a shot, relative to a normal ball flight. */
export const TRAJECTORY_WIND: Record<Trajectory, number> = { low: 0.65, mid: 1.0, high: 1.3 };

/** Standard-conditions temperature baseline: 20°C / 68°F — round in both unit systems. */
export const BASELINE_TEMP_F = 68;

/**
 * Returns `v` when it is a real finite number, else `fallback`.
 * Used at every state boundary so a half-migrated or malformed state can
 * never turn into NaN on screen or in the model.
 */
export function finiteOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export const TRAJECTORY_LABEL: Record<Trajectory, string> = { low: 'Low', mid: 'Mid', high: 'High' };
export const SHAPE_LABEL: Record<Shot['shape'], string> = { straight: 'Straight', draw: 'Draw', fade: 'Fade' };

// ---- units (internal distances are always yards) ---------------------------

export const YARDS_PER_METER = 1.09361;

export function toDisplayYards(yd: number, units: 'yd' | 'm'): number {
  return units === 'yd' ? yd : yd / YARDS_PER_METER;
}

export function fromDisplayYards(v: number, units: 'yd' | 'm'): number {
  return units === 'yd' ? v : v * YARDS_PER_METER;
}

export function fmtDist(yd: number, units: 'yd' | 'm'): string {
  return `${Math.round(toDisplayYards(yd, units))} ${units}`;
}

// ---- conditions units (°C/km/h/m vs °F/mph/ft — internal stays °F/mph/ft) --

export const KMH_PER_MPH = 1.609344;
export const METERS_PER_FOOT = 0.3048;

export function tempToDisplay(tempF: number, sys: UnitsSystem): number {
  return sys === 'metric' ? ((tempF - 32) * 5) / 9 : tempF;
}

export function tempFromDisplay(v: number, sys: UnitsSystem): number {
  return sys === 'metric' ? (v * 9) / 5 + 32 : v;
}

export function windToDisplay(mph: number, sys: UnitsSystem): number {
  return sys === 'metric' ? mph * KMH_PER_MPH : mph;
}

export function windFromDisplay(v: number, sys: UnitsSystem): number {
  return sys === 'metric' ? v / KMH_PER_MPH : v;
}

export function altToDisplay(ft: number, sys: UnitsSystem): number {
  return sys === 'metric' ? ft * METERS_PER_FOOT : ft;
}

export function altFromDisplay(v: number, sys: UnitsSystem): number {
  return sys === 'metric' ? v / METERS_PER_FOOT : v;
}

export const WIND_UNIT = (sys: UnitsSystem) => (sys === 'metric' ? 'km/h' : 'mph');
export const TEMP_UNIT = (sys: UnitsSystem) => (sys === 'metric' ? '°C' : '°F');
export const ALT_UNIT = (sys: UnitsSystem) => (sys === 'metric' ? 'm' : 'ft');

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// ---- wind ------------------------------------------------------------------

const rad = (deg: number) => (deg * Math.PI) / 180;

export interface WindParts {
  /** + = helping (tailwind component). */
  tail: number;
  /** + = hurting (headwind component). */
  head: number;
  /** + = pushes the ball right (wind blowing left→right). */
  crossRight: number;
}

export function windComponents(c: Conditions): WindParts {
  const speed = finiteOr(c?.windSpeed, 0);
  const dir = finiteOr(c?.windDir, 0);
  const tail = speed * Math.cos(rad(dir));
  const crossRight = speed * Math.sin(rad(dir));
  return { tail, head: -tail, crossRight };
}

/**
 * Human description of the wind, as separate components so callers can lay
 * them out on their own lines (or join with ' + ' inline).
 */
export function windLabel(c: Conditions, sys: UnitsSystem = 'imperial'): string[] {
  const speed = finiteOr(c?.windSpeed, 0);
  if (speed < 2) return ['Calm'];
  const { tail, head, crossRight } = windComponents(c);
  const w = (mph: number) => `${Math.round(windToDisplay(mph, sys))} ${WIND_UNIT(sys)}`;
  const parts: string[] = [];
  if (tail >= 0.2 * speed) parts.push(`${w(tail)} tailwind`);
  if (head >= 0.2 * speed) parts.push(`${w(head)} headwind`);
  const cross = Math.abs(crossRight);
  if (cross >= 0.2 * speed) {
    parts.push(`${w(cross)} ${crossRight > 0 ? 'left → right' : 'right → left'}`);
  }
  if (parts.length === 0) parts.push(`${w(speed)} quartering`);
  return parts;
}

// ---- the model -------------------------------------------------------------

export interface ShotEstimate {
  shot: Shot;
  /** How far this shot flies in the current conditions. */
  effectiveCarry: number;
  /** + = flies past the number to cover, − = comes up short. Yards. */
  diff: number;
  /** Ranking cost (overshoots penalized). */
  score: number;
  /** Net wind effect applied to this shot, %. */
  windPct: number;
}

export function estimateShot(shot: Shot, c: Conditions, settings: Settings): ShotEstimate {
  const f = settings.factors ?? DEFAULT_FACTORS;
  const { head } = windComponents(c);
  const k =
    head >= 0
      ? finiteOr(f.headwindPctPerMph, DEFAULT_FACTORS.headwindPctPerMph)
      : finiteOr(f.tailwindPctPerMph, DEFAULT_FACTORS.tailwindPctPerMph);
  const sens = shot.windSensitivity ?? TRAJECTORY_WIND[shot.trajectory] ?? TRAJECTORY_WIND.mid;
  const windPct = clamp(-head * k * sens, -40, 40);
  const tempPct =
    (finiteOr(settings.tempF, BASELINE_TEMP_F) - BASELINE_TEMP_F) *
    finiteOr(f.tempPctPerDegF, DEFAULT_FACTORS.tempPctPerDegF);
  const altPct =
    (finiteOr(settings.courseAltFt, 0) / 1000) *
    finiteOr(f.altPctPer1000Ft, DEFAULT_FACTORS.altPctPer1000Ft);
  // Uphill (+slopeDeg) makes the ball land on rising ground — shorter carry;
  // downhill lets it run past the flat-carry point — longer.
  const slopePct =
    -finiteOr(c.slopeDeg, 0) * finiteOr(f.slopePctPerDeg, DEFAULT_FACTORS.slopePctPerDeg);
  const effectiveCarry =
    finiteOr(shot.carry, 0) *
    (1 + windPct / 100) *
    (1 + tempPct / 100) *
    (1 + altPct / 100) *
    (1 + slopePct / 100);
  const diff = effectiveCarry - finiteOr(c.pinDistance, 0);
  const score = diff >= 0 ? diff * finiteOr(f.overshootPenalty, DEFAULT_FACTORS.overshootPenalty) : -diff;
  return { shot, effectiveCarry, diff, score, windPct };
}

export function rankShots(shots: Shot[], c: Conditions, settings: Settings): ShotEstimate[] {
  return shots
    .filter((s) => s.carry > 0 && s.club.toLowerCase() !== 'putter')
    .map((s) => estimateShot(s, c, settings))
    .sort((a, b) => a.score - b.score);
}

/** Rough start-line offset for a crosswind, in yards. Aim this far into the wind. */
export function crossAimYards(effectiveCarryYd: number, crossRightMph: number): number {
  return Math.abs(crossRightMph) * (effectiveCarryYd / 150) * 0.8;
}

// ---- labels ----------------------------------------------------------------

/** Short club label for the distance ladder ("Driver" → "D", "7 Iron" → "7i"). */
export function clubAbbrev(club: string): string {
  const c = club.trim();
  const lw = c.toLowerCase();
  if (lw.startsWith('driver')) return 'D';
  if (lw.startsWith('pitching')) return 'PW';
  if (lw.startsWith('gap')) return 'GW';
  if (lw.startsWith('sand')) return 'SW';
  if (lw.startsWith('lob')) return 'LW';
  const m = c.match(/^(\d+)\s*(w|h|i)/i);
  if (m) return m[1] + (m[2].toLowerCase() === 'i' ? 'i' : m[2].toUpperCase());
  if (lw.includes('wood')) return 'W';
  if (lw.includes('hybrid')) return 'H';
  if (lw.includes('iron')) return 'I';
  return c.slice(0, 3);
}
