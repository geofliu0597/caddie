import type { Conditions, Factors, Settings, Shot, Trajectory } from '../types';

/**
 * The plays-like model.
 *
 * A shot's stock `carry` is defined under STANDARD CONDITIONS:
 *   no wind · flat lie-to-green · 70°F · sea level.
 *
 * On the course:
 *  - WIND changes how far each shot flies (percentage, scaled by trajectory:
 *    high-flying shots are affected more than punch shots).
 *  - TEMPERATURE and COURSE ALTITUDE scale every shot's flight.
 *  - ELEVATION CHANGE to the green changes the REQUIRED carry, not the shot.
 *
 * required carry = pin distance + elevation adjustment
 * effective carry(shot) = stock carry × wind × temperature × altitude
 * The best shot minimizes |effective − required|, with overshoots penalized
 * (flying the green is worse than coming up short).
 */
export const DEFAULT_FACTORS: Factors = {
  headwindPctPerMph: 0.8,
  tailwindPctPerMph: 0.45,
  tempPctPerDegF: 0.15,
  altPctPer1000Ft: 2,
  elevUpYdPerFt: 1.0,
  elevDownYdPerFt: 0.5,
  overshootPenalty: 1.5,
};

/** How strongly wind affects a shot, relative to a normal ball flight. */
export const TRAJECTORY_WIND: Record<Trajectory, number> = { low: 0.65, mid: 1.0, high: 1.3 };

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
  const tail = c.windSpeed * Math.cos(rad(c.windDir));
  const crossRight = c.windSpeed * Math.sin(rad(c.windDir));
  return { tail, head: -tail, crossRight };
}

export function windLabel(c: Conditions): string {
  if (c.windSpeed < 2) return 'Calm';
  const { tail, head, crossRight } = windComponents(c);
  const parts: string[] = [];
  if (tail >= 0.2 * c.windSpeed) parts.push(`${Math.round(tail)} mph tailwind`);
  if (head >= 0.2 * c.windSpeed) parts.push(`${Math.round(head)} mph headwind`);
  const cross = Math.abs(crossRight);
  if (cross >= 0.2 * c.windSpeed) {
    parts.push(`${Math.round(cross)} mph ${crossRight > 0 ? 'left → right' : 'right → left'}`);
  }
  if (parts.length === 0) parts.push(`${c.windSpeed} mph quartering`);
  return parts.join(' + ');
}

// ---- the model -------------------------------------------------------------

export function elevationYards(c: Conditions, f: Factors): number {
  return c.elevationFt >= 0 ? c.elevationFt * f.elevUpYdPerFt : c.elevationFt * f.elevDownYdPerFt;
}

export function requiredCarry(c: Conditions, f: Factors): number {
  return Math.max(0, c.pinDistance + elevationYards(c, f));
}

export function isStockConditions(c: Conditions): boolean {
  return c.windSpeed < 2 && c.elevationFt === 0 && c.tempF === 70;
}

export interface ShotEstimate {
  shot: Shot;
  /** How far this shot flies in the current conditions. */
  effectiveCarry: number;
  /** + = flies past the required carry, − = comes up short. Yards. */
  diff: number;
  /** Ranking cost (overshoots penalized). */
  score: number;
  /** Net wind effect applied to this shot, %. */
  windPct: number;
}

export function estimateShot(shot: Shot, c: Conditions, settings: Settings): ShotEstimate {
  const f = settings.factors;
  const { head } = windComponents(c);
  const k = head >= 0 ? f.headwindPctPerMph : f.tailwindPctPerMph;
  const sens = shot.windSensitivity ?? TRAJECTORY_WIND[shot.trajectory];
  const windPct = clamp(-head * k * sens, -40, 40);
  const tempPct = (c.tempF - 70) * f.tempPctPerDegF;
  const altPct = (settings.courseAltFt / 1000) * f.altPctPer1000Ft;
  const effectiveCarry = shot.carry * (1 + windPct / 100) * (1 + tempPct / 100) * (1 + altPct / 100);
  const diff = effectiveCarry - requiredCarry(c, f);
  const score = diff >= 0 ? diff * f.overshootPenalty : -diff;
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
