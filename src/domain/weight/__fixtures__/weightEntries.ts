import type { WeightEntry } from '@/types'
import { addDays } from '@/domain/dates'
import type { DailyWeight } from '../types'

/** A weigh-in on a local date; measured at 07:00 UTC unless overridden. Ids are deterministic. */
export function weighIn(date: string, weightKg: number, overrides: Partial<WeightEntry> = {}): WeightEntry {
  const measuredAt = overrides.measuredAt ?? `${date}T07:00:00.000Z`
  return {
    id: `w-${date}-${weightKg}`,
    userId: 'user-1',
    date,
    measuredAt,
    weightKg,
    inputUnit: 'kg',
    note: null,
    createdAt: measuredAt,
    updatedAt: measuredAt,
    ...overrides,
  }
}

/** Weigh-ins on consecutive days from `start`; a null value skips that day. */
export function weighInSeries(start: string, values: readonly (number | null)[]): WeightEntry[] {
  return values.flatMap((value, index) => (value === null ? [] : [weighIn(addDays(start, index), value)]))
}

/** A selected daily value, as produced by selectDailyWeights. */
export function day(date: string, weightKg: number): DailyWeight {
  return { date, weightKg, entryId: `w-${date}`, measurementCount: 1 }
}
