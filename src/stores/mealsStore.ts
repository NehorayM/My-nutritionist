import { useMemo } from 'react'
import { create } from 'zustand'
import { compareDateKeys, todayKey, type DateKey } from '@/domain/dates'
import { gramsForQuantity } from '@/domain/nutrition'
import { formatNumber } from '@/lib/format'
import { newId } from '@/lib/id'
import { LIMITS, mealEntrySchema } from '@/schemas'
import { getRepositories } from '@/services/runtime'
import type { FoodPortion, MealEntry, MealType } from '@/types'
import { userMessageFor } from './errors'
import type { LoadStatus, SaveResult } from './profileStore'
import { registerUserStoreReset } from './registry'

/** Smallest loggable amount: below it every nutrient rounds to nothing. */
export const MIN_ENTRY_GRAMS = 0.1
/** Entries scanned for the Recent list (newest first). */
export const RECENT_ENTRY_LIMIT = 60

export interface DayLog {
  status: LoadStatus
  /** Chronological (loggedAt, then id). */
  entries: MealEntry[]
  error: string | null
}

export type MealsResult<T> = { ok: true; value: T } | { ok: false; message: string }
export type EntryChanges = Partial<Pick<MealEntry, 'quantity' | 'servingLabel' | 'servingGrams' | 'mealType'>>
export interface RecentFood {
  /** Food identity: food id, else provider source + external id, else name + brand. */
  key: string
  /** The most recently logged portion of this food. */
  portion: FoodPortion
  mealType: MealType
  loggedAt: string
}

/** Validation message for `quantity` units of `servingGrams` (null = grams), or null when loggable. */
export function portionAmountError(quantity: number | null, servingGrams: number | null): string | null {
  if (quantity === null || !Number.isFinite(quantity)) return 'Enter an amount.'
  if (quantity <= 0) return 'Enter an amount greater than 0.'
  if (servingGrams !== null && !(servingGrams > 0 && servingGrams <= LIMITS.servingGrams.max)) {
    return 'This serving size can’t be used. Choose grams or another unit.'
  }
  const grams = quantity * (servingGrams ?? 1)
  if (grams < MIN_ENTRY_GRAMS) return `That’s too small to log. Enter at least ${MIN_ENTRY_GRAMS} g.`
  if (grams > LIMITS.entryGrams.max) {
    return `That’s more than ${formatNumber(LIMITS.entryGrams.max)} g in one entry. Check the amount, or log it as separate entries.`
  }
  if (quantity > LIMITS.entryQuantity.max) return `Enter at most ${formatNumber(LIMITS.entryQuantity.max)} servings.`
  return null
}

/** The portion fields of an entry (or of any object carrying them). */
export function toPortion(source: FoodPortion): FoodPortion {
  const { foodId, foodSource, foodExternalId, foodName, brand, quantity, servingLabel, servingGrams, grams, per100g } = source
  return { foodId, foodSource, foodExternalId, foodName, brand, quantity, servingLabel, servingGrams, grams, per100g: { ...per100g } }
}

/**
 * Food identity of a portion: the provider record (so a saved USDA/Open Food Facts copy and the unsaved result
 * are one food), else the stored food id, else name + brand.
 */
export function foodKey(portion: Pick<FoodPortion, 'foodId' | 'foodSource' | 'foodExternalId' | 'foodName' | 'brand'>): string {
  if (portion.foodExternalId) return `${portion.foodSource}:${portion.foodExternalId}`
  if (portion.foodId) return `id:${portion.foodId}`
  return `name:${portion.foodName.trim().toLowerCase()}|${(portion.brand ?? '').trim().toLowerCase()}`
}

/** Recent foods from entries (newest first), one per food identity, keeping the last-used portion. */
export function recentFoods(entries: readonly MealEntry[]): RecentFood[] {
  const seen = new Map<string, RecentFood>()
  for (const entry of [...entries].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))) {
    const key = foodKey(entry)
    if (!seen.has(key)) seen.set(key, { key, portion: toPortion(entry), mealType: entry.mealType, loggedAt: entry.loggedAt })
  }
  return [...seen.values()]
}

