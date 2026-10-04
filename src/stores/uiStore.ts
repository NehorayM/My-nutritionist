import { z } from 'zod'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { addDays, isDateKey, todayKey, type DateKey } from '@/domain/dates'

/**
 * UI preferences that live only on this device: theme, and suggestions the user dismissed.
 * Persisted to localStorage under `mn.ui`; every storage access is fault-tolerant
 * (private mode, blocked storage, quota) and falls back to in-memory state.
 */
export const UI_STORAGE_KEY = 'mn.ui'
export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const
export type ThemePreference = (typeof THEME_PREFERENCES)[number]
export type ResolvedTheme = 'light' | 'dark'

/** Dismissals older than this many days (relative to today) are dropped. */
export const DISMISSAL_RETENTION_DAYS = 14

/** Dismissed ids keyed by a local date (recommendations) or a week-start date (catch-up). */
export type DismissalMap = Record<DateKey, readonly string[]>

const NONE: readonly string[] = Object.freeze([])

interface UiPersistedState {
  theme: ThemePreference
  dismissedRecommendations: DismissalMap
  dismissedCatchUps: DismissalMap
}

export interface UiState extends UiPersistedState {
  setTheme: (theme: ThemePreference) => void
  dismissRecommendation: (date: DateKey, id: string) => void
  restoreRecommendation: (date: DateKey, id: string) => void
  /** Stable reference: safe to use directly as a Zustand selector result. */
  dismissedFor: (date: DateKey) => readonly string[]
  dismissCatchUp: (weekStart: DateKey, id: string) => void
  restoreCatchUp: (weekStart: DateKey, id: string) => void
  dismissedCatchUpsFor: (weekStart: DateKey) => readonly string[]
  /** Drop dismissals keyed before `today − DISMISSAL_RETENTION_DAYS`. */
  pruneDismissals: (today?: DateKey) => void
}

/** Removes entries with invalid keys or keys older than the retention window. */
export function pruneDismissalMap(map: DismissalMap, today: DateKey): DismissalMap {
  const cutoff = addDays(today, -DISMISSAL_RETENTION_DAYS)
  const kept: Record<DateKey, readonly string[]> = {}
  let changed = false
  for (const [key, ids] of Object.entries(map)) {
    if (isDateKey(key) && key >= cutoff && ids.length > 0) kept[key] = ids
    else changed = true
  }
  return changed ? kept : map
}

function withId(map: DismissalMap, key: DateKey, id: string): DismissalMap {
  const current = map[key] ?? NONE
  return current.includes(id) ? map : { ...map, [key]: [...current, id] }
}

function withoutId(map: DismissalMap, key: DateKey, id: string): DismissalMap {
  const current = map[key]
  if (!current?.includes(id)) return map
  const next = current.filter((existing) => existing !== id)
  const copy = { ...map }
  if (next.length > 0) copy[key] = next
  else delete copy[key]
  return copy
}

function safeLocalStorage(): StateStorage {
  return {
    getItem: (name) => {
      try {
        return window.localStorage.getItem(name)
      } catch {
        return null
      }
    },
    setItem: (name, value) => {
      try {
        window.localStorage.setItem(name, value)
      } catch {
        // Storage blocked or full: preferences stay in memory for this session.
      }
    },
    removeItem: (name) => {
      try {
        window.localStorage.removeItem(name)
      } catch {
        // Nothing to clean up when storage is unavailable.
      }
    },
  }
}

const themeSchema = z.enum(THEME_PREFERENCES)
const dismissalMapSchema = z.record(z.string(), z.array(z.string()))

/** Validates untrusted stored data field by field; anything invalid keeps the current value. */
function mergePersisted(persisted: unknown, current: UiState): UiState {
  if (persisted === null || typeof persisted !== 'object') return current
  const stored = persisted as Record<string, unknown>
  const theme = themeSchema.safeParse(stored.theme)
  const recommendations = dismissalMapSchema.safeParse(stored.dismissedRecommendations)
  const catchUps = dismissalMapSchema.safeParse(stored.dismissedCatchUps)
  const today = todayKey()
  return {
    ...current,
    theme: theme.success ? theme.data : current.theme,
    dismissedRecommendations: pruneDismissalMap(
      recommendations.success ? recommendations.data : current.dismissedRecommendations,
      today,
    ),
    dismissedCatchUps: pruneDismissalMap(catchUps.success ? catchUps.data : current.dismissedCatchUps, today),
  }
}

const initialState: UiPersistedState = {
  theme: 'system',
  dismissedRecommendations: {},
  dismissedCatchUps: {},
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      ...initialState,
      setTheme: (theme) => set({ theme }),
      dismissRecommendation: (date, id) =>
        set((state) => ({
          dismissedRecommendations: pruneDismissalMap(withId(state.dismissedRecommendations, date, id), todayKey()),
        })),
      restoreRecommendation: (date, id) =>
        set((state) => ({ dismissedRecommendations: withoutId(state.dismissedRecommendations, date, id) })),
      dismissedFor: (date) => get().dismissedRecommendations[date] ?? NONE,
      dismissCatchUp: (weekStart, id) =>
        set((state) => ({
          dismissedCatchUps: pruneDismissalMap(withId(state.dismissedCatchUps, weekStart, id), todayKey()),
        })),
      restoreCatchUp: (weekStart, id) =>
        set((state) => ({ dismissedCatchUps: withoutId(state.dismissedCatchUps, weekStart, id) })),
      dismissedCatchUpsFor: (weekStart) => get().dismissedCatchUps[weekStart] ?? NONE,
      pruneDismissals: (today = todayKey()) =>
        set((state) => ({
          dismissedRecommendations: pruneDismissalMap(state.dismissedRecommendations, today),
          dismissedCatchUps: pruneDismissalMap(state.dismissedCatchUps, today),
        })),
    }),
    {
      name: UI_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(safeLocalStorage),
      partialize: (state): UiPersistedState => ({
        theme: state.theme,
        dismissedRecommendations: state.dismissedRecommendations,
        dismissedCatchUps: state.dismissedCatchUps,
      }),
      // Stored data is untrusted (older versions, manual edits): validate, then prune.
      merge: mergePersisted,
    },
  ),
)

/** Restores defaults (used by "reset local data" and tests). */
export function resetUiStore(): void {
  useUiStore.setState({ ...initialState })
}
