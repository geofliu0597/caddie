export type Trajectory = 'low' | 'mid' | 'high';
export type Shape = 'straight' | 'draw' | 'fade';

/** One shot in your arsenal — a club + swing combination you can call on. */
export interface Shot {
  id: string;
  club: string; // "Driver", "7 Iron", "Lob Wedge", ...
  name: string; // "Full", "Punch", "Flop", "Knockdown ¾", ...
  /** Stock carry distance under "standard conditions" (no wind, flat, 70°F, sea level). Yards. */
  carry: number;
  /** Optional total distance (carry + rollout). Yards. */
  total?: number | null;
  trajectory: Trajectory;
  shape: Shape;
  /** Override for how much wind affects this shot (1 = normal). Null = derived from trajectory. */
  windSensitivity?: number | null;
  notes?: string;
  /** Marks rows that came from the built-in sample data. */
  sample?: boolean;
}

/** The situation the shot needs to cover. Distances/elevations stored in yards/feet internally. */
export interface Conditions {
  /** Distance to the pin (yards). */
  pinDistance: number;
  /** Elevation of green relative to ball, feet. Positive = uphill (plays longer). */
  elevationFt: number;
  /** Wind speed, mph. */
  windSpeed: number;
  /** Direction the wind blows TOWARD, degrees. 0 = toward the green (tailwind), 90 = left-to-right, 180 = back at you (headwind). */
  windDir: number;
  /** Temperature, °F (baseline 70). */
  tempF: number;
}

/** Tunable constants for the plays-like model. See README for what each does. */
export interface Factors {
  headwindPctPerMph: number;
  tailwindPctPerMph: number;
  tempPctPerDegF: number;
  altPctPer1000Ft: number;
  elevUpYdPerFt: number;
  elevDownYdPerFt: number;
  /** Overshoots are worse than coming up short — this multiplies the "flies past" penalty when ranking. */
  overshootPenalty: number;
}

export interface Settings {
  units: 'yd' | 'm';
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