const byLogged = (a: MealEntry, b: MealEntry) => a.loggedAt.localeCompare(b.loggedAt) || a.id.localeCompare(b.id)
const newestFirst = (a: MealEntry, b: MealEntry) => -byLogged(a, b)
const fail = (message: string) => ({ ok: false, message }) as const

interface MealsState {
  /** Day shown on the Meals screen; null follows today. */
  selectedDate: DateKey | null
  days: Record<DateKey, DayLog>
  recentEntries: MealEntry[]
  recentStatus: LoadStatus
  /** Future dates fall back to today. */
  selectDate: (date: DateKey | null) => void
  /** Loads one day; a no-op while that day is loading or loaded, unless `force`. */
  load: (date: DateKey, options?: { force?: boolean }) => Promise<void>
  loadRecent: () => Promise<void>
  /** Logs portions (one or several, e.g. a saved meal) to a meal of `date`; returns the new entries. */
  addPortions: (portions: readonly FoodPortion[], mealType: MealType, date: DateKey) => Promise<MealsResult<MealEntry[]>>
  /** Changes amount, unit or meal; the nutrition snapshot is kept. */
  updateEntry: (id: string, changes: EntryChanges) => Promise<MealsResult<MealEntry>>
  /** Returns the removed entry (for Undo). */
  deleteEntry: (id: string) => Promise<MealsResult<MealEntry>>
  restoreEntry: (entry: MealEntry) => Promise<SaveResult>
  /** Logs a copy of `mealType` from `fromDate` into the same meal of `toDate` ("repeat yesterday"). */
  copyMeal: (fromDate: DateKey, toDate: DateKey, mealType: MealType) => Promise<MealsResult<MealEntry[]>>
  reset: () => void
}

const initial = { selectedDate: null, days: {}, recentEntries: [], recentStatus: 'idle' as LoadStatus }
let generation = 0
const loadTokens = new Map<DateKey, number>()

