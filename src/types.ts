export type Trajectory = 'low' | 'mid' | 'high';
export type Shape = 'straight' | 'draw' | 'fade';

/** One shot in your arsenal — a club + swing combination you can call on. */
export interface Shot {
  id: string;
  club: string; // "Driver", "7 Iron", "Lob Wedge", ...
  name: string; // "Full", "Punch", "Flop", "Knockdown ¾", ...
  /** Stock carry distance under "standard conditions" (no wind, 20°C/68°F, sea level). Yards. */
  carry: number;
  /** Optional total distance (carry + rollout). Yards. */
  total?: number | null;
  trajectory: Trajectory;
  shape: Shape;
  /** Override for how much wind affects this shot (1 = normal). Null = derived from trajectory. */
  windSensitivity?: number | null;
  notes?: string;
  /** Marks rows that came from the built-in sample arsenal. */
  sample?: boolean;
}

/** The per-swing situation the shot needs to cover. Distances stored in yards internally. */
export interface Conditions {
  /** Distance to cover, yards. A slope-adjusted laser reading is ideal — elevation is already baked in. */
  pinDistance: number;
  /** Wind speed, mph. */
  windSpeed: number;
  /** Direction the wind blows TOWARD, degrees. 0 = toward the green (tailwind), 90 = left-to-right, 180 = back at you (headwind). */
  windDir: number;
  /** Slope of the ground under the golfer's feet, degrees. + = uphill stance (adds loft — about the same carry, lands steep and stops), − = downhill (delofts — carries less, rolls much more). */
  slopeDeg: number;
  /**
   * Which miss the golfer prefers when no shot lands exact: 'short' penalizes
   * overshoots when ranking (default — trouble long of the green), 'long'
   * penalizes undershoots instead (trouble short, e.g. a front bunker). The
   * other side is penalized at a fixed 2× (OVERSHOOT_PENALTY in golf.ts).
   */
  missPref: 'short' | 'long';
}

/** Units for wind / temperature / altitude display. Metric is the default. */
export type UnitsSystem = 'metric' | 'imperial';

// ---- played-shot log -------------------------------------------------------

/** Where the ball finished, relative to the pin. */
export type FinishTag = 'short' | 'atPin' | 'past';

/** What the ball finished lying in — the situation the observation came from. */
export type SituationTag = 'green' | 'fringe' | 'fairway' | 'rough' | 'other';

/** Self-reported strike quality. Noisy mid-round — used for strike-rate stats, never for calibration math. */
export type StrikeTag = 'flush' | 'solid' | 'mishit';

export type PlayedSource = 'course';

/**
 * Raw post-shot observation. Only what is directly observable on course is
 * entered: where the ball STOPPED relative to the pin (laser, pacing, or the
 * next chip/putt length). Carry is derived in analysis — never entered —
 * because for shots that finish on/near the green, resting shortfall ≈ carry
 * shortfall (irons land steep and stop).
 */
export interface PlayedObservation {
  /** Resting distance to the pin, yards. 0 = at pin. */
  restingYd: number;
  finish: FinishTag;
  situation: SituationTag;
  strike: StrikeTag;
}

/**
 * One logged attempt: the frozen pre-shot state plus the raw post-shot
 * observation. The golfer taps "Hitting this" before the shot (freezing the
 * snapshot) and records the result at their ball (~10 seconds).
 */
export interface PlayedShot {
  id: string;
  ts: number;
  shotId: string;
  /** Club/name copied at log time, so the record survives arsenal edits and deletions. */
  club: string;
  shotName: string;
  source: PlayedSource;
  /** Conditions + round settings at the moment the shot was marked — the half of the data that must be captured pre-shot. */
  snapshot: {
    conditions: Conditions;
    tempF: number;
    courseAltFt: number;
    formPct: number;
  };
  /** Model output at shot time. Recomputable, but stored so later model changes can't rewrite history. */
  predicted: {
    effectiveCarry: number;
    diff: number;
    windPct: number;
  };
  /** Null while pending (pre-shot) and for archived pick-only records (a new shot was marked before the result was entered). */
  observation: PlayedObservation | null;
}

export interface Settings {
  /** Golf distance units — yards by default; golf is played in yards almost everywhere. */
  units: 'yd' | 'm';
  unitsSystem: UnitsSystem;
  /** Round conditions, set once per round in Settings — not per swing. Stored in °F internally. */
  tempF: number;
  /** Course elevation above sea level, feet (affects how far the ball flies). */
  courseAltFt: number;
  /** Day form, % — how you're striking it today vs. the baseline arsenal numbers. −20..+20. */
  formPct: number;
  /** Opt-in played-shot logging on the Play screen. Off by default — it must never add steps for golfers who don't want it. */
  logShots: boolean;
}

export interface AppState {
  version: number;
  shots: Shot[];
  conditions: Conditions;
  settings: Settings;
  /** Finished log records (oldest first). */
  played: PlayedShot[];
  /** The shot marked "Hitting this" but not yet given a result — at most one at a time. */
  pendingShot: PlayedShot | null;
}
