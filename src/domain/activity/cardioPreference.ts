import { addDays, compareDateKeys } from '@/domain/dates'
import type { WorkoutEntry } from '@/types'
import { CATCH_UP_CARDIO_TYPES, DEFAULT_CARDIO_TYPE, RECENT_WINDOW_DAYS } from './constants'
import type { CatchUpCardioType } from './constants'
import { countsToward } from './progress'

function isCatchUpCardioType(type: string): type is CatchUpCardioType {
  return (CATCH_UP_CARDIO_TYPES as readonly string[]).includes(type)
}

interface TypeUsage {
  type: CatchUpCardioType
  count: number
  lastDate: string
}

/**
 * Cardio types the person actually does, most preferred first: counted cardio sessions within the last
 * 14 days up to `today`, ranked by frequency, then by the most recent session, then by the fixed type order.
 * HIIT is never returned (it always counts as a vigorous session, and catch-up suggestions stay moderate).
 */
export function rankCardioTypes(history: readonly WorkoutEntry[], today: string): CatchUpCardioType[] {
  const from = addDays(today, -(RECENT_WINDOW_DAYS - 1))
  const usage = new Map<CatchUpCardioType, TypeUsage>()
  for (const workout of history) {
    if (compareDateKeys(workout.date, from) < 0 || compareDateKeys(workout.date, today) > 0) continue
    if (countsToward(workout) !== 'cardio' || !isCatchUpCardioType(workout.type)) continue
    const current = usage.get(workout.type)
    usage.set(workout.type, {
      type: workout.type,
      count: (current?.count ?? 0) + 1,
      lastDate: current && compareDateKeys(current.lastDate, workout.date) > 0 ? current.lastDate : workout.date,
    })
  }
  return [...usage.values()]
    .sort(
      (a, b) =>
        b.count - a.count ||
        compareDateKeys(b.lastDate, a.lastDate) ||
        CATCH_UP_CARDIO_TYPES.indexOf(a.type) - CATCH_UP_CARDIO_TYPES.indexOf(b.type),
    )
    .map((entry) => entry.type)
}

/**
 * Preferred cardio type plus a different variant for the "cardio variant" alternative. Without history the
 * preference is a brisk walk; without a second type in the history the variant is a walk, or — for people
 * who mostly walk — an open "cardio session" they can do any way they like.
 */
export function cardioChoices(
  history: readonly WorkoutEntry[],
  today: string,
): { preferred: CatchUpCardioType; variant: CatchUpCardioType } {
  const ranked = rankCardioTypes(history, today)
  const preferred = ranked[0] ?? DEFAULT_CARDIO_TYPE
  const variant = ranked[1] ?? (preferred === 'walk' ? 'cardio' : 'walk')
  return { preferred, variant }
}