export const useMealsStore = create<MealsState>()((set, get) => {
  function setDay(date: DateKey, day: DayLog): void {
    set((state) => ({ days: { ...state.days, [date]: day } }))
  }

  /** Puts `entry` in its day (when that day is cached) and the recent list; `null` removes `id` everywhere. */
  function place(id: string, entry: MealEntry | null): void {
    set((state) => {
      const days: Record<DateKey, DayLog> = {}
      for (const [date, day] of Object.entries(state.days)) {
        const rest = day.entries.filter((existing) => existing.id !== id)
        const entries = entry?.date === date ? [...rest, entry].sort(byLogged) : rest
        days[date] = entries.length === day.entries.length && entry?.date !== date ? day : { ...day, entries }
      }
      const others = state.recentEntries.filter((existing) => existing.id !== id)
      const recentEntries = (entry ? [...others, entry].sort(newestFirst) : others).slice(0, RECENT_ENTRY_LIMIT)
      return { days, recentEntries }
    })
  }

  function findEntry(id: string): MealEntry | undefined {
    for (const day of Object.values(get().days)) {
      const found = day.entries.find((entry) => entry.id === id)
      if (found) return found
    }
    return get().recentEntries.find((entry) => entry.id === id)
  }

  /** Optimistic save of one entry; restores `before` (or removes the entry) when it fails. */
  async function persist(entry: MealEntry, before: MealEntry | null, action: string): Promise<MealsResult<MealEntry>> {
    if (!mealEntrySchema.safeParse(entry).success) return fail('Some details of this entry are invalid. Please check the amount.')
    place(entry.id, entry)
    try {
      const saved = await getRepositories().meals.save(entry)
      place(saved.id, saved)
      return { ok: true, value: saved }
    } catch (error) {
      place(entry.id, before)
      return fail(userMessageFor(error, action))
    }
  }

  return {
    ...initial,

    selectDate(date) {
      set({ selectedDate: date === null || compareDateKeys(date, todayKey()) >= 0 ? null : date })
    },

    async load(date, options = {}) {
      const current = get().days[date]
      if (!options.force && (current?.status === 'ready' || current?.status === 'loading')) return
      const token = (loadTokens.get(date) ?? 0) + 1
      const run = generation
      loadTokens.set(date, token)
      const stale = () => run !== generation || loadTokens.get(date) !== token
      setDay(date, { status: 'loading', entries: current?.entries ?? [], error: null })
      try {
        const entries = await getRepositories().meals.listByDate(date)
        if (!stale()) setDay(date, { status: 'ready', entries: entries.sort(byLogged), error: null })
      } catch (error) {
        if (!stale()) setDay(date, { status: 'error', entries: current?.entries ?? [], error: userMessageFor(error, 'load your meals') })
      }
    },

    async loadRecent() {
      const run = generation
      set({ recentStatus: 'loading' })
      try {
        const entries = await getRepositories().meals.listRecent(RECENT_ENTRY_LIMIT)
        if (run === generation) set({ recentEntries: entries.sort(newestFirst), recentStatus: 'ready' })
      } catch (error) {
        userMessageFor(error, 'load your recent foods')
        if (run === generation) set({ recentStatus: 'error' })
      }
    },

    async addPortions(portions, mealType, date) {
      if (portions.length === 0) return fail('There’s nothing to log.')
      if (compareDateKeys(date, todayKey()) > 0) return fail('Meals can be logged for today or earlier days.')
      for (const portion of portions) {
        const problem = portionAmountError(portion.quantity, portion.servingGrams) ?? portionAmountError(portion.grams, null)
        if (problem) return fail(portions.length > 1 ? `${portion.foodName}: ${problem}` : problem)
      }
      const userId = getRepositories().userId
      const nowMs = Date.now()
      const created: MealEntry[] = []
      for (const [index, portion] of portions.entries()) {
        const stamp = new Date(nowMs + index).toISOString()
        const entry: MealEntry = { ...toPortion(portion), id: newId(), userId, date, mealType, loggedAt: stamp, createdAt: stamp, updatedAt: stamp }
        const result = await persist(entry, null, 'save the food')
        if (!result.ok) {
          for (const saved of created) await get().deleteEntry(saved.id)
          return result
        }
        created.push(result.value)
      }
      return { ok: true, value: created }
    },

    async updateEntry(id, changes) {
      const existing = findEntry(id)
      if (!existing) return fail('This entry is no longer available.')
      const next = { ...existing, ...changes }
      const problem = portionAmountError(next.quantity, next.servingGrams)
      if (problem) return fail(problem)
      const grams = gramsForQuantity(next.quantity, next.servingGrams)
      return persist({ ...next, grams, updatedAt: new Date().toISOString() }, existing, 'update the entry')
    },

    async deleteEntry(id) {
      const existing = findEntry(id)
      if (!existing) return fail('This entry is no longer available.')
      place(id, null)
      try {
        await getRepositories().meals.remove(id)
        return { ok: true, value: existing }
      } catch (error) {
        place(id, existing)
        return fail(userMessageFor(error, 'remove the entry'))
      }
    },

    async restoreEntry(entry) {
      const result = await persist({ ...entry, updatedAt: new Date().toISOString() }, null, 'restore the entry')
      return result.ok ? { ok: true } : result
    },

    async copyMeal(fromDate, toDate, mealType) {
      const cached = get().days[fromDate]
      let source: MealEntry[]
      try {
        source = cached?.status === 'ready' ? cached.entries : await getRepositories().meals.listByDate(fromDate)
      } catch (error) {
        return fail(userMessageFor(error, 'copy the meal'))
      }
      const portions = source.filter((entry) => entry.mealType === mealType).sort(byLogged).map(toPortion)
      if (portions.length === 0) return fail('There’s nothing logged in that meal to copy.')
      return get().addPortions(portions, mealType, toDate)
    },

    reset() {
      generation += 1
      loadTokens.clear()
      set(initial)
    },
  }
})

registerUserStoreReset(() => useMealsStore.getState().reset())

/** Recent foods derived from the store's recent entries (memoized). */
export function useRecentFoods(): RecentFood[] {
  const entries = useMealsStore((s) => s.recentEntries)
  return useMemo(() => recentFoods(entries), [entries])
}
