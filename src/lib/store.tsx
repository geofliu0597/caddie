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
/** 2 — played-shot log (played, pendingShot, settings.logShots). */
export const STATE_VERSION = 2;

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
    conditions: { pinDistance: 150, windSpeed: 0, windDir: 0, slopeDeg: 0, missPref: 'short' },
    settings: {
      units: 'yd',
      unitsSystem: 'metric',
      tempF: BASELINE_TEMP_F,
      courseAltFt: 0,
      formPct: 0,
      logShots: false,
    },
    played: [],
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
  return {
    version: STATE_VERSION,
    shots: raw.shots.map(normalizeShot).filter((s): s is Shot => s !== null),
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
      // v1 backups) means off.
      logShots: st.logShots === true,
    },
    played: Array.isArray(raw.played)
      ? raw.played.map(normalizePlayedShot).filter((p): p is PlayedShot => p !== null)
      : [],
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
