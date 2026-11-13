import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type {
  AppState,
  Conditions,
  FinishTag,
  PlayedObservation,
  PlayedShot,
  Settings,
  Shape,
  Shot,
  SituationTag,
  StrikeTag,
  Trajectory,
} from '../types';
import { BASELINE_TEMP_F, clamp, finiteOr } from './golf';

const STORAGE_KEY = 'caddie-state-v1';
/** 2 — played-shot log. 3 — records store the log-time stock carry. 4 — sample shot log + one-time demo injection. */
export const STATE_VERSION = 4;

export function newShotId(): string {
  return `s${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

/** Placeholder arsenal so the app demonstrates itself — replace with real numbers. */
function sampleShots(): Shot[] {
  const s = (
    club: string,
    name: string,
    carry: number,
    total: number | null,
    trajectory: Shot['trajectory'],
    shape: Shot['shape'] = 'straight',
  ): Shot => ({ id: newShotId(), club, name, carry, total, trajectory, shape, sample: true });
  return [
    s('Driver', 'Full', 230, 255, 'mid', 'fade'),
    s('3 Wood', 'Full', 205, 225, 'mid'),
    s('5 Wood', 'Full', 190, 205, 'mid'),
    s('4 Hybrid', 'Full', 180, 192, 'mid'),
    s('5 Iron', 'Full', 172, 182, 'mid'),
    s('6 Iron', 'Full', 162, 170, 'mid'),
    s('7 Iron', 'Full', 152, 159, 'mid'),
    s('8 Iron', 'Full', 142, 148, 'mid'),
    s('9 Iron', 'Full', 128, 134, 'mid'),
    s('Pitching Wedge', 'Full', 112, 118, 'mid'),
    s('Gap Wedge', 'Full', 98, 102, 'mid'),
    s('Sand Wedge', 'Full', 72, 76, 'mid'),
    s('Lob Wedge', 'Full', 52, 55, 'mid'),
    s('Lob Wedge', 'Flop', 38, null, 'high'),
    s('7 Iron', 'Punch', 132, 138, 'low'),
    s('Pitching Wedge', 'Knockdown ¾', 94, 98, 'low'),
    s('Sand Wedge', 'Bunker shot', 60, 64, 'high'),
  ];
}

/**
 * Sample played-shot log — the demo data behind the Numbers check. Every
 * verdict state the analysis can produce is represented: a short-biased club
 * with an Apply suggestion, one holding up, a wild/inconsistent one, a
 * mishit-prone one, and a club with too little data. All records are marked
 * sample (deleteSampleShots clears them) and all are logged under clean
 * baseline conditions so the implied-stock math is exact: implied = travel.
 */
function samplePlayed(shots: Shot[]): PlayedShot[] {
  const pick = (club: string, name: string): Shot => {
    const s = shots.find((x) => x.club === club && x.name === name);
    if (!s) throw new Error(`sample log: missing shot ${club} ${name}`);
    return s;
  };
  let seq = 0;
  const mk = (
    shot: Shot,
    daysAgo: number,
    pin: number,
    finish: FinishTag,
    restingYd: number,
    situation: SituationTag,
    strike: StrikeTag,
  ): PlayedShot => {
    seq++;
    const eff = shot.carry; // clean baseline conditions — every factor is 1
    return {
      id: newShotId(),
      ts: Date.now() - daysAgo * 86400000 - seq * 3600000,
      shotId: shot.id,
      club: shot.club,
      shotName: shot.name,
      source: 'course',
      sample: true,
      snapshot: {
        conditions: { pinDistance: pin, windSpeed: 0, windDir: 0, slopeDeg: 0, missPref: 'short' },
        tempF: BASELINE_TEMP_F,
        courseAltFt: 0,
        formPct: 0,
      },
      predicted: { stockCarry: shot.carry, effectiveCarry: eff, diff: eff - pin, windPct: 0 },
      observation: { restingYd, finish, situation, strike },
    };
  };
  const sixI = pick('6 Iron', 'Full');
  const eightI = pick('8 Iron', 'Full');
  const threeW = pick('3 Wood', 'Full');
  const flop = pick('Lob Wedge', 'Flop');
  const punch = pick('7 Iron', 'Punch');
  return [
    // 6 Iron — stock 162, green median 155 → "comes up ~7 short" + Apply 155
    mk(sixI, 20, 162, 'short', 9, 'green', 'solid'),
    mk(sixI, 16, 160, 'short', 6, 'green', 'solid'),
    mk(sixI, 13, 161, 'short', 6, 'green', 'flush'),
    mk(sixI, 9, 163, 'short', 7, 'green', 'solid'),
    mk(sixI, 6, 162, 'short', 5, 'green', 'solid'),
    // 8 Iron — stock 142 holds up (+ one fairway result, excluded from carry math)
    mk(eightI, 19, 142, 'atPin', 0, 'green', 'flush'),
    mk(eightI, 15, 144, 'short', 4, 'green', 'solid'),
    mk(eightI, 11, 143, 'short', 1, 'green', 'flush'),
    mk(eightI, 8, 142, 'past', 1, 'green', 'solid'),
    mk(eightI, 5, 141, 'short', 1, 'green', 'solid'),
    mk(eightI, 3, 142, 'short', 6, 'fairway', 'solid'),
    // 3 Wood — median right on 205, spread wild: inconsistency, not the number
    mk(threeW, 18, 205, 'short', 20, 'green', 'solid'),
    mk(threeW, 12, 202, 'short', 6, 'green', 'solid'),
    mk(threeW, 10, 205, 'atPin', 0, 'green', 'flush'),
    mk(threeW, 7, 202, 'past', 15, 'green', 'solid'),
    mk(threeW, 2, 198, 'past', 30, 'green', 'mishit'),
    // Lob Wedge flop — number fine, mishit-prone
    mk(flop, 21, 38, 'short', 1, 'green', 'flush'),
    mk(flop, 14, 38, 'atPin', 0, 'green', 'solid'),
    mk(flop, 10, 41, 'short', 3, 'green', 'mishit'),
    mk(flop, 6, 38, 'past', 1, 'green', 'solid'),
    mk(flop, 3, 40, 'short', 3, 'green', 'mishit'),
    mk(flop, 1, 37, 'past', 1, 'green', 'mishit'),
    // 7 Iron punch — too little data for a check
    mk(punch, 8, 130, 'short', 8, 'green', 'solid'),
    mk(punch, 4, 132, 'short', 10, 'rough', 'solid'),
  ];
}

export function freshState(): AppState {
  const shots = sampleShots();
  return {
    version: STATE_VERSION,
    shots,
    conditions: { pinDistance: 150, windSpeed: 0, windDir: 0, slopeDeg: 0, missPref: 'short' },
    settings: {
      units: 'yd',
      unitsSystem: 'metric',
      tempF: BASELINE_TEMP_F,
      courseAltFt: 0,
      formPct: 0,
      // Demo state ships with logging on so the whole loop is visible on
      // first run; anyone who doesn't want it flips one toggle.
      logShots: true,
    },
    played: samplePlayed(shots),
    pendingShot: null,
  };
}

export type AppAction =
  | { type: 'setConditions'; patch: Partial<Conditions> }
  | { type: 'setSettings'; patch: Partial<Settings> }
  | { type: 'upsertShot'; shot: Shot }
  | { type: 'deleteShot'; id: string }
  | { type: 'deleteSampleShots' }
  | { type: 'markHitting'; played: PlayedShot }
  | { type: 'saveObservation'; observation: PlayedObservation }
  | { type: 'discardPending' }
  | { type: 'clearPlayed' }
  | { type: 'replaceAll'; state: AppState };

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'setConditions':
      return { ...state, conditions: { ...state.conditions, ...action.patch } };
    case 'setSettings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'markHitting':
      // One pending shot at a time — an unrecorded previous one is kept as a
      // pick-only record (observation null) rather than silently dropped.
      return {
        ...state,
        played: state.pendingShot ? [...state.played, state.pendingShot] : state.played,
        pendingShot: action.played,
      };
    case 'saveObservation': {
      if (!state.pendingShot) return state;
      return {
        ...state,
        played: [...state.played, { ...state.pendingShot, observation: action.observation }],
        pendingShot: null,
      };
    }
    case 'discardPending':
      return { ...state, pendingShot: null };
    case 'clearPlayed':
      return { ...state, played: [] };
    case 'upsertShot': {
      const exists = state.shots.some((s) => s.id === action.shot.id);
      return {
        ...state,
        shots: exists
          ? state.shots.map((s) => (s.id === action.shot.id ? action.shot : s))
          : [...state.shots, action.shot],
      };
    }
    case 'deleteShot':
      return { ...state, shots: state.shots.filter((s) => s.id !== action.id) };
    case 'deleteSampleShots':
      // Samples span the arsenal AND the shot log — one button clears both.
      return {
        ...state,
        shots: state.shots.filter((s) => !s.sample),
        played: state.played.filter((p) => !p.sample),
        pendingShot: state.pendingShot?.sample ? null : state.pendingShot,
      };
    case 'replaceAll':
      return normalizeState(action.state);
  }
}

const TRAJECTORIES: Trajectory[] = ['low', 'mid', 'high'];
const SHAPES: Shape[] = ['straight', 'draw', 'fade'];

/** Coerce any shot object (old saved shapes, imported files) into a valid Shot. */
function normalizeShot(raw: unknown): Shot | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  const club = typeof s.club === 'string' ? s.club.trim() : '';
  if (!club) return null;
  const carry = finiteOr(s.carry, 0);
  const total = finiteOr(s.total, 0);
  const sens = finiteOr(s.windSensitivity, 0);
  return {
    id: typeof s.id === 'string' && s.id ? s.id : newShotId(),
    club,
    name: typeof s.name === 'string' && s.name.trim() ? s.name.trim() : 'Full',
    carry,
    total: total > 0 ? total : null,
    trajectory: TRAJECTORIES.includes(s.trajectory as Trajectory) ? (s.trajectory as Trajectory) : 'mid',
    shape: SHAPES.includes(s.shape as Shape) ? (s.shape as Shape) : 'straight',
    windSensitivity: sens > 0 ? sens : null,
    notes: typeof s.notes === 'string' && s.notes ? s.notes : undefined,
    sample: s.sample === true,
  };
}

const FINISHES: FinishTag[] = ['short', 'atPin', 'past'];
const SITUATIONS: SituationTag[] = ['green', 'fringe', 'fairway', 'rough', 'other'];
const STRIKES: StrikeTag[] = ['flush', 'solid', 'mishit'];

/** Coerce any played-shot record (old saves, imported backups) into a valid PlayedShot. */
function normalizePlayedShot(raw: unknown): PlayedShot | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const snap = (p.snapshot ?? {}) as Record<string, unknown>;
  const cond = (snap.conditions ?? {}) as Partial<Conditions>;
  const pred = (p.predicted ?? {}) as Record<string, unknown>;
  const obs = (p.observation ?? null) as Record<string, unknown> | null;
  const club = typeof p.club === 'string' ? p.club.trim() : '';
  return {
    id: typeof p.id === 'string' && p.id ? p.id : newShotId(),
    ts: finiteOr(p.ts, Date.now()),
    shotId: typeof p.shotId === 'string' ? p.shotId : '',
    club: club || 'Unknown',
    shotName: typeof p.shotName === 'string' ? p.shotName.trim() : '',
    source: 'course',
    snapshot: {
      conditions: {
        // Historical raw data — no UI snapping (unlike live conditions), just
        // finite fallbacks so analysis never sees NaN.
        pinDistance: Math.max(0, finiteOr(cond.pinDistance, 0)),
        windSpeed: clamp(finiteOr(cond.windSpeed, 0), 0, 40),
        windDir: ((finiteOr(cond.windDir, 0) % 360) + 360) % 360,
        slopeDeg: finiteOr(cond.slopeDeg, 0),
        missPref: cond.missPref === 'long' ? 'long' : 'short',
      },
      tempF: finiteOr(snap.tempF, BASELINE_TEMP_F),
      courseAltFt: finiteOr(snap.courseAltFt, 0),
      formPct: clamp(finiteOr(snap.formPct, 0), -20, 20),
    },
    predicted: {
      stockCarry: Math.max(0, finiteOr(pred.stockCarry, 0)),
      effectiveCarry: finiteOr(pred.effectiveCarry, 0),
      diff: finiteOr(pred.diff, 0),
      windPct: finiteOr(pred.windPct, 0),
    },
    observation:
      obs && typeof obs === 'object'
        ? {
            restingYd: Math.max(0, finiteOr(obs.restingYd, 0)),
            finish: FINISHES.includes(obs.finish as FinishTag) ? (obs.finish as FinishTag) : 'short',
            situation: SITUATIONS.includes(obs.situation as SituationTag)
              ? (obs.situation as SituationTag)
              : 'other',
            strike: STRIKES.includes(obs.strike as StrikeTag) ? (obs.strike as StrikeTag) : 'solid',
          }
        : null,
    sample: p.sample === true,
  };
}

/**
 * Coerce anything (an old localStorage shape, an imported backup, a
 * half-migrated in-memory state) into a fully valid AppState. Every numeric
 * field gets a finite fallback, so the UI and the model can never see NaN —
 * whatever happened before, the app always renders a sane baseline.
 */
/** Exported for tests — also the single choke-point every state entry uses. */
export function normalizeState(input: unknown): AppState {
  const base = freshState();
  if (!input || typeof input !== 'object') return base;
  const raw = input as Partial<AppState>;
  if (!Array.isArray(raw.shots)) return base;
  const c = (raw.conditions ?? {}) as Partial<Conditions>;
  const st = (raw.settings ?? {}) as Partial<Settings>;
  const tempF = finiteOr(st.tempF, BASELINE_TEMP_F);
  const shots = raw.shots.map(normalizeShot).filter((s): s is Shot => s !== null);
  const playedIn = Array.isArray(raw.played)
    ? raw.played.map(normalizePlayedShot).filter((p): p is PlayedShot => p !== null)
    : [];
  // One-time demo migration: pre-v4 installs that still run the untouched
  // sample arsenal get the sample shot log injected too, so the Numbers
  // check demo appears for existing users. Runs once — the save persists as
  // v4 (and never fires for real arsenals or non-empty logs).
  const preDemo =
    finiteOr(raw.version, 0) < 4 &&
    shots.length > 0 &&
    shots.every((s) => s.sample === true) &&
    playedIn.length === 0;
  return {
    version: STATE_VERSION,
    shots,
    conditions: {
      pinDistance: clamp(finiteOr(c.pinDistance, base.conditions.pinDistance), 0, 400),
      windSpeed: clamp(finiteOr(c.windSpeed, 0), 0, 40),
      windDir: ((finiteOr(c.windDir, 0) % 360) + 360) % 360,
      // Snap to the slider's 5° notches (±20° — the model caps out inside
      // that on both sides) — values from older saves get pulled onto one so
      // the slider, graphic and model always agree.
      slopeDeg: clamp(Math.round(finiteOr(c.slopeDeg, 0) / 5) * 5, -20, 20),
      // Anything other than 'long' (including missing, from older saves) ranks
      // with the default preference: come up short.
      missPref: c.missPref === 'long' ? 'long' : 'short',
    },
    settings: {
      units: st.units === 'm' ? 'm' : 'yd',
      unitsSystem: st.unitsSystem === 'imperial' ? 'imperial' : 'metric',
      // Migrate the pre-68°F default (70) so existing installs land on the
      // clean 20°C / 68°F baseline too.
      tempF: tempF === 70 ? BASELINE_TEMP_F : tempF,
      courseAltFt: finiteOr(st.courseAltFt, 0),
      formPct: clamp(finiteOr(st.formPct, 0), -20, 20),
      // Opt-in feature — anything but an explicit true (older saves, imported
      // v1 backups) means off; the demo migration turns it on.
      logShots: st.logShots === true || preDemo,
    },
    played: preDemo ? samplePlayed(shots) : playedIn,
    pendingShot: raw.pendingShot != null ? normalizePlayedShot(raw.pendingShot) : null,
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch {
    // corrupt or unavailable storage — fall through to a fresh state
  }
  return freshState();
}

interface Store {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

const StoreContext = createContext<Store | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full or blocked — the app still works for this session
    }
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useApp(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
