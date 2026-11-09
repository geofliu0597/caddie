import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { AppState, Conditions, Factors, Settings, Shot } from '../types';
import { DEFAULT_FACTORS } from './golf';

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
    conditions: { pinDistance: 150, windSpeed: 0, windDir: 0 },
    settings: { units: 'yd', tempF: 70, courseAltFt: 0, factors: { ...DEFAULT_FACTORS } },
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
      return action.state;
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      const base = freshState();
      if (
        parsed &&
        Array.isArray(parsed.shots) &&
        parsed.conditions &&
        parsed.settings &&
        parsed.settings.factors
      ) {
        return {
          ...base,
          ...parsed,
          version: STATE_VERSION,
          settings: {
            ...base.settings,
            ...parsed.settings,
            factors: { ...DEFAULT_FACTORS, ...parsed.settings.factors },
          },
        };
      }
    }
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
