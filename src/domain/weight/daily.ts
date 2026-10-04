import type { WeightEntry } from '@/types'
import { compareDateKeys, isDateKey } from '@/domain/dates'
import type { DailyWeight } from './types'

type DailyCandidate = Pick<WeightEntry, 'id' | 'date' | 'measuredAt' | 'weightKg'>

/** Unparseable timestamps sort after every real instant of the same day. */
function instantOf(measuredAt: string): number {
  const ms = Date.parse(measuredAt)
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms
}

function isUsable(entry: DailyCandidate): boolean {
  return Number.isFinite(entry.weightKg) && entry.weightKg > 0 && isDateKey(entry.date)
}

/** True when `a` should represent the day instead of `b`: earlier instant, then smaller id. */
function precedes(a: DailyCandidate, b: DailyCandidate): boolean {
  const diff = instantOf(a.measuredAt) - instantOf(b.measuredAt)
  if (diff !== 0 && !Number.isNaN(diff)) return diff < 0
  return a.id < b.id
}

/**
 * One value per local day, ascending by date.
 *
 * Same-day rule: the EARLIEST measurement of the local day (`entry.date`) by its `measuredAt` instant —
 * the morning weigh-in is the most comparable day to day. Equal instants are broken by id (ascending), so
 * the result never depends on input order. Entries with a non-finite or non-positive weight or an invalid
 * date key are ignored; an unparseable `measuredAt` ranks after every valid one of the same day.
 */
export function selectDailyWeights(entries: readonly DailyCandidate[]): DailyWeight[] {
  const byDate = new Map<string, { chosen: DailyCandidate; count: number }>()
  for (const entry of entries) {
    if (!isUsable(entry)) continue
    const day = byDate.get(entry.date)
    if (!day) {
      byDate.set(entry.date, { chosen: entry, count: 1 })
      continue
    }
    day.count += 1
    if (precedes(entry, day.chosen)) day.chosen = entry
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => compareDateKeys(a, b))
    .map(([date, { chosen, count }]) => ({
      date,
      weightKg: chosen.weightKg,
      entryId: chosen.id,
      measurementCount: count,
    }))
}

/** Daily values dated on or before `today`. */
export function dailyWeightsThrough(entries: readonly DailyCandidate[], today: string): DailyWeight[] {
  return selectDailyWeights(entries).filter((day) => compareDateKeys(day.date, today) <= 0)
}
