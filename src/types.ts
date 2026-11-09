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
  /** Slope of the ground under the golfer's feet, degrees. + = uphill stance (adds loft, plays shorter), − = downhill (delofts, plays longer). */
  slopeDeg: number;
}

/** Tunable constants for the model. See README for what each does. */
export interface Factors {
  headwindPctPerMph: number;
  tailwindPctPerMph: number;
  tempPctPerDegF: number;
  altPctPer1000Ft: number;
  /** Carry change per degree of uphill slope to the green. */
  slopePctPerDeg: number;
  /** Overshoots are worse than coming up short — this multiplies the "flies past" penalty when ranking. */
  overshootPenalty: number;
}

/** Units for wind / temperature / altitude display. Metric is the default. */
export type UnitsSystem = 'metric' | 'imperial';

export interface Settings {
  /** Golf distance units — yards by default; golf is played in yards almost everywhere. */
  units: 'yd' | 'm';
  unitsSystem: UnitsSystem;
  /** Round conditions, set once per round in Settings — not per swing. Stored in °F internally. */
  tempF: number;
  /** Course elevation above sea level, feet (affects how far the ball flies). */
  courseAltFt: number;
  factors: Factors;
}

export interface AppState {
  version: number;
  shots: Shot[];
  conditions: Conditions;
  settings: Settings;
}
