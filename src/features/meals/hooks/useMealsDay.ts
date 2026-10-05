import { useEffect, useMemo } from 'react'
import { addDays, type DateKey } from '@/domain/dates'
import { aggregateDay, micronutrientCoverage, type DailyTargets, type DayTotals, type MicronutrientCoverage } from '@/domain/nutrition'
import { useDailyTargets } from '@/stores/derived'
import { useMealsStore } from '@/stores/mealsStore'
import type { LoadStatus } from '@/stores/profileStore'
import type { MealEntry } from '@/types'

const NO_ENTRIES: MealEntry[] = []

export interface MealsDay {
  date: DateKey
  status: LoadStatus
  error: string | null
  entries: MealEntry[]
  totals: DayTotals
  targets: DailyTargets
  coverage: MicronutrientCoverage
  /** Entries of the day before (empty until loaded): powers "Repeat yesterday's …". */
  previousEntries: MealEntry[]
  retry: () => void
}

/** Loads `date` and the day before, and derives totals, targets and micronutrient coverage (never stored). */
export function useMealsDay(date: DateKey): MealsDay {
  const previousDate = addDays(date, -1)
  const day = useMealsStore((s) => s.days[date])
  const previous = useMealsStore((s) => s.days[previousDate])
  const dayMissing = day === undefined
  const previousMissing = previous === undefined

  // An absent day (first visit, or the store was reset for another user) loads afresh.
  useEffect(() => {
    if (dayMissing) void useMealsStore.getState().load(date)
  }, [date, dayMissing])
  useEffect(() => {
    if (previousMissing) void useMealsStore.getState().load(previousDate)
  }, [previousDate, previousMissing])

  const entries = day?.entries ?? NO_ENTRIES
  const targets = useDailyTargets(date)
  const totals = useMemo(() => aggregateDay(date, entries), [date, entries])
  const coverage = useMemo(() => micronutrientCoverage(targets, totals.totals, entries), [targets, totals, entries])

  return {
    date,
    status: day?.status ?? 'loading',
    error: day?.error ?? null,
    entries,
    totals,
    targets,
    coverage,
    previousEntries: previous?.status === 'ready' ? previous.entries : NO_ENTRIES,
    retry: () => void useMealsStore.getState().load(date, { force: true }),
  }
}
