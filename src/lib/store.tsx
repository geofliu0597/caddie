import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { AppState, Conditions, Factors, Settings, Shape, Shot, Trajectory } from '../types';
import { BASELINE_TEMP_F, DEFAULT_FACTORS, clamp, finiteOr } from './golf';

const STORAGE_KEY = 'caddie-state-v1';
export const STATE_VERSION = 1;

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

export function freshState(): AppState {
  return {
    version: STATE_VERSION,
    shots: sampleShots(),
    conditions: { pinDistance: 150, windSpeed: 0, windDir: 0, slopeDeg: 0 },
    settings: {
      units: 'yd',
      unitsSystem: 'metric',
      tempF: BASELINE_TEMP_F,
      courseAltFt: 0,
      formPct: 0,
      factors: { ...DEFAULT_FACTORS },
    },
  };
}

export type AppAction =
  | { type: 'setConditions'; patch: Partial<Conditions> }
  | { type: 'setSettings'; patch: Partial<Settings> }
  | { type: 'setFactors'; patch: Partial<Factors> }
  | { type: 'upsertShot'; shot: Shot }
  | { type: 'deleteShot'; id: string }
  | { type: 'deleteSampleShots' }
  | { type: 'replaceAll'; state: AppState };

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'setConditions':
      return { ...state, conditions: { ...state.conditions, ...action.patch } };
    case 'setSettings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'setFactors':
      return {
        ...state,
        settings: { ...state.settings, factors: { ...state.settings.factors, ...action.patch } },
      };
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
      return { ...state, shots: state.shots.filter((s) => !s.sample) };
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
  const f = (st.factors ?? {}) as Partial<Factors>;
  const tempF = finiteOr(st.tempF, BASELINE_TEMP_F);
  return {
    version: STATE_VERSION,
    shots: raw.shots.map(normalizeShot).filter((s): s is Shot => s !== null),
    conditions: {
      pinDistance: clamp(finiteOr(c.pinDistance, base.conditions.pinDistance), 0, 400),
      windSpeed: clamp(finiteOr(c.windSpeed, 0), 0, 40),
      windDir: ((finiteOr(c.windDir, 0) % 360) + 360) % 360,
      slopeDeg: clamp(finiteOr(c.slopeDeg, 0), -30, 30),
    },
    settings: {
      units: st.units === 'm' ? 'm' : 'yd',
      unitsSystem: st.unitsSystem === 'imperial' ? 'imperial' : 'metric',
      // Migrate the pre-68°F default (70) so existing installs land on the
      // clean 20°C / 68°F baseline too.
      tempF: tempF === 70 ? BASELINE_TEMP_F : tempF,
      courseAltFt: finiteOr(st.courseAltFt, 0),
      formPct: clamp(finiteOr(st.formPct, 0), -20, 20),
      factors: {
        headwindPctPerMph: finiteOr(f.headwindPctPerMph, DEFAULT_FACTORS.headwindPctPerMph),
        tailwindPctPerMph: finiteOr(f.tailwindPctPerMph, DEFAULT_FACTORS.tailwindPctPerMph),
        tempPctPerDegF: finiteOr(f.tempPctPerDegF, DEFAULT_FACTORS.tempPctPerDegF),
        altPctPer1000Ft: finiteOr(f.altPctPer1000Ft, DEFAULT_FACTORS.altPctPer1000Ft),
        slopePctPerDeg: finiteOr(f.slopePctPerDeg, DEFAULT_FACTORS.slopePctPerDeg),
        overshootPenalty: finiteOr(f.overshootPenalty, DEFAULT_FACTORS.overshootPenalty),
      },
    },
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
