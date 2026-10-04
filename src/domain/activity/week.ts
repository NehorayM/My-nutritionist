import { addDays, compareDateKeys, daysBetween, isDateKey, startOfWeek } from '@/domain/dates'
import { DAYS_PER_WEEK } from './constants'
import type { WeekWindow } from './types'

/**
 * The local calendar week containing `today` (YYYY-MM-DD), starting on Sunday (0) or Monday (1).
 * Throws a RangeError for a malformed date key.
 */
export function getWeekWindow(today: string, weekStartsOn: 0 | 1): WeekWindow {
  if (!isDateKey(today)) throw new RangeError(`Invalid date key: ${today}`)
  const start = startOfWeek(today, weekStartsOn)
  const daysElapsed = daysBetween(start, today)
  return {
    start,
    end: addDays(start, DAYS_PER_WEEK - 1),
    today,
    daysElapsed,
    daysRemaining: DAYS_PER_WEEK - daysElapsed,
  }
}

/** True when a valid date key falls inside the week (start and end inclusive). */
export function isInWeek(date: string, week: Pick<WeekWindow, 'start' | 'end'>): boolean {
  return isDateKey(date) && compareDateKeys(date, week.start) >= 0 && compareDateKeys(date, week.end) <= 0
}
