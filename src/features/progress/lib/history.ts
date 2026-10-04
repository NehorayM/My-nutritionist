import { compareDateKeys } from '@/domain/dates'
import { selectDailyWeights } from '@/domain/weight'
import type { WeightEntry } from '@/types'

export interface HistoryItem {
  entry: WeightEntry
  /** This is the day's value on the chart (the weight engine's same-day rule). */
  usedInChart: boolean
}

export interface HistoryDay {
  date: string
  items: HistoryItem[]
}

function instant(entry: WeightEntry): number {
  const ms = Date.parse(entry.measuredAt)
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms
}

/** Weigh-ins grouped by local date, newest day first and newest measurement first within a day. */
export function groupHistory(entries: readonly WeightEntry[]): HistoryDay[] {
  const chosen = new Set(selectDailyWeights(entries).map((day) => day.entryId))
  const byDate = new Map<string, WeightEntry[]>()
  for (const entry of entries) {
    const list = byDate.get(entry.date)
    if (list) list.push(entry)
    else byDate.set(entry.date, [entry])
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => compareDateKeys(b, a))
    .map(([date, list]) => ({
      date,
      items: [...list]
        .sort((a, b) => instant(b) - instant(a) || (a.id < b.id ? 1 : -1))
        .map((entry) => ({ entry, usedInChart: chosen.has(entry.id) })),
    }))
}

/** The weigh-in the chart uses for `date` (earliest of the day), or null when there is none. */
export function firstWeighInOn(entries: readonly WeightEntry[], date: string): WeightEntry | null {
  const sameDay = entries.filter((entry) => entry.date === date)
  const day = selectDailyWeights(sameDay)[0]
  return day ? (sameDay.find((entry) => entry.id === day.entryId) ?? null) : null
}
